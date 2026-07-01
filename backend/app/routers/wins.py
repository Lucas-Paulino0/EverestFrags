"""
Router — sistema de vitórias

POST /api/matches/{id}/result   → registra resultado (admin) — time 1 ou time 2 ganhou
GET  /api/wins/ranking          → placar de vitórias (público)
GET  /api/players/{id}/wins     → histórico de vitórias do player (público)
DELETE /api/matches/{id}/result → remove resultado registrado (admin)
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.match import Match, PlayerWins
from app.models.player import Player
from app.services.auth_service import require_admin

router = APIRouter(tags=["wins"])


class MatchResultIn(BaseModel):
    winning_team: int          # 1 ou 2
    team_1_ids: list[int]      # player_ids do time 1
    team_2_ids: list[int]      # player_ids do time 2


class WinsEntry(BaseModel):
    player_id: int
    nickname: str
    display_name: Optional[str]
    avatar_initials: str
    avatar_url: Optional[str]
    wins: int
    losses: int
    win_rate: float
    win_streak: int
    max_win_streak: int
    points: int

    model_config = {"from_attributes": True}


def _get_or_create_wins(db: Session, player_id: int) -> PlayerWins:
    row = db.query(PlayerWins).filter(PlayerWins.player_id == player_id).first()
    if not row:
        row = PlayerWins(player_id=player_id)
        db.add(row)
        db.flush()
    return row


def _apply_result(db: Session, match: Match, winning_team: int, team_1_ids: list[int], team_2_ids: list[int]):
    """Aplica o resultado a todos os players de ambos os times na tabela player_wins."""
    winners = team_1_ids if winning_team == 1 else team_2_ids
    losers  = team_2_ids if winning_team == 1 else team_1_ids

    for pid in winners:
        row = _get_or_create_wins(db, pid)
        row.wins += 1
        row.win_streak += 1
        if row.win_streak > row.max_win_streak:
            row.max_win_streak = row.win_streak
        # Vitória como azarão (+5 pts) se o time tem score médio menor — simplificado: +3 base
        row.points += 3

    for pid in losers:
        row = _get_or_create_wins(db, pid)
        row.losses += 1
        row.win_streak = 0
        row.points = max(0, row.points - 1)


def _revert_result(db: Session, match: Match):
    """Remove o impacto de um resultado já registrado."""
    if not match.winning_team or not match.team_1_ids or not match.team_2_ids:
        return
    winners = match.team_1_ids if match.winning_team == 1 else match.team_2_ids
    losers  = match.team_2_ids if match.winning_team == 1 else match.team_1_ids

    for pid in winners:
        row = db.query(PlayerWins).filter(PlayerWins.player_id == pid).first()
        if row:
            row.wins = max(0, row.wins - 1)
            row.points = max(0, row.points - 3)

    for pid in losers:
        row = db.query(PlayerWins).filter(PlayerWins.player_id == pid).first()
        if row:
            row.losses = max(0, row.losses - 1)
            row.points += 1  # devolve o ponto que foi tirado


@router.post("/api/matches/{match_id}/result", status_code=status.HTTP_200_OK)
def register_result(
    match_id: int,
    data: MatchResultIn,
    db: Session = Depends(get_db),
    _admin: Player = Depends(require_admin),
):
    """Registra qual time ganhou a partida e atualiza o placar de vitórias."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partida não encontrada")
    if data.winning_team not in (1, 2):
        raise HTTPException(status_code=422, detail="winning_team deve ser 1 ou 2")
    if not data.team_1_ids or not data.team_2_ids:
        raise HTTPException(status_code=422, detail="Ambos os times precisam ter jogadores")

    # Se já tinha resultado, desfaz antes de aplicar o novo
    if match.winning_team is not None:
        _revert_result(db, match)

    match.team_1_ids = data.team_1_ids
    match.team_2_ids = data.team_2_ids
    match.winning_team = data.winning_team

    _apply_result(db, match, data.winning_team, data.team_1_ids, data.team_2_ids)
    db.commit()

    return {"message": f"Resultado registrado: Time {data.winning_team} venceu"}


@router.delete("/api/matches/{match_id}/result", status_code=status.HTTP_200_OK)
def remove_result(
    match_id: int,
    db: Session = Depends(get_db),
    _admin: Player = Depends(require_admin),
):
    """Remove o resultado registrado e desfaz o impacto no placar."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partida não encontrada")
    if match.winning_team is None:
        raise HTTPException(status_code=404, detail="Esta partida não tem resultado registrado")

    _revert_result(db, match)
    match.team_1_ids = None
    match.team_2_ids = None
    match.winning_team = None
    db.commit()

    return {"message": "Resultado removido"}


@router.get("/api/wins/ranking")
def wins_ranking(db: Session = Depends(get_db)):
    """Placar de vitórias ordenado por pontos. Players sem partida de resultado não aparecem."""
    rows = (
        db.query(PlayerWins, Player)
        .join(Player, PlayerWins.player_id == Player.id)
        .filter(Player.is_active == True)  # noqa: E712
        .order_by(PlayerWins.points.desc(), PlayerWins.wins.desc())
        .all()
    )
    result = []
    for i, (pw, p) in enumerate(rows, 1):
        result.append({
            "rank": i,
            "player_id": p.id,
            "nickname": p.nickname,
            "display_name": p.display_name,
            "avatar_initials": p.avatar_initials,
            "avatar_url": p.avatar_url,
            "wins": pw.wins,
            "losses": pw.losses,
            "win_rate": pw.win_rate,
            "win_streak": pw.win_streak,
            "max_win_streak": pw.max_win_streak,
            "points": pw.points,
        })
    return result


@router.get("/api/players/{player_id}/wins")
def player_wins(player_id: int, db: Session = Depends(get_db)):
    """Vitórias/derrotas de um player específico."""
    player = db.query(Player).filter(Player.id == player_id, Player.is_active == True).first()  # noqa: E712
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")

    pw = db.query(PlayerWins).filter(PlayerWins.player_id == player_id).first()
    if not pw:
        return {"wins": 0, "losses": 0, "win_rate": 0.0, "win_streak": 0, "max_win_streak": 0, "points": 0}

    # Histórico de partidas com resultado
    matches = (
        db.query(Match)
        .filter(
            Match.winning_team.isnot(None),
            Match.team_1_ids.isnot(None),
        )
        .order_by(Match.played_at.desc())
        .all()
    )
    history = []
    for m in matches:
        all_ids = (m.team_1_ids or []) + (m.team_2_ids or [])
        if player_id not in all_ids:
            continue
        team = 1 if player_id in (m.team_1_ids or []) else 2
        won = team == m.winning_team
        history.append({
            "match_id": m.id,
            "played_at": str(m.played_at),
            "map_name": m.map_name,
            "team": team,
            "won": won,
        })

    return {
        "wins": pw.wins,
        "losses": pw.losses,
        "win_rate": pw.win_rate,
        "win_streak": pw.win_streak,
        "max_win_streak": pw.max_win_streak,
        "points": pw.points,
        "history": history,
    }
