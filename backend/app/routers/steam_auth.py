"""
Router — autenticação via Steam OpenID

Endpoints:
  GET /api/auth/steam           → redireciona o usuário para o login da Steam
  GET /api/auth/steam/callback  → processa o retorno da Steam, cria/encontra o player,
                                  emite JWT e redireciona para o frontend

Variáveis de ambiente necessárias:
  BACKEND_URL   → URL base do backend (ex: http://localhost:8001 em dev)
  FRONTEND_URL  → URL base do frontend (ex: http://localhost:5173 em dev)
  STEAM_API_KEY → chave da Steam Web API (opcional, mas necessária para buscar nickname)
"""

import os
import json
from urllib.parse import quote, unquote

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.steam_service import build_steam_redirect, verify_steam_response, get_steam_profile
from app.services.player_service import get_or_create_by_steam
from app.services.auth_service import create_access_token

router = APIRouter(prefix="/api/auth", tags=["steam-auth"])


@router.get("/steam")
def steam_login():
    """
    Redireciona o usuário para a página de login da Steam.

    A Steam vai autenticar o usuário e redirecioná-lo de volta para
    /api/auth/steam/callback com os parâmetros OpenID.
    """
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8001")
    return_to = f"{backend_url}/api/auth/steam/callback"
    redirect_url = build_steam_redirect(return_to=return_to, realm=backend_url)
    return RedirectResponse(redirect_url)


@router.get("/steam/callback")
async def steam_callback(request: Request, db: Session = Depends(get_db)):
    """
    Recebe o redirect da Steam após autenticação.

    Fluxo:
      1. Verifica a resposta OpenID com a Steam
      2. Extrai o Steam ID
      3. Busca o perfil na Steam Web API (nickname, avatar)
      4. Cria ou encontra o Player no banco
      5. Emite um JWT
      6. Redireciona para o frontend com o token e dados do player na query string

    Em caso de erro, redireciona para /login?error=steam_auth_failed.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    steam_api_key = os.getenv("STEAM_API_KEY", "")

    try:
        # parse manual para preservar '+' literais da assinatura base64 do Steam
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

        # Busca perfil na Steam API (nickname, avatar)
        profile = await get_steam_profile(steam_id, steam_api_key)

        # Cria ou atualiza o player no banco
        player, _created = get_or_create_by_steam(db, steam_id, profile)

        # Gera JWT com o ID do player
        token = create_access_token({"sub": str(player.id)})

        # Serializa dados do player para a query string (URL-encoded JSON)
        player_data = {
            "id": player.id,
            "nickname": player.nickname,
            "role": player.role,
            "avatar_initials": player.avatar_initials,
        }
        player_encoded = quote(json.dumps(player_data))

        return RedirectResponse(
            f"{frontend_url}/auth/callback?token={token}&player={player_encoded}"
        )
    except Exception as e:
        return RedirectResponse(f"{frontend_url}/login?error=steam_auth_failed")
