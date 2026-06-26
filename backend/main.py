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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import auth, players, matches, ranking, sort, steam_auth, chat, demo

# Importa todos os models para garantir que o create_all os detecte
import app.models  # noqa: F401

app = FastAPI(
    title="EverestFrags API",
    description="CS2 Mix Squad Tracker — ranking, partidas e sorteio de times",
    version="1.0.0",
)

# CORS — em produção, substituir pelo domínio real do frontend (Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:4173",   # Vite preview
        "https://everestfrags.vercel.app",  # produção (ajustar conforme necessário)
    ],
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
