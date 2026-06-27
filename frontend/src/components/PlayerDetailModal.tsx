/**
 * PlayerDetailModal — detalhe completo de um player do ranking
 *
 * Aberto ao clicar em qualquer card do ranking (pódio, grade ou lista compacta).
 * Reaproveita o mesmo padrão visual do cartão de identidade do Profile.tsx
 * (radar + barras de categoria + score final) e adiciona a grade de métricas
 * cruas agregadas que agora vêm no RankingEntry (GET /api/ranking já traz tudo).
 *
 * Painel "POR QUE ESSE RANK?" — calculado 100% no cliente a partir de
 * `allEntries` (o ranking completo, já carregado pela página que abre o modal),
 * sem precisar de endpoint novo:
 *   1. Breakdown numérico: quantos pontos do score final vieram de cada categoria
 *   2. Frase automática: maior destaque e maior ponto fraco vs a média do grupo
 *   3. Gap pro próximo/anterior colocado
 * A comparação com a média do grupo (item 4 do pedido) fica embutida como um
 * indicador ▲/▼ direto em cada célula da grade de métricas cruas.
 */

import { type RankingEntry } from "../api/client";
import { RadarChart } from "./RadarChart";
import { CategoryBar } from "./CategoryBar";

interface PlayerDetailModalProps {
  entry: RankingEntry;
  allEntries: RankingEntry[];
  onClose: () => void;
}

// Pesos do score final — devem espelhar WEIGHT_COMBAT/DUEL/UTILITY em
// backend/app/services/ranking_service.py (pesos fixos, não vêm da API).
const WEIGHT_COMBAT = 0.30;
const WEIGHT_DUEL = 0.36;
const WEIGHT_UTILITY = 0.34;

// Métricas onde menor valor é melhor — usado tanto na frase automática quanto
// na cor do indicador ▲/▼ da grade (mesma lista de INVERTED_METRICS do backend).
const INVERTED_KEYS = new Set<keyof RankingEntry>(["deaths", "time_to_kill_ms"]);

// Métricas usadas pra eleger destaque/ponto fraco do player dentro do grupo.
// `inverted: true` = menor valor é melhor (deaths, TTK).
const JUDGABLE_METRICS: { key: keyof RankingEntry; label: string; inverted?: boolean }[] = [
  { key: "hltv_rating", label: "RATING" },
  { key: "adr", label: "ADR" },
  { key: "kast_percent", label: "KAST%" },
  { key: "opening_kills", label: "OPENING KILLS" },
  { key: "trade_kills", label: "TRADE KILLS" },
  { key: "trade_denials", label: "TRADE DENIALS" },
  { key: "flash_assists", label: "FLASH ASSISTS" },
  { key: "fire_damage", label: "DANO MOLOTOV" },
  { key: "grenade_damage", label: "DANO GRANADA" },
  { key: "deaths", label: "DEATHS", inverted: true },
  { key: "time_to_kill_ms", label: "TTK", inverted: true },
];

interface StatItem { label: string; value: string; key: keyof RankingEntry }
interface StatGroup { label: string; color: string; stats: StatItem[] }

function numOf(entry: RankingEntry, key: keyof RankingEntry): number {
  const v = entry[key];
  return typeof v === "number" ? v : 0;
}

function groupAverage(entries: RankingEntry[], key: keyof RankingEntry): number {
  if (!entries.length) return 0;
  return entries.reduce((sum, e) => sum + numOf(e, key), 0) / entries.length;
}

export function PlayerDetailModal({ entry, allEntries, onClose }: PlayerDetailModalProps) {
  const groups: StatGroup[] = [
    {
      label: "COMBATE",
      color: "#0e7490",
      stats: [
        { label: "K/D", value: entry.kd_ratio.toFixed(2), key: "kd_ratio" },
        { label: "KILLS", value: String(entry.kills), key: "kills" },
        { label: "DEATHS", value: String(entry.deaths), key: "deaths" },
        { label: "ASSISTS", value: String(entry.assists), key: "assists" },
        { label: "DANO TOTAL", value: String(entry.damage_total), key: "damage_total" },
        { label: "ADR", value: entry.adr.toFixed(1), key: "adr" },
        { label: "ADR +/-", value: entry.adr_difference.toFixed(1), key: "adr_difference" },
        { label: "RATING", value: entry.hltv_rating.toFixed(2), key: "hltv_rating" },
        { label: "KAST%", value: `${entry.kast_percent.toFixed(0)}%`, key: "kast_percent" },
        { label: "ECO KILLS", value: String(entry.eco_kills), key: "eco_kills" },
        { label: "DESVANTAGEM K", value: String(entry.disadvantage_kills), key: "disadvantage_kills" },
        { label: "VANTAGEM K", value: String(entry.advantage_kills), key: "advantage_kills" },
      ],
    },
    {
      label: "DUELOS",
      color: "#6366f1",
      stats: [
        { label: "OPENING KILLS", value: String(entry.opening_kills), key: "opening_kills" },
        { label: "TRADE KILLS", value: String(entry.trade_kills), key: "trade_kills" },
        { label: "TRADE DENIALS", value: String(entry.trade_denials), key: "trade_denials" },
        { label: "TTK (MS)", value: entry.time_to_kill_ms.toFixed(0), key: "time_to_kill_ms" },
      ],
    },
    {
      label: "UTILITY",
      color: "#e0a82e",
      stats: [
        { label: "FLASH ASSISTS", value: String(entry.flash_assists), key: "flash_assists" },
        { label: "DANO GRANADA", value: String(entry.grenade_damage), key: "grenade_damage" },
        { label: "HE HIT", value: String(entry.he_enemies_hit), key: "he_enemies_hit" },
        { label: "FIRE HIT", value: String(entry.fire_enemies_hit), key: "fire_enemies_hit" },
        { label: "DANO MOLOTOV", value: String(entry.fire_damage), key: "fire_damage" },
      ],
    },
  ];

  // ── Breakdown numérico por categoria ──────────────────────────────────────
  const breakdown = [
    { label: "COMBATE", color: "#22d3ee", score: entry.score_combat, weight: WEIGHT_COMBAT },
    { label: "DUELOS", color: "#818cf8", score: entry.score_duel, weight: WEIGHT_DUEL },
    { label: "UTILITY", color: "#e8b948", score: entry.score_utility, weight: WEIGHT_UTILITY },
  ].map(c => ({ ...c, pts: c.score * c.weight }));
  const strongestCategory = breakdown.reduce((a, b) => (b.pts > a.pts ? b : a));

  // ── Frase automática: destaque e ponto fraco vs média do grupo ────────────
  const group = allEntries.length ? allEntries : [entry];
  let best: { label: string; deltaPct: number } | null = null;
  let worst: { label: string; deltaPct: number } | null = null;
  for (const m of JUDGABLE_METRICS) {
    const avg = groupAverage(group, m.key);
    if (avg === 0) continue;
    const raw = numOf(entry, m.key);
    const deltaPct = ((raw - avg) / avg) * 100;
    const goodness = m.inverted ? -deltaPct : deltaPct;
    if (!best || goodness > best.deltaPct) best = { label: m.label, deltaPct: goodness };
    if (!worst || goodness < worst.deltaPct) worst = { label: m.label, deltaPct: goodness };
  }

  // ── Gap pro próximo/anterior colocado ──────────────────────────────────────
  const sorted = [...group].sort((a, b) => a.rank - b.rank);
  const idx = sorted.findIndex(e => e.player_id === entry.player_id);
  const better = idx > 0 ? sorted[idx - 1] : null;     // rank acima (melhor)
  const worse = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null; // rank abaixo (pior)

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.74)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24, overflowY: "auto" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "relative", width: 640, maxWidth: "100%", border: "1px solid #1e2a36", background: "linear-gradient(180deg,#0f161d,#0a0e13)", padding: "30px 32px 28px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#0e7490,#6366f1,#e0a82e)" }} />

        <button
          onClick={onClose}
          style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "#566476", fontSize: 19, cursor: "pointer", lineHeight: 1, padding: "2px 4px" }}
        >
          ✕
        </button>

        {/* Identidade */}
        <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, border: "2px solid #0e7490", background: "#04222b",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 26, color: "#22d3ee",
            boxShadow: "0 0 16px rgba(14,116,144,.25)", flexShrink: 0,
          }}>
            {entry.avatar_initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, color: "#f0f9ff", lineHeight: 1 }}>
              {entry.player_nickname}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 28, color: "#22d3ee", lineHeight: 1 }}>
                #{entry.rank}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a5868" }}>
                {entry.total_matches} partidas
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 32, color: "#f0f9ff", lineHeight: 1 }}>
              {Math.round(entry.score_final)}
            </div>
            <div style={{ fontSize: 9, letterSpacing: "2px", color: "#4a5868", marginTop: 2 }}>SCORE</div>
          </div>
        </div>

        {/* Radar + barras */}
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 22 }}>
          <RadarChart
            adr={entry.score_combat}
            kast={entry.kast_percent}
            rating={entry.hltv_rating * 50}
            openK={entry.score_duel}
            trade={Math.min(entry.kd_ratio * 33, 100)}
            util={entry.score_utility}
            color="#0e7490"
            size={160}
          />
          <div style={{ flex: 1, minWidth: 200, paddingTop: 8 }}>
            <CategoryBar label="COMBATE" value={entry.score_combat} color="#0e7490" textColor="#22d3ee" height={5} />
            <CategoryBar label="DUELOS" value={entry.score_duel} color="#6366f1" textColor="#818cf8" height={5} />
            <CategoryBar label="UTILITY" value={entry.score_utility} color="#e0a82e" textColor="#e8b948" height={5} />
          </div>
        </div>

        {/* Por que esse rank? */}
        <div style={{ marginBottom: 22, border: "1px solid #1a222c", background: "#0c1015", padding: "14px 16px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "2px", color: "#aebccd", marginBottom: 12 }}>
            POR QUE #{entry.rank}?
          </div>

          {/* Breakdown numérico */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {breakdown.map(b => (
              <div key={b.label} style={{ flex: 1, textAlign: "center", padding: "8px 4px", background: b.label === strongestCategory.label ? "rgba(255,255,255,.04)" : "transparent", border: b.label === strongestCategory.label ? `1px solid ${b.color}44` : "1px solid transparent" }}>
                <div style={{ fontSize: 8, letterSpacing: "1px", color: "#5d6d80" }}>{b.label} · {Math.round(b.weight * 100)}%</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: b.color, marginTop: 2 }}>
                  {b.pts.toFixed(1)} pts
                </div>
              </div>
            ))}
          </div>

          {/* Frase automática */}
          {best && worst && (
            <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "#aebccd", marginBottom: 10 }}>
              Destaque em <strong style={{ color: "#22d3ee" }}>{best.label}</strong>
              {best.deltaPct >= 0 ? ` (${best.deltaPct.toFixed(0)}% acima da média do grupo)` : " (próximo da média do grupo)"}.
              {" "}Ponto a melhorar: <strong style={{ color: "#e8b948" }}>{worst.label}</strong>
              {worst.deltaPct < 0 ? ` (${Math.abs(worst.deltaPct).toFixed(0)}% abaixo da média do grupo)` : " (mesmo assim, dentro da média)"}.
            </div>
          )}

          {/* Gap pro próximo/anterior */}
          {(better || worse) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
              {better && (
                <div style={{ color: "#64748a" }}>
                  ▼ <span style={{ color: "#e0a82e" }}>-{(better.score_final - entry.score_final).toFixed(1)} pts</span> para alcançar #{better.rank} ({better.player_nickname})
                </div>
              )}
              {worse && (
                <div style={{ color: "#64748a" }}>
                  ▲ <span style={{ color: "#22d3ee" }}>+{(entry.score_final - worse.score_final).toFixed(1)} pts</span> de vantagem sobre #{worse.rank} ({worse.player_nickname})
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grade de métricas cruas, por categoria — com comparação vs média do grupo */}
        {groups.map(g => (
          <div key={g.label} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <span style={{ width: 9, height: 9, background: g.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "2px", color: "#aebccd" }}>
                {g.label}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "#1a222c", border: "1px solid #1a222c" }}>
              {g.stats.map(s => {
                // Delta absoluto vs a média do grupo (não percentual): métricas como
                // adr_difference já são uma diferença em si, com média do grupo perto
                // de zero por construção — uma % em cima disso explode (ex: 134900%).
                const avg = groupAverage(group, s.key);
                const raw = numOf(entry, s.key);
                const diff = raw - avg;
                const showDelta = Math.abs(diff) >= 0.05;
                // Seta = direção factual (valor acima/abaixo da média). Cor = julgamento
                // de "bom/neutro", invertido pra deaths/TTK (onde menor é melhor).
                const isGood = INVERTED_KEYS.has(s.key) ? diff < 0 : diff > 0;
                return (
                  <div key={s.label} style={{ background: "#0c1015", padding: "9px 8px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "#dde6f0" }}>{s.value}</div>
                    <div style={{ fontSize: 8, letterSpacing: "0.5px", color: "#475569", marginTop: 3 }}>{s.label}</div>
                    {showDelta && (
                      <div style={{ fontSize: 8, fontFamily: "'JetBrains Mono', monospace", color: isGood ? "#2dd4bf" : "#94a3b8", marginTop: 2 }}>
                        {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(1)} vs média ({avg.toFixed(1)})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
