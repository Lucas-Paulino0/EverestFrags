"""
EverestFrags — entrada principal da aplicação FastAPI

Responsabilidades:
  - Cria a instância FastAPI com metadados (título, versão, docs)
  - Configura CORS para aceitar requisições do frontend (localhost:5173 em dev)
  - Registra todos os routers
  - Cria as tabelas no banco ao iniciar (create_all) — fallback pra ambiente novo

NOTA: create_all() cria as tabelas se não existirem; não altera tabelas já existentes
(é um no-op seguro depois que o schema já está em sync, como hoje). O projeto agora
usa Alembic (alembic/) pra mudanças de schema — gerar revisão nova com
`alembic revision --autogenerate -m "..."` e aplicar com `alembic upgrade head` em vez
de ALTER TABLE manual. A migração baseline (8c264163dd4b) já está "stamped" no banco
local, refletindo o schema atual sem alterá-lo.

Rotas públicas (sem token):
  GET  /api/ranking
  GET  /api/players
  GET  /api/matches
  GET  /api/sort-teams
  GET  /api/stats/group-averages

Rotas autenticadas (qualquer player logado):
  GET  /api/auth/me
  GET  /api/players/{id}/stats
  POST /api/auth/change-password

Rotas de admin:
  POST /api/players
  GET  /api/players/steam-lookup
  PATCH /api/players/{id}
  POST /api/matches
  DELETE /api/matches/{id}
  POST /api/demo/parse
"""

import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.database import engine, Base
from app.limiter import limiter
from app.routers import auth, players, matches, ranking, sort, steam_auth, chat, demo, stats, export, wins, ai

logger = logging.getLogger(__name__)

# Importa todos os models para garantir que o create_all os detecte
import app.models  # noqa: F401

_DEBUG = os.getenv("DEBUG", "false").lower() == "true"

app = FastAPI(
    title="EverestFrags API",
    description="CS2 Mix Squad Tracker — ranking, partidas e sorteio de times",
    version="1.0.0",
    docs_url="/docs" if _DEBUG else None,
    redoc_url="/redoc" if _DEBUG else None,
    openapi_url="/openapi.json" if _DEBUG else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    if not _DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if "server" in response.headers:
        del response.headers["server"]
    return response

# CORS — FRONTEND_URL (mesma env var usada pelo redirect do Steam OpenID) é
# sempre liberada, então trocar o domínio do Vercel não exige redeploy do backend.
_cors_origins = [
    "http://localhost:5173",   # Vite dev server
    "http://localhost:4173",   # Vite preview
]
_frontend_url = os.getenv("FRONTEND_URL")
if _frontend_url and _frontend_url not in _cors_origins:
    _cors_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra todos os routers
app.include_router(auth.router)
app.include_router(steam_auth.router)
app.include_router(players.router)
app.include_router(matches.router)
app.include_router(ranking.router)
app.include_router(sort.router)
app.include_router(chat.router)
app.include_router(demo.router)
app.include_router(stats.router)
app.include_router(export.router)
app.include_router(wins.router)
app.include_router(ai.router)


@app.on_event("startup")
def create_tables():
    """
    Cria todas as tabelas definidas nos models se não existirem.
    Equivalente a 'alembic upgrade head' para a migração inicial.
    """
    Base.metadata.create_all(bind=engine)


@app.get("/")
def health():
    """Health check — confirma que a API está no ar."""
    return {"status": "ok", "service": "EverestFrags API v1.0.0"}
