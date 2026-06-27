"""
Router — upload e parse de arquivos .dem do CS2

POST /api/demo/parse  → recebe .dem, retorna stats dos jogadores
  - Requer autenticação (admin)
  - Retorna: map_name, total_rounds, players[], matchups[], created_players[], inactive_players[], errors[]
  - matchups[] = confronto direto (player_id, opponent_id, kills, flash_assists) — só
    inclui pares onde os dois lados têm steam_id resolvido
  - Cada player do demo é casado com sua conta via steam_id; se não existir
    conta para aquele steam_id, ela é criada automaticamente (role viewer)
  - Cada player no retorno já vem com player_id resolvido — pronto para AddMatch
  - Se a conta resolvida estiver com is_active=False, ela entra em inactive_players[]
    (o AddMatch não consegue selecioná-la, já que GET /api/players só lista ativos)
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
        inactive_players = []
        player_id_by_steamid: dict[str, int] = {}
        for p in result["players"]:
            steam_id = p.get("steam_id")
            if not steam_id:
                p["player_id"] = None
                continue
            player, created = get_or_create_by_steam(db, steam_id, fallback_nickname=p["nickname"])
            p["player_id"] = player.id
            p["nickname"] = player.nickname  # nickname canônico do sistema
            player_id_by_steamid[steam_id] = player.id
            if created:
                created_players.append({"id": player.id, "nickname": player.nickname, "steam_id": steam_id})
            elif not player.is_active:
                inactive_players.append({"id": player.id, "nickname": player.nickname, "steam_id": steam_id})
        result["created_players"] = created_players
        result["inactive_players"] = inactive_players

        # Resolve player_id/opponent_id dos confrontos diretos — descarta qualquer
        # par envolvendo player sem steam_id (não há como casar/criar a conta).
        matchups = []
        for m in result.get("matchups", []):
            player_id = player_id_by_steamid.get(m["player_steamid"])
            opponent_id = player_id_by_steamid.get(m["opponent_steamid"])
            if player_id is None or opponent_id is None:
                continue
            matchups.append({
                "player_id": player_id,
                "opponent_id": opponent_id,
                "kills": m["kills"],
                "flash_assists": m["flash_assists"],
            })
        result["matchups"] = matchups

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
