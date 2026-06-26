"""
Schemas Pydantic — ranking

RankingEntry → uma linha do ranking (GET /api/ranking). Inclui todas as métricas
brutas agregadas (soma/média) além dos scores por categoria e final, pra alimentar
tanto o Dashboard quanto o modal de detalhe do player e a página /metrics.

Não existe mais configuração de pesos editável — ver ranking_service.py.
"""

from pydantic import BaseModel


class RankingEntry(BaseModel):
    """
    Uma posição no ranking. Contém métricas agregadas de todas as partidas
    e os scores calculados pela fórmula min-max com pesos fixos por categoria.
    """

    rank: int
    player_id: int
    player_nickname: str
    avatar_initials: str
    total_matches: int

    # Métricas brutas agregadas — soma
    kills: int = 0
    deaths: int = 0
    assists: int = 0
    damage_total: int = 0
    opening_kills: int = 0
    trade_kills: int = 0
    trade_denials: int = 0
    flash_assists: int = 0
    grenade_damage: int = 0
    he_enemies_hit: int = 0
    fire_enemies_hit: int = 0
    disadvantage_kills: int = 0
    advantage_kills: int = 0
    eco_kills: int = 0

    # Métricas brutas agregadas — média
    kd_ratio: float = 0.0
    adr: float = 0.0
    adr_difference: float = 0.0
    hltv_rating: float = 0.0
    kast_percent: float = 0.0
    time_to_kill_ms: float = 0.0

    # Scores por categoria (0–100)
    score_combat: float = 0.0
    score_duel: float = 0.0
    score_utility: float = 0.0

    # Score final ponderado (0–100)
    score_final: float = 0.0
