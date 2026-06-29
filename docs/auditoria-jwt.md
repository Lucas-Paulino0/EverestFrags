# /auditoria-jwt — Auditoria de Segurança JWT (FastAPI + python-jose + passlib)

Faça uma auditoria de segurança completa no sistema de autenticação JWT deste projeto.
A auditoria cobre **8 categorias** derivadas de 8 rodadas de ataque real.
Para cada problema encontrado, use o formato:

**Motivo** — por que é um problema  
**Classificação** — Crítico / Alto / Médio / Baixo  
**Impacto** — o que um atacante pode fazer  
**Correção** — código seguro passo a passo  
**Validação** — como testar que a correção funciona  

---

## Categoria 1 — Configuração e Segredos

Verificar em `auth.py`, `.env`, `main.py`:

- [ ] `SECRET_KEY` lida do ambiente com `os.getenv` — mas sem `if not SECRET_KEY: raise RuntimeError`?
- [ ] `SECRET_KEY` tem entropia suficiente? (não é palavra, frase ou mnemônico — deve ser `secrets.token_hex(32)`)
- [ ] `DEBUG` controla se `/docs`, `/redoc`, `/openapi.json` são expostos?
- [ ] `DEBUG=true` em `.env` enquanto o código exige `DEBUG=false` em produção?
- [ ] Endpoint raiz `/` retorna informação sobre localização do frontend ou tecnologia usada?

---

## Categoria 2 — Autenticação e Timing Attacks

Verificar em `auth.py`, `main.py`, `database.py`:

- [ ] Login retorna imediatamente se o usuário não existe (bcrypt não roda → diferença de ~200ms mensurável)?
  - Correção: `_HASH_DUMMY = pwd.hash("dummy")` + `pwd.verify(senha, _HASH_DUMMY)` quando usuário não existe
- [ ] Cadastro: o hash bcrypt é feito ANTES ou DEPOIS da verificação de username existente?
  - Se depois: timing attack confirma existência de usernames via tempo de resposta
  - Correção: `senha_hash = pwd.hash(dados.password)` na primeira linha, antes de qualquer verificação
- [ ] `/logout` aceita qualquer token sem autenticação? (permite revogar token alheio sem conhecê-lo)
  - Deve ter `Depends(get_usuario_atual)` ou equivalente
- [ ] Username é normalizado com `.lower()` antes de qualquer comparação ou inserção?

---

## Categoria 3 — JWT: Claims e Validação

Verificar em `auth.py`:

- [ ] Token contém `iss` (issuer) e `verificar_token` valida `payload["iss"] == "nome-do-sistema"`?
- [ ] Token contém `aud` (audience) e `jwt.decode` passa `audience=AUDIENCE`?
  - Cuidado: `/logout` e `/refresh` também precisam do parâmetro `audience` ao decodificar
- [ ] Token contém `type` (`"access"` ou `"refresh"`) e `verificar_token` valida esse campo?
  - Sem isso, um refresh token seria aceito como access token e vice-versa
- [ ] Token contém `jti` (JWT ID — UUID único)? Blacklist guarda o `jti`, não o token inteiro?
- [ ] Token contém `iat` (issued at)?
- [ ] `python-jose` está configurado para rejeitar `alg: none`? (padrão é sim, mas confirmar)
- [ ] JWT completo esperado: `{ "sub", "iss", "aud", "iat", "jti", "type", "exp" }`

---

## Categoria 4 — Rate Limiting

Verificar em `main.py`:

- [ ] `/login` tem rate limit por **username** (ex: 5 falhas → bloquear 5 min)?
- [ ] `/login` tem rate limit de **volume global por IP** (ex: 30 req/min independente de username)?
  - Sem isso: 1000 usernames × 4 tentativas = 4000 bcrypts sem bloqueio (DoS via CPU)
- [ ] `/cadastro` tem rate limit por IP (ex: 10/hora)?
- [ ] Endpoints protegidos (`/perfil`, `/dados`, etc.) têm rate limit (ex: 60 req/min por IP)?
- [ ] Rate limit por IP é **atômico**? Verificar + incrementar em um único `with _lock`?
  - Se forem duas chamadas separadas: 200ms de janela (duração do bcrypt) permite bypass paralelo
- [ ] Rate limit por username conta somente **falhas**, não logins bem-sucedidos?
  - Se conta todos: usuário legítimo com 20 logins/hora fica bloqueado pelo próprio sistema
- [ ] Rate limit por IP usa `request.client.host` (IP real da TCP), não `X-Forwarded-For`?

---

## Categoria 5 — Blacklist e Revogação de Tokens

Verificar em `auth.py`:

- [ ] Blacklist tem `threading.Lock()` cobrindo **todas** as operações (leitura, escrita, deleção)?
  - Um dict sem lock: duas threads leem e escrevem simultaneamente → estado corrompido
- [ ] Limpeza de expirados (`_limpar_blacklist`) acontece em background task periódico?
  - Se chamada dentro de `criar_par_tokens` ou `get_usuario_atual`: varredura de tabela a cada request
- [ ] Tokens revogados somem no restart do servidor? (memória vs Redis)
  - Documentar o risco: token revogado volta a ser válido após crash/restart

---

## Categoria 6 — Validação de Entrada e XSS

Verificar em `models.py`:

- [ ] Campo `password` tem `max_length=72`? (bcrypt trunca silenciosamente acima de 72 bytes)
- [ ] Campo `password` tem validação de complexidade (maiúscula + número)?
- [ ] Campo `username` tem `pattern=r"^[a-zA-Z0-9_]+"` e `max_length`?
- [ ] Campos de texto livre (nome, descrição) têm `max_length`?
- [ ] Campos de texto exibidos no frontend bloqueiam `< > " '` com `field_validator`?
  - Armazenar `<script>` em campo de nome → Stored XSS em todos os usuários que virem o dado
- [ ] Frontend usa `textContent` (não `innerHTML`) para exibir dados do backend?

---

## Categoria 7 — Headers de Segurança HTTP

Verificar em `main.py` (middleware):

- [ ] `Content-Security-Policy` presente E **sem** `unsafe-inline`?
  - CSP com `unsafe-inline` = proteção declarada mas ineficaz (qualquer `<script>` inline passa)
  - Exige CSS e JS em arquivos externos (não inline no HTML)
- [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains` presente?
- [ ] `X-Content-Type-Options: nosniff` presente?
- [ ] `X-Frame-Options: DENY` presente?
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` presente?
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` presente?
- [ ] `Cache-Control: no-store` presente nas respostas autenticadas?
- [ ] `Cross-Origin-Opener-Policy: same-origin` presente?
- [ ] `Cross-Origin-Resource-Policy: same-origin` presente?
- [ ] Header `Server` removido ou substituído por valor genérico?
  - Uvicorn adiciona `server: uvicorn` **depois** do middleware — corrigir com `server_header=False` no runner programático

---

## Categoria 8 — Observabilidade e Auditoria

Verificar em `main.py`:

- [ ] Eventos de auditoria logados: LOGIN, FALHA_LOGIN, BLOQUEIO, LOGOUT?
- [ ] Logs sanitizados: username e outros campos de input têm `\n` e `\r` removidos?
  - Log injection: `"adriano\n[CRITICAL] sistema comprometido"` cria linha falsa no log
- [ ] Rate limit por IP gera log quando bloqueia? (silent block = cego para ataques em andamento)
- [ ] Frontend trata erro no logout do servidor? (token não revogado mas usuário acha que está seguro)

---

## Formato do Relatório Final

Após a análise, gerar:

### Roadmap de Correção

**Fase 1 — Crítico** (corrigir antes de qualquer deploy)  
**Fase 2 — Alto** (corrigir no próximo ciclo)  
**Fase 3 — Médio/Baixo** (melhorias incrementais)  

### Score de Maturidade

Usar a escala abaixo como referência:

| Score | Significado |
|---|---|
| 0–30 | Sistema básico sem proteções |
| 31–50 | Proteções básicas (SECRET_KEY no env, bcrypt) |
| 51–65 | Rate limiting e blacklist implementados |
| 66–75 | Headers de segurança e logs |
| 76–85 | Claims JWT completos, race conditions resolvidas |
| 86–95 | CSP real (sem unsafe-inline), timing attacks eliminados |
| 96–100 | Redis para blacklist, HTTPS, refresh token, cookies httpOnly |

### Gaps para 100% (documentar, não bloquear)

Lista do que exigiria infraestrutura adicional (Redis, PostgreSQL, Nginx) com nota de quando vale implementar.
