# EverestFrags — Roadmap

Planejamento geral do sistema. Auditoria feita em 2026-06-29.

---

## 🔴 SEGURANÇA — FASE 1 (urgente, antes de qualquer nova feature)

- [x] **SECRET_KEY hardcodada com fallback inseguro**
  - `auth_service.py` → `SECRET_KEY = os.environ["SECRET_KEY"]` com `RuntimeError` se ausente
  - `chat.py` → importa `SECRET_KEY, ALGORITHM` de `auth_service` (não lê env novamente)
  - Atualizar no painel do Render se a variável ainda não estiver configurada

- [x] **JWT exposto na URL do callback Steam**
  - `steam_auth.py` → código de troca: JWT em `_pending_codes` (TTL=30s), redirect usa `?code=UUID`
  - Novo endpoint `POST /api/auth/steam/exchange` — frontend troca UUID por JWT
  - `SteamCallback.tsx` → POST para exchange; token nunca aparece em URL/logs

---

## 🟠 SEGURANÇA — FASE 2

- [ ] Migrar JWT de `localStorage` → cookie `HttpOnly; Secure; SameSite=Strict`
- [ ] Implementar blacklist de tokens com claim `jti` (tabela `revoked_tokens` no banco)
- [ ] Claims JWT completos: adicionar `iss`, `aud`, `iat`, `jti`, `type="access"`
- [x] Rate limiting com `slowapi`: `POST /api/auth/login` → 5/min, `POST /api/demo/parse` → 3/min
- [ ] PATCH `/players` com schema de allowlist por role (`PlayerUpdateViewer` vs `PlayerUpdateAdmin`)
- [x] Validar formato do `steam_id`: regex `\d{17}` — `PlayerCreate` e `PlayerUpdate`
- [x] Filtrar players inativos em stats e head-to-head (`match_service.py` — h2h agora filtra `is_active=True`)
- [ ] WebSocket: nova conexão não pode substituir sessão ativa silenciosamente (`chat.py:95`)

---

## 🟡 SEGURANÇA — FASE 3

- [x] Security headers middleware (`main.py` — middleware manual: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS em prod)
- [x] Timing attack no login: `_DUMMY_HASH` em `player_service.py` — bcrypt roda mesmo quando nickname não existe
- [x] `ProtectedRoute` na rota `/profile` (`App.tsx`)
- [x] Upload `.dem`: validar magic bytes (`HL2DEMO\x00`) antes de processar
- [x] `scope_url` validator (http/https) + `notes: max_length=2000` em `schemas/match.py`
- [ ] Limite de conexões WebSocket por IP (máx 3)
- [x] Criar `PlayerResponsePublic` sem `steam_id` para rotas públicas (`GET /api/players`, `GET /api/players/{id}`)

---

## 🔵 SEGURANÇA — FASE 4

- [ ] Migrar `python-jose` → `PyJWT` (CVE-2024-33664/33663)
- [x] Desabilitar `/docs` e `/redoc` em produção (env var `DEBUG=true` para habilitar em dev)
- [x] `password max_length=72` (bcrypt trunca acima de 72 bytes) — `schemas/auth.py` e `schemas/player.py`
- [ ] Nickname com `pattern=r"^[\w\-. ]{2,50}$"`
- [ ] Logs de auditoria: LOGIN_OK, LOGIN_FAIL, LOGOUT, SENHA_ALTERADA
- [ ] Remover header `server: uvicorn` (`server_header=False`)
- [x] `DATABASE_URL = os.environ["DATABASE_URL"]` sem fallback (`RuntimeError` se ausente)

> Score atual de segurança: **~68/100** (Fases 1+3 quase completas; F2/F4 parcialmente concluídas). Meta para produção segura: **70+** (Fases 1–3 concluídas).

---

## 📁 REORGANIZAÇÃO DE PASTAS

- [ ] `banco/SETUP_BANCO.md` → `docs/setup-banco.md` (deletar pasta `banco/` depois)
- [ ] `WORKFLOW (2) (1).md` → `docs/workflow.md`
- [ ] `Everest Frags rebrand/` → `design/rebrand/`
- [ ] Deletar orphans (confirmar com grep antes):
  - `backend/models.py`
  - `backend/schemas.py`
  - `backend/routers/` (3 arquivos antigos)

---

## 🤖 IA — GROQ (free tier permanente)

Provider recomendado: **Groq** — 14.400 requests/dia, sem cartão, API compatível com OpenAI SDK.

```python
from openai import OpenAI
client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ.get("GROQ_API_KEY")
)
```

Fallback: Gemini Flash. Dev local: Ollama.

### Agente 1 — Bot do Chat (`/chat`)
- Responde quando mencionado com `@bot` no WebSocket existente
- Ferramentas: ranking, stats de player, partidas, head-to-head, sorteio, médias
- Novo endpoint: `POST /api/chat/agent`

### Agente 2 — Analista pós-partida
- Dispara ao salvar nova partida (`.dem` ou manual)
- Compara stats com média histórica, detecta recordes, posta resumo no chat

### Agente 3 — Coach do perfil (`/profile`)
- Botão "Analisar meu jogo"
- Output: pontos fortes/fracos, tendências, performance por mapa

### Agente 4 — Sorteio inteligente (`/sort`)
- Após snake draft, comenta sinergia e distribuição de roles entre os times

### Agente 5 — Monitor de conquistas
- Roda após cada partida salva
- Detecta milestones (rating 1.5+ consecutivo, 50 flash assists, etc.) e posta no chat

---

## 🔌 INTEGRAÇÕES GRATUITAS

### Steam Web API (já tem chave)
- Expandir: buscar horas no CS2, nível Steam, país ao cadastrar player
- Auto-preencher avatar/nome pelo Steam ID no `/admin`

### Discord Webhooks
- Admin cadastra URL do webhook nas configurações
- Notificações automáticas: nova partida (MVP + link), ranking atualizado, sorteio da noite
- Zero configuração extra, completamente gratuito

### FACEIT API (se o grupo usar FACEIT)
- Importar partidas automaticamente pelo nick, sem precisar do `.dem`
- Chave gratuita em developers.faceit.com

---

## 🗺️ NOVAS TELAS / FEATURES

### Já tem dados, só precisa de tela:
- [x] `/h2h` — head-to-head entre 2 players (página `HeadToHead.tsx` criada, rota `/h2h` em `App.tsx`, link no `Navbar`)
- [x] Gráfico de evolução histórica no `/profile` — HLTV Rating por partida (`HistoryChart` SVG em `Profile.tsx`, endpoint `GET /api/players/{id}/history`)
- Performance por mapa no `/profile` (`map_name` já está em cada partida)

### Features novas:
- **Sessão da noite** — agrupar partidas do mesmo dia, exibir MVP e placar da sessão
- **Reações** — emoji em mensagens do chat (WebSocket já existe)
- **Feed enriquecido** — recordes, subidas de ranking, marcos no Dashboard
- **Conquistas** — badges visíveis no perfil (estilo Steam)

---

## 🎨 FAVICON

Conceito: triângulo de montanha + crosshair no pico.

- Fundo `#0c0f14` | Montanha `#1a2a38` | Borda teal `#0e7490` | Crosshair `#22d3ee`
- Variação A (só montanha) para 16px
- Variação B (montanha + crosshair) para apple-touch-icon 180px
