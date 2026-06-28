"""
Router — autenticação

POST /api/auth/login          → público, retorna JWT
POST /api/auth/logout         → stateless, instrui frontend a deletar token
GET  /api/auth/me             → autenticado, retorna dados do player logado
POST /api/auth/change-password → autenticado, troca senha
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse, PasswordChange
from app.schemas.player import PlayerPublic
from app.services.auth_service import create_access_token, get_current_player
from app.services.player_service import authenticate, change_password
from app.models.player import Player

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """
    Autentica com nickname + senha e retorna JWT.
    Lança 401 se as credenciais forem inválidas.
    """
    player = authenticate(db, data.nickname, data.password)
    if not player:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": str(player.id)})
    return TokenResponse(
        access_token=token,
        player=PlayerPublic.model_validate(player),
    )


@router.post("/logout")
def logout():
    """
    Stateless — o backend não armazena tokens.
    Este endpoint existe apenas para o frontend ter um ponto de chamada uniforme
    antes de deletar o token do localStorage.
    """
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
    return {"message": "Senha alterada com sucesso"}
