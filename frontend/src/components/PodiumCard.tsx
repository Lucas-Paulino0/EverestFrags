/**
 * PodiumCard — card grande para as posições 1, 2, 3 do ranking
 *
 * Cores rebrand v2:
 *   1º → teal #0e7490 | 2º → indigo #6366f1 | 3º → ouro #e0a82e
 */

import { type RankingEntry } from "../api/client";
import { RadarChart } from "./RadarChart";
import { CategoryBar } from "./CategoryBar";

const ACCENT  = ["#0e7490", "#6366f1", "#e0a82e"];
const BORDER  = ["rgba(14,116,144,0.4)", "rgba(99,102,241,0.3)", "rgba(224,168,46,0.3)"];
const CARD_TOP= ["#04222b", "#0f1033", "#1a1100"];
const MEDAL   = ["01", "02", "03"];
const NUM_COL = ["#22d3ee", "#818cf8", "#e8b948"];

interface PodiumCardProps { entry: RankingEntry; onClick?: () => void }

export function PodiumCard({ entry, onClick }: PodiumCardProps) {
  const i = entry.rank - 1;
  const accent    = ACCENT[i]   ?? ACCENT[0];
  const border    = BORDER[i]   ?? BORDER[0];
  const cardTop   = CARD_TOP[i] ?? CARD_TOP[0];
  const numColor  = NUM_COL[i]  ?? NUM_COL[0];

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 220,
        border: `1px solid ${border}`,
        background: `linear-gradient(180deg, ${cardTop}, #0d1218)`,
        padding: "22px 22px 20px",
        position: "relative",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />

      {/* Posição + iniciais + score */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800, fontSize: 46, lineHeight: 0.8,
            color: accent,
            textShadow: `0 0 20px ${accent}66`,
          }}>
            {MEDAL[i] ?? String(entry.rank)}
          </div>
          <div style={{
            width: 50, height: 50, border: `1px solid ${border}`,
            background: "#0a0e13",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, color: "#c6d2e0",
          }}>
            {entry.avatar_initials}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 34, lineHeight: 1, color: numColor }}>
            {Math.round(entry.score_final)}
          </div>
          <div style={{ fontSize: 9, letterSpacing: "2px", color: "#4a5868", marginTop: 2 }}>SCORE</div>
        </div>
      </div>

      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: 0.5, color: "#f0f9ff", marginBottom: 4 }}>
        {entry.player_nickname}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#566476", marginBottom: 14 }}>
        {entry.total_matches} partidas · K/D {entry.kd_ratio.toFixed(2)}
      </div>

      {/* Radar */}
      <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 14px" }}>
        <RadarChart
          adr={entry.score_combat}
          kast={entry.kast_percent}
          rating={entry.hltv_rating * 50}
          openK={entry.score_duel}
          trade={entry.score_duel}
          util={entry.score_utility}
          color={accent}
          size={190}
        />
      </div>

      {/* Barras de categoria */}
      <CategoryBar label="COMBATE" value={entry.score_combat} color="#0e7490" textColor="#22d3ee" height={5} />
      <CategoryBar label="DUELOS"  value={entry.score_duel}   color="#6366f1" textColor="#818cf8" height={5} />
      <CategoryBar label="UTILITY" value={entry.score_utility} color="#e0a82e" textColor="#e8b948" height={5} />

      {/* Pills de stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#1a222c", border: "1px solid #1a222c", marginTop: 16 }}>
        {[
          { label: "ADR",    value: entry.adr.toFixed(1) },
          { label: "RATING", value: entry.hltv_rating.toFixed(2) },
          { label: "KAST%",  value: entry.kast_percent.toFixed(0) },
        ].map(s => (
          <div key={s.label} style={{ background: "#0c1015", padding: "9px 6px", textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "#dde6f0" }}>{s.value}</div>
            <div style={{ fontSize: 8.5, letterSpacing: "1px", color: "#475569", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
