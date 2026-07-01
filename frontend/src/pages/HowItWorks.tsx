import { Navbar } from "../components/Navbar";

const S = {
  page: {
    minHeight: "100vh",
    background: "#070a0e",
    color: "#dde6f0",
    fontFamily: "'Inter', sans-serif",
    paddingBottom: 80,
  } as React.CSSProperties,
  scanlines: {
    position: "fixed" as const,
    inset: 0,
    pointerEvents: "none" as const,
    zIndex: 50,
    background: "repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 3px,rgba(0,0,0,0.10) 4px,rgba(0,0,0,0) 5px)",
    opacity: 0.35,
  },
  main: {
    maxWidth: 840,
    margin: "0 auto",
    padding: "40px 48px 0",
    position: "relative" as const,
    zIndex: 10,
  } as React.CSSProperties,
  sectionTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "3px",
    color: "#5d6d80",
    marginBottom: 18,
    display: "flex",
    alignItems: "center",
    gap: 14,
  } as React.CSSProperties,
  divider: {
    flex: 1,
    height: 1,
    background: "linear-gradient(90deg,#1e2a36,transparent)",
  } as React.CSSProperties,
  card: {
    border: "1px solid #1b2530",
    background: "#0d1218",
    padding: "24px 28px",
    marginBottom: 16,
  } as React.CSSProperties,
  cardTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 19,
    letterSpacing: 0.5,
    color: "#f0f9ff",
    marginBottom: 12,
  } as React.CSSProperties,
  body: {
    fontSize: 13.5,
    lineHeight: 1.7,
    color: "#8899ab",
  } as React.CSSProperties,
  formula: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    background: "#060a0e",
    border: "1px solid #1b2530",
    padding: "14px 18px",
    color: "#22d3ee",
    margin: "12px 0",
    lineHeight: 1.8,
  } as React.CSSProperties,
  pill: (color: string) => ({
    display: "inline-block",
    padding: "1px 8px",
    background: `${color}18`,
    border: `1px solid ${color}44`,
    color,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "1px",
    marginRight: 6,
    marginBottom: 4,
  } as React.CSSProperties),
  row: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap" as const,
    marginBottom: 12,
  } as React.CSSProperties,
  metricBox: (color: string) => ({
    flex: 1,
    minWidth: 160,
    border: `1px solid ${color}33`,
    background: `${color}08`,
    padding: "14px 16px",
  } as React.CSSProperties),
  metricTitle: (color: string) => ({
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "1.5px",
    color,
    marginBottom: 10,
  } as React.CSSProperties),
  metricItem: {
    fontSize: 12,
    color: "#6a7f93",
    lineHeight: 1.6,
  } as React.CSSProperties,
  levelRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 8,
    marginTop: 12,
  } as React.CSSProperties,
  levelBox: (color: string) => ({
    border: `1px solid ${color}44`,
    background: `${color}0a`,
    padding: "10px 14px",
    textAlign: "center" as const,
  } as React.CSSProperties),
};

const LEVELS = [
  { name: "Recruta",   xp: 0,    color: "#5d6d80" },
  { name: "Soldado",   xp: 500,  color: "#4a9a7a" },
  { name: "Veterano",  xp: 1000, color: "#4a7aaa" },
  { name: "Elite",     xp: 2000, color: "#6366f1" },
  { name: "Atirador",  xp: 3500, color: "#0e7490" },
  { name: "Lenda",     xp: 5500, color: "#e0a82e" },
  { name: "Imortal",   xp: 9000, color: "#ef4444" },
];

const COMBAT_METRICS = [
  "kills (ponderados por contexto)",
  "deaths (invertido — menos = melhor)",
  "assists",
  "damage_total",
  "ADR",
  "ADR difference",
  "HLTV Rating",
  "KAST%",
  "grenade_damage",
];

const DUEL_METRICS = [
  "opening_kills (1º kill do round)",
  "trade_kills (vingança em até 5s)",
  "trade_denials (impediu troca adversária)",
  "time_to_kill_ms (invertido — mais rápido = melhor)",
  "opening_deaths (invertido)",
  "MVPs",
];

const UTILITY_METRICS = [
  "flash_assists",
  "grenade_damage (HE)",
  "he_enemies_hit",
  "fire_enemies_hit",
  "fire_damage (molotov/incendiária)",
];

export function HowItWorks() {
  return (
    <div style={S.page}>
      <div style={S.scanlines} />
      <Navbar />

      <main style={S.main}>

        {/* Título */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 38, letterSpacing: 1, color: "#f0f9ff", margin: 0, lineHeight: 1 }}>
            COMO FUNCIONA O <span style={{ color: "#0e7490" }}>RANKING</span>
          </h1>
          <p style={{ fontSize: 13, color: "#4a5868", marginTop: 8, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.5px" }}>
            // score relativo ao grupo — normalizado entre os jogadores com partidas registradas
          </p>
        </div>

        {/* Filosofia */}
        <div style={{ ...S.sectionTitle }}>
          <span>FILOSOFIA</span>
          <span style={S.divider} />
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Inspirado na evolução do HLTV Rating</div>
          <p style={S.body}>
            O sistema acompanha a mesma lógica histórica do HLTV: começou com K/D puro, evoluiu para ADR e
            KAST, depois passou a valorizar contexto (Round Swing). No EverestFrags, kills em situação difícil valem mais,
            kills fáceis valem menos — e o score final é sempre relativo ao grupo, não absoluto.
          </p>
          <p style={{ ...S.body, marginTop: 10 }}>
            Um jogador com 30 kills num grupo fraco pode ter score menor que um com 20 kills num grupo forte,
            dependendo de como os outros foram. O ranking responde à pergunta: <em style={{ color: "#aebccd" }}>"quem se
            destacou mais dentro desse grupo específico?"</em>
          </p>
        </div>

        {/* Passo 1 — Agregação */}
        <div style={S.sectionTitle}>
          <span>PASSO 1 — AGREGAÇÃO</span>
          <span style={S.divider} />
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Todas as partidas, um número por jogador</div>
          <p style={S.body}>
            Antes de calcular qualquer score, as métricas de todas as partidas de cada jogador são agregadas.
            Algumas são <strong style={{ color: "#dde6f0" }}>somadas</strong> (volume total — kills, dano, opening kills...),
            outras são <strong style={{ color: "#dde6f0" }}>calculadas como média</strong> (consistência — ADR, HLTV Rating, KAST%, TTK).
          </p>
        </div>

        {/* Passo 2 — Normalização */}
        <div style={S.sectionTitle}>
          <span>PASSO 2 — NORMALIZAÇÃO MIN-MAX</span>
          <span style={S.divider} />
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Todos na mesma escala de 0 a 100</div>
          <p style={S.body}>
            Cada métrica é normalizada <strong style={{ color: "#dde6f0" }}>comparando todos os jogadores entre si</strong>:
          </p>
          <div style={S.formula}>
            score = (valor_jogador − mín_do_grupo) / (máx_do_grupo − mín_do_grupo) × 100
          </div>
          <p style={S.body}>
            Métricas onde <strong style={{ color: "#dde6f0" }}>menor é melhor</strong> são invertidas — mortes, tempo de kill
            (TTK), opening_deaths:
          </p>
          <div style={S.formula}>
            score_invertido = (máx_do_grupo − valor_jogador) / (máx_do_grupo − mín_do_grupo) × 100
          </div>
          <p style={{ ...S.body, marginTop: 8 }}>
            Se todos têm o mesmo valor numa métrica → score 50 para todos (empate perfeito, ninguém prejudicado).
          </p>
        </div>

        {/* Passo 3 — Categorias */}
        <div style={S.sectionTitle}>
          <span>PASSO 3 — SCORE POR CATEGORIA</span>
          <span style={S.divider} />
        </div>

        <div style={S.row}>
          <div style={S.metricBox("#0e7490")}>
            <div style={S.metricTitle("#0e7490")}>COMBATE <span style={{ fontSize: 10, color: "#4a7a90" }}>30%</span></div>
            {COMBAT_METRICS.map(m => <div key={m} style={S.metricItem}>· {m}</div>)}
          </div>
          <div style={S.metricBox("#6366f1")}>
            <div style={S.metricTitle("#6366f1")}>DUELOS <span style={{ fontSize: 10, color: "#4a4c8a" }}>36%</span></div>
            {DUEL_METRICS.map(m => <div key={m} style={S.metricItem}>· {m}</div>)}
          </div>
          <div style={S.metricBox("#e0a82e")}>
            <div style={S.metricTitle("#e0a82e")}>UTILITY <span style={{ fontSize: 10, color: "#8a6a1a" }}>34%</span></div>
            {UTILITY_METRICS.map(m => <div key={m} style={S.metricItem}>· {m}</div>)}
          </div>
        </div>

        {/* Ajustes contextuais */}
        <div style={S.card}>
          <div style={S.cardTitle}>Ajustes Contextuais (Round Swing)</div>
          <p style={S.body}>
            Inspirado no HLTV Rating 3.0: kills não valem todas igual. Antes da normalização,
            um campo derivado <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#22d3ee", fontSize: 12 }}>weighted_kills</code> substitui o kill puro no score de Combate:
          </p>
          <div style={S.formula}>
            weighted_kills = kills − (eco_kills × 0.5) + (disadvantage_kills × 0.3) − (advantage_kills × 0.2)
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
            <div style={{ flex: 1, minWidth: 180, border: "1px solid #ef444422", background: "#ef44440a", padding: "12px 14px" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: "#ef4444", letterSpacing: "1px", marginBottom: 6 }}>ECO KILLS — penalizado 50%</div>
              <div style={{ fontSize: 12, color: "#6a7f93", lineHeight: 1.6 }}>
                Kill contra inimigo com menos de $500 em equipamento efetivo (incluindo o que carregou do round anterior).
                Abater um eco não exige tanto esforço quanto um full-buy.
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180, border: "1px solid #22d3ee22", background: "#22d3ee0a", padding: "12px 14px" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: "#22d3ee", letterSpacing: "1px", marginBottom: 6 }}>DISADVANTAGE KILLS — bônus 30%</div>
              <div style={{ fontSize: 12, color: "#6a7f93", lineHeight: 1.6 }}>
                Kill feita quando seu time tinha menos jogadores vivos que o adversário. Virar o round em desvantagem numérica é o gesto mais valioso do CS.
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180, border: "1px solid #e0a82e22", background: "#e0a82e0a", padding: "12px 14px" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: "#e0a82e", letterSpacing: "1px", marginBottom: 6 }}>ADVANTAGE KILLS — reduzido 20%</div>
              <div style={{ fontSize: 12, color: "#6a7f93", lineHeight: 1.6 }}>
                Kill feita com mais players vivos que o adversário. Vantagem numérica facilita o duelo — o kill vale um pouco menos.
              </div>
            </div>
          </div>
        </div>

        {/* Passo 4 — Score final */}
        <div style={S.sectionTitle}>
          <span>PASSO 4 — SCORE FINAL</span>
          <span style={S.divider} />
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Média ponderada das 3 categorias</div>
          <div style={S.formula}>
            score_final = (score_combate × 0.30){"\n"}
                        + (score_duelo   × 0.36){"\n"}
                        + (score_utility × 0.34)
          </div>
          <p style={S.body}>
            Os pesos são fixos e definidos por decisão do grupo — não existe edição via admin.
            Duelos leva o maior peso (36%) porque abertura de rounds e trades são as ações mais decisivas
            do CS2. Utility (34%) vem logo atrás, valorizando quem joga além do rifle.
            Os pesos somam exatamente 1.0 (100%).
          </p>
        </div>

        {/* Métricas do demo */}
        <div style={S.sectionTitle}>
          <span>COMO AS MÉTRICAS SÃO EXTRAÍDAS</span>
          <span style={S.divider} />
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Parser do .dem — sem parse_ticks()</div>
          <p style={S.body}>
            Todas as métricas vêm dos eventos do demo (<code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#22d3ee", fontSize: 12 }}>player_death</code>,{" "}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#22d3ee", fontSize: 12 }}>player_hurt</code>,{" "}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#22d3ee", fontSize: 12 }}>item_purchase</code>,{" "}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#22d3ee", fontSize: 12 }}>round_end</code>)
            — processados em ordem de tick, sem carregar todos os snapshots de frame em memória.
            Isso mantém o parser viável mesmo para demos de 750MB+.
          </p>
          <p style={{ ...S.body, marginTop: 8 }}>
            Se o servidor usou <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#22d3ee", fontSize: 12 }}>mp_restartgame</code> durante a partida, o parser detecta o reset (round volta a 0),
            descarta os eventos pré-restart e processa só a partida real. Um aviso é exibido no AddMatch quando isso acontece.
          </p>
        </div>

        {/* Sistema de XP */}
        <div style={S.sectionTitle}>
          <span>SISTEMA DE XP E NÍVEIS</span>
          <span style={S.divider} />
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Calculado retroativamente — sem coluna no banco</div>
          <p style={S.body}>
            XP é derivado on-the-fly das stats já acumuladas. Qualquer partida registrada (passada ou futura)
            conta automaticamente — não existe "zerar" o XP.
          </p>
          <div style={S.formula}>
            XP = kills×10 + assists×5 + opening_kills×20 + trade_kills×10{"\n"}
               + flash_assists×5 + mvps×15 + partidas×50{"\n"}
               + bônus por HLTV Rating médio (5–25 XP por partida)
          </div>
          <div style={S.levelRow}>
            {LEVELS.map(l => (
              <div key={l.name} style={S.levelBox(l.color)}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: l.color, letterSpacing: "0.5px" }}>
                  {l.name.toUpperCase()}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a5868", marginTop: 4 }}>
                  {l.xp === 0 ? "início" : `${l.xp.toLocaleString()} XP`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ borderTop: "1px solid #151d26", marginTop: 32, paddingTop: 20, paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#2e3e50", letterSpacing: "0.5px" }}>
            // fórmula em ranking_service.py · pesos constantes · retroativo automático
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={S.pill("#0e7490")}>COMBATE 30%</span>
            <span style={S.pill("#6366f1")}>DUELOS 36%</span>
            <span style={S.pill("#e0a82e")}>UTILITY 34%</span>
          </div>
        </div>

      </main>
    </div>
  );
}
