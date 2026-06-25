"""
Schemas Pydantic — partidas e stats por partida

PlayerStatsCreate    → stats de um jogador ao criar partida (POST /api/matches)
PlayerStatsInMatch   → stats de um jogador na resposta de uma partida
MatchCreate          → corpo do POST /api/matches
MatchResponse        → resposta resumida para listagem
MatchDetailResponse  → resposta completa com todos os jogadores e stats
PaginatedMatchResponse → wrapper paginado para GET /api/matches
"""

from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, Field


class PlayerStatsCreate(BaseModel):
    """Stats de um único jogador dentro do corpo do POST /api/matches."""

    player_id: int = Field(..., description="ID do jogador")

    # Combate
    kills: int = Field(0, ge=0)
    deaths: int = Field(0, ge=0)
    assists: int = Field(0, ge=0)
    damage_total: int = Field(0, ge=0)
    adr: float = Field(0.0, ge=0.0, le=500.0)
    adr_difference: float = Field(0.0, ge=-500.0, le=500.0)
    hltv_rating: float = Field(0.0, ge=0.0, le=5.0)
    kast_percent: float = Field(0.0, ge=0.0, le=100.0)

    # Duelos
    opening_kills: int = Field(0, ge=0)
    trade_kills: int = Field(0, ge=0)
    trade_denials: int = Field(0, ge=0)
    # TTK em milissegundos — 0 significa sem dados
    time_to_kill_ms: int = Field(0, ge=0)

    # Utility
    flash_assists: int = Field(0, ge=0)
    grenade_damage: int = Field(0, ge=0)
    he_enemies_hit: int = Field(0, ge=0)
    fire_enemies_hit: int = Field(0, ge=0)


class PlayerStatsInMatch(BaseModel):
    """Stats de um jogador na resposta de detalhes de uma partida."""

    player_id: int
    player_nickname: str
    player_avatar_initials: str
    kills: int
    deaths: int
    assists: int
    damage_total: int
    adr: float
    adr_difference: float
    hltv_rating: float
    kast_percent: float
    opening_kills: int
    trade_kills: int
    trade_denials: int
    time_to_kill_ms: int
    flash_assists: int
    grenade_damage: int
    he_enemies_hit: int
    fire_enemies_hit: int

    model_config = {"from_attributes": True}


class MatchCreate(BaseModel):
    """Corpo do POST /api/matches. Requer ao menos 1 jogador."""

    scope_url: Optional[str] = Field(None, description="URL do scope.gg para referência")
    played_at: date = Field(..., description="Data em que a partida foi jogada")
    map_name: Optional[str] = Field(None, max_length=50, description="Ex: de_dust2")
    notes: Optional[str] = Field(None, max_length=500)
    # Lista de jogadores com suas stats — mínimo 1
    players: List[PlayerStatsCreate] = Field(..., min_length=1)


class MatchResponse(BaseModel):
    """Resposta resumida para listagem de partidas."""

    id: int
    scope_url: Optional[str] = None
    played_at: date
    map_name: Optional[str] = None
    notes: Optional[str] = None
    player_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchDetailResponse(BaseModel):
    """Resposta completa de uma partida com todos os jogadores."""

    id: int
    scope_url: Optional[str] = None
    played_at: date
    map_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    players: List[PlayerStatsInMatch] = []

    model_config = {"from_attributes": True}


class PaginatedMatchResponse(BaseModel):
    """Wrapper de paginação para GET /api/matches."""

    total: int
    page: int
    limit: int
    items: List[MatchResponse]
