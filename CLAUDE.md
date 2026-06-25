# EverestFrags — CS2 Mix Squad Tracker
## Documentação técnica completa

---

## O que é este projeto

Um grupo fixo de ~15 amigos joga mixes de CS2 com frequência. O problema: não havia como
saber quem estava evoluindo, nem como dividir os times de forma justa para um 5x5 equilibrado.

O EverestFrags resolve dois problemas centrais:

1. **Ranking consolidado** — cada partida registrada alimenta um score calculado com 15 métricas
   reais do jogo (kills, ADR, HLTV Rating, opening kills, flash assists…). O ranking mostra,
   de forma objetiva, quem são os melhores do grupo.

2. **Sorteio equilibrado** — com o ranking em mãos, o sistema usa Snake Draft para distribuir
   os jogadores selecionados em 2 ou 3 times, minimizando a diferença de skill total entre eles.

---

## Stack

```
Backend:  FastAPI (Python 3.11+) + PostgreSQL + SQLAlchemy 2.0
Auth:     JWT (python-jose) + bcrypt (passlib) + Steam OpenID 2.0
Frontend: React 18 + TypeScript + Vite (sem Tailwind, CSS puro)
Deploy:   Render (backend + PostgreSQL free tier) + Vercel (frontend)
```

---

## Estrutura de pastas

```
EverestFrags/
├── backend/
│   ├── main.py                      ← FastAPI app, CORS, routers, create_all()
│   ├── seed.py                      ← Cria tabelas + admin + 15 players + 11 partidas de exemplo
│   ├── .env                         ← Variáveis de ambiente — NÃO commitar
│   ├── .env.example                 ← Template comentado do .env
│   ├── requirements.txt
│   └── app/
│       ├── database.py              ← Engine SQLAlchemy, SessionLocal, get_db()
│       ├── models/
│       │   ├── player.py            ← Player (auth embutido: password_hash, role, is_active)
│       │   ├── match.py             ← Match + PlayerMatchStats (15 métricas)
│       │   └── ranking_config.py   ← RankingConfig (singleton de pesos — sempre 1 linha)
│       ├── schemas/
│       │   ├── player.py            ← PlayerCreate, PlayerUpdate, PlayerPublic, PlayerResponse
│       │   ├── match.py             ← MatchCreate, MatchDetailResponse, PaginatedMatchResponse
│       │   ├── auth.py              ← LoginRequest, TokenResponse, PasswordChange
│       │   ├── ranking.py           ← RankingEntry, RankingConfigUpdate (valida soma = 1.0)
│       │   └── sort.py              ← SortTeamsResponse, TeamResult, PlayerInTeam
│       ├── services/
│       │   ├── auth_service.py      ← JWT, bcrypt, get_current_player, require_admin
│       │   ├── player_service.py    ← CRUD, authenticate(), get_or_create_by_steam()
│       │   ├── match_service.py     ← CRUD matches + stats (transação única com flush)
│       │   ├── ranking_service.py   ← Fórmula min-max normalização + pesos do banco
│       │   ├── sort_service.py      ← Algoritmo Snake Draft em memória
│       │   ├── steam_service.py     ← OpenID build_redirect, verify_response, get_steam_profile
│       │   └── demo_service.py      ← Parser .dem: 4 eventos, sem parse_ticks, dicts leves, chave = steamid
│       └── routers/
│           ├── auth.py              ← POST /login, GET /me, POST /change-password, POST /logout
│           ├── steam_auth.py        ← GET /steam, GET /steam/callback
│           ├── players.py           ← GET/POST /players, GET/PATCH /players/{id}
│           ├── matches.py           ← GET/POST /matches, GET/DELETE /matches/{id}
│           ├── ranking.py           ← GET /ranking (público), GET/PUT /ranking/config (admin)
│           ├── sort.py              ← GET /sort-teams?players=1,2,3&teams=2
│           ├── chat.py              ← WS /chat/ws?token=JWT (broadcast em memória, sem persistência)
│           └── demo.py              ← POST /demo/parse (upload .dem, admin only, max 750 MB) — casa/cria players via steam_id
│
├── frontend/
│   ├── index.html                   ← HTML base com Google Fonts (Barlow Condensed, Inter, JetBrains Mono)
│   ├── .env                         ← VITE_API_URL= (vazio em dev — usa proxy Vite → 8001)
│   ├── .env.production              ← VITE_API_URL=https://SEU-APP.onrender.com (preencher no Vercel)
│   ├── vite.config.ts               ← Proxy /api/* → localhost:8001 sem strip de path
│   └── src/
│       ├── main.tsx                 ← Entry point React
│       ├── App.tsx                  ← Roteamento (react-router-dom v6)
│       ├── index.css                ← Design system: reset, ef-slider, efShake, scanlines
│       ├── vite-env.d.ts            ← Tipos Vite (necessário para import.meta.env)
│       ├── api/client.ts            ← Fetch wrapper: injeta token, trata 401, tipagens
│       ├── context/AuthContext.tsx  ← Estado global: login(), loginWithToken(), logout()
│       ├── components/
│       │   ├── ProtectedRoute.tsx   ← ProtectedRoute + AdminRoute para react-router
│       │   ├── Navbar.tsx           ← Barra de navegação (Dashboard/Partidas/Sorteio/Chat/Perfil)
│       │   ├── RadarChart.tsx       ← SVG hexagonal puro, 6 eixos, sem biblioteca
│       │   ├── CategoryBar.tsx      ← Barra de progresso por categoria
│       │   ├── PodiumCard.tsx       ← Card top-3 (radar + barras + pills)
│       │   ├── RankCard.tsx         ← Card médio (4–11) e compacto (12+)
│       │   └── WeightConfigModal.tsx← Modal com sliders interdependentes
│       └── pages/
│           ├── Login.tsx            ← Login nickname+senha e botão "Entrar com Steam"
│           ├── SteamCallback.tsx    ← Processa redirect do Steam (/auth/callback)
│           ├── Dashboard.tsx        ← Ranking: pódio + grade + lista compacta
│           ├── Matches.tsx          ← Histórico paginado + delete (admin) + clique abre MatchDetail
│           ├── MatchDetail.tsx      ← /matches/:id — stats básicas (K/D/A, +/-, ADR, RATING) + delete (admin)
│           ├── AddMatch.tsx         ← Formulário nova partida + drop-zone de .dem embutida (extrai e preenche na mesma tela)
│           ├── Sort.tsx             ← Sorteio: checkboxes + 2/3 times + resultado
│           ├── Profile.tsx          ← Perfil pessoal: ranking + stats + alterar senha
│           ├── Admin.tsx            ← Gestão: criar/editar players (com Steam ID), deletar partidas
│           └── Chat.tsx             ← Chat em tempo real via WebSocket
│
└── Everest Frags rebrand/           ← Referências de design (NÃO é código de produção)
    ├── EverestFrags Dashboard.dc.html ← Protótipo Declutter (referência visual)
    ├── screenshots/                 ← Prints do design
    └── uploads/
        ├── EverestFrags-prompt-claude-code.md   ← Spec original
        └── FRAGSTACK-prompt-complementar-2.md   ← Spec auth + pesos dinâmicos
```

---

## Banco de dados

### Diagrama de relacionamentos

```
players ──────────────────────────────────────────┐
  id (PK)                                         │
  nickname        (unique, obrigatório)            │
  steam_id        (opcional — preenchido no login  │
  avatar_initials  Steam ou manualmente)           │
  password_hash   (nulo para players Steam-only)  │
  role            'admin' | 'viewer'               │
  is_active       boolean                         │
  created_at                                      │
        │                                         │
        │ 1:N                                     │ 1:N
        ▼                                         ▼
player_match_stats                          ranking_config
  id (PK)                                     id (PK) ← sempre 1 linha
  player_id  (FK → players)                   weight_combat   (ex: 0.50)
  match_id   (FK → matches)                   weight_duel     (ex: 0.30)
  UNIQUE(player_id, match_id)                 weight_utility  (ex: 0.20)
  -- métricas base --                         updated_at
  kills, deaths, assists                      updated_by (FK → players)
  damage_total, adr, adr_difference
  hltv_rating, kast_percent         ◄── matches
  opening_kills, trade_kills            id (PK)
  time_to_kill_ms                       scope_url  (link scope.gg)
  flash_assists, grenade_damage         played_at  (date)
  he_enemies_hit, fire_enemies_hit      map_name
  -- situacionais (HLTV 3.0) --              notes
  -- ⚠ ainda NÃO existem no model --     created_at
  -- ver "O que falta implementar" --
```

### Decisões de design do banco

**Por que Player tem campos de auth (password_hash, role)?**
Num primeiro rascunho havia tabela `User` separada. Mas no projeto, cada player do grupo
É também um usuário do sistema — não existe player sem conta, nem conta sem player.
Unificar evita JOINs desnecessários e mantém o modelo simples.

**Por que o sorteio não tem tabela?**
Times não são persistidos. O sorteio é calculado em memória a cada requisição (`sort_service.py`).
Isso foi intencional: os times mudam a cada sessão de jogo, guardar seria lixo no banco.

**Por que RankingConfig é singleton (sempre 1 linha)?**
Os pesos (combate/duelos/utility) são uma configuração global, não por partida.
A lógica do `ranking_service.py` sempre lê a linha com `id=1`. A primeira linha
é criada pelo `seed.py`; o admin só pode editar, nunca criar uma segunda.

**Criação de tabelas**
`Base.metadata.create_all()` roda no startup (`main.py`). Sem Alembic por enquanto.
Cria tabelas se não existirem; não altera schema de tabelas já existentes.

### Variáveis de ambiente necessárias (`.env`)

```bash
# Banco
DATABASE_URL=postgresql://user:password@host:5432/everestfrags

# Auth JWT
SECRET_KEY=string-aleatoria-muito-longa
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480   # 8 horas

# Steam OpenID + Web API
STEAM_API_KEY=sua-chave-steam   # steamcommunity.com/dev/apikey
BACKEND_URL=http://localhost:8001  # URL do backend (Steam vai redirecionar aqui)
FRONTEND_URL=http://localhost:5173 # URL do frontend (backend redireciona o player aqui)
```

---

## Sistema de Score e Ranking

### Filosofia — inspirado na evolução do HLTV Rating

O sistema foi desenhado acompanhando a evolução histórica do HLTV:
- **Rating 1.0 (2010):** só K/D + multikills
- **Rating 2.0 (2017):** adicionou ADR, KAST, Impact
- **Rating 2.1 (out/2024):** penalizou saving, igualou pesos das sub-ratings, ajustou para MR12
- **Rating 3.0 (ago/2025):** adicionou Round Swing (valor contextual de cada kill) e eco-adjustment

Nossa fórmula incorpora as mesmas ideias: kills em situação difícil valem mais, kills fáceis valem menos.

### Como funciona (resumo)

O score final é calculado **comparando todos os jogadores entre si** — não é absoluto.
Um jogador com 30 kills num grupo fraco pode ter score menor que um com 20 kills
num grupo forte, dependendo de como os outros foram.

### Passo 1 — Agregação por jogador (todas as partidas)

Antes de calcular o score, as métricas são agregadas ao longo de TODAS as partidas:

| Métricas somadas (volume) | Métricas por média (consistência) |
|---------------------------|-----------------------------------|
| kills, deaths, assists | adr, adr_difference |
| damage_total | hltv_rating, kast_percent |
| opening_kills, trade_kills, trade_denials | time_to_kill_ms |
| flash_assists, grenade_damage | |
| he_enemies_hit, fire_enemies_hit | |
| disadvantage_kills, advantage_kills, eco_kills | |

### Passo 2 — Normalização min-max (0 a 100)

Cada métrica é normalizada **dentro do grupo atual de jogadores com partidas**:

```
score_normal = (valor_jogador - min_do_grupo) / (max_do_grupo - min_do_grupo) × 100
```

Métricas onde **menor é melhor** são invertidas:
- `deaths` — morreu menos = melhor
- `time_to_kill_ms` — matou mais rápido = melhor

```
score_invertido = (max_do_grupo - valor_jogador) / (max_do_grupo - min_do_grupo) × 100
```

Se todos os jogadores têm o mesmo valor numa métrica → score = 50 para todos (empate perfeito).

### Passo 3 — Score por categoria com ajustes contextuais

**Score Combate** — média ponderada de:

| Métrica | Peso/Ajuste |
|---------|-------------|
| kills (normalizado) | base |
| deaths (invertido) | base |
| assists | base |
| damage_total | base |
| adr | base |
| adr_difference | base |
| hltv_rating | resumo externo |
| kast_percent | consistência |
| grenade_damage | utility de dano |
| **eco_kills** | **valem 0.5× — kill fácil penalizada** |
| **disadvantage_kills** | **valem 1.3× — kill difícil bonificada** |
| **advantage_kills** | **valem 0.8× — kill com vantagem penalizada** |

> Esses três multiplicadores são aplicados ANTES da normalização, ajustando o valor bruto
> de kills de acordo com o contexto da rodada — mesma lógica do HLTV 3.0 Round Swing.
>
> ⚠️ **Isto é o spec, não o código atual.** `ranking_service.py` ainda não lê
> `eco_kills`/`disadvantage_kills`/`advantage_kills`/`trade_denials` — essas colunas nem
> existem em `PlayerMatchStats` hoje. Ver "O que falta implementar".

**Score Duelos** — média de:

| Métrica | Descrição |
|---------|-----------|
| opening_kills | primeiro kill do round — abre vantagem numérica |
| trade_kills | vingança em até 5s após morte de companheiro |
| trade_denials | impediu que inimigo tradasse kill de companheiro em 5s |
| time_to_kill_ms (invertido) | mais rápido = mais decisivo no duelo |

**Score Utility** — média de:

| Métrica | Descrição |
|---------|-----------|
| flash_assists | cegou inimigo que foi morto em seguida |
| grenade_damage | dano de HE |
| he_enemies_hit | cobertura de área |
| fire_enemies_hit | molotov/incendiária |

### Passo 4 — Score final ponderado

```
score_final = (score_combate  × peso_combate)   # default 0.50
            + (score_duelo    × peso_duelo)      # default 0.30
            + (score_utility  × peso_utility)    # default 0.20
```

Os pesos são lidos da tabela `ranking_config` a cada cálculo — nunca hardcodados.
O admin pode ajustá-los em tempo real pelo modal de configuração no Dashboard.
A validação garante que a soma dos 3 pesos sempre seja exatamente 1.0 (100%).

---

## Métricas Situacionais — Como Calcular do .dem

Estas 4 métricas são calculadas em `demo_parser.py` durante o parsing do arquivo `.dem`:

### disadvantage_kills — kill em desvantagem numérica

```python
# A cada kill, verificar contagem de jogadores vivos no momento
# Se time do atirador tem MENOS jogadores vivos que o inimigo → disadvantage kill
alive_attackers = count_alive(team=attacker_team, tick=kill_tick)
alive_victims   = count_alive(team=victim_team,   tick=kill_tick)
if alive_attackers < alive_victims:
    disadvantage_kills += 1
```

### advantage_kills — kill em vantagem numérica

```python
# Inverso: time do atirador tem MAIS jogadores vivos
if alive_attackers > alive_victims:
    advantage_kills += 1
# Obs: kills em situação 1v1 (igual) não são nem advantage nem disadvantage
```

### eco_kills — kill contra inimigo mal equipado

```python
# Classificar o equipamento da vítima no momento da kill
# Se valor de equipamento < ECO_THRESHOLD (ex: < $1000 de valor de arma) → eco kill
victim_equipment_value = get_equipment_value(victim, tick=kill_tick)
if victim_equipment_value < ECO_THRESHOLD:
    eco_kills += 1
```

### trade_denials — impediu troca adversária

```python
# Após uma kill de um companheiro: se o atirador eliminar o attacker inimigo
# em até 5 segundos, ele negou a troca do adversário
WINDOW_TICKS = 5 * 64  # 5 segundos a 64 tick
for teammate_kill in kills_by_team:
    enemy_attacker = teammate_kill.attacker
    if player_killed(enemy_attacker, within=WINDOW_TICKS, after=teammate_kill.tick):
        trade_denials += 1
```

---

## Sistema de Sorteio (Aleatório Equilibrado)

### Objetivo

Times **diferentes** a cada sessão, sempre dentro de uma margem de equilíbrio de 40-60%.
O mesmo grupo de 10 jogadores pode produzir dezenas de divisões válidas — o sistema
escolhe uma aleatoriamente entre elas.

### Como o algoritmo funciona (`sort_service.py`)

**Entrada:** lista de player_ids selecionados + número de times (2 ou 3)

**Passo 1 — Score dos jogadores**

Consulta o ranking calculado (`ranking_service.get_ranking()`).
Jogadores sem partidas registradas têm score 0 e ficam no fim da lista.

**Passo 2 — Gera todas as combinações possíveis**

```
2 times, 10 jogadores → C(9,4) = 126 combinações únicas
2 times, 18 jogadores → C(17,8) = 24.310 combinações únicas
3 times, 9  jogadores → C(9,3)×C(6,3) = 1.680 combinações
3 times, 15 jogadores → amostragem de 6.000 tentativas aleatórias
```

Para N grande (> 15.000 combinações), usa amostragem aleatória em vez de enumeração.

**Passo 3 — Filtra por margem de equilíbrio**

```
2 times: diff / total_score <= 0.20  →  garante equilíbrio 40/60
3 times: diff / total_score <= 0.15  →  garante ~±8% por time
```

**Passo 4 — Escolha aleatória**

Se houver combinações válidas → escolhe uma aleatoriamente (`random_balanced`).
Se nenhuma couber na margem (grupo muito desequilibrado) → usa a de menor diferença (`best_effort`).

**Retorno do endpoint `/api/sort-teams`:**

```json
{
  "teams": [
    { "team_number": 1, "players": [...], "total_score": 218, "avg_score": 72.7 },
    { "team_number": 2, "players": [...], "total_score": 203, "avg_score": 67.7 }
  ],
  "diff_score": 15.0,
  "algorithm": "random_balanced"
}
```

**Importante:** o sorteio é **stateless** — não salva nada no banco.
Cada chamada é independente. Clicar SORTEAR novamente gera uma divisão diferente.

---

## Upload de Demo (.dem) — identificação por steam_id

O upload de `.dem` foi unificado na própria tela "Adicionar Partida" (`/matches/new`) —
não existe mais uma página separada de upload. O admin arrasta o arquivo, clica em
"EXTRAIR DO DEMO" e a tabela de stats é preenchida ali mesmo, sem navegação.

### Por que por steam_id e não por nickname?

Nicknames mudam entre partidas e podem colidir entre contas diferentes; o steamid64
de cada jogador é estável e está disponível em todo evento do demo (`attacker_steamid`,
`user_steamid`, `assister_steamid` via `demoparser2`). `demo_service.py` usa o steamid
como chave de agregação das métricas — o nickname vira só um campo de exibição.

### Fluxo (`POST /api/demo/parse`)

```
1. demo_service.parse_demo() agrega as métricas por steamid (não por nome)
2. Para cada steamid encontrado, o router demo.py chama
   player_service.get_or_create_by_steam(db, steam_id, fallback_nickname=nick_do_demo)
   → player já existe (por steam_id)?  usa a conta existente
   → não existe?                       cria Player novo (role=viewer, sem senha,
                                        nickname = nick visto no demo)
3. Cada player no retorno já vem com player_id resolvido + a lista created_players[]
   (contas novas criadas nesse upload)
4. AddMatch.tsx casa as linhas da tabela por player_id (não por nickname) e seleciona
   automaticamente quem tiver match
```

`get_or_create_by_steam()` é a mesma função usada pelo login via Steam OpenID — agora
aceita um `fallback_nickname` opcional para quando não há perfil Steam disponível
(caso do demo upload, que não consulta a Steam Web API).

Jogadores do demo sem steamid (raro — bot/anônimo) ficam com `player_id: null` e
aparecem num aviso "sem steam_id, não foi possível criar/casar conta" — não bloqueiam
o restante do upload.

⚠️ **Pegadinha:** o endpoint `GET /api/players` (usado para montar a tabela do AddMatch)
filtra `is_active=True` por padrão. Se uma conta criada via demo for desativada depois
pelo Admin, ela some da tabela do AddMatch mesmo que o `player_id` continue resolvendo
certo no parse — o jogador simplesmente não aparece pra ser selecionado, sem aviso. Se
isso acontecer, reative o player em `/admin` antes de tentar lançar a partida.

---

## Autenticação

### Dois métodos de login

**1. Nickname + Senha (admin e players cadastrados manualmente)**
```
POST /api/auth/login
Body: { "nickname": "admin", "password": "fragstack2025" }
Retorna: { "access_token": "JWT...", "player": { id, nickname, role, avatar_initials } }
```

**2. Steam OpenID (players do grupo)**
```
Fluxo completo:
  Usuário clica "Entrar com a Steam"
      → frontend navega para /api/auth/steam
          → backend redireciona para steamcommunity.com/openid/login
              → Steam autentica e retorna para /api/auth/steam/callback
                  → backend verifica a resposta (POST de confirmação para a Steam)
                      → extrai Steam ID, busca perfil na Steam Web API
                          → cria Player no banco (se primeiro acesso) com role=viewer
                              → emite JWT idêntico ao login normal
                                  → redireciona para /auth/callback?token=JWT&player={...}
                                      → SteamCallback.tsx salva token e redireciona para /
```

Após o login, o comportamento é idêntico independente do método — ambos usam JWT.

### Token JWT

- Armazenado em `localStorage` com chave `ef_token`
- Dados do player em `localStorage` com chave `ef_player`
- O `api/client.ts` injeta `Authorization: Bearer <token>` em toda requisição automaticamente
- Em resposta 401: limpa localStorage e redireciona para `/login`

### Tabela de permissões

| Endpoint | Público | Viewer | Admin |
|----------|---------|--------|-------|
| GET /api/ranking | ✓ | ✓ | ✓ |
| GET /api/players | ✓ | ✓ | ✓ |
| GET /api/matches | ✓ | ✓ | ✓ |
| GET /api/sort-teams | ✓ | ✓ | ✓ |
| GET /api/auth/me | — | ✓ | ✓ |
| GET /api/players/{id}/stats | — | ✓ | ✓ |
| POST /api/auth/change-password | — | ✓ | ✓ |
| POST /api/players | — | — | ✓ |
| PATCH /api/players/{id} | — | — | ✓ |
| POST /api/matches | — | — | ✓ |
| DELETE /api/matches/{id} | — | — | ✓ |
| GET/PUT /api/ranking/config | — | — | ✓ |

---

## Identidade Visual

| Token | Valor | Uso |
|-------|-------|-----|
| `#080808` | Fundo principal | Fundo de todas as páginas |
| `#cc2200` | Vermelho (primário) | CTAs, 1º lugar, acento principal |
| `#7c3aed` | Roxo (secundário) | 2º lugar, duelos |
| `#e0a82e` | Dourado | 3º lugar, utility |
| `#0d0d0d` | Card bg | Fundo dos cards |
| `#1c1c1c` | Borda | Bordas e divisores |
| `#f4f4f4` | Texto principal | Títulos e nomes |
| `#9a9a9a` | Texto secundário | Labels e subtítulos |
| Barlow Condensed | Display | Títulos, scores, nomes de jogadores |
| Inter | Corpo | Labels, textos corridos |
| JetBrains Mono | Dados | Números, stats, código |

Regras: sem Tailwind, sem border-radius excessivo, sem emojis na UI, estética FPS/militar.
Efeito scanlines em todas as páginas via `repeating-linear-gradient` fixo.

---

## Como rodar localmente

### Pré-requisitos
- Python 3.11+, Node.js 18+, PostgreSQL (local ou Docker)

### Backend

```bash
cd backend
cp .env.example .env
# Preencher: DATABASE_URL, SECRET_KEY, STEAM_API_KEY, BACKEND_URL, FRONTEND_URL

pip install -r requirements.txt
python seed.py              # cria tabelas + dados de exemplo
uvicorn main:app --reload --port 8001
# Docs: http://localhost:8001/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
# /api/* vai pelo proxy → localhost:8001 (vite.config.ts)
```

### Credenciais de teste (seed.py)

```
admin   / fragstack2025   ← trocar após o primeiro login!
players / player123
```

---

## Deploy

### Backend — Render

1. Criar **Web Service** apontando para `/backend`
2. **Build:** `pip install -r requirements.txt`
3. **Start:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Criar **PostgreSQL** no Render e copiar a `DATABASE_URL` gerada
5. Env vars no Render:
   ```
   DATABASE_URL        = (gerado pelo Render)
   SECRET_KEY          = (string aleatória longa — gerar no terminal: openssl rand -hex 32)
   ALGORITHM           = HS256
   ACCESS_TOKEN_EXPIRE_MINUTES = 480
   STEAM_API_KEY       = (obter em steamcommunity.com/dev/apikey)
   BACKEND_URL         = https://seu-app.onrender.com
   FRONTEND_URL        = https://seu-app.vercel.app
   ```
6. Primeiro deploy: rodar `python seed.py` via Shell do Render

### Frontend — Vercel

1. Importar repositório, pasta raiz: `frontend/`, framework: **Vite**
2. Env var no Vercel: `VITE_API_URL=https://seu-app.onrender.com`
3. Deploy automático a cada push para main

---

## Rotas do frontend (App.tsx)

| Rota | Acesso | Página |
|------|--------|--------|
| `/login` | público | Login (nickname+senha ou Steam) |
| `/auth/callback` | público | SteamCallback (processa redirect OpenID) |
| `/` | público | Dashboard (ranking completo) |
| `/matches` | público | Histórico de partidas paginado |
| `/matches/new` | admin | Formulário de nova partida (com upload de .dem embutido) |
| `/matches/:id` | público | Detalhes da partida — stats básicas por jogador |
| `/sort` | público | Sorteio de times (Snake Draft) |
| `/profile` | autenticado | Perfil pessoal + alterar senha |
| `/admin` | admin | Gestão de players e partidas |
| `/chat` | público | Chat em tempo real (WebSocket) |
| `/*` | — | Redireciona para `/` |

---

## O que falta implementar

### Crítico (bloqueia uso real)
- [ ] Deploy no Render + Vercel — projeto ainda não está no ar
- [ ] Testar endpoints após deploy (especialmente WebSocket e demo parser)
- [ ] Trocar senha do admin após primeiro login
- [ ] Verificar se `demoparser2` (lib Rust) instala corretamente no ambiente Linux do Render

### Importantes (melhoram a experiência)
- [ ] Chat sem persistência — mensagens somem se o servidor reiniciar; considerar Redis pub/sub ou tabela no banco
- [ ] Busca de perfil Steam ao cadastrar player manualmente no Admin (hoje precisa copiar o ID na mão)
- [ ] `kast_percent` fixado em 50 no `demo_service.py` — cálculo real exige `parse_ticks()` que carrega todo o demo em memória

### Futuro
- [ ] `disadvantage_kills`, `advantage_kills`, `eco_kills` não são calculadas no demo parser ainda (precisam de `parse_ticks`)
- [ ] `trade_denials` já É calculada em `demo_service.py`, mas não existe coluna em `PlayerMatchStats`/`PlayerStatsCreate` — hoje esse valor é descartado ao criar a partida
- [ ] `ranking_service.py` não usa nenhuma das 4 métricas situacionais no cálculo do score — os multiplicadores documentados na seção "Score Combate" são spec, não código
- [ ] Alembic — migrações incrementais quando o schema precisar evoluir
- [ ] Integração direta com scope.gg (scraping ou API oficial se existir)
- [ ] Aviso explícito no AddMatch quando um `player_id` resolvido pelo demo pertence a uma conta `is_active=False` (hoje o jogador some da tabela sem nenhum aviso — só o caso "sem steam_id" é avisado)

---

## Bugs registrados e corrigidos

### Bug 1 — Models com campos errados (reconstrução completa)
Primeira versão: `name` em vez de `nickname`, model `MatchPlayer` com apenas 5 campos.
Faltavam `hltv_rating`, `kast_percent`, `opening_kills`, `trade_kills`, `time_to_kill_ms` etc.
Impossível calcular a fórmula de score por categoria.
**Fix:** Models reconstruídos do zero seguindo o spec original (15 métricas).

### Bug 2 — Tabela `users` separada de `players`
Havia model `User` separado. No projeto, Player É o usuário (tem `password_hash`, `role`, `is_active`).
**Fix:** Campos de auth movidos para Player. Tabela `users` removida.

### Bug 3 — Models `Team` e `TeamMember` persistidos no banco
Times não devem ser salvos — o sorteio é stateless (calculado em memória).
**Fix:** Models removidos. Sorteio feito em `sort_service.py` sem escrita no banco.

### Bug 4 — `@validator` (Pydantic v1) em vez de `@model_validator` (Pydantic v2)
O spec usava sintaxe v1 para validar que pesos somam 1.0.
**Fix:** `@model_validator(mode="after")` conforme Pydantic v2.

### Bug 5 — `Field` não importado em `schemas/ranking.py`
`RankingConfigUpdate` usava `Field(...)` sem importar.
**Fix:** `from pydantic import BaseModel, Field, model_validator`.

### Bug 6 — `index.css` do projeto FlameOS (projeto diferente)
Arquivo tinha glassmorphism, fundo `#0a0d13`, laranja `#f97316`.
**Fix:** Reescrito com design system EverestFrags.

### Bug 7 — Proxy Vite removendo `/api` das rotas
`vite.config.ts` tinha `rewrite: path => path.replace(/^\/api/, '')`.
Como todas as rotas FastAPI têm `/api`, isso quebrava 100% das chamadas em dev.
**Fix:** Rewrite removido. Proxy repassa o path inteiro.

### Bug 8 — `BASE_URL` hardcodado para `localhost:8000`
`api/client.ts` defaultava para `"http://localhost:8000"` mesmo em dev, bypassando o proxy.
**Fix:** Default alterado para `""`. Em dev usa proxy; em prod usa `VITE_API_URL`.

### Bug 9 — `.env.example` com encoding Windows-1252
Comentários em português salvos em Latin-1. psycopg2 falhava com `UnicodeDecodeError`.
**Fix:** `.env` recriado via `Set-Content -Encoding utf8` com conteúdo ASCII puro.

### Bug 10 — `vite-env.d.ts` ausente
TypeScript não reconhecia `import.meta.env` → erro `Property 'env' does not exist on ImportMeta`.
**Fix:** Criado `src/vite-env.d.ts` com `/// <reference types="vite/client" />`.

### Bug 11 — AddMatch casava jogadores do demo por nickname (string match)
Se o nick salvo no banco não fosse idêntico (case-insensitive) ao nick visto no `.dem`,
o jogador ficava em "não encontrado" mesmo já tendo conta — nicks de CS2 mudam o tempo todo.
**Fix:** Identificação trocada para `steam_id` (estável). `demo_service.py` agrega métricas
por steamid; o router `demo.py` casa/cria a conta via `get_or_create_by_steam()` e devolve
`player_id` já resolvido. `AddMatch.tsx` casa as linhas da tabela por `player_id`.

### Bug 12 — Players com conta `is_active=False` somem do AddMatch sem aviso
Descoberto verificando o upload de demo: 3 jogadores tinham sido desativados no Admin
(quando ainda tinham nickname provisório `steam_XXXX`, antes do Bug 11 ser corrigido).
`GET /api/players` filtra `is_active=True` por padrão, então mesmo com `player_id`
corretamente resolvido pelo parse, o AddMatch não tinha linha pra marcar — o jogador
era descartado da partida em silêncio.
**Fix aplicado:** reativados manualmente os 3 players afetados. **Não corrigido no
código ainda** — ver "O que falta implementar".

### Bug 13 — `uvicorn --reload` não recarregava após edições durante depuração ao vivo
Múltiplos arquivos editados em sequência enquanto o servidor de dev rodava em background
— o WatchFiles não disparou reload, então o endpoint `/api/demo/parse` continuou servindo
código antigo (sem `steam_id`/`player_id`/`created_players`), causando
`Cannot read properties of undefined (reading 'length')` no frontend.
**Fix:** restart manual do processo uvicorn. Se mudanças no backend não parecerem ter
efeito, suspeite do reloader antes de suspeitar do código — reinicie e teste de novo.
