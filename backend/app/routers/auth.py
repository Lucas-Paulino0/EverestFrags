"""
Router — autenticação

POST /api/auth/login          → público, retorna JWT
POST /api/auth/logout         → stateless, instrui frontend a deletar token
GET  /api/auth/me             → autenticado, retorna dados do player logado
POST /api/auth/change-password → autenticado, troca senha
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.limiter import limiter
from app.schemas.auth import LoginRequest, TokenResponse, PasswordChange
from app.schemas.player import PlayerPublic
from app.services.auth_service import create_access_token, get_current_player
from app.services.player_service import authenticate, change_password
from app.models.player import Player

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    """
    Autentica com nickname + senha e retorna JWT.
    Lança 401 se as credenciais forem inválidas.
    """
    ip = request.client.host if request.client else "unknown"
    player = authenticate(db, data.nickname, data.password)
    if not player:
        logger.warning("LOGIN_FAIL nickname=%r ip=%s", data.nickname, ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    logger.info("LOGIN_OK player_id=%s nickname=%r ip=%s", player.id, player.nickname, ip)
    token = create_access_token({"sub": str(player.id)})
    return TokenResponse(
        access_token=token,
        player=PlayerPublic.model_validate(player),
    )


@router.post("/logout")
def logout(current: Player = Depends(get_current_player)):
    """Stateless — instrui o frontend a deletar o token do localStorage."""
    logger.info("LOGOUT player_id=%s nickname=%r", current.id, current.nickname)
    return {"message": "ok"}


@router.get("/me", response_model=PlayerPublic)
def me(current: Player = Depends(get_current_player)):
    """Retorna os dados do player autenticado. Útil para validar o token no startup do frontend."""
    return PlayerPublic.model_validate(current)


@router.post("/change-password")
def change_pwd(
    data: PasswordChange,
    current: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
):
    """Troca a senha do player autenticado. Exige a senha atual para confirmar."""
    change_password(db, current, data.current_password, data.new_password)
    logger.info("SENHA_ALTERADA player_id=%s nickname=%r", current.id, current.nickname)
    return {"message": "Senha alterada com sucesso"}
