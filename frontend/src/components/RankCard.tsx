/**
 * RankCard — card médio para posições 4–11 e compacto para 12+
 *
 * Paleta rebrand v2: teal/indigo/ouro, fundo #0e141b, bordas #172029
 */

import { type RankingEntry } from "../api/client";

interface RankCardProps {
  entry: RankingEntry;
  compact?: boolean;
  onClick?: () => void;
}

export function RankCard({ entry, compact = false, onClick }: RankCardProps) {
  const scoreW = `${Math.round(entry.score_final)}%`;
  const combatW = `${Math.round(entry.score_combat)}%`;
  const duelW   = `${Math.round(entry.score_duel)}%`;
  const utilW   = `${Math.round(entry.score_utility)}%`;

  if (compact) {
    return (
      <div
        onClick={onClick}
        style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "13px 18px", borderBottom: "1px solid #141b23",
          background: "#0a0e13",
          cursor: onClick ? "pointer" : undefined,
        }}
      >
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: "#3a4757", width: 26 }}>
          {entry.rank}
        </span>
        <div style={{
          width: 30, height: 30, border: "1px solid #1d2833", background: "#0d1218", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: "#9aabbd",
        }}>
          {entry.avatar_url
            ? <img src={entry.avatar_url} alt={entry.player_nickname} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : entry.avatar_initials}
        </div>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 19, color: "#c6d2e0", width: 180 }}>
          {entry.player_display_name || entry.player_nickname}
        </span>
        <div style={{ display: "flex", gap: 18, flex: 1 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5d6d80" }}>
            K/D <span style={{ color: "#aebccd" }}>{entry.kd_ratio.toFixed(2)}</span>
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5d6d80" }}>
            ADR <span style={{ color: "#aebccd" }}>{entry.adr.toFixed(1)}</span>
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5d6d80" }}>
            RTG <span style={{ color: "#aebccd" }}>{entry.hltv_rating.toFixed(2)}</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: 200 }}>
          <div style={{ flex: 1, height: 4, background: "#151d26" }}>
            <div style={{ height: "100%", width: scoreW, background: "linear-gradient(90deg,#0e7490,#6366f1)" }} />
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 18, color: "#c6d2e0", width: 30, textAlign: "right" }}>
            {Math.round(entry.score_final)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{ border: "1px solid #172029", background: "#0e141b", padding: 16, cursor: onClick ? "pointer" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, color: "#404e60", width: 26 }}>
          {entry.rank}
        </div>
        <div style={{
          width: 36, height: 36, border: "1px solid #1e2a36", background: "#0a0e13", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: "#aebccd",
        }}>
          {entry.avatar_url
            ? <img src={entry.avatar_url} alt={entry.player_nickname} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : entry.avatar_initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 19, color: "#e3ebf3",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {entry.player_display_name || entry.player_nickname}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569" }}>
            K/D {entry.kd_ratio.toFixed(2)}
          </div>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 24, color: "#f0f0f0" }}>
          {Math.round(entry.score_final)}
        </div>
      </div>

      {/* Score bar */}
      <div style={{ height: 4, background: "#151d26", marginBottom: 12 }}>
        <div style={{ height: "100%", background: "linear-gradient(90deg,#0e7490,#6366f1)", width: scoreW }} />
      </div>

      {/* Category bars mini */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { color: "#0e7490", width: combatW, score: Math.round(entry.score_combat) },
          { color: "#6366f1", width: duelW,   score: Math.round(entry.score_duel) },
          { color: "#e0a82e", width: utilW,   score: Math.round(entry.score_utility) },
        ].map((c, ci) => (
          <div key={ci} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 5, height: 5, background: c.color, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, height: 3, background: "#141b23" }}>
              <div style={{ height: "100%", background: c.color, width: c.width }} />
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "#6a7a8d", width: 18, textAlign: "right" }}>
              {c.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
