# EverestFrags — Plano: Features de IA

Branch: `feat/ai-features` | Base: `dev` | Início: 2026-06-30

Provider: **Groq free tier** (Llama 3.1 70B para análises, 8B para respostas rápidas)
Custo adicional: $0

---

## 1. Coach Individual (`POST /api/players/{id}/coach`)

Botão "Analisar meu jogo" na página `/profile`.

**O que faz:**
- Busca stats das últimas N partidas do player
- Compara cada métrica com a média do grupo
- Calcula tendência (últimas 3 partidas vs anteriores)
- Identifica melhor e pior mapa
- Groq retorna: 1 ponto forte real, 1 fraqueza real, 1 sugestão prática

**Prompt base:**
```python
system = "Você é analista de CS2. Seja direto e baseado só nos dados. Máx 150 palavras. PT-BR."

user = f"""
Jogador: {nickname} — últimas {n} partidas

vs média do grupo:
ADR: {adr:.1f} ({diff_adr:+.0f}%)
Opening kills: {opening_kills:.1f} ({diff_ok:+.0f}%)
Flash assists: {flash_assists:.1f} ({diff_fa:+.0f}%)
KAST%: {kast:.0f}% ({diff_kast:+.0f}%)
Time to kill: {ttk}ms ({diff_ttk:+.0f}%)

Tendência ADR (últimas 3): {trend}
Melhor mapa: {best_map} (ADR {best_adr:.0f})
Pior mapa: {worst_map} (ADR {worst_adr:.0f})

1 ponto forte, 1 fraqueza, 1 sugestão prática.
"""
```

**Frontend:** card colapsável no `/profile` com loading skeleton enquanto Groq responde.

---

## 2. Narrativa da Partida (`POST /api/matches/{id}/narrative`)

Gerada automaticamente ao salvar partida, exibida no `/matches/:id`.

**O que faz:**
- Recebe stats de todos os players da partida
- IA escreve um resumo estilo comentarista esportivo (3–4 parágrafos)
- Destaca momentos-chave: quem dominou, quem virou, quem decepcionou

**Exemplo de output:**
```
Em uma partida acirrada em de_mirage, GodBR ditou o ritmo desde
o início com 3 opening kills consecutivas no primeiro pistol.
A equipe aproveitou os espaços abertos e fechou o CT side em 9–6.

O ponto de virada veio no round 14: Kaz, que vinha abaixo da
sua média com 0.89 de rating, acumulou dois clutches 1v2 em
sequência que reanimaram o time e mudaram o momentum da partida.

Destaques: GodBR (MVP — ADR 94, rating 1.47), Kaz (resiliência —
dois clutches decisivos). A partida foi a de melhor ADR coletivo
do grupo nos últimos 30 dias.
```

---

## 3. Previsão Pré-Sessão (`POST /api/sort/prediction`)

Chamado na tela `/sort` após selecionar os jogadores presentes.

**O que faz:**
- Analisa forma recente (últimas 5 partidas) de cada jogador presente
- IA aponta quem está "em alta" e quem está "em baixa" nessa sessão
- Não substitui o sorteio — é um card informativo acima dele

**Exemplo:**
```
FORMA DO DIA — 8 jogadores selecionados

🔥 Em alta: GodBR (+18% ADR nas últimas 3), Ruxin (KAST acima de 80%)
❄️ Em baixa: Kaz (abaixo da média em 4 das últimas 5 partidas)
⚠️ Cuidado: Preto não joga há 2 semanas — possível queda de ritmo
```

---

## 4. Digest Semanal (Discord Webhook)

Job automático toda segunda-feira às 10h (ou trigger manual pelo admin).

**Conteúdo:**
- Ranking atual top 5
- Quem mais subiu/caiu na semana
- Partida da semana (maior rating coletivo)
- Destaque individual (melhor performance da semana)
- IA escreve o texto do digest com base nos dados

**Implementação:** endpoint `POST /api/discord/digest` chamado por cron job (APScheduler) ou manualmente pelo admin.

---

## 5. Export para Planilha (`GET /api/export`)

Sem IA — só Python puro (`openpyxl`).

**Abas geradas:**
- **Ranking** — score_final, score_combat, score_duel, score_utility, total_matches
- **Stats completas** — todas as 20 métricas por player (médias)
- **Histórico** — todas as partidas com stats individuais
- **Head-to-head** — matrix de kills entre todos os players

**Formato:** `.xlsx` com estilo visual (cores do EverestFrags, cabeçalhos em negrito, barras condicionais no score).

**Frontend:** botão "Exportar" no `/ranking` e no `/admin`.

---

## 6. Sistema de XP e Níveis

Paralelo ao score 0–100 atual. XP acumulado ao longo de todas as partidas.

**Fórmula XP por partida:**
```
xp_base = kills * 10 + assists * 5 + (adr / 10)
xp_bonus = opening_kills * 15 + flash_assists * 8 + trade_kills * 12
xp_penalty = deaths * 3
xp_total = xp_base + xp_bonus - xp_penalty
```

**Ranks por XP acumulado:**
| Rank | XP | Ícone |
|------|-----|-------|
| Recruta | 0–999 | ○ |
| Soldado | 1.000–2.999 | ◐ |
| Veterano | 3.000–5.999 | ● |
| Elite | 6.000–9.999 | ◈ |
| Everest | 10.000+ | ✦ |

**Onde aparece:** badge no card do player no `/ranking`, no `/profile`, no modal de detalhes.

---

## Implementação — Ordem Sugerida

1. **Export planilha** — menor risco, sem dependência de IA, entrega imediata
2. **Coach individual** — maior valor percebido, endpoint simples
3. **Sistema de XP** — requer migração no banco (nova coluna `xp_total`)
4. **Narrativa da partida** — dispara junto com o analista pós-partida existente
5. **Previsão pré-sessão** — depende dos dados de forma recente
6. **Digest semanal** — último, pois depende do webhook Discord estar configurado

---

## 7. Sistema de Vitórias (paralelo ao ranking de performance)

Aba separada `/wins` ou tab dentro do `/ranking`. **Não influencia o score atual** — é um placar paralelo baseado puramente em resultado de partida.

### Problema atual
O sistema registra stats individuais, mas não guarda qual time ganhou nem quem estava em cada time. O sorteio distribui os times mas o resultado some depois.

### O que precisa ser adicionado no banco
```sql
-- Novos campos na tabela matches
team_1_player_ids  INTEGER[]   -- ids dos players do Time 1
team_2_player_ids  INTEGER[]   -- ids dos players do Time 2
winning_team       INTEGER     -- 1 ou 2 (null se não registrado)

-- Nova tabela de pontuação por vitórias
player_wins (
  player_id   INTEGER FK,
  wins        INTEGER DEFAULT 0,
  losses      INTEGER DEFAULT 0,
  win_streak  INTEGER DEFAULT 0,
  points      INTEGER DEFAULT 0
)
```

### Fórmula de pontos
```
Vitória normal:                    +3 pts
Derrota:                           -1 pt
Vitória sendo time azarão*:        +5 pts
Sequência de 3+ vitórias (streak): badge visual
```
*azarão = time com score médio inferior ao adversário no momento do sorteio

### Interface — aba "Placar"
```
PLACAR DA TEMPORADA

1° Ciclano    V:12  D:5   WR:70%  🔥 3 seguidas   42 pts
2° GodBR      V:9   D:6   WR:60%                   21 pts
3° Fresh      V:10  D:7   WR:59%                   23 pts
4° Kaz        V:8   D:9   WR:47%                    15 pts
```

### Fluxo de registro
1. Admin sorteia os times no `/sort` (já existe)
2. Após a partida, admin clica em "Registrar resultado" no `/sort` ou no detalhe da partida
3. Seleciona qual time ganhou (Time 1 ou Time 2)
4. Sistema atualiza wins/losses/points de cada player automaticamente

### Novos endpoints necessários
```
POST /api/matches/{id}/result      — registrar resultado (admin)
GET  /api/wins/ranking             — placar de vitórias
GET  /api/players/{id}/wins        — histórico de vitórias do player
```

---

## Implementação — Ordem Sugerida (atualizada)

1. **Export planilha** — menor risco, sem dependência de IA, entrega imediata
2. **Sistema de vitórias** — requer migração no banco, mas agrega muito valor social
3. **Coach individual** — maior valor percebido, endpoint simples
4. **Sistema de XP** — requer migração no banco (nova coluna `xp_total`)
5. **Narrativa da partida** — dispara junto com o analista pós-partida existente
6. **Previsão pré-sessão** — depende dos dados de forma recente
7. **Digest semanal** — último, pois depende do webhook Discord estar configurado

---

## Dependências a instalar

```bash
# Backend
pip install groq openpyxl apscheduler httpx

# Variáveis de ambiente a adicionar no Render
GROQ_API_KEY=...
DISCORD_WEBHOOK_URL=...  # opcional, configurável pelo admin
```
