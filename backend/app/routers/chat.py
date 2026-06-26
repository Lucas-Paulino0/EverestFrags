"""
Router — chat em tempo real via WebSocket

Endpoint:
  WS /api/chat/ws?token=<JWT>  → conexão WebSocket autenticada

Mensagens são broadcast para todos os clientes conectados E persistidas na tabela
chat_messages. Ao conectar, o cliente recebe um lote com as últimas mensagens
({"type": "history"}) antes de qualquer mensagem nova chegar.

Formato de mensagem (JSON):
  Entrada:  { "text": "mensagem" }
  Saída:    { "type": "message", "player_id": 1, "nickname": "GodBR", "avatar_initials": "GB", "text": "...", "timestamp": "..." }
"""

import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from time import time
from typing import Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt

router = APIRouter(prefix="/api/chat", tags=["chat"])

HISTORY_LIMIT = 50

# Rate limiting em memória — sem Redis, sem dependência nova.
# Estado reinicia com o servidor (aceitável para MVP: flood ocasional perde o estado
# após restart, mas protege contra flood contínuo durante a sessão).
RATE_WINDOW = 10   # segundos por janela deslizante
RATE_MAX    = 5    # máximo de mensagens por jogador por janela

_rate: Dict[int, list] = defaultdict(list)  # player_id → lista de timestamps

# Mapa de conexões ativas: player_id → (WebSocket, nickname, avatar_initials)
_connections: Dict[int, tuple] = {}


def _decode_token(token: str) -> dict | None:
    secret = os.getenv("SECRET_KEY", "")
    algo = os.getenv("ALGORITHM", "HS256")
    try:
        return jwt.decode(token, secret, algorithms=[algo])
    except JWTError:
        return None


async def _broadcast(message: dict):
    payload = json.dumps(message, ensure_ascii=False)
    dead = []
    for pid, (ws, _, _) in list(_connections.items()):
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(pid)
    for pid in dead:
        _connections.pop(pid, None)


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket, token: str = Query(...)):
    payload = _decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    # Importa aqui para evitar import circular
    from app.database import SessionLocal
    from app.models.player import Player
    from app.models.chat_message import ChatMessage

    db = SessionLocal()
    try:
        player_id = int(payload.get("sub", 0))
        player = db.query(Player).filter(Player.id == player_id, Player.is_active == True).first()
        if not player:
            await websocket.close(code=4003)
            return

        # Histórico — últimas mensagens, em ordem cronológica
        history_rows = (
            db.query(ChatMessage)
            .order_by(ChatMessage.created_at.desc())
            .limit(HISTORY_LIMIT)
            .all()
        )
        history_rows.reverse()
    finally:
        db.close()

    await websocket.accept()
    _connections[player_id] = (websocket, player.nickname, player.avatar_initials)

    await websocket.send_text(json.dumps({
        "type": "history",
        "messages": [
            {
                "type": "message",
                "player_id": m.player_id,
                "nickname": m.nickname,
                "avatar_initials": m.avatar_initials,
                "text": m.text,
                "timestamp": m.created_at.isoformat(),
            }
            for m in history_rows
        ],
    }, ensure_ascii=False))

    # Avisa que o player entrou
    await _broadcast({
        "type": "join",
        "player_id": player_id,
        "nickname": player.nickname,
        "avatar_initials": player.avatar_initials,
        "text": f"{player.nickname} entrou no chat",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                text = str(data.get("text", "")).strip()[:500]
            except Exception:
                continue

            if not text:
                continue

            # Rate limiting: janela deslizante de RATE_WINDOW segundos
            now = time()
            _rate[player_id] = [t for t in _rate[player_id] if now - t < RATE_WINDOW]
            if len(_rate[player_id]) >= RATE_MAX:
                await websocket.send_json({"error": "rate_limit", "retry_after": RATE_WINDOW})
                continue
            _rate[player_id].append(now)

            timestamp = datetime.now(timezone.utc)

            db = SessionLocal()
            try:
                db.add(ChatMessage(
                    player_id=player_id,
                    nickname=player.nickname,
                    avatar_initials=player.avatar_initials,
                    text=text,
                ))
                db.commit()
            finally:
                db.close()

            await _broadcast({
                "type": "message",
                "player_id": player_id,
                "nickname": player.nickname,
                "avatar_initials": player.avatar_initials,
                "text": text,
                "timestamp": timestamp.isoformat(),
            })

    except WebSocketDisconnect:
        _connections.pop(player_id, None)
        await _broadcast({
            "type": "leave",
            "player_id": player_id,
            "nickname": player.nickname,
            "avatar_initials": player.avatar_initials,
            "text": f"{player.nickname} saiu do chat",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
