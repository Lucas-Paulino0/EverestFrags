"""
Model ORM — tabela 'chat_messages'

Histórico persistente do chat em tempo real. nickname/avatar_initials são uma
cópia (snapshot) do player no momento do envio — assim a mensagem continua
exibindo corretamente mesmo se o player for renomeado ou desativado depois.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # SET NULL (não CASCADE) — deletar um player não deve apagar o histórico do chat
    player_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="SET NULL"), nullable=True, index=True
    )
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    avatar_initials: Mapped[str] = mapped_column(String(2), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<ChatMessage id={self.id} player_id={self.player_id} text={self.text[:20]!r}>"
