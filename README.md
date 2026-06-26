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
- Chat em tempo real via WebSocket
- Perfil pessoal com stats e posicao no ranking
- Painel admin: criar/editar players, vincular Steam ID, gerenciar partidas

---

## Como o Ranking funciona

O ranking nao e um simples quadro de kills — ele tenta responder uma pergunta mais honesta: **quem joga melhor, consistentemente, em qualquer papel?**

Para isso, cada jogador recebe um score de 0 a 100 baseado em tres categorias:

**Combate** — voce mata, voce resiste, voce causa dano. K/D, ADR, HLTV Rating, KAST% e dano de granadas entram aqui. Nao basta matar muito, tem que morrer pouco tambem.

**Duelos** — qualidade nos confrontos diretos. Opening kills (quem abre o round?), trade kills, trade denials e TTK (tempo medio entre kills — quanto menor, mais rapido voce finaliza). Um jogador que abre rounds consistentemente vale ouro mesmo com K/D mediano.

**Utility** — flash assists, dano de HE, hits de fogo. Invisivel no placar, decisivo na partida.

Cada categoria pesa **1/3** do score final. Sem favoritismo.

### O score e relativo — e isso e intencional

O score usa **normalizacao min-max**: o melhor jogador do grupo em cada metrica recebe 100, o pior recebe 0, e os outros ficam distribuidos no meio.

Consequencia direta: **seu score pode mudar sem voce ter jogado.** Se o jogador que era o pior em kills jogar uma partida ainda pior, voce sobe — mesmo sem abrir o jogo. Parece estranho mas e matematicamente correto: sua posicao relativa no grupo mudou.

### Jogador com 3 partidas vs. jogador com 5 partidas

O sistema converte tudo para **taxa por partida** antes de calcular, neutralizando o vies de volume:

| | 3 partidas | 5 partidas |
|---|---|---|
| Kills totais | 60 | 100 |
| Kills por partida | **20** | **20** |
| Score recebido | igual | igual |

Performance igual → score igual. Quem joga mais nao leva vantagem so pelo volume — precisa manter o nivel.

### O que o ranking nao captura (ainda)

- **Resultado da partida** — vencer ou perder nao afeta o score, o que faz sentido para mixes onde os times mudam todo jogo.
- **HLTV Rating** — a formula usada e uma aproximacao baseada em engenharia reversa (a oficial nao e publica). Resultados ficam proximos, mas podem divergir em condicoes extremas.
- **Clutches e entry frags** como categorias separadas estao no radar para versoes futuras.

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
