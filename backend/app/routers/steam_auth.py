"""
Router — autenticação via Steam OpenID

Endpoints:
  GET  /api/auth/steam           → redireciona o usuário para o login da Steam
  GET  /api/auth/steam/callback  → processa o retorno da Steam, gera código opaco, redireciona
  POST /api/auth/steam/exchange  → troca o código opaco pelo JWT (JWT nunca aparece em URLs/logs)

Variáveis de ambiente necessárias:
  BACKEND_URL   → URL base do backend (ex: http://localhost:8001 em dev)
  FRONTEND_URL  → URL base do frontend (ex: http://localhost:5173 em dev)
  STEAM_API_KEY → chave da Steam Web API (opcional, mas necessária para buscar nickname)
"""

import os
import time
import uuid
from typing import Dict, Tuple
from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.steam_service import build_steam_redirect, verify_steam_response, get_steam_profile
from app.services.player_service import get_or_create_by_steam
from app.services.auth_service import create_access_token

router = APIRouter(prefix="/api/auth", tags=["steam-auth"])

# Códigos de troca de uso único: code → (token, player_data, expires_at)
# TTL de 30 segundos — o redirect frontend→exchange é quase instantâneo;
# 30s é generoso e ainda muito curto para ser explorado.
_pending_codes: Dict[str, Tuple[str, dict, float]] = {}


class SteamExchangeRequest(BaseModel):
    code: str


@router.get("/steam")
def steam_login():
    """Redireciona o usuário para a página de login da Steam."""
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8001")
    return_to = f"{backend_url}/api/auth/steam/callback"
    redirect_url = build_steam_redirect(return_to=return_to, realm=backend_url)
    return RedirectResponse(redirect_url)


@router.post("/steam/exchange")
def steam_exchange(body: SteamExchangeRequest):
    """
    Troca o código opaco pelo JWT real.

    O código é de uso único e expira em 30 segundos. Esta separação evita
    que o JWT apareça em logs de servidor (que registram URLs completas de redirect).
    """
    now = time.time()

    # Limpeza lazy dos códigos expirados
    expired = [k for k, (_, _, exp) in _pending_codes.items() if now > exp]
    for k in expired:
        del _pending_codes[k]

    entry = _pending_codes.get(body.code)
    if not entry or now > entry[2]:
        _pending_codes.pop(body.code, None)
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")

    token_str, player_data, _ = entry
    del _pending_codes[body.code]  # uso único
    return {"access_token": token_str, "token_type": "bearer", "player": player_data}


@router.get("/steam/callback")
async def steam_callback(request: Request, db: Session = Depends(get_db)):
    """
    Recebe o redirect da Steam após autenticação.

    Gera um código opaco de 30s em vez de expor o JWT na URL.
    O frontend troca esse código pelo token via POST /steam/exchange.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    steam_api_key = os.getenv("STEAM_API_KEY", "")

    try:
        # Parse manual para preservar '+' literais da assinatura base64 do Steam
        # (request.query_params usa parse_qsl que converte '+' em espaço, corrompendo o sig)
        raw_query = str(request.url.query)
        params = {}
        for pair in raw_query.split("&"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                params[unquote(k)] = unquote(v)

        steam_id = await verify_steam_response(params)

        if not steam_id:
            return RedirectResponse(f"{frontend_url}/login?error=steam_auth_failed")

        profile = await get_steam_profile(steam_id, steam_api_key)
        player, _created = get_or_create_by_steam(db, steam_id, profile)

        token = create_access_token({"sub": str(player.id)})

        player_data = {
            "id": player.id,
            "nickname": player.nickname,
            "display_name": player.display_name,
            "role": player.role,
            "avatar_initials": player.avatar_initials,
            "avatar_url": player.avatar_url,
        }

        code = str(uuid.uuid4())
        _pending_codes[code] = (token, player_data, time.time() + 30)

        return RedirectResponse(f"{frontend_url}/auth/callback?code={code}")

    except Exception:
        return RedirectResponse(f"{frontend_url}/login?error=steam_auth_failed")
