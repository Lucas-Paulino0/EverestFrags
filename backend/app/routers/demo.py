"""
Router — upload e parse de arquivos .dem do CS2

POST /api/demo/parse  → recebe .dem, retorna stats dos jogadores
  - Requer autenticação (admin)
  - Retorna: map_name, total_rounds, players[], created_players[], errors[]
  - Cada player do demo é casado com sua conta via steam_id; se não existir
    conta para aquele steam_id, ela é criada automaticamente (role viewer)
  - Cada player no retorno já vem com player_id resolvido — pronto para AddMatch
"""

import logging
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.auth_service import require_admin
from app.services.player_service import get_or_create_by_steam
from app.models.player import Player

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/demo", tags=["demo"])

MAX_SIZE_MB = 750


@router.post("/parse")
async def parse_demo(
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

    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo muito grande ({size_mb:.0f}MB). Limite: {MAX_SIZE_MB}MB",
        )

    try:
        from app.services.demo_service import parse_demo as _parse
        result = _parse(content)

        # Casa cada player do demo com sua conta via steam_id, criando quando necessário.
        created_players = []
        for p in result["players"]:
            steam_id = p.get("steam_id")
            if not steam_id:
                p["player_id"] = None
                continue
            player, created = get_or_create_by_steam(db, steam_id, fallback_nickname=p["nickname"])
            p["player_id"] = player.id
            p["nickname"] = player.nickname  # nickname canônico do sistema
            if created:
                created_players.append({"id": player.id, "nickname": player.nickname, "steam_id": steam_id})
        result["created_players"] = created_players

        return result
    except RuntimeError as e:
        logger.error("Demo RuntimeError: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except BaseException as e:
        # Captura panics do Rust (demoparser2) e outros erros de baixo nível
        logger.exception("Demo parse falhou com %s: %s", type(e).__name__, e)
        return JSONResponse(
            status_code=500,
            content={"detail": f"Erro ao processar demo [{type(e).__name__}]: {e}"},
        )
