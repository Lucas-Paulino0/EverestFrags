# EverestFrags — Roadmap

Planejamento geral do sistema. Auditoria feita em 2026-06-29.

---

## 🔴 SEGURANÇA — FASE 1 (urgente, antes de qualquer nova feature)

- [ ] **SECRET_KEY hardcodada com fallback inseguro**
  - `backend/app/services/auth_service.py:36` → remover fallback `"dev-insecure-key-change-in-production"`
  - `backend/app/routers/chat.py:43` → remover fallback `""` (string vazia)
  - Centralizar: `SECRET_KEY = os.environ["SECRET_KEY"]` com `RuntimeError` se ausente
  - Gerar chave: `python -c "import secrets; print(secrets.token_hex(32))"`
  - Atualizar no painel do Render

- [ ] **JWT exposto na URL do callback Steam**
  - `backend/app/routers/steam_auth.py:98-99` → redirect `?token=JWT` aparece em logs do Render
  - Fix: padrão de código de troca — salvar JWT em dict com TTL=30s, redirecionar com UUID opaco
  - Frontend troca UUID por JWT via `POST` antes de armazenar

---

## 🟠 SEGURANÇA — FASE 2

- [ ] Migrar JWT de `localStorage` → cookie `HttpOnly; Secure; SameSite=Strict`
- [ ] Implementar blacklist de tokens com claim `jti` (tabela `revoked_tokens` no banco)
- [ ] Claims JWT completos: adicionar `iss`, `aud`, `iat`, `jti`, `type="access"`
- [ ] Rate limiting com `slowapi`: `POST /api/auth/login` → 5/min, `POST /api/demo/parse` → 3/min
- [ ] PATCH `/players` com schema de allowlist por role (`PlayerUpdateViewer` vs `PlayerUpdateAdmin`)
- [ ] Validar formato do `steam_id`: regex `\d{17}` em `players.py:61`
- [ ] Filtrar players inativos em stats e head-to-head (`player_service.py:29`, `match_service.py:153`)
- [ ] WebSocket: nova conexão não pode substituir sessão ativa silenciosamente (`chat.py:95`)

---

## 🟡 SEGURANÇA — FASE 3

- [ ] Security headers middleware (`pip install secure`, uma linha em `main.py`)
- [ ] Timing attack no login: `_DUMMY_HASH` em `player_service.py:115`
- [ ] `ProtectedRoute` na rota `/profile` (`App.tsx`)
- [ ] Upload `.dem`: validar magic bytes (`HL2DEMO`) antes de processar
- [ ] `scope_url: HttpUrl` + `notes: max_length=2000` em `schemas/match.py`
- [ ] Limite de conexões WebSocket por IP (máx 3)
- [ ] Criar `PlayerResponsePublic` sem `steam_id` para rotas públicas

---

## 🔵 SEGURANÇA — FASE 4

- [ ] Migrar `python-jose` → `PyJWT` (CVE-2024-33664/33663)
- [ ] Desabilitar `/docs` e `/redoc` em produção
- [ ] `password max_length=72` (bcrypt trunca acima de 72 bytes)
- [ ] Nickname com `pattern=r"^[\w\-. ]{2,50}$"`
- [ ] Logs de auditoria: LOGIN_OK, LOGIN_FAIL, LOGOUT, SENHA_ALTERADA
- [ ] Remover header `server: uvicorn` (`server_header=False`)
- [ ] `DATABASE_URL = os.environ["DATABASE_URL"]` sem fallback

> Score atual de segurança: **35/100**. Meta para produção segura: **70+** (Fases 1–3 concluídas).

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
- `/h2h` — head-to-head entre 2 players (API `/vs/{id2}` já existe)
- Gráfico de evolução histórica no `/profile` (score partida a partida)
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
