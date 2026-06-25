"""
Service — autenticação JWT

Funções:
  hash_password       → gera hash bcrypt de uma senha
  verify_password     → verifica senha contra hash
  create_access_token → gera JWT assinado com SECRET_KEY
  get_current_player  → dependência FastAPI: valida token e retorna o Player
  require_admin       → dependência FastAPI: exige role == 'admin'

Configuração via variáveis de ambiente (.env):
  SECRET_KEY                  → chave de assinatura do JWT (obrigatória em produção)
  ALGORITHM                   → padrão HS256
  ACCESS_TOKEN_EXPIRE_MINUTES → padrão 480 (8 horas)

ATENÇÃO: SECRET_KEY tem um valor padrão inseguro apenas para desenvolvimento local.
Nunca subir para produção sem trocar por uma chave forte.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.player import Player

load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-insecure-key-change-in-production")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

# Contexto bcrypt — deprecated="auto" migra automaticamente hashes antigos
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# tokenUrl aponta para o endpoint de login — usado pelo Swagger UI
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    """Gera hash bcrypt. Sempre usar esta função — nunca salvar senha em texto puro."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Compara senha em texto puro com hash bcrypt."""
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Gera um JWT com os dados fornecidos + campo 'exp' de expiração.
    O campo 'sub' deve ser o nickname do player (string).
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_player(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Player:
    """
    Dependência FastAPI para rotas autenticadas.
    Decodifica o JWT, extrai o nickname e carrega o Player do banco.
    Lança 401 se o token for inválido, expirado ou o player não existir.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: Optional[str] = payload.get("sub")
        if not sub:
            raise credentials_exception
        player_id = int(sub)
    except (JWTError, ValueError):
        raise credentials_exception

    player = db.query(Player).filter(
        Player.id == player_id,
        Player.is_active == True,  # noqa: E712
    ).first()
    if not player:
        raise credentials_exception
    return player


def require_admin(current: Player = Depends(get_current_player)) -> Player:
    """
    Dependência FastAPI para rotas restritas a admins.
    Lança 403 se o player logado não for admin.
    """
    if current.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a gestores",
        )
    return current
