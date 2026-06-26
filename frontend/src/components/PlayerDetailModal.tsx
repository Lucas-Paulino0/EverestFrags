/**
 * PlayerDetailModal — detalhe completo de um player do ranking
 *
 * Aberto ao clicar em qualquer card do ranking (pódio, grade ou lista compacta).
 * Reaproveita o mesmo padrão visual do cartão de identidade do Profile.tsx
 * (radar + barras de categoria + score final) e adiciona a grade de métricas
 * cruas agregadas que agora vêm no RankingEntry (GET /api/ranking já traz tudo).
 */

import { type RankingEntry } from "../api/client";
import { RadarChart } from "./RadarChart";
import { CategoryBar } from "./CategoryBar";

interface PlayerDetailModalProps {
  entry: RankingEntry;
  onClose: () => void;
}

interface StatGroup {
  label: string;
  color: string;
  stats: { label: string; value: string }[];
}

export function PlayerDetailModal({ entry, onClose }: PlayerDetailModalProps) {
  const groups: StatGroup[] = [
    {
      label: "COMBATE",
      color: "#0e7490",
      stats: [
        { label: "K/D", value: entry.kd_ratio.toFixed(2) },
        { label: "KILLS", value: String(entry.kills) },
        { label: "DEATHS", value: String(entry.deaths) },
        { label: "ASSISTS", value: String(entry.assists) },
        { label: "DANO TOTAL", value: String(entry.damage_total) },
        { label: "ADR", value: entry.adr.toFixed(1) },
        { label: "ADR +/-", value: entry.adr_difference.toFixed(1) },
        { label: "RATING", value: entry.hltv_rating.toFixed(2) },
        { label: "KAST%", value: `${entry.kast_percent.toFixed(0)}%` },
        { label: "ECO KILLS", value: String(entry.eco_kills) },
        { label: "DESVANTAGEM K", value: String(entry.disadvantage_kills) },
        { label: "VANTAGEM K", value: String(entry.advantage_kills) },
      ],
    },
    {
      label: "DUELOS",
      color: "#6366f1",
      stats: [
        { label: "OPENING KILLS", value: String(entry.opening_kills) },
        { label: "TRADE KILLS", value: String(entry.trade_kills) },
        { label: "TRADE DENIALS", value: String(entry.trade_denials) },
        { label: "TTK (MS)", value: entry.time_to_kill_ms.toFixed(0) },
      ],
    },
    {
      label: "UTILITY",
      color: "#e0a82e",
      stats: [
        { label: "FLASH ASSISTS", value: String(entry.flash_assists) },
        { label: "DANO GRANADA", value: String(entry.grenade_damage) },
        { label: "HE HIT", value: String(entry.he_enemies_hit) },
        { label: "FIRE HIT", value: String(entry.fire_enemies_hit) },
      ],
    },
  ];

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
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 26 }}>
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

        {/* Grade de métricas cruas, por categoria */}
        {groups.map(g => (
          <div key={g.label} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <span style={{ width: 9, height: 9, background: g.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "2px", color: "#aebccd" }}>
                {g.label}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "#1a222c", border: "1px solid #1a222c" }}>
              {g.stats.map(s => (
                <div key={s.label} style={{ background: "#0c1015", padding: "9px 8px", textAlign: "center" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "#dde6f0" }}>{s.value}</div>
                  <div style={{ fontSize: 8, letterSpacing: "0.5px", color: "#475569", marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
