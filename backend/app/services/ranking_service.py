"""
Service — cálculo do ranking

Implementa a fórmula de score em 3 passos:
  1. Agrega métricas de todas as partidas por jogador (soma ou média)
  2. Normaliza cada métrica com min-max dentro do grupo (0–100)
  3. Calcula score por categoria e score final ponderado pelos pesos do banco

Os pesos são lidos da tabela ranking_config a cada chamada — nunca hardcodados.
Se a tabela estiver vazia, usa os padrões 50/30/20.

Métricas de SOMA:
  kills, deaths, assists, damage_total, opening_kills, trade_kills,
  flash_assists, grenade_damage, he_enemies_hit, fire_enemies_hit

Métricas de MÉDIA:
  adr, adr_difference, hltv_rating, kast_percent, time_to_kill_ms

Métricas INVERTIDAS na normalização (menor é melhor):
  deaths, time_to_kill_ms
"""

from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.models.match import PlayerMatchStats
from app.models.player import Player
from app.models.ranking_config import RankingConfig
from app.schemas.ranking import RankingEntry


# Métricas de soma — agregadas somando valores de todas as partidas
SOMA_METRICS = [
    "kills", "deaths", "assists", "damage_total",
    "opening_kills", "trade_kills", "trade_denials",
    "flash_assists", "grenade_damage", "he_enemies_hit", "fire_enemies_hit",
]

# Métricas de média — agregadas tirando média entre partidas
MEDIA_METRICS = [
    "adr", "adr_difference", "hltv_rating", "kast_percent", "time_to_kill_ms",
]

# Métricas onde MENOR é melhor — normalizadas de forma invertida
INVERTED_METRICS = {"deaths", "time_to_kill_ms"}

# Agrupamento por categoria para cálculo do score parcial
COMBAT_METRICS = [
    "kills", "deaths", "assists", "damage_total",
    "adr", "adr_difference", "hltv_rating", "kast_percent", "grenade_damage",
]
DUEL_METRICS = ["opening_kills", "trade_kills", "trade_denials", "time_to_kill_ms"]
UTILITY_METRICS = ["flash_assists", "grenade_damage", "he_enemies_hit", "fire_enemies_hit"]


def _normalize(value: float, min_val: float, max_val: float, inverted: bool = False) -> float:
    """
    Normalização min-max para o intervalo [0, 100].
    Se todos os valores são iguais (max == min), retorna 50 para todos.
    """
    if max_val == min_val:
        return 50.0
    normalized = (value - min_val) / (max_val - min_val) * 100.0
    return (100.0 - normalized) if inverted else normalized


def _score_category(normalized: Dict[str, float], metrics: List[str]) -> float:
    """Calcula o score de uma categoria como média simples das métricas normalizadas."""
    values = [normalized[m] for m in metrics if m in normalized]
    if not values:
        return 0.0
    return sum(values) / len(values)


def get_ranking(db: Session) -> List[RankingEntry]:
    """
    Calcula e retorna o ranking completo de todos os players com ao menos 1 partida.

    Passos:
      1. Busca pesos do banco (ranking_config)
      2. Agrega stats por player (soma/média conforme a métrica)
      3. Normaliza cada métrica dentro do grupo
      4. Calcula scores por categoria e score final
      5. Ordena por score_final DESC e atribui posições
    """
    # Passo 1 — pesos
    config = db.query(RankingConfig).first()
    w_combat = float(config.weight_combat) if config else 0.50
    w_duel = float(config.weight_duel) if config else 0.30
    w_utility = float(config.weight_utility) if config else 0.20

    # Passo 2 — agrega stats por player
    stats_rows = (
        db.query(PlayerMatchStats)
        .join(Player)
        .filter(Player.is_active == True)  # noqa: E712
        .all()
    )

    if not stats_rows:
        return []

    # Agrupa por player_id
    raw: Dict[int, Dict[str, Any]] = {}
    for row in stats_rows:
        pid = row.player_id
        if pid not in raw:
            raw[pid] = {
                "player": row.player,
                "match_count": 0,
                **{m: 0 for m in SOMA_METRICS},
                **{m: [] for m in MEDIA_METRICS},
            }
        raw[pid]["match_count"] += 1
        for m in SOMA_METRICS:
            raw[pid][m] += getattr(row, m)
        for m in MEDIA_METRICS:
            raw[pid][m].append(float(getattr(row, m)))

    # Finaliza médias
    players_data: List[Dict[str, Any]] = []
    for pid, d in raw.items():
        aggregated = {**d}
        for m in MEDIA_METRICS:
            vals = d[m]
            aggregated[m] = sum(vals) / len(vals) if vals else 0.0
        players_data.append(aggregated)

    # Passo 3 — normaliza cada métrica
    all_metrics = SOMA_METRICS + MEDIA_METRICS
    min_max: Dict[str, tuple] = {}
    for m in all_metrics:
        vals = [p[m] for p in players_data]
        min_max[m] = (min(vals), max(vals))

    for p in players_data:
        p["normalized"] = {}
        for m in all_metrics:
            mn, mx = min_max[m]
            p["normalized"][m] = _normalize(p[m], mn, mx, inverted=(m in INVERTED_METRICS))

    # Passo 4 — calcula scores
    for p in players_data:
        norm = p["normalized"]
        p["score_combat"] = _score_category(norm, COMBAT_METRICS)
        p["score_duel"] = _score_category(norm, DUEL_METRICS)
        p["score_utility"] = _score_category(norm, UTILITY_METRICS)
        p["score_final"] = (
            p["score_combat"] * w_combat
            + p["score_duel"] * w_duel
            + p["score_utility"] * w_utility
        )

    # Passo 5 — ordena e gera ranking
    players_data.sort(key=lambda x: x["score_final"], reverse=True)

    result = []
    for rank, p in enumerate(players_data, start=1):
        player = p["player"]
        deaths = p["deaths"] or 1  # evita divisão por zero no K/D
        result.append(
            RankingEntry(
                rank=rank,
                player_id=player.id,
                player_nickname=player.nickname,
                avatar_initials=player.avatar_initials,
                total_matches=p["match_count"],
                kills=p["kills"],
                deaths=p["deaths"],
                kd_ratio=round(p["kills"] / deaths, 2),
                adr=round(p["adr"], 2),
                hltv_rating=round(p["hltv_rating"], 3),
                kast_percent=round(p["kast_percent"], 2),
                score_combat=round(p["score_combat"], 1),
                score_duel=round(p["score_duel"], 1),
                score_utility=round(p["score_utility"], 1),
                score_final=round(p["score_final"], 1),
            )
        )
    return result


def get_player_stats(db: Session, player_id: int) -> Dict[str, Any]:
    """
    Retorna métricas brutas + scores de um jogador específico.
    Usa o mesmo ranking completo e filtra pelo player_id.
    Retorna None se o player não tiver partidas.
    """
    ranking = get_ranking(db)
    for entry in ranking:
        if entry.player_id == player_id:
            return entry
    return None


def get_ranking_config(db: Session) -> RankingConfig:
    """Retorna a configuração atual (cria linha padrão se não existir)."""
    config = db.query(RankingConfig).first()
    if not config:
        config = RankingConfig(weight_combat=0.50, weight_duel=0.30, weight_utility=0.20)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def update_ranking_config(
    db: Session, weight_combat: float, weight_duel: float, weight_utility: float, updated_by: int
) -> RankingConfig:
    """Atualiza os pesos do ranking. Assume que a validação (soma = 1.0) foi feita no schema."""
    config = get_ranking_config(db)
    config.weight_combat = weight_combat
    config.weight_duel = weight_duel
    config.weight_utility = weight_utility
    config.updated_by = updated_by
    db.commit()
    db.refresh(config)
    return config
