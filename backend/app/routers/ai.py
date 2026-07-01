"""
Router — endpoints de IA (Groq)

GET /api/players/{id}/coach      — análise individual do jogador
GET /api/matches/{id}/narrative  — narrativa da partida
POST /api/sort/prediction        — forma recente dos jogadores selecionados
POST /api/ai/digest              — digest semanal (admin only)

Todos degradam graciosamente se GROQ_API_KEY não estiver configurada:
retornam {"text": null, "unavailable": true} em vez de 500.
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.match import Match, PlayerMatchStats
from app.models.player import Player
from app.services import ranking_service
from app.services.match_service import get_match_by_id
from app.services.auth_service import get_current_player, require_admin
from app.services import ai_service
from app.limiter import limiter
from fastapi import Request

router = APIRouter(prefix="/api", tags=["ai"])


def _unavailable():
    return {"text": None, "unavailable": True, "reason": "GROQ_API_KEY não configurada ou erro na API de IA."}


# ─── Coach individual ────────────────────────────────────────────────────────

@router.get("/players/{player_id}/coach")
@limiter.limit("6/minute")
def coach_player(
    request: Request,
    player_id: int,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    """Análise IA do jogador: ponto forte, fraqueza e sugestão prática."""
    player = db.query(Player).filter(Player.id == player_id, Player.is_active == True).first()
    if not player:
        raise HTTPException(404, "Jogador não encontrado")

    entry = ranking_service.get_player_stats(db, player_id)
    if not entry:
        raise HTTPException(422, "Jogador não tem partidas suficientes para análise")

    group_avg = ranking_service.get_group_averages(db)
    history = ranking_service.get_player_match_history(db, player_id)

    # Tendência ADR: média das últimas 3 vs anteriores
    adr_vals = [h["adr"] for h in history]
    if len(adr_vals) >= 4:
        recent_avg = sum(adr_vals[-3:]) / 3
        older_avg  = sum(adr_vals[:-3]) / len(adr_vals[:-3])
        diff = recent_avg - older_avg
        trend_adr = f"{'↑' if diff > 2 else '↓' if diff < -2 else '→'} {abs(diff):.1f} ({older_avg:.0f}→{recent_avg:.0f})"
    else:
        trend_adr = "dados insuficientes"

    # Melhor/pior mapa por Rating médio
    map_ratings: dict[str, list[float]] = {}
    for h in history:
        if h["map_name"]:
            map_ratings.setdefault(h["map_name"], []).append(h["hltv_rating"])
    map_avgs = {m: sum(v) / len(v) for m, v in map_ratings.items() if len(v) >= 2}
    best_map  = max(map_avgs, key=map_avgs.get) if map_avgs else ""
    worst_map = min(map_avgs, key=map_avgs.get) if map_avgs else ""

    stats = {
        "adr": entry.adr,
        "opening_kills": entry.opening_kills / max(entry.total_matches, 1),
        "flash_assists": entry.flash_assists / max(entry.total_matches, 1),
        "kast_percent": entry.kast_percent,
        "kd_ratio": entry.kd_ratio,
        "hltv_rating": entry.hltv_rating,
    }
    avg_dict = {
        "adr": group_avg.adr,
        "opening_kills": group_avg.opening_kills,
        "flash_assists": group_avg.flash_assists,
        "kast_percent": group_avg.kast_percent,
        "kd_ratio": group_avg.kills / max(group_avg.deaths, 1) if group_avg.deaths else 1.0,
    }

    text = ai_service.coach_player(
        nickname=player.nickname,
        stats=stats,
        group_avg=avg_dict,
        trend_adr=trend_adr,
        best_map=best_map,
        worst_map=worst_map,
    )

    if text is None:
        return _unavailable()
    return {"text": text, "unavailable": False}


# ─── Narrativa da partida ────────────────────────────────────────────────────

@router.get("/matches/{match_id}/narrative")
@limiter.limit("6/minute")
def match_narrative(
    request: Request,
    match_id: int,
    db: Session = Depends(get_db),
):
    """Resumo narrativo estilo comentarista de uma partida."""
    match = get_match_by_id(db, match_id)
    if not match:
        raise HTTPException(404, "Partida não encontrada")

    players_data = [
        {
            "player_nickname": s.player.nickname,
            "kills":   s.kills,
            "deaths":  s.deaths,
            "assists": s.assists,
            "adr":     float(s.adr),
            "hltv_rating": float(s.hltv_rating),
        }
        for s in match.player_stats
    ]

    text = ai_service.match_narrative(
        map_name=match.map_name or "mapa desconhecido",
        played_at=str(match.played_at),
        players=players_data,
    )

    if text is None:
        return _unavailable()
    return {"text": text, "unavailable": False}


# ─── Previsão de forma (pré-sorteio) ────────────────────────────────────────

class PredictionRequest(BaseModel):
    player_ids: list[int]


@router.post("/sort/prediction")
@limiter.limit("6/minute")
def sort_prediction(
    request: Request,
    body: PredictionRequest,
    db: Session = Depends(get_db),
):
    """Análise de forma recente dos jogadores selecionados para o sorteio."""
    if not body.player_ids:
        raise HTTPException(422, "Forneça ao menos 1 player_id")

    ranking = ranking_service.get_ranking(db)
    rank_by_id = {e.player_id: e for e in ranking}

    players_form = []
    for pid in body.player_ids:
        entry = rank_by_id.get(pid)
        if not entry:
            continue
        history = ranking_service.get_player_match_history(db, pid)
        recent = history[-3:] if len(history) >= 3 else history
        avg_rating = sum(h["hltv_rating"] for h in recent) / len(recent) if recent else 0
        avg_adr    = sum(h["adr"] for h in recent) / len(recent) if recent else 0
        players_form.append({
            "nickname":   entry.player_nickname,
            "avg_rating": round(avg_rating, 2),
            "avg_adr":    round(avg_adr, 1),
            "n_matches":  len(recent),
        })

    if not players_form:
        raise HTTPException(422, "Nenhum player com histórico encontrado")

    text = ai_service.sort_prediction(players_form)
    if text is None:
        return _unavailable()
    return {"text": text, "unavailable": False}


# ─── Digest semanal ──────────────────────────────────────────────────────────

@router.post("/ai/digest")
@limiter.limit("2/minute")
def weekly_digest(
    request: Request,
    db: Session = Depends(get_db),
    _admin: Player = Depends(require_admin),
):
    """Gera o digest semanal da EverestFrags (admin only)."""
    ranking = ranking_service.get_ranking(db)
    top5 = [
        {"rank": e.rank, "player_nickname": e.player_nickname, "score_final": e.score_final}
        for e in ranking[:5]
    ]

    since = date.today() - timedelta(days=7)
    week_rows = db.query(Match).filter(Match.played_at >= since).order_by(Match.played_at.desc()).all()
    week_matches = [{"map_name": m.map_name, "played_at": str(m.played_at)} for m in week_rows]

    # Melhor performance individual da semana
    best_stat = (
        db.query(PlayerMatchStats, Match, Player)
        .join(Match, PlayerMatchStats.match_id == Match.id)
        .join(Player, PlayerMatchStats.player_id == Player.id)
        .filter(Match.played_at >= since, Player.is_active == True)
        .order_by(PlayerMatchStats.hltv_rating.desc())
        .first()
    )
    best_perf: dict = {}
    if best_stat:
        stat, match_, pl = best_stat
        best_perf = {
            "nickname": pl.nickname,
            "hltv_rating": float(stat.hltv_rating),
            "adr": float(stat.adr),
            "map_name": match_.map_name,
        }

    text = ai_service.weekly_digest(top5, week_matches, best_perf)
    if text is None:
        return _unavailable()
    return {"text": text, "unavailable": False}
