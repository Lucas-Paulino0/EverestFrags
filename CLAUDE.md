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

2. **Sorteio equilibrado** — com o ranking em mãos, o sistema gera todas as combinações possíveis
   (ou amostra 6.000 para grupos grandes) e escolhe aleatoriamente entre as divisões dentro de uma
   margem de 40-60%, garantindo times diferentes a cada sessão mas sempre equilibrados.

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
│   ├── alembic.ini                  ← Config Alembic (sqlalchemy.url sobrescrita em runtime por env.py)
│   ├── alembic/
│   │   ├── env.py                   ← Lê DATABASE_URL do .env, target_metadata = Base.metadata
│   │   └── versions/                ← Migrações (baseline 8c264163dd4b = schema atual, stamped)
│   └── app/
│       ├── database.py              ← Engine SQLAlchemy, SessionLocal, get_db()
│       ├── models/
│       │   ├── player.py            ← Player (auth embutido: password_hash, role, is_active)
│       │   ├── match.py             ← Match + PlayerMatchStats (18 métricas)
│       │   └── chat_message.py      ← ChatMessage (histórico persistente do chat)
│       ├── schemas/
│       │   ├── player.py            ← PlayerCreate, PlayerUpdate, PlayerPublic, PlayerResponse
│       │   ├── match.py             ← MatchCreate, MatchDetailResponse, PaginatedMatchResponse
│       │   ├── auth.py              ← LoginRequest, TokenResponse, PasswordChange
│       │   ├── ranking.py           ← RankingEntry (todas as métricas brutas + scores)
│       │   └── sort.py              ← SortTeamsResponse, TeamResult, PlayerInTeam
│       ├── services/
│       │   ├── auth_service.py      ← JWT, bcrypt, get_current_player, require_admin
│       │   ├── player_service.py    ← CRUD, authenticate(), get_or_create_by_steam()
│       │   ├── match_service.py     ← CRUD matches + stats (transação única com flush)
│       │   ├── ranking_service.py   ← Fórmula min-max normalização + pesos fixos (1/3 cada)
│       │   ├── sort_service.py      ← Algoritmo Snake Draft em memória
│       │   ├── steam_service.py     ← OpenID build_redirect, verify_response, get_steam_profile
│       │   └── demo_service.py      ← Parser .dem: 4 eventos, sem parse_ticks, dicts leves, chave = steamid
│       └── routers/
│           ├── auth.py              ← POST /login, GET /me, POST /change-password, POST /logout
│           ├── steam_auth.py        ← GET /steam, GET /steam/callback
│           ├── players.py           ← GET/POST /players, GET/PATCH /players/{id}, GET /players/steam-lookup
│           ├── matches.py           ← GET/POST /matches, GET/DELETE /matches/{id}
│           ├── ranking.py           ← GET /ranking (público — sem mais config de pesos)
│           ├── sort.py              ← GET /sort-teams?players=1,2,3&teams=2
│           ├── chat.py              ← WS /chat/ws?token=JWT (broadcast + persiste em chat_messages, histórico ao conectar)
│           ├── demo.py              ← POST /demo/parse (upload .dem, admin only, max 750 MB) — casa/cria players via steam_id, avisa contas inativas
│           └── stats.py             ← GET /stats/group-averages (médias da EverestFrags, não por jogador)
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
│       │   ├── PodiumCard.tsx       ← Card top-3 (radar + barras + pills), clicável → modal
│       │   ├── RankCard.tsx         ← Card médio (4–11) e compacto (12+), clicável → modal
│       │   ├── PlayerDetailModal.tsx← Modal de detalhe do player (todas as métricas cruas)
│       │   └── CompareModal.tsx     ← Modal "COMPARAR": 2 jogadores lado a lado + confronto direto
│       └── pages/
│           ├── Login.tsx            ← Login nickname+senha e botão "Entrar com Steam"
│           ├── SteamCallback.tsx    ← Processa redirect do Steam (/auth/callback)
│           ├── Dashboard.tsx        ← Ranking: pódio + grade + lista compacta + botão COMPARAR
│           ├── Metrics.tsx          ← /metrics — leaderboard por métrica crua (ADR, trades, etc.)
│           ├── Averages.tsx         ← /averages — médias da EverestFrags (grupo todo, não por jogador)
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
        │
        │ 1:N
        ▼
player_match_stats
  id (PK)
  player_id  (FK → players)
  match_id   (FK → matches)
  UNIQUE(player_id, match_id)
  -- métricas base --              matches
  kills, deaths, assists              id (PK)
  damage_total, adr, adr_difference   scope_url  (link scope.gg)
  hltv_rating, kast_percent           played_at  (date)
  opening_kills, trade_kills          map_name
  trade_denials                       notes
  time_to_kill_ms                     created_at
  flash_assists, grenade_damage
  he_enemies_hit, fire_enemies_hit
  fire_damage
  -- situacionais (Round Swing) --
  disadvantage_kills, advantage_kills
  eco_kills

chat_messages              (player_id nullable — SET NULL se o player for deletado;
  id (PK)                   nickname/avatar_initials são snapshot, não join)
  player_id  (FK → players, ON DELETE SET NULL, nullable)
  nickname, avatar_initials  (cópia do player no momento do envio)
  text
  created_at  (indexado — usado pra ordenar o histórico)

player_vs_player_stats     (confronto direto — uma linha por DIREÇÃO, não por par;
  id (PK)                   "Fresh matou Alana 3x" é 1 linha, a morte da Alana
  match_id   (FK → matches) pro Fresh é a linha inversa, não um campo a mais)
  player_id  (FK → players) — quem agiu
  opponent_id (FK → players) — quem recebeu
  UNIQUE(match_id, player_id, opponent_id)
  kills            — vezes que player matou opponent nessa partida
  flash_assists    — vezes que player flashou opponent levando a kill de aliado
```

### Decisões de design do banco

**Por que Player tem campos de auth (password_hash, role)?**
Num primeiro rascunho havia tabela `User` separada. Mas no projeto, cada player do grupo
É também um usuário do sistema — não existe player sem conta, nem conta sem player.
Unificar evita JOINs desnecessários e mantém o modelo simples.

**Por que o sorteio não tem tabela?**
Times não são persistidos. O sorteio é calculado em memória a cada requisição (`sort_service.py`).
Isso foi intencional: os times mudam a cada sessão de jogo, guardar seria lixo no banco.

**Por que não existe mais tabela de configuração de pesos?**
Existiu (`ranking_config`, singleton de 1 linha, editável pelo admin em 50/30/20).
Foi removida — não só a UI, a tabela inteira — porque os pesos passaram a ser fixos e
iguais (1/3 cada) direto no código (`ranking_service.py`). Ver "Sistema de Score e
Ranking → Passo 4" pra justificativa completa. Sem uso editável, manter a tabela seria
dado morto no banco — mesma lógica do Bug 15 (não deixar coisa sem dono).

**Criação de tabelas e migrações**
`Base.metadata.create_all()` roda no startup (`main.py`) — cria tabelas que não existem,
nunca altera as que já existem; serve de fallback pra um banco totalmente novo (clone do
zero). Mudanças de schema em bancos que já têm dados passam por Alembic (`backend/alembic/`):
gerar revisão com `alembic revision --autogenerate -m "..."`, revisar o arquivo gerado,
aplicar com `alembic upgrade head`. A baseline (`8c264163dd4b`) foi gerada com diff vazio
(modelos já batiam com o schema existente) e marcada como aplicada via `alembic stamp head`
sem rodar nenhum DDL.

**Por que `chat_messages` guarda nickname/avatar_initials em vez de só fazer JOIN com players?**
Histórico de chat deve continuar legível mesmo se o player for renomeado ou deletado depois.
Por isso são uma cópia (snapshot) do momento do envio, e o FK usa `ON DELETE SET NULL`
em vez de CASCADE — apagar uma conta não apaga as mensagens que ela mandou.

### Variáveis de ambiente necessárias (`.env`)

```bash
# Banco
DATABASE_URL=postgresql://user:password@host:5432/everestfrags

# Auth JWT
SECRET_KEY=string-aleatoria-muito-longa
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200   # 30 dias — token vive no localStorage, funciona como "lembrar de mim"

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
| he_enemies_hit, fire_enemies_hit, fire_damage | |
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
> Implementado em `ranking_service.py` via uma métrica derivada `weighted_kills`
> (não persistida — calculada em memória a cada chamada do ranking):
> ```
> weighted_kills = kills - eco_kills*0.5 + disadvantage_kills*0.3 - advantage_kills*0.2
> ```
> `weighted_kills` substitui "kills" puro só dentro de `COMBAT_METRICS` (normalização do
> score Combate). O "kills" puro continua aparecendo no ranking pro usuário (K/D, etc.)
> sem nenhum ajuste — só o score Combate usa a versão ponderada.

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
| fire_enemies_hit | nº de inimigos acertados por molotov/incendiária |
| fire_damage | dano somado de molotov/incendiária |

### Passo 4 — Score final ponderado

```
score_final = (score_combate  × 0.30)
            + (score_duelo    × 0.36)
            + (score_utility  × 0.34)
```

Pesos **fixos**, definidos como constantes em `ranking_service.py`
(`WEIGHT_COMBAT`/`WEIGHT_DUEL`/`WEIGHT_UTILITY`) — não existe edição de pesos via admin/UI,
só direto no código. Não existe mais tabela `ranking_config` nem modal de configuração
(removidos — ver decisão abaixo).

> **Por que 30/36/34 em vez de 1/3 cada?** A versão original usava pesos exatamente iguais
> (1/3/1/3/1/3) pela mesma razão que continua valendo agora: não há base estatística pra
> justificar uma categoria valer mais que outra com o histórico de partidas ainda pequeno
> (~10-20 partidas), e pesos editáveis por admin seriam uma escolha subjetiva sem
> fundamento. O ajuste pra 30/36/34 é um leve favorecimento de Duelos/Utility sobre
> Combate — testado e mantido por decisão do grupo, não por uma correlação estatística
> nova. Continua sendo um valor fixo no código (não editável por admin), e a soma continua
> em 1.0 (100%).

---

## Métricas Situacionais — Como São Calculadas do .dem

Implementadas em `demo_service.py`. Todas as 4 vêm dos eventos já parseados
(`player_death`, `item_purchase`) — **nenhuma precisa de `parse_ticks()`**. A suposição
inicial de que precisariam carregar todos os snapshots do demo em memória estava errada:
contagem de vivos por time e gasto por round dão pra derivar só com os eventos certos,
em ordem cronológica de tick.

### disadvantage_kills / advantage_kills — vantagem numérica no momento da kill

Mantém um dict `alive: dict[team_num, count]` que reseta a cada round (`total_rounds_played`
mudando) e decrementa a cada morte. No momento de cada kill, compara o tamanho do time do
atirador com o do time da vítima ANTES de decrementar:

```python
if alive[atk_team] < alive[vic_team]:
    disadvantage_kills += 1   # atirador em desvantagem numérica
elif alive[atk_team] > alive[vic_team]:
    advantage_kills += 1      # atirador em vantagem numérica
# 1v1 (alive iguais) não conta pra nenhum dos dois
```

`team_size` é estimado como `(jogadores_no_demo + 1) // 2` — assume times parelhos
(mix 5v5 padrão do grupo); não lê o roster real de cada time pelo evento.

### eco_kills — kill contra inimigo mal equipado

Soma o `cost` de cada `item_purchase` por `(round, steamid)` em `round_spend`. Antes do
loop de kills, propaga equipamento carregado entre rounds via `effective_spend`: jogadores
que sobreviveram mantêm o gasto efetivo do round anterior como base para o próximo;
quem morreu começa do zero. A tabela `effective_spend[rnd][player]` combina compras novas
e equipamento carregado via `max(buys.get(p, 0), carried.get(p, 0))`. No momento da kill:

```python
vic_spend = effective_spend.get(rnd, {}).get(vic, 0)
if vic_spend < ECO_THRESHOLD:
    eco_kills += 1
```

Assim AWPs e rifles carregados sem nova compra são contabilizados corretamente. Ver Bug 21
para o histórico da correção.

### kast_percent — Kill/Assist/Survived/Traded

Também recalculado de verdade (era hardcoded em 50.0). Por round, o jogador conta pro KAST
se teve kill, assist, sobreviveu (não está em `died_rounds`) OU foi "traded" (um companheiro
vingou sua morte em até `TRADE_WINDOW_TICKS`). `kast_percent = rounds_que_contam / total_rounds * 100`.

### trade_denials — impediu troca adversária

Janela de `TRADE_WINDOW_TICKS` (5s) olhando os últimos kills recentes: se o atirador elimina
um inimigo cujo time acabou de tradar um companheiro do atirador, conta como trade denial.
Calculado desde antes desta rodada de trabalho, mas só agora chega até o banco — ver Bug 11/17.

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
| GET /api/players/{id}/vs/{id2} | ✓ | ✓ | ✓ |
| GET /api/auth/me | — | ✓ | ✓ |
| GET /api/players/{id}/stats | — | ✓ | ✓ |
| POST /api/auth/change-password | — | ✓ | ✓ |
| POST /api/players | — | — | ✓ |
| GET /api/players/steam-lookup | — | — | ✓ |
| PATCH /api/players/{id} | — | — | ✓ |
| POST /api/matches | — | — | ✓ |
| DELETE /api/matches/{id} | — | — | ✓ |
| POST /api/demo/parse | — | — | ✓ |

---

## Identidade Visual

| Token | Valor | Uso |
|-------|-------|-----|
| `#070a0e` | Fundo principal | Fundo de todas as páginas |
| `#0e7490` | Teal (primário) | CTAs, acento principal, links |
| `#6366f1` | Indigo (secundário) | 2º lugar, duelos |
| `#e0a82e` | Dourado | 3º lugar, utility, avisos |
| `#0d1218` | Card bg | Fundo de cards e headers |
| `#1b2530` | Borda | Bordas e divisores |
| `#f0f9ff` | Texto principal | Títulos e nomes |
| `#5d6d80` | Texto secundário | Labels e subtítulos |
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
python seed.py              # cria tabelas (create_all) + dados de exemplo
alembic stamp head          # marca o banco novo como já estando na baseline atual
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
3. **Start:** `alembic upgrade head && python seed.py && uvicorn main:app --host 0.0.0.0 --port $PORT`
   > A ordem importa — `alembic upgrade head` tem que vir ANTES do `seed.py`. O `seed.py` consulta
   > o model `Player` via ORM, que já espera as colunas da versão atual do código; se a migration
   > não rodou ainda, a tabela real do banco não tem essas colunas e a consulta quebra
   > (`column players.X does not exist`). O plano free do Render não tem Shell/SSH/One-off Jobs,
   > então não tem como rodar esses comandos manualmente uma vez só — ficam embutidos no Start
   > Command, e são seguros de rodar em todo boot porque ambos são idempotentes.
4. Criar **PostgreSQL** no Render e copiar a `DATABASE_URL` gerada
5. Env vars no Render:
   ```
   DATABASE_URL        = (gerado pelo Render)
   SECRET_KEY          = (string aleatória longa — gerar no terminal: openssl rand -hex 32)
   ALGORITHM           = HS256
   ACCESS_TOKEN_EXPIRE_MINUTES = 43200
   STEAM_API_KEY       = (obter em steamcommunity.com/dev/apikey)
   BACKEND_URL         = https://seu-app.onrender.com
   FRONTEND_URL        = https://seu-app.vercel.app
   ```

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
| `/metrics` | público | Leaderboard por métrica crua (ADR, trades, dano de granada...) |
| `/averages` | público | Médias da EverestFrags (grupo todo, não por jogador) |
| `/profile` | autenticado | Perfil pessoal + alterar senha |
| `/admin` | admin | Gestão de players e partidas |
| `/chat` | público | Chat em tempo real (WebSocket) |
| `/*` | — | Redireciona para `/` |

---

## Workflow Git

```
main  ← branch de produção — só recebe merges de dev
dev   ← branch de staging — valida antes de ir pra main
feature/xxx ← branch de trabalho — criada a partir de dev
```

**Fluxo padrão:**
1. `git checkout dev && git pull`
2. `git checkout -b feature/nome-da-feature`
3. Trabalha, commits normais
4. PR: feature → dev (para revisão/teste)
5. Depois validado em dev: PR dev → main

**Contas GitHub:**
- `Adrian9742` — dono do repo, tem permissão de merge
- `tirealmetais-dotcom` — colaborador, pode abrir PRs mas não mergear

**Nota:** o GitHub pode traduzir nomes de branch no browser (ex: `main` → `principal`,
`dev` → `desenvolvedor`). É a extensão de tradução automática do browser — desative-a
em github.com para evitar confusão.

---

## O que falta implementar

### Crítico (bloqueia uso real)
- [ ] Deploy no Render + Vercel — projeto ainda não está no ar
- [ ] Testar endpoints após deploy (especialmente WebSocket e demo parser)
- [ ] Trocar senha do admin após primeiro login
- [ ] Verificar se `demoparser2` (lib Rust) instala corretamente no ambiente Linux do Render

### Importantes (melhoram a experiência)
- [x] ~~Chat sem persistência — mensagens somem se o servidor reiniciar~~ → **implementado** — tabela `chat_messages` (model `ChatMessage`); cada mensagem é persistida no commit do WS e o cliente recebe um payload `{"type":"history"}` com as últimas 50 mensagens ao conectar
- [x] ~~Busca de perfil Steam ao cadastrar player manualmente no Admin~~ → **implementado** — `GET /api/players/steam-lookup?steam_id=` (admin only, usa `steam_service.get_steam_profile`) + botão "BUSCAR" no modal de cadastro do Admin que pré-preenche o nickname
- [x] ~~`kast_percent` fixado em 50 no `demo_service.py`~~ → **implementado** — calculado de verdade por round (kill/assist/survived/traded), sem precisar de `parse_ticks()` (ver "Métricas Situacionais")

### Futuro
- [x] ~~`disadvantage_kills`, `advantage_kills`, `eco_kills` não são calculadas no demo parser~~ → **implementado** — `demo_service.py` deriva as 3 dos eventos `player_death`/`item_purchase` já parseados, sem `parse_ticks()` (a suposição de que precisariam dele estava errada — ver "Métricas Situacionais")
- [x] ~~`trade_denials` já É calculada em `demo_service.py`, mas não existe coluna em `PlayerMatchStats`~~ → **implementado** — coluna adicionada ao model, schema, service e router; entra no score de Duelos
- [x] ~~`ranking_service.py` não usa `trade_denials`~~ → **implementado** — adicionado a `SOMA_METRICS` e `DUEL_METRICS`
- [x] ~~`adr_difference` sempre 0.0 no demo parser~~ → **implementado** — calculado como `adr_player - mean_adr` após parsear todos os jogadores
- [x] ~~`grenade_damage`/`he_enemies_hit`/`fire_enemies_hit` sem parsing por tipo de arma~~ → **implementado** — demo_service agora lê campo `weapon` do evento `player_hurt` e diferencia HE, molotov/incendiária
- [x] ~~`ranking_service.py` não usa eco_kills/disadvantage_kills/advantage_kills~~ → **implementado** — métrica derivada `weighted_kills` no score Combate, ver "Passo 3" acima
- [x] ~~Alembic — migrações incrementais quando o schema precisar evoluir~~ → **implementado** — `alembic/` configurado (`env.py` lê `DATABASE_URL` do `.env`, `target_metadata = Base.metadata`); migração baseline `8c264163dd4b` gerada e "stamped" no banco local (diff vazio = models já em sync com o schema existente). Daqui pra frente, mudança de schema = `alembic revision --autogenerate -m "..."` + `alembic upgrade head`, não mais `ALTER TABLE` manual.
- [x] Integração direta com scope.gg → **pesquisado, não implementável**: scope.gg não tem API pública (confirmado via busca — sem documentação de API, sem endpoint oficial). Restaria só scraping, frágil e fora de escopo; não implementado por decisão.
- [x] ~~Aviso explícito no AddMatch quando um `player_id` resolvido pelo demo pertence a uma conta `is_active=False`~~ → **implementado** — `POST /api/demo/parse` retorna `inactive_players[]`; `AddMatch.tsx` mostra um banner de aviso separado do de "sem steam_id", recomendando reativar em `/admin`
- [x] ~~Página com a média da EverestFrags~~ → **implementado em 2026-06-27** — `GET /api/stats/group-averages` (router `stats.py`, função `ranking_service.get_group_averages`) calcula a média de cada métrica entre TODAS as linhas de `player_match_stats` (1 linha = 1 jogador em 1 partida), não a média dos totais por jogador — assim quem jogou mais partidas não pesa mais nem menos. Página `/averages` (`Averages.tsx`) mostra os números agrupados por categoria (Combate/Duelos/Utility), com `total_matches` e `total_player_entries` de contexto.
- [x] ~~Comparar 2 players lado a lado~~ → **implementado em 2026-06-27** — botão "COMPARAR" no Dashboard (ao lado do título "PÓDIO") abre `CompareModal.tsx`: 2 selects pra escolher os jogadores (a partir do `allEntries` já carregado, sem endpoint novo pra isso), tabela de métricas lado a lado destacando quem está melhor em cada uma (mesma lógica de inversão do PlayerDetailModal — menor é melhor em DEATHS/TTK), veredito de quem está na frente no score final, e a seção "Confronto Direto" usando o head-to-head já implementado (`GET /api/players/{a}/vs/{b}`).
  - [x] ~~Confronto direto (head-to-head): kills e flash_assists entre 2 players específicos~~ → **implementado em 2026-06-27** — tabela `player_vs_player_stats` (uma linha por direção: quem agiu → quem recebeu), `demo_service.py` rastreia o par durante o parse em vez de descartar (kills já tinha atacante+vítima por evento; flash assist idem), `POST /api/demo/parse` resolve player_id/opponent_id e retorna em `matchups[]`, `POST /api/matches` persiste via `MatchupCreate`, novo endpoint `GET /api/players/{id}/vs/{id2}` agrega em todas as partidas (kills de cada um, flash_assists de cada um, partidas jogadas juntos). Só vale pra partidas cadastradas via upload de demo a partir de agora — não retroativo nas já existentes (o `.dem` é descartado após o parse). **Sem UI ainda** — só a API; entra no modal de comparação quando ele for construído.
  - [ ] Dano de HE/molotov por vítima específica (quantas vezes X bangou/queimou Y) — não implementado. O evento `player_hurt` hoje só guarda quem causou o dano (`demo_service.py`), não em quem; precisaria adicionar o steamid da vítima no `parse_event` e uma coluna nova em `player_vs_player_stats` (ex: `he_damage`, `fire_damage`). Decisão consciente de deixar pra depois (pedido pelo Adrian em 2026-06-27) — não é mais urgente que o resto da fila.
- [x] ~~`opening_deaths` (primeira morte do round) não rastreado~~ → **implementado em 2026-06-29** — coluna `opening_deaths` em `PlayerMatchStats` (migration `e80dd8bf709b`), adicionado a `SOMA_METRICS` no ranking com inversão (menos = melhor), exposto em AddMatch/Averages/Metrics/PlayerDetailModal/CompareModal. No demo parser: flag `seen_opening_rounds` evita contar o mesmo round duas vezes.
- [x] ~~MVP por round (quem foi mais decisivo em cada round ganho) não rastreado~~ → **implementado em 2026-06-29** — coluna `mvps` em `PlayerMatchStats` (migration `c6e87ec82e1d`), calculado como "player com mais kills do time vencedor no round; desempate por dano total causado no round". Rastreado no `demo_service.py` via `round_kills`/`round_team`/`round_dmg` dicts + `round_winner` mapa (N-ésimo `round_end` real → team_num vencedor). Adicionado a `SOMA_METRICS`, exposto em AddMatch/Averages/Metrics/PlayerDetailModal/CompareModal.
- [x] ~~UI não responsiva em celular~~ → **implementado em 2026-06-29** — sidebar já virava bottom tab bar no mobile (`@media ≤820px`); adicionadas regras CSS para corrigir: (a) padding simétrico em `<main>` e `<div>` de conteúdo (48px→12px), (b) tabelas com `overflow-x: auto` para não transbordar, (c) headers das páginas internas com padding reduzido (48px→16px), (d) padding-bottom 90px para não cobrir o bottom tab bar.
- [x] ~~Segurança — SECRET_KEY/DATABASE_URL hardcodadas com fallback inseguro~~ → **resolvido em 2026-06-30** — `auth_service.py` e `database.py` usam `os.environ["KEY"]` com `RuntimeError` se ausente; sem fallback default inseguro
- [x] ~~Segurança — JWT exposto na URL do callback Steam~~ → **resolvido em 2026-06-30** — código opaco UUID de 30s TTL em `_pending_codes`; endpoint `POST /api/auth/steam/exchange`; `SteamCallback.tsx` troca o código via POST
- [x] ~~Segurança — /docs público em produção~~ → **resolvido em 2026-06-30** — `main.py` usa `DEBUG=true` (env var) para habilitar `/docs`; padrão desabilitado. No Render, não configurar `DEBUG` ou deixar `false`. Em dev local, adicionar `DEBUG=true` ao `.env`
- [x] ~~Segurança — magic bytes não validados no upload de .dem~~ → **resolvido em 2026-06-30** — `demo.py` verifica `HL2DEMO\x00` nos primeiros 8 bytes; rejeita com 400 se não bater
- [x] ~~Segurança — steam_id exposto em rotas públicas~~ → **resolvido em 2026-06-30** — `PlayerResponsePublic` (sem steam_id) em `schemas/player.py`; `GET /api/players` e `GET /api/players/{id}` usam esse schema; rotas admin mantém `PlayerResponse` com steam_id
- [x] ~~Segurança — rate limiting ausente~~ → **resolvido em 2026-06-30** — `slowapi==0.1.9` em `requirements.txt`; limiter centralizado em `app/limiter.py`; `POST /api/auth/login` → 5/min, `POST /api/demo/parse` → 3/min; `main.py` registra o exception handler
- [x] ~~Segurança — security headers ausentes~~ → **resolvido em 2026-06-30** — middleware em `main.py`: X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy, HSTS em prod (não em dev)
- [x] ~~Segurança — players inativos retornados em head-to-head~~ → **resolvido em 2026-06-30** — `match_service.get_head_to_head` filtra `is_active=True` em ambos os players
- [x] ~~Página /h2h~~ → **implementado em 2026-06-30** — `HeadToHead.tsx`: dois selects de jogador, barra de progresso comparativa por kills e flash_assists, veredito de quem domina; rota `/h2h` em `App.tsx`; link "H2H" com ícone `Crosshair` no `Navbar`
- [x] ~~Gráfico de evolução no /profile~~ → **implementado em 2026-06-30** — `HistoryChart` SVG inline (sem biblioteca externa); endpoint `GET /api/players/{id}/history` via `ranking_service.get_player_match_history`; exibe HLTV Rating por partida em ordem cronológica; visível quando há ≥2 partidas
- [x] ~~Favicon ausente~~ → **implementado em 2026-06-30** — `docs/eve.png` copiado para `frontend/public/favicon.png`; `index.html` atualizado com `<link rel="icon" type="image/png">` + `<link rel="apple-touch-icon">`
- [x] ~~Orphan files~~ → **deletados em 2026-06-30** — `backend/routers/matches.py`, `players.py`, `ranking.py` (0 bytes cada) removidos
- [x] ~~Bug 30 — Demos gzip do CS2~~ → **resolvido em 2026-06-30** — magic bytes corrigido `HL2DEMO\x00` → `PBDEMS2\x00`; `_decompress_if_needed()` em `routers/demo.py` detecta `\x1f\x8b` e descomprime com `gzip.decompress()` antes de passar pro parser. Verificado nos 3 demos do grupo.
- [x] ~~Segurança — server header vaza versão~~ → **resolvido** — middleware `security_headers` em `main.py` remove `server` header + adiciona X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS (prod only)
- [x] ~~Segurança — audit logs ausentes~~ → **resolvido** — `auth.py` loga `LOGIN_OK`/`LOGIN_FAIL`/`LOGOUT`/`SENHA_ALTERADA` com `player_id`, `nickname`, `ip` via `logging`
- [x] ~~Export de dados para planilha~~ → **implementado** — `GET /api/export` → `StreamingResponse` com arquivo `.xlsx` (4 abas: Ranking, Stats Completas, Histórico, Head-to-Head); `EXPORTAR` button na página `/ranking`; usa `openpyxl`, paleta EverestFrags
- [x] ~~Sistema de vitórias~~ → **implementado** — tabela `player_wins` (wins/losses/streak/max_streak/points); `POST /api/matches/{id}/result` (admin) registra resultado; `GET /api/wins/ranking` (público); `GET /api/players/{id}/wins`; página `/wins` com tabela de classificação; botão "REGISTRAR RESULTADO" em `/matches/:id`; link "Vitórias" no Navbar
- [x] ~~IA — Coach individual~~ → **implementado** — `GET /api/players/{id}/coach`; service `ai_service.py` com Groq (Llama 3.1 70B); card colapsável "COACH IA" no `/profile`; degrada graciosamente se `GROQ_API_KEY` ausente
- [x] ~~IA — Narrativa da partida~~ → **implementado** — `GET /api/matches/{id}/narrative`; card colapsável "NARRATIVA IA" em `/matches/:id`
- [x] ~~IA — Previsão de forma pré-sorteio~~ → **implementado** — `POST /api/sort/prediction` com lista de player_ids; card "FORMA DO DIA" no `/sort` (colapsável abaixo do botão SORTEAR)
- [x] ~~IA — Digest semanal~~ → **implementado** — `POST /api/ai/digest` (admin only); botão "GERAR DIGEST" na página `/admin`; top 5, partidas da semana, melhor performance
- [x] ~~Sistema de XP e níveis~~ → **implementado** — calculado on-the-fly em `ranking_service.py` (sem coluna no DB — retroativo automático); fórmula: kills×10 + assists×5 + opening_kills×20 + trade_kills×10 + flash_assists×5 + mvps×15 + partidas×50 + bônus de rating por partida; 7 níveis: Recruta/Soldado/Veterano/Elite/Atirador/Lenda/Imortal; badge dourado no PodiumCard, RankCard e perfil

> **Migração:** desde esta rodada, mudanças de schema passam por Alembic (`cd backend && alembic revision --autogenerate -m "..."` → revisar o arquivo gerado em `alembic/versions/` → `alembic upgrade head`). O banco local já tem as colunas `disadvantage_kills`, `advantage_kills`, `eco_kills`, `opening_deaths`, `mvps` em `player_match_stats` e a tabela `chat_messages` — quem clonar o repo do zero recebe tudo via `create_all()` no startup; quem já tinha o banco rodando precisa só do `alembic upgrade head`.

> **⚠️ Partidas existentes precisam de re-upload:** colunas `opening_deaths` e `mvps` foram adicionadas com `server_default=0`. Qualquer partida cadastrada antes de 2026-06-29 terá `opening_deaths=0` e `mvps=0` até o demo ser re-parseado. Como o `.dem` não é persistido, o re-upload deve ser feito manualmente pelo admin em `/matches/new`.

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
**Fix aplicado:** reativados manualmente os 3 players afetados. **Fix definitivo no
código:** `POST /api/demo/parse` agora retorna `inactive_players[]` (qualquer player
resolvido com `is_active=False`); `AddMatch.tsx` mostra um banner de aviso dedicado.

### Bug 13 — `uvicorn --reload` não recarregava após edições durante depuração ao vivo
Múltiplos arquivos editados em sequência enquanto o servidor de dev rodava em background
— o WatchFiles não disparou reload, então o endpoint `/api/demo/parse` continuou servindo
código antigo (sem `steam_id`/`player_id`/`created_players`), causando
`Cannot read properties of undefined (reading 'length')` no frontend.
**Fix:** restart manual do processo uvicorn. Se mudanças no backend não parecerem ter
efeito, suspeite do reloader antes de suspeitar do código — reinicie e teste de novo.

### Bug 14 — JWT `sub` inconsistente entre login normal e Steam
Login normal (`POST /api/auth/login`) gerava token com `sub = player.nickname` (string).
Login Steam (`GET /api/auth/steam/callback`) gerava token com `sub = str(player.id)` (int em string).
`get_current_player` tentava fazer `filter(Player.nickname == sub)` — funcionava só para login normal.
Para Steam: sub era "1" (o ID) e nenhum player tem nickname "1" → 401 em toda rota autenticada.
Chat (`chat.py`) fazia `int(sub)` → `int("admin")` levantava `ValueError` para login normal.
**Fix:** padronizado para `sub = str(player.id)` em ambos os logins.
`get_current_player` atualizado para `filter(Player.id == int(sub))`.

### Bug 15 — `backend/database.py` (nível raiz) com markdown misturado ao Python
O arquivo raiz `backend/database.py` (diferente de `backend/app/database.py` que é o usado pelo app)
continha código Python correto nas primeiras linhas mas tinha conteúdo do `SETUP_BANCO.md`
copiado junto — terminava em ` ``` ` e resto do markdown, tornando o arquivo Python inválido.
Como `main.py` importa de `app.database`, o arquivo raiz não afetava o runtime, mas gerava
confusão e erros se importado diretamente.
**Fix:** arquivo raiz deletado — nada no projeto importa `backend.database`, só `app.database`.
Mantê-lo (mesmo limpo) criaria uma cópia duplicada do engine/SessionLocal real, convidando
alguém a editar o arquivo errado no futuro.

### Bug 16 — `demoparser2==0.9.0` em `requirements.txt` (versão inexistente)
Pin colocado no `requirements.txt` apontava para uma versão que **não existe no PyPI**
(o índice vai de `0.15.2` a `0.41.3`). `pip install -r requirements.txt` falharia direto
numa instalação limpa (deploy no Render, ou qualquer clone novo do repo) — quebraria
silenciosamente até alguém tentar rodar o backend do zero.
**Fix:** corrigido para `demoparser2==0.41.3`, a versão de fato instalada e testada
(inclusive contra demos reais, com extração de `steamid` e `weapon` funcionando).

### Bug 17 — Suposição errada de que métricas situacionais exigiam `parse_ticks()`
A documentação original (e o código) assumiam que `disadvantage_kills`, `advantage_kills`,
`eco_kills` e `kast_percent` real só seriam viáveis com `parse_ticks()` — método caro que
carrega todos os snapshots de tick do demo em memória, inviável para arquivos de até 750MB.
Isso bloqueou a implementação das 4 métricas por uma sessão inteira de planejamento.
**Descoberta:** todas as 4 são derivváveis só dos eventos já parseados (`player_death` com
`team_num`/`steamid`, `item_purchase` com `cost`/`steamid`/`total_rounds_played`) — contagem
de vivos por time e gasto por round não precisam de tick-by-tick, só de processar os eventos
em ordem cronológica de `tick`. **Fix:** implementado em `demo_service.py` (ver "Métricas
Situacionais"); verificado contra o `.dem` real de 302MB no root do projeto, com resultados
plausíveis (KAST 60–92%, ratings 0.41–1.34, sem erros de parse). Lição: antes de assumir que
uma feature precisa do caminho caro, checar se os eventos baratos já não levam ao mesmo dado.

### Bug 18 — `trade_denials` perdido entre backend e frontend
A coluna `trade_denials` foi adicionada ao model/schema do backend numa branch anterior
(mergeada), mas nunca chegou no `client.ts` do frontend — nem na interface `PlayerStatsCreate`
nem em `PlayerStatsInMatch`, nem como coluna em `AddMatch.tsx`. Resultado: qualquer
`trade_denials` calculado pelo parser do demo era silenciosamente descartado antes de chegar
no `POST /api/matches` (nunca dava erro — o campo só não existia no objeto JS enviado, e o
schema do backend tem default 0). **Fix:** adicionado a ambas as interfaces em `client.ts` e
à tabela de `AddMatch.tsx` (coluna "T.DENIAL"), junto com as 3 colunas novas de
disadvantage/advantage/eco kills. Lição: ao adicionar uma coluna nova end-to-end, sempre
conferir o frontend depois de mergear uma branch só de backend — campos descartados em
silêncio não aparecem em nenhum teste de tipo nem erro de runtime.

### Bug 19 — `kast_percent` podia passar de 100% e quebrar o POST /api/matches com 422
`total_rounds` em `demo_service.py` era calculado só pela contagem de eventos `round_end`.
O round final de uma partida às vezes não dispara esse evento (a demo grava até o kill
decisivo e acaba antes do evento de fim de round chegar), então `total_rounds` ficava
subestimado em 1 — mas os kills/assists daquele último round já tinham sido contados em
`kast_rounds`. Resultado: `len(kast_rounds) / total_rounds * 100` passava de 100% (visto em
produção: 105.9%), violando `kast_percent: Field(..., le=100.0)` no schema e fazendo o
upload de demo preencher a tabela do AddMatch com valores que o backend rejeitava no salvar
(422 silencioso — ver Bug 20). **Fix:** `total_rounds` agora é o maior entre a contagem de
`round_end` e `(maior índice de round visto nas kills) + 1`; adicionado também um
`min(kast, 100.0)` defensivo (KAST nunca pode matematicamente passar de 100%, então isso é
só uma segunda camada de proteção, não uma correção do cálculo em si).

### Bug 20 — Erro 422 aparecia como `[object Object],[object Object]` no AddMatch
`api/client.ts` fazia `throw new Error(error.detail)` assumindo que `detail` é sempre uma
string. Em erros de validação (422) do FastAPI/Pydantic, `detail` é um **array** de objetos
(`{loc, msg, type, ...}`) — `new Error(array)` chama `.toString()` no array, que junta os
itens com `.toString()` de cada objeto, dando `"[object Object],[object Object]"` em vez da
mensagem real. Mascarava completamente a causa de qualquer erro de validação (incluindo o
Bug 19 acima). **Fix:** nova função `formatErrorDetail()` em `client.ts` que trata `detail`
como string OU array (formatando cada item como `campo: mensagem`, separados por `·`),
usada nos dois pontos que liam `error.detail` (`request()` genérico e `demoApi.parse()`).

### Bug 21 — `eco_kills` ignorava equipamento carregado de rounds anteriores
`demo_service.py` calculava `eco_kills` consultando só o gasto registrado em `round_spend`
para aquele round específico — players que sobreviveram com armas compradas em rounds
anteriores (AWP carregada, rifles, etc.) e não fizeram nenhuma compra nova tinham gasto
registrado como 0, fazendo qualquer kill contra eles contar como eco kill mesmo que o inimigo
estivesse full-buy. Resultado: `eco_kills` inflado artificialmente, penalizando o score
Combate de jogadores que matavam players ricos em rounds de carryover.
**Fix (Opção B — effective_spend):** antes do loop de kills, construído `effective_spend`
propagando `carried` dict entre rounds — sobreviventes mantêm o gasto efetivo máximo do
round anterior como base para o próximo round; mortos têm `carried` zerado. A consulta
muda de `round_spend.get(rnd, {}).get(vic, 0)` para `effective_spend.get(rnd, {}).get(vic, 0)`.
Sem precisar de `parse_ticks()` nem `equipment_value` (campo ausente no demoparser2 nos
eventos `player_death`). Ver "Métricas Situacionais → eco_kills" para a lógica atual.

### Bug 22 — RadarChart eixo `trade` era `score_duel` (mesmo eixo repetido)
`PodiumCard.tsx` e `PlayerDetailModal.tsx` passavam `trade={entry.score_duel}` para o
`RadarChart` — o mesmo valor do eixo "Duelos", tornando os dois eixos sempre idênticos e
o hexágono visualmente redundante.
`RankingEntry` não tem campos `score_entry`/`score_clutch`/`score_support` (nunca foram
implementados), então não havia candidato óbvio pro 6º eixo.
**Fix:** `trade={Math.min(entry.kd_ratio * 33, 100)}` — K/D ratio mapeado para 0–100
(`kd_ratio × 33`, cap 100): 0.5→16, 1.0→33, 2.0→66, 3.0→99. É semanticamente distinto
de `score_duel` (que é sobre abertura de rounds e trades) e não exige mudança no backend.
Comentário atualizado em `RadarChart.tsx`: `// k/d normalizado: kd_ratio × 33 cap 100`.

### Bug 23 — Paleta antiga (#080808/#cc2200) usada em 4 arquivos após rebrand
Após o rebrand para paleta v2 (teal/indigo), os arquivos `Matches.tsx`, `MatchDetail.tsx`,
`AddMatch.tsx` e `SteamCallback.tsx` ainda usavam `background: "#080808"` (fundo) e
`#cc2200` (acento vermelho) em múltiplos lugares. Botões de CTA, links scope.gg, paginação
ativa, spinner e barra de acento do card de partida apareciam na cor errada.
Além disso, as 3 primeiras páginas não tinham `<Navbar />` — a navegação sumia ao entrar
nessas rotas. **Fix:** paleta migrada para `#070a0e`/`#0e7490` em todos os 4 arquivos;
`Navbar` importada e adicionada em Matches, MatchDetail e AddMatch; botões "← voltar"
removidos (redundantes com a Navbar). CLAUDE.md atualizado para refletir a paleta correta.

### Bug 24 — Partidas de teste com `flash_assists` de uma versão antiga do parser
Após o fix do Bug "flash assists reais" (commit `c433946`), 5 partidas de teste já
cadastradas no banco (criadas enquanto o backend ainda rodava código anterior a esse
fix) continuaram com `flash_assists` inflado — contagem de qualquer cegada em inimigo,
sem checar se gerou kill. Reparsear o mesmo `.dem` com o código atual deu valores bem
menores e plausíveis (ex: 1-5 por partida, contra 17-27 salvos). **Causa raiz:** corrigir
o parser não recalcula dados que já estão no banco — só afeta uploads novos. **Fix
aplicado:** as 5 partidas de teste foram apagadas e o `.dem` real foi re-processado pelo
parser atual. **Lição:** ao corrigir uma métrica calculada no parser, qualquer partida já
salva com a versão antiga fica com dado divergente até ser re-processada manualmente —
não existe (ainda) um script de "recalcular partidas existentes a partir do demo
original", porque o `.dem` não é persistido (é descartado logo após o parse, por design).

### Bug 25 — `fire_enemies_hit` só contava acertos, não havia dano de molotov
O parser diferenciava dano de HE (`grenade_damage`) mas pra fogo (molotov/incendiária)
só contava quantos inimigos foram acertados (`fire_enemies_hit`), sem somar o dano real
causado — não tinha como responder "quanto dano de molotov esse jogador causou".
**Fix:** nova coluna `fire_damage` (migration Alembic `00d948669318`) somando `dmg_health`
de cada `player_hurt` com `weapon` de fogo, em paralelo ao `fire_enemies_hit` (contagem
continua existindo). Adicionado a `UTILITY_METRICS` no ranking (mesmo peso que as
demais métricas de utility) e exposto no modal de detalhe, em `/metrics` e no
formulário de `AddMatch`.

### Bug 27 — `round_winner` sempre vazio por tentar `int("CT")` → MVP heurístico nunca funcionava
`round_end` retorna o campo `winner` como string "CT" ou "T" (não como int team_num como assumido).
O código fazia `int(winner_raw)` dentro de um try/except — o ValueError era engolido silenciosamente,
deixando `round_winner` sempre vazio em toda partida. Resultado: o bloco de cálculo de MVPs por
heurística (`round_kills × round_winner`) nunca rodava; todo jogador tinha `mvps=0` para sempre.
**Causa secundária:** demoparser2 não expõe o evento `round_mvp` em demos CS2 (testado com
`list_game_events()` — o evento simplesmente não existe no formato atual de demo do jogo). O `round_mvp`
que o jogo mostra no placar é calculado pelo cliente CS2, não gravado como evento discreto no demo.
**Fix:** mapeamento explícito `_WINNER_TEAM = {"CT": 3, "T": 2}` aplicado na construção de
`round_winner`; `round_dmg` movido para antes do loop de hurt (estava sendo usado antes de ser declarado);
fallback do evento `round_mvp` mantido no código (caso uma versão futura do demoparser2 ou outro
formato de demo passe a expô-lo).

### Bug 28 — `round_dmg` usado no loop de hurt antes de ser declarado
Introduzido na sessão anterior: `round_dmg` foi adicionado ao loop de hurt para rastrear dano por round
(usado como desempate no cálculo de MVP), mas sua declaração `round_dmg: dict[int, dict[str, int]] = {}`
ficou no bloco de step 6 (loop de kills), que roda DEPOIS do loop de hurt.
Resultado: `UnboundLocalError: cannot access local variable 'round_dmg'` ao processar qualquer demo.
**Fix:** declaração de `round_dmg` movida para antes do loop de hurt; comentário explicativo adicionado.

### Bug 29 — Stats assimétricas em demos com `mp_restartgame` (ex: de_train)
Quando um servidor executa `mp_restartgame`, o campo `total_rounds_played` dos eventos
player_death/player_hurt/item_purchase reseta para 0. O parser processava TODOS os eventos do
demo sem detectar esse reset — rounds 0, 1, 2... apareciam duas vezes (pré e pós-restart),
e como cada sequência tinha jogadores diferentes nos mesmos round numbers, os stats ficavam
assimétricos: alguns players com kills inflados, outros com mortes infladas, sem correspondência
entre totais de kills e mortes na partida. Descoberto no de_train com restart na metade.
**Fix:** `demo_service.py` ordena os kills por tick e detecta quando `total_rounds_played` cai
(qualquer valor < máximo visto até então = restart). Determina o `_restart_tick` do último reset
e descarta todos os eventos com `tick < _restart_tick` — aplica nos 4 loops: `hurt_rows`,
`round_records`, `flash_df`, `purchase_df`. O retorno da API inclui um aviso em `errors[]`
quando um restart é detectado. Partidas sem restart: `_restart_tick = 0`, nenhum evento
descartado (zero impacto em demos normais).

### Bug 26 — Fix do Bug 22 (eixo "trade" duplicado no radar) não chegou em `PodiumCard.tsx`
O Bug 22 documentava a troca de `trade={entry.score_duel}` (idêntico ao eixo `openK`, mesmo
valor repetido em 2 pontas do hexágono) por `trade={Math.min(entry.kd_ratio * 33, 100)}` em
"PodiumCard.tsx e PlayerDetailModal.tsx" — mas o fix só foi de fato aplicado em
`PlayerDetailModal.tsx` (e depois em `Profile.tsx`, que usa o mesmo padrão). `PodiumCard.tsx`
continuou com o eixo duplicado sem ninguém notar, porque visualmente 2 pontas iguais ainda
formam um hexágono plausível — só ficou óbvio ao adicionar labels nos eixos do `RadarChart`
(ADR, KAST, RATING, OPEN K, K/D, UTIL, posicionados em volta do hexágono) e comparar o card
do pódio com o modal de detalhe lado a lado. **Fix:** `trade={Math.min(entry.kd_ratio * 33,
100)}` aplicado em `PodiumCard.tsx` também. Lição: quando um bugfix é descrito como "aplicado
em N arquivos", checar os N arquivos de fato, não assumir que documentar já implica que todos
foram tocados.

### Bug 30 — Demos gzip do CS2 interpretados como `UnknownDemoCmd(7991)` pelo demoparser2
Em alguma atualização de 2025, o CS2 passou a gzip-ar demos antes de gravá-los no disco.
Os arquivos `.dem` continuaram com a extensão `.dem`, mas o conteúdo é um arquivo gzip válido
(magic bytes `\x1f\x8b`) em vez de `PBDEMS2\x00` direto. Quando `demoparser2` recebia esses
bytes gzip, interpretava o byte `\x1f` (=31) como um comando desconhecido e estourava com
`UnknownDemoCmd(7991)` — o número bizarro vem de como os bytes gzip são lidos como varint.
Além disso, a checagem de magic bytes adicionada na sprint de segurança usava `HL2DEMO\x00`
(magic do CS:GO/Source 1) em vez de `PBDEMS2\x00` (magic do CS2/Source 2), bloqueando 100%
dos uploads com erro 400 antes mesmo de chegar no parser. **Fix (duas partes):**
1. Magic bytes corrigido para `PBDEMS2\x00` em `routers/demo.py`
2. Função `_decompress_if_needed()` adicionada ao mesmo arquivo: detecta `\x1f\x8b` (gzip)
   e descomprime com `gzip.decompress()` antes de passar pro parser; demos PBDEMS2 direto
   passam sem alteração. Verificado contra os 3 demos do grupo: anubis (gzip 132MB→210MB
   descomprimido), NUKE (PBDEMS2 direto 271MB) e TRAIN (gzip 173MB→280MB) — todos OK.
