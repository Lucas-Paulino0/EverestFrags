"""
Router — jogadores

GET  /api/players                → público, lista todos os jogadores ativos
POST /api/players                → admin, cria jogador
GET  /api/players/steam-lookup   → admin, busca perfil público na Steam Web API
GET  /api/players/{id}           → público, dados de um jogador
PATCH /api/players/{id}          → admin, atualiza campos do jogador
GET  /api/players/{id}/stats     → autenticado, stats consolidadas do jogador
GET  /api/players/{id}/vs/{id2}  → público, confronto direto entre 2 jogadores
"""

import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.player import PlayerCreate, PlayerUpdate, PlayerResponse, PlayerStatsResponse
from app.schemas.match import HeadToHeadResponse
from app.services.auth_service import get_current_player, require_admin
from app.services.player_service import get_all_players, get_player_by_id, create_player, update_player
from app.services.ranking_service import get_player_stats
from app.services.match_service import get_head_to_head
from app.services.steam_service import get_steam_profile
from app.models.player import Player

router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("", response_model=List[PlayerResponse])
def list_players(db: Session = Depends(get_db)):
    """Lista todos os jogadores ativos ordenados por nickname."""
    return get_all_players(db)


@router.post("", response_model=PlayerResponse, status_code=201)
def create(
    data: PlayerCreate,
    db: Session = Depends(get_db),
    _: Player = Depends(require_admin),
):
    """Cria um novo jogador. Apenas admins."""
    return create_player(db, data)


@router.get("/steam-lookup")
async def steam_lookup(
    steam_id: str,
    _: Player = Depends(require_admin),
):
    """
    Busca nickname + avatar de um steam_id na Steam Web API, pra pré-preencher
    o cadastro manual de player no Admin (hoje a única forma é copiar o ID na mão).
    Requer STEAM_API_KEY no .env. 404 se o perfil não existir ou a API não responder.
    """
    api_key = os.getenv("STEAM_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="STEAM_API_KEY não configurada no servidor")

    profile = await get_steam_profile(steam_id.strip(), api_key)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil Steam não encontrado para esse ID")

    return {
        "nickname": profile.get("personaname"),
        "avatar_url": profile.get("avatarfull"),
    }


@router.get("/{player_id}", response_model=PlayerResponse)
def get_player(player_id: int, db: Session = Depends(get_db)):
    """Retorna dados públicos de um jogador."""
    return get_player_by_id(db, player_id)


@router.patch("/{player_id}", response_model=PlayerResponse)
def update(
    player_id: int,
    data: PlayerUpdate,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    """
    Atualiza campos de um jogador.

    Admin pode editar qualquer campo de qualquer jogador. Um player comum só
    pode editar o próprio display_name (apelido) — qualquer outro campo, ou
    tentar editar outro jogador, retorna 403.
    """
    if current.role != "admin":
        if current.id != player_id:
            raise HTTPException(status_code=403, detail="Sem permissão para editar este jogador")
        sent_fields = data.model_dump(exclude_unset=True)
        if set(sent_fields) - {"display_name"}:
            raise HTTPException(status_code=403, detail="Você só pode editar seu apelido")
    return update_player(db, player_id, data)


@router.get("/{player_id}/stats", response_model=PlayerStatsResponse)
def player_stats(
    player_id: int,
    db: Session = Depends(get_db),
    _: Player = Depends(get_current_player),
):
    """Stats consolidadas de um jogador. Requer autenticação."""
    # Garante que o player existe antes de calcular ranking
    get_player_by_id(db, player_id)
    stats = get_player_stats(db, player_id)
    if stats is None:
        # Player existe mas não tem partidas ainda
        player = get_player_by_id(db, player_id)
        return PlayerStatsResponse(
            id=player.id,
            nickname=player.nickname,
            avatar_initials=player.avatar_initials,
        )
    return stats


@router.get("/{player_id}/vs/{opponent_id}", response_model=HeadToHeadResponse)
def head_to_head(player_id: int, opponent_id: int, db: Session = Depends(get_db)):
    """
    Confronto direto entre 2 jogadores, somado em todas as partidas — quantas vezes
    cada um matou e flashou (com kill em seguida) o outro. Só conta partidas
    processadas via upload de demo depois desta feature (ver CLAUDE.md > Futuro).
    """
    return get_head_to_head(db, player_id, opponent_id)
