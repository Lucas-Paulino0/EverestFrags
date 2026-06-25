# EverestFrags — Setup Completo do Banco de Dados

Guia passo a passo para criar e popular o banco PostgreSQL do projeto do zero.

---

## Stack de banco

| Componente | Versão / Detalhe |
|------------|-----------------|
| PostgreSQL | 14+ |
| SQLAlchemy | 2.0.30 (ORM declarativo com `Mapped`) |
| psycopg2 | 2.9.9 (driver de conexão) |
| python-dotenv | 1.0.1 (leitura do `.env`) |
| Alembic | 1.13.1 (instalado, ainda não utilizado — migrações futuras) |

Sem Alembic ativo por enquanto: as tabelas são criadas via `Base.metadata.create_all()` no startup do FastAPI e no `seed.py`.

---

## 1. Instalar o PostgreSQL

**Windows:** baixe o instalador em [postgresql.org/download/windows](https://www.postgresql.org/download/windows/).

Durante a instalação:
- Defina uma senha para o usuário `postgres` e anote.
- Mantenha a porta padrão `5432`.
- Instale o pgAdmin se quiser uma interface gráfica (opcional).

**Verificar que o serviço está rodando:**

```powershell
psql -U postgres -c "SELECT version();"
# Saída esperada: PostgreSQL 14.x ...
```

Se `psql` não for reconhecido, adicione ao PATH: `C:\Program Files\PostgreSQL\<versao>\bin`.

---

## 2. Criar o banco de dados

```powershell
psql -U postgres
```

Dentro do prompt `psql`:

```sql
CREATE DATABASE everestfrags;

-- Confirmar criação:
\l
-- A lista deve mostrar "everestfrags"

\q
```

---

## 3. Configurar o arquivo `.env`

O arquivo `.env.example` já existe no backend com todos os campos documentados. Copie e preencha:

```powershell
cd backend
copy .env.example .env
```

Conteúdo completo do `.env`:

```env
# URL de conexão com o PostgreSQL
# Formato: postgresql://usuario:senha@host:porta/nome_do_banco
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/everestfrags

# Chave secreta para assinar os JWTs — nunca comitar essa chave
SECRET_KEY=cole-aqui-a-string-gerada-no-passo-abaixo

# Algoritmo de assinatura do JWT (não alterar)
ALGORITHM=HS256

# Tempo de expiração do token em minutos (480 = 8 horas)
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Steam Web API — obter em: https://steamcommunity.com/dev/apikey
# Necessária para buscar nickname e avatar após o login com Steam
# Deixe vazio para rodar sem login Steam (login por senha continua funcionando)
STEAM_API_KEY=sua-chave-steam-aqui

# URLs da aplicação (necessárias para o redirect do Steam OpenID)
BACKEND_URL=http://localhost:8001
FRONTEND_URL=http://localhost:5173
```

**Gerar o `SECRET_KEY`:**

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
# Exemplo de saída: a3f8c1d2e4b7...  (cole no .env)
```

---

## 4. Instalar as dependências Python

```powershell
cd backend
pip install -r requirements.txt
```

Pacotes relevantes para o banco:

```
sqlalchemy==2.0.30      ← ORM
psycopg2-binary==2.9.9  ← driver PostgreSQL
python-dotenv==1.0.1    ← leitura do .env
alembic==1.13.1         ← migrations (futuro)
passlib[bcrypt]==1.7.4  ← hash de senha do admin
```

---

## 5. Criar as tabelas e popular os dados iniciais

```powershell
cd backend
python seed.py
```

O `seed.py` executa em ordem:

1. `Base.metadata.create_all(bind=engine)` — cria as 4 tabelas se não existirem
2. Insere o admin (trocar senha após o primeiro login)
3. Insere a config de pesos padrão (50% combate / 30% duelos / 20% utility)
4. Insere os 13 jogadores reais do grupo com seus Steam IDs

**Saída esperada:**

```
+ Admin criado -- TROQUE A SENHA!
+ Ranking config criada (50/30/20)
+ 13 players criados, 0 ja existiam

== Seed concluido! ==
```

Rodar o `seed.py` duas vezes é seguro — ele verifica existência antes de inserir.

---

## 6. Verificar as tabelas criadas

```powershell
psql -U postgres -d everestfrags
```

```sql
-- Listar tabelas criadas
\dt
-- Esperado: matches, player_match_stats, players, ranking_config

-- Verificar admin e players
SELECT id, nickname, role, steam_id, is_active FROM players ORDER BY id;

-- Verificar pesos do ranking
SELECT * FROM ranking_config;
-- weight_combat=0.5000, weight_duel=0.3000, weight_utility=0.2000

-- Verificar estrutura de player_match_stats (incluindo trade_denials)
\d player_match_stats

\q
```

---

## 7. Subir o servidor e confirmar conexão

```powershell
cd backend
uvicorn main:app --reload --port 8001
```

- Docs interativas: `http://localhost:8001/docs`
- Health check: `http://localhost:8001/` → `{"status":"ok","service":"EverestFrags API v1.0.0"}`

Se a página de docs abrir sem erros no terminal, o banco está conectado e as tabelas foram criadas corretamente.

---

## Diagrama de relacionamentos

```
players ──────────────────────────────────────────┐
  id (PK)                                         │
  nickname (UNIQUE)                               │
  steam_id                                        │
  avatar_initials                                 │
  password_hash (nullable)                        │
  role: 'admin' | 'viewer'                        │
  is_active                                       │
  created_at                                      │
        │                                         │
        │ 1:N                                     │ 1:N
        ▼                                         ▼
player_match_stats                          ranking_config
  id (PK)                                     id (PK) ← sempre 1 linha
  player_id → players (CASCADE DELETE)        weight_combat   0.50
  match_id  → matches (CASCADE DELETE)        weight_duel     0.30
  UNIQUE(player_id, match_id)                 weight_utility  0.20
  kills, deaths, assists                      updated_at
  damage_total, adr, adr_difference           updated_by → players (SET NULL)
  hltv_rating, kast_percent
  opening_kills, trade_kills, trade_denials
  time_to_kill_ms
  flash_assists, grenade_damage
  he_enemies_hit, fire_enemies_hit
        ▲
        │ N:1
        │
matches
  id (PK)
  scope_url (nullable)
  played_at
  map_name (nullable)
  notes (nullable)
  created_at
```

---

## Colunas de `player_match_stats`

| Coluna | Tipo | Categoria |
|--------|------|-----------|
| `kills` | INTEGER | Combate |
| `deaths` | INTEGER | Combate (invertido na fórmula) |
| `assists` | INTEGER | Combate |
| `damage_total` | INTEGER | Combate |
| `adr` | NUMERIC(6,2) | Combate |
| `adr_difference` | NUMERIC(6,2) | Combate (player_adr − mean_adr da partida) |
| `hltv_rating` | NUMERIC(5,3) | Combate |
| `kast_percent` | NUMERIC(5,2) | Combate |
| `opening_kills` | INTEGER | Duelos |
| `trade_kills` | INTEGER | Duelos |
| `trade_denials` | INTEGER | Duelos |
| `time_to_kill_ms` | INTEGER | Duelos (invertido) |
| `flash_assists` | INTEGER | Utility |
| `grenade_damage` | INTEGER | Utility |
| `he_enemies_hit` | INTEGER | Utility |
| `fire_enemies_hit` | INTEGER | Utility |

---

## Comportamento do `ondelete`

| Relação | `ondelete` | Efeito |
|---------|-----------|--------|
| `player_match_stats.player_id` → `players` | `CASCADE` | deletar player apaga todas as suas stats |
| `player_match_stats.match_id` → `matches` | `CASCADE` | deletar partida apaga todas as stats da partida |
| `ranking_config.updated_by` → `players` | `SET NULL` | deletar admin não apaga a config de pesos |

---

## Migrações manuais (sem Alembic)

Quando uma coluna é adicionada ao model mas o banco já existia (`create_all` não altera tabelas existentes):

```powershell
psql -U postgres -d everestfrags
```

```sql
-- Adicionado em 2026-06-25: trade_denials em player_match_stats
ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS trade_denials INTEGER NOT NULL DEFAULT 0;

-- Verificar
\d player_match_stats
\q
```

Alternativa: recriar o banco do zero (ver seção abaixo).

---

## Resetar o banco (do zero)

Se precisar recomeçar:

```powershell
psql -U postgres
```

```sql
DROP DATABASE everestfrags;
CREATE DATABASE everestfrags;
\q
```

```powershell
cd backend
python seed.py
```

---

## Próximos passos após o setup

1. Trocar a senha do admin em `/profile` → "Alterar senha"
2. Subir o frontend: `cd frontend && npm install && npm run dev`
3. Acessar `http://localhost:5173` e logar com admin
4. Em produção: preencher as env vars no Render e rodar `python seed.py` via shell do Render
