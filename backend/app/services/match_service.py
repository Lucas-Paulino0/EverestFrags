"""
Service — operações CRUD em partidas

Funções:
  get_matches        → lista paginada de partidas
  get_match_by_id    → partida com todos os jogadores e stats
  create_match       → cria partida + stats de todos os jogadores em uma transação
  delete_match       → remove partida (e stats via cascade)
  get_head_to_head   → confronto direto agregado entre 2 players (kills, flash_assists)
"""

from typing import List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_

from app.models.match import Match, PlayerMatchStats, PlayerVsPlayerStats
from app.models.player import Player
from app.schemas.match import MatchCreate, HeadToHeadResponse


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
            fire_damage=ps.fire_damage,
        )
        db.add(stat)

    # Confrontos diretos (player x player) — só presentes quando a partida vem
    # de um upload de demo. player_id/opponent_id já validados via player_ids
    # acima (matchups só referenciam players que vieram do mesmo parse).
    valid_ids = set(player_ids)
    for vs in data.matchups:
        if vs.player_id not in valid_ids or vs.opponent_id not in valid_ids:
            continue
        db.add(PlayerVsPlayerStats(
            match_id=match.id,
            player_id=vs.player_id,
            opponent_id=vs.opponent_id,
            kills=vs.kills,
            flash_assists=vs.flash_assists,
        ))

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


def get_head_to_head(db: Session, player_id: int, opponent_id: int) -> HeadToHeadResponse:
    """
    Soma o confronto direto entre 2 players em todas as partidas que jogaram juntos.
    `matches_together` conta partidas onde os dois têm PlayerMatchStats (jogaram
    juntos), independente de terem se encontrado em algum kill/flash — já
    player_kills/opponent_kills/flash_assists vêm só de PlayerVsPlayerStats
    (só existe linha quando há pelo menos 1 kill ou flash entre os dois).
    """
    player = db.query(Player).filter(Player.id == player_id).first()
    opponent = db.query(Player).filter(Player.id == opponent_id).first()
    if not player or not opponent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogador não encontrado")

    matches_a = {
        row.match_id for row in db.query(PlayerMatchStats.match_id).filter(PlayerMatchStats.player_id == player_id)
    }
    matches_b = {
        row.match_id for row in db.query(PlayerMatchStats.match_id).filter(PlayerMatchStats.player_id == opponent_id)
    }

    rows = (
        db.query(PlayerVsPlayerStats)
        .filter(
            or_(
                and_(PlayerVsPlayerStats.player_id == player_id, PlayerVsPlayerStats.opponent_id == opponent_id),
                and_(PlayerVsPlayerStats.player_id == opponent_id, PlayerVsPlayerStats.opponent_id == player_id),
            )
        )
        .all()
    )

    return HeadToHeadResponse(
        player_id=player.id,
        player_nickname=player.nickname,
        opponent_id=opponent.id,
        opponent_nickname=opponent.nickname,
        matches_together=len(matches_a & matches_b),
        player_kills=sum(r.kills for r in rows if r.player_id == player_id),
        opponent_kills=sum(r.kills for r in rows if r.player_id == opponent_id),
        player_flash_assists=sum(r.flash_assists for r in rows if r.player_id == player_id),
        opponent_flash_assists=sum(r.flash_assists for r in rows if r.player_id == opponent_id),
    )
