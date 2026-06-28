"""
Model ORM — tabela 'players'

Player é ao mesmo tempo o perfil do jogador e a conta de acesso (não há tabela
User separada). O campo role controla o nível de permissão: 'admin' pode criar
partidas e gerenciar jogadores; 'viewer' só lê o ranking.

ATENÇÃO (bug anterior): a versão antiga desse modelo usava o campo 'name' em vez
de 'nickname', e não tinha os campos de auth (password_hash, role, is_active).
Isso tornava impossível implementar login e o campo não batia com o spec.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import Integer, String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.database import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Nome de exibição único — usado no login e no ranking
    nickname: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    # Steam ID opcional — reservado para integração futura com Steam API / awpy
    steam_id: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Iniciais para o avatar gerado (ex: "GB" para GodBR) — fallback quando não há avatar_url
    avatar_initials: Mapped[str] = mapped_column(String(2), nullable=False, default="??")

    # Foto de perfil da Steam (avatarfull) — atualizada a cada login via Steam
    avatar_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Apelido editável pelo próprio player ou admin — não é sincronizado com a Steam.
    # 'nickname' continua sendo o nome sincronizado com a conta Steam (e o identificador
    # único usado em login/matching); display_name é só de exibição, sobrepõe o nickname
    # na UI quando definido.
    display_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Senha bcrypt — NULL enquanto o player ainda não definiu senha
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # 'admin' pode criar/deletar partidas e jogadores; 'viewer' só lê
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")

    # Permite desativar um player sem deletar seu histórico
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relacionamento reverso com todas as stats de partidas deste jogador
    stats: Mapped[List["PlayerMatchStats"]] = relationship(  # noqa: F821
        "PlayerMatchStats", back_populates="player", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Player id={self.id} nickname={self.nickname!r} role={self.role!r}>"
