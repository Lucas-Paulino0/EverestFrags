"""
Service — operações CRUD em partidas

Funções:
  get_matches        → lista paginada de partidas
  get_match_by_id    → partida com todos os jogadores e stats
  create_match       → cria partida + stats de todos os jogadores em uma transação
  delete_match       → remove partida (e stats via cascade)
"""

from typing import List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.match import Match, PlayerMatchStats
from app.models.player import Player
from app.schemas.match import MatchCreate


def get_matches(
    db: Session, page: int = 1, limit: int = 20
) -> Tuple[List[Match], int]:
    """
    Retorna partidas paginadas (mais recentes primeiro) + total de registros.
    Retorna a contagem para montar o PaginatedMatchResponse no router.
    """
    query = db.query(Match).order_by(Match.played_at.desc(), Match.id.desc())
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, total


def get_match_by_id(db: Session, match_id: int) -> Match:
    """
    Busca partida completa com stats de todos os jogadores (eager load).
    Lança 404 se não encontrar.
    """
    match = (
        db.query(Match)
        .options(
            joinedload(Match.player_stats).joinedload(PlayerMatchStats.player)
        )
        .filter(Match.id == match_id)
        .first()
    )
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partida {match_id} não encontrada",
        )
    return match


def create_match(db: Session, data: MatchCreate) -> Match:
    """
    Cria uma partida e os registros de stats de cada jogador em uma única transação.

    Validações:
    - Cada player_id deve existir no banco
    - Não pode haver IDs duplicados na lista de jogadores

    Se qualquer validação falhar, nada é salvo (rollback automático pelo SQLAlchemy).
    """
    # Verifica IDs duplicados na lista
    player_ids = [p.player_id for p in data.players]
    if len(player_ids) != len(set(player_ids)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Lista de jogadores contém IDs duplicados",
        )

    # Verifica que todos os players existem
    for pid in player_ids:
        if not db.query(Player).filter(Player.id == pid).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Jogador {pid} não encontrado",
            )

    match = Match(
        scope_url=data.scope_url,
        played_at=data.played_at,
        map_name=data.map_name,
        notes=data.notes,
    )
    db.add(match)
    db.flush()  # gera o match.id sem commitar ainda

    for ps in data.players:
        stat = PlayerMatchStats(
            match_id=match.id,
            player_id=ps.player_id,
            kills=ps.kills,
            deaths=ps.deaths,
            assists=ps.assists,
            damage_total=ps.damage_total,
            adr=ps.adr,
            adr_difference=ps.adr_difference,
            hltv_rating=ps.hltv_rating,
            kast_percent=ps.kast_percent,
            disadvantage_kills=ps.disadvantage_kills,
            advantage_kills=ps.advantage_kills,
            eco_kills=ps.eco_kills,
            opening_kills=ps.opening_kills,
            trade_kills=ps.trade_kills,
            trade_denials=ps.trade_denials,
            time_to_kill_ms=ps.time_to_kill_ms,
            flash_assists=ps.flash_assists,
            grenade_damage=ps.grenade_damage,
            he_enemies_hit=ps.he_enemies_hit,
            fire_enemies_hit=ps.fire_enemies_hit,
        )
        db.add(stat)

    db.commit()
    db.refresh(match)
    return get_match_by_id(db, match.id)  # retorna com jogadores carregados


def delete_match(db: Session, match_id: int) -> None:
    """
    Remove a partida e todas as stats associadas (CASCADE no banco).
    Lança 404 se não encontrar.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partida {match_id} não encontrada",
        )
    db.delete(match)
    db.commit()
