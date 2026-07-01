"""
Schemas Pydantic — autenticação

LoginRequest    → POST /api/auth/login
TokenResponse   → resposta do login com JWT e dados do player
PasswordChange  → POST /api/auth/change-password

NOTA: não há schema de registro separado — players são criados por admins
via POST /api/players (schema PlayerCreate em schemas/player.py).
"""

from pydantic import BaseModel, Field
from app.schemas.player import PlayerPublic


class LoginRequest(BaseModel):
    """Credenciais para login. Usa nickname (não email)."""

    nickname: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    """Resposta do login. O frontend armazena access_token no localStorage."""

    access_token: str
    token_type: str = "bearer"
    # Dados públicos do player logado — evita um GET /api/auth/me extra após login
    player: PlayerPublic


class PasswordChange(BaseModel):
    """Troca de senha. Exige a senha atual para confirmar identidade."""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=72)
