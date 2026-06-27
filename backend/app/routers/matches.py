"""
Router — partidas

GET    /api/matches       → público, lista paginada
POST   /api/matches       → admin, cria partida com stats
GET    /api/matches/{id}  → público, detalhes completos
DELETE /api/matches/{id}  → admin, remove partida
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.match import MatchCreate, MatchDetailResponse, PaginatedMatchResponse, MatchResponse
from app.services.auth_service import require_admin
from app.services.match_service import get_matches, get_match_by_id, create_match, delete_match
from app.models.player import Player

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("", response_model=PaginatedMatchResponse)
def list_matches(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Lista partidas paginadas, mais recentes primeiro."""
    items, total = get_matches(db, page=page, limit=limit)
    # Adiciona player_count a cada partida para a listagem
    match_responses = []
    for m in items:
        match_responses.append(
            MatchResponse(
                id=m.id,
                scope_url=m.scope_url,
                played_at=m.played_at,
                map_name=m.map_name,
                notes=m.notes,
                player_count=len(m.player_stats) if m.player_stats else 0,
                created_at=m.created_at,
            )
        )
    return PaginatedMatchResponse(total=total, page=page, limit=limit, items=match_responses)


@router.post("", response_model=MatchDetailResponse, status_code=201)
def create(
    data: MatchCreate,
    db: Session = Depends(get_db),
    _: Player = Depends(require_admin),
):
    """Cria uma partida com as stats de todos os jogadores. Apenas admins."""
    match = create_match(db, data)
    return _to_detail_response(match)


@router.get("/{match_id}", response_model=MatchDetailResponse)
def get_match(match_id: int, db: Session = Depends(get_db)):
    """Retorna detalhes completos de uma partida com todos os jogadores."""
    match = get_match_by_id(db, match_id)
    return _to_detail_response(match)


@router.delete("/{match_id}", status_code=204)
def delete(
    match_id: int,
    db: Session = Depends(get_db),
    _: Player = Depends(require_admin),
):
    """Remove uma partida e todas as stats associadas. Apenas admins."""
    delete_match(db, match_id)


def _to_detail_response(match) -> MatchDetailResponse:
    """Converte o ORM Match para MatchDetailResponse incluindo dados dos jogadores."""
    from app.schemas.match import PlayerStatsInMatch
    players = []
    for s in match.player_stats:
        players.append(
            PlayerStatsInMatch(
                player_id=s.player_id,
                player_nickname=s.player.nickname,
                player_avatar_initials=s.player.avatar_initials,
                kills=s.kills,
                deaths=s.deaths,
                assists=s.assists,
                damage_total=s.damage_total,
                adr=float(s.adr),
                adr_difference=float(s.adr_difference),
                hltv_rating=float(s.hltv_rating),
                kast_percent=float(s.kast_percent),
                disadvantage_kills=s.disadvantage_kills,
                advantage_kills=s.advantage_kills,
                eco_kills=s.eco_kills,
                opening_kills=s.opening_kills,
                trade_kills=s.trade_kills,
                trade_denials=s.trade_denials,
                time_to_kill_ms=s.time_to_kill_ms,
                flash_assists=s.flash_assists,
                grenade_damage=s.grenade_damage,
                he_enemies_hit=s.he_enemies_hit,
                fire_enemies_hit=s.fire_enemies_hit,
                fire_damage=s.fire_damage,
            )
        )
    return MatchDetailResponse(
        id=match.id,
        scope_url=match.scope_url,
        played_at=match.played_at,
        map_name=match.map_name,
        notes=match.notes,
        created_at=match.created_at,
        players=players,
    )
