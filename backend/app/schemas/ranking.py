"""
Schemas Pydantic — ranking

RankingEntry → uma linha do ranking (GET /api/ranking). Inclui todas as métricas
brutas agregadas (soma/média) além dos scores por categoria e final, pra alimentar
tanto o Dashboard quanto o modal de detalhe do player e a página /metrics.

Não existe mais configuração de pesos editável — ver ranking_service.py.
"""

from typing import Optional
from pydantic import BaseModel


class RankingEntry(BaseModel):
    """
    Uma posição no ranking. Contém métricas agregadas de todas as partidas
    e os scores calculados pela fórmula min-max com pesos fixos por categoria.
    """

    rank: int
    player_id: int
    player_nickname: str
    player_display_name: Optional[str] = None
    avatar_initials: str
    avatar_url: Optional[str] = None
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
    fire_damage: int = 0
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


class GroupAveragesResponse(BaseModel):
    """
    Médias da EverestFrags — não por jogador, um número só por métrica
    representando o grupo todo. Cada valor é a média daquela métrica entre
    TODAS as linhas de player_match_stats (1 linha = 1 jogador em 1 partida),
    não a média dos totais por jogador — assim quem jogou mais partidas não
    pesa mais nem menos que quem jogou menos (ver ranking_service.get_group_averages).
    """

    total_matches: int = 0
    total_player_entries: int = 0  # nº de linhas player_match_stats consideradas

    kills: float = 0.0
    deaths: float = 0.0
    assists: float = 0.0
    damage_total: float = 0.0
    adr: float = 0.0
    adr_difference: float = 0.0
    hltv_rating: float = 0.0
    kast_percent: float = 0.0
    opening_kills: float = 0.0
    trade_kills: float = 0.0
    trade_denials: float = 0.0
    time_to_kill_ms: float = 0.0
    flash_assists: float = 0.0
    grenade_damage: float = 0.0
    he_enemies_hit: float = 0.0
    fire_enemies_hit: float = 0.0
    fire_damage: float = 0.0
    disadvantage_kills: float = 0.0
    advantage_kills: float = 0.0
    eco_kills: float = 0.0
