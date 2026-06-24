# EVERESTFRAGS

> **CS2 Mix Squad Tracker** — ranking e sorteio de times para grupos de amigos que jogam Counter-Strike 2.

---

## Objetivo

Um grupo fixo de amigos joga mixes de CS2 mas nao tinha como medir quem evoluia ou dividir os times de forma justa. O EverestFrags resolve dois problemas:

1. **Ranking consolidado** — cada partida alimenta um score calculado com 15 metricas reais (kills, ADR, HLTV Rating, opening kills, flash assists, etc.). O ranking mostra quem sao os melhores do grupo de forma objetiva.

2. **Sorteio equilibrado** — com o ranking calculado, o sistema avalia todas as combinacoes possiveis de divisao e escolhe uma aleatoriamente dentro da margem de 40-60%, garantindo times diferentes e equilibrados a cada sessao.

---

## Funcionalidades

- Login com Steam (OpenID) — sem precisar criar senha
- Login com nickname + senha para o admin
- Dashboard com podio top-3, ranking completo e scores por categoria
- Registro de partidas com 15 metricas do scope.gg
- Upload de demo `.dem` para preenchimento automatico das stats
- Historico paginado de partidas
- Sorteio aleatorio equilibrado (avalia todas as combinacoes, margem 40-60%)
- Configuracao dinamica dos pesos do score (Combate / Duelos / Utility)
- Chat em tempo real via WebSocket
- Perfil pessoal com stats e posicao no ranking
- Painel admin: criar/editar players, vincular Steam ID, gerenciar partidas

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | FastAPI (Python 3.11+) |
| Banco | PostgreSQL + SQLAlchemy 2.0 |
| Auth | JWT + bcrypt + Steam OpenID 2.0 |
| Frontend | React 18 + TypeScript + Vite |
| Deploy | Render (backend + banco) + Vercel (frontend) |

---

## Como rodar localmente

### Pre-requisitos

- Python 3.11+, Node.js 18+, PostgreSQL rodando localmente

### Backend

```bash
cd backend
cp .env.example .env
# Preencher no .env:
#   DATABASE_URL   = postgresql://user:senha@localhost:5432/everestfrags
#   SECRET_KEY     = string-aleatoria-longa (gerar: openssl rand -hex 32)
#   STEAM_API_KEY  = obter em steamcommunity.com/dev/apikey
#   BACKEND_URL    = http://localhost:8001
#   FRONTEND_URL   = http://localhost:5173

pip install -r requirements.txt
python seed.py          # cria tabelas + admin + 13 players reais
uvicorn main:app --reload --port 8001
```

Docs interativos: `http://localhost:8001/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173
```

Chamadas `/api/*` sao proxiadas automaticamente para o backend (vite.config.ts).

### Login de admin

```
Nickname: admin
Senha:    fragstack2025   <- trocar apos o primeiro login
```

Os 13 players do grupo ja estao no seed com Steam ID vinculado.
Eles so precisam clicar "Entrar com Steam" para acessar.

---

## Deploy

Ver secao completa em [CLAUDE.md](./CLAUDE.md) — instrucoes para Render (backend + PostgreSQL) e Vercel (frontend), variaveis de ambiente necessarias e checklist pos-deploy.

---

## Documentacao tecnica

Ver [CLAUDE.md](./CLAUDE.md) — arquitetura, formula do score, algoritmo de sorteio, fluxo de autenticacao Steam, bugs documentados e pendencias.

---

## Licenca

Projeto privado do grupo Everest Frags. Uso interno.
