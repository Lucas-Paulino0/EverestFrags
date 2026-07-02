"""
Router — upload e parse assíncrono de arquivos .dem do CS2

POST /api/demo/parse   → valida, salva temp, cria job, retorna {job_id, status} IMEDIATAMENTE
                         o parse roda em segundo plano (FastAPI BackgroundTasks)
GET  /api/demo/status/{job_id} → retorna {status, ...result} quando pronto

Fluxo:
  1. Admin faz upload do .dem
  2. Endpoint valida (magic bytes, tamanho) e retorna job_id em < 1s
  3. Background task: parse → resolve players → salva resultado em demo_jobs.result
  4. Frontend faz polling GET /api/demo/status/{job_id} a cada 2s
  5. Quando status = "done", frontend preenche a tabela de stats
"""

import logging
import os
import tempfile
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.limiter import limiter
from app.models.demo_job import DemoJob
from app.models.player import Player
from app.services.auth_service import require_admin
from app.services.player_service import get_or_create_by_steam

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/demo", tags=["demo"])

MAX_SIZE_MB = 750
_PBDEMS2_MAGIC = b"PBDEMS2\x00"
_GZIP_MAGIC    = b"\x1f\x8b"


def _decompress_if_needed(content: bytes) -> bytes:
    if len(content) >= 2 and content[:2] == _GZIP_MAGIC:
        import gzip
        return gzip.decompress(content)
    return content


def _resolve_players(result: dict, db: Session) -> dict:
    """Casa cada player do demo com sua conta via steam_id (cria se necessário).
    Mutates result in-place e devolve o mesmo dict."""
    created_players: list = []
    inactive_players: list = []
    player_id_by_steamid: dict[str, int] = {}

    for p in result["players"]:
        steam_id = p.get("steam_id")
        if not steam_id:
            p["player_id"] = None
            continue
        player, created = get_or_create_by_steam(db, steam_id, fallback_nickname=p["nickname"])
        p["player_id"] = player.id
        p["nickname"] = player.nickname
        player_id_by_steamid[steam_id] = player.id
        if created:
            created_players.append({"id": player.id, "nickname": player.nickname, "steam_id": steam_id})
        elif not player.is_active:
            inactive_players.append({"id": player.id, "nickname": player.nickname, "steam_id": steam_id})

    result["created_players"] = created_players
    result["inactive_players"] = inactive_players

    matchups = []
    for m in result.get("matchups", []):
        pid = player_id_by_steamid.get(m["player_steamid"])
        oid = player_id_by_steamid.get(m["opponent_steamid"])
        if pid and oid:
            matchups.append({"player_id": pid, "opponent_id": oid,
                             "kills": m["kills"], "flash_assists": m["flash_assists"]})
    result["matchups"] = matchups
    return result


def _run_parse(job_id: str, tmp_path: str) -> None:
    """Background task: descomprime se necessário, parseia, resolve players, salva resultado."""
    db = SessionLocal()
    decompressed_path: str | None = None
    try:
        # Verifica magic bytes lendo apenas 2 bytes — não carrega o arquivo inteiro
        with open(tmp_path, "rb") as fh:
            magic2 = fh.read(2)

        parse_path = tmp_path
        if magic2 == _GZIP_MAGIC:
            # Descomprime em streaming (8 MB por vez) para evitar OOM no free tier.
            # gzip.decompress() carregaria compressed+decompressed ao mesmo tempo
            # (~173 MB + ~280 MB = 453 MB só de buffers), estourando o limite de 512 MB.
            import gzip
            import shutil
            tmp_fd2, decompressed_path = tempfile.mkstemp(suffix=".dem")
            try:
                with gzip.open(tmp_path, "rb") as gz_in, os.fdopen(tmp_fd2, "wb") as out:
                    shutil.copyfileobj(gz_in, out, length=8 * 1024 * 1024)
            except Exception:
                # tmp_fd2 já foi fechado pelo fdopen; só limpar o arquivo
                try:
                    os.unlink(decompressed_path)
                except OSError:
                    pass
                decompressed_path = None
                raise
            parse_path = decompressed_path

        from app.services.demo_service import parse_demo as _parse
        result = _parse(parse_path)

        _resolve_players(result, db)

        job = db.get(DemoJob, job_id)
        if job:
            job.status = "done"
            job.result = result
            job.finished_at = datetime.utcnow()
            db.commit()

    except Exception as exc:
        logger.exception("Background demo parse failed (job %s): %s", job_id, exc)
        try:
            db.rollback()
            job = db.get(DemoJob, job_id)
            if job:
                job.status = "error"
                job.error_msg = f"{type(exc).__name__}: {exc}"
                job.finished_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
        for path in (tmp_path, decompressed_path):
            if path:
                try:
                    os.unlink(path)
                except OSError:
                    pass


@router.post("/parse")
@limiter.limit("3/minute")
async def parse_demo(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: Player = Depends(require_admin),
):
    if not file.filename or not file.filename.lower().endswith(".dem"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser um .dem do CS2")

    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler arquivo: {e}")

    # Valida magic bytes antes de descomprimir — aceita gzip ou PBDEMS2 direto
    if len(content) < 8 or (content[:2] != _GZIP_MAGIC and content[:8] != _PBDEMS2_MAGIC):
        raise HTTPException(status_code=400, detail="Arquivo inválido: não é um demo CS2")

    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(status_code=413, detail=f"Demo muito grande ({size_mb:.0f}MB). Limite: {MAX_SIZE_MB}MB")

    # Salva bytes RAW (comprimido ou não) — descompressão acontece na background task
    # para não bloquear o event loop assíncrono.
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".dem")
    try:
        os.write(tmp_fd, content)
        os.close(tmp_fd)
    except Exception as e:
        try:
            os.close(tmp_fd)
        except OSError:
            pass
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail=f"Erro ao salvar demo temporário: {e}")

    del content  # libera memória imediatamente

    # Cria job no banco
    job_id = str(uuid4())
    job = DemoJob(id=job_id)
    db.add(job)
    db.commit()

    # Dispara o parse em background — resposta retorna imediatamente
    background_tasks.add_task(_run_parse, job_id, tmp_path)

    return {"job_id": job_id, "status": "processing"}


@router.get("/status/{job_id}")
async def demo_status(
    job_id: str,
    db: Session = Depends(get_db),
    _admin: Player = Depends(require_admin),
):
    job = db.get(DemoJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    if job.status == "processing":
        return {"job_id": job_id, "status": "processing"}

    if job.status == "error":
        return JSONResponse(
            status_code=500,
            content={"job_id": job_id, "status": "error", "detail": job.error_msg or "Erro desconhecido"},
        )

    # done — devolve resultado completo
    return {"job_id": job_id, "status": "done", **(job.result or {})}
