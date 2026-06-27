"""
Schemas Pydantic — jogadores

PlayerCreate       → POST /api/players (admin)
PlayerUpdate       → PATCH /api/players/{id} (admin)
PlayerPublic       → resposta pública com role (usada no TokenResponse após login)
PlayerResponse     → resposta para listagem (sem hash de senha)
PlayerStatsResponse → stats consolidadas de um jogador em /api/players/{id}/stats
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PlayerCreate(BaseModel):
    """Cria um novo jogador. O admin também pode definir a senha inicial."""

    nickname: str = Field(..., min_length=2, max_length=50, description="Nick único do jogador")
    steam_id: Optional[str] = Field(None, max_length=20)
    avatar_initials: Optional[str] = Field(None, min_length=1, max_length=2)
    # Senha opcional na criação — o próprio jogador pode definir depois via /auth/change-password
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    role: str = Field("viewer", pattern="^(admin|viewer)$")


class PlayerUpdate(BaseModel):
    """Todos os campos opcionais — só o que for enviado é atualizado."""

    nickname: Optional[str] = Field(None, min_length=2, max_length=50)
    steam_id: Optional[str] = Field(None, max_length=20)
    avatar_initials: Optional[str] = Field(None, min_length=1, max_length=2)
    role: Optional[str] = Field(None, pattern="^(admin|viewer)$")
    is_active: Optional[bool] = None


class PlayerPublic(BaseModel):
    """Dados públicos do jogador logado — retornados no TokenResponse."""

    id: int
    nickname: str
    role: str
    avatar_initials: str

    model_config = {"from_attributes": True}


class PlayerResponse(BaseModel):
    """Resposta para listagem de jogadores — sem hash de senha."""

    id: int
    nickname: str
    steam_id: Optional[str] = None
    avatar_initials: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PlayerStatsResponse(BaseModel):
    """
    Stats consolidadas de um jogador — calculadas pelo ranking_service
    a partir de todas as partidas em que participou.
    """

    id: int
    nickname: str
    avatar_initials: str
    total_matches: int = 0

    # Métricas de SOMA
    kills: int = 0
    deaths: int = 0
    assists: int = 0
    damage_total: int = 0
    opening_kills: int = 0
    trade_kills: int = 0
    flash_assists: int = 0
    grenade_damage: int = 0
    he_enemies_hit: int = 0
    fire_enemies_hit: int = 0
    fire_damage: int = 0

    # Métricas de MÉDIA
    adr: float = 0.0
    adr_difference: float = 0.0
    hltv_rating: float = 0.0
    kast_percent: float = 0.0
    time_to_kill_ms: float = 0.0

    # Scores calculados (0–100)
    score_combat: float = 0.0
    score_duel: float = 0.0
    score_utility: float = 0.0
    score_final: float = 0.0

    # Derivados
    kd_ratio: float = 0.0
