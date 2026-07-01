/**
 * Médias da EverestFrags — página /averages
 *
 * Mostra a média de cada métrica (kills, deaths, ADR...) consolidada pro
 * grupo TODO — um número só, não por jogador. Carrega GET /api/stats/group-averages
 * (média entre todas as linhas de player_match_stats, não entre os totais por jogador
 * — ver ranking_service.get_group_averages).
 */

import { useEffect, useState } from "react";
import { statsApi, type GroupAveragesResponse } from "../api/client";
import { Navbar } from "../components/Navbar";

type Category = "combat" | "duel" | "utility";

interface MetricDef {
  key: keyof GroupAveragesResponse;
  label: string;
  category: Category;
  format: (v: number) => string;
}

const CATEGORY_COLOR: Record<Category, string> = { combat: "#0e7490", duel: "#6366f1", utility: "#e0a82e" };
const CATEGORY_BRIGHT: Record<Category, string> = { combat: "#22d3ee", duel: "#818cf8", utility: "#e8b948" };
const CATEGORY_LABEL: Record<Category, string> = { combat: "COMBATE", duel: "DUELOS", utility: "UTILITY" };

const METRICS: MetricDef[] = [
  { key: "kills",             label: "KILLS",          category: "combat", format: v => v.toFixed(1) },
  { key: "deaths",            label: "DEATHS",         category: "combat", format: v => v.toFixed(1) },
  { key: "assists",           label: "ASSISTS",        category: "combat", format: v => v.toFixed(1) },
  { key: "damage_total",      label: "DANO TOTAL",     category: "combat", format: v => v.toFixed(0) },
  { key: "adr",               label: "ADR",            category: "combat", format: v => v.toFixed(1) },
  { key: "hltv_rating",       label: "RATING",         category: "combat", format: v => v.toFixed(2) },
  { key: "kast_percent",      label: "KAST%",          category: "combat", format: v => `${v.toFixed(0)}%` },
  { key: "disadvantage_kills", label: "DESVANTAGEM K", category: "combat", format: v => v.toFixed(1) },
  { key: "advantage_kills",   label: "VANTAGEM K",     category: "combat", format: v => v.toFixed(1) },
  { key: "eco_kills",         label: "ECO KILLS",      category: "combat", format: v => v.toFixed(1) },
  { key: "opening_kills",     label: "OPENING KILLS",  category: "duel", format: v => v.toFixed(1) },
  { key: "opening_deaths",    label: "OPENING DEATHS", category: "duel", format: v => v.toFixed(1) },
  { key: "mvps",              label: "MVPs",           category: "duel", format: v => v.toFixed(1) },
  { key: "trade_kills",       label: "TRADE KILLS",    category: "duel", format: v => v.toFixed(1) },
  { key: "trade_denials",     label: "TRADE DENIALS",  category: "duel", format: v => v.toFixed(1) },
  { key: "time_to_kill_ms",   label: "TTK (MS)",       category: "duel", format: v => v.toFixed(0) },
  { key: "flash_assists",     label: "FLASH ASSISTS",  category: "utility", format: v => v.toFixed(1) },
  { key: "grenade_damage",    label: "DANO GRANADA",   category: "utility", format: v => v.toFixed(1) },
  { key: "he_enemies_hit",    label: "HE HIT",         category: "utility", format: v => v.toFixed(1) },
  { key: "fire_enemies_hit",  label: "FIRE HIT",       category: "utility", format: v => v.toFixed(1) },
  { key: "fire_damage",       label: "DANO MOLOTOV",   category: "utility", format: v => v.toFixed(1) },
];

export function Averages() {
  const [data, setData] = useState<GroupAveragesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.groupAverages().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#dde6f0", fontFamily: "'Inter', sans-serif", paddingBottom: 64 }}>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, background: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.10) 4px, rgba(0,0,0,0) 5px)", opacity: 0.35 }} />

      <header style={{ borderBottom: "1px solid #1b2530", background: "linear-gradient(180deg,#0d1218,#070a0e)", padding: "22px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 38, height: 38, border: "2px solid #0e7490", display: "flex", alignItems: "center", justifyContent: "center", background: "#04222b" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M2 21 L9 7 L12.5 13 L15.5 6 L22 21 Z" fill="#0e7490" />
              <path d="M15.5 6 L13.2 10 L17.8 10 Z" fill="#cfe6ee" />
              <path d="M9 7 L7.3 10 L10.7 10 Z" fill="#cfe6ee" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: 1 }}>
            <span style={{ color: "#f0f9ff" }}>EVEREST</span>
            <span style={{ color: "#0e7490" }}>FRAGS</span>
          </span>
        </div>
      </header>

      <Navbar />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px 0", position: "relative", zIndex: 10 }}>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "3px", color: "#5d6d80" }}>MÉDIAS DA EVERESTFRAGS</span>
          <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#1e2a36,transparent)" }} />
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#3a4757", marginBottom: 26 }}>
          // média por participação numa partida (1 jogador em 1 partida = 1 amostra) — não a média dos totais por jogador
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 80, fontFamily: "'JetBrains Mono', monospace", color: "#3a4757" }}>
            carregando...
          </div>
        )}

        {!loading && (!data || data.total_player_entries === 0) && (
          <div style={{ textAlign: "center", padding: 80, fontFamily: "'JetBrains Mono', monospace", color: "#3a4757" }}>
            nenhuma partida registrada ainda
          </div>
        )}

        {!loading && data && data.total_player_entries > 0 && (
          <>
            <div style={{ display: "flex", gap: 24, marginBottom: 30, fontFamily: "'JetBrains Mono', monospace" }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#f0f9ff" }}>{data.total_matches}</div>
                <div style={{ fontSize: 10.5, letterSpacing: "1.5px", color: "#5d6d80" }}>PARTIDAS CONSIDERADAS</div>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#f0f9ff" }}>{data.total_player_entries}</div>
                <div style={{ fontSize: 10.5, letterSpacing: "1.5px", color: "#5d6d80" }}>PARTICIPAÇÕES (JOGADOR × PARTIDA)</div>
              </div>
            </div>

            {(["combat", "duel", "utility"] as Category[]).map(cat => (
              <div key={cat} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, background: CATEGORY_COLOR[cat] }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 700, letterSpacing: "2px", color: CATEGORY_BRIGHT[cat] }}>
                    {CATEGORY_LABEL[cat]}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {METRICS.filter(m => m.category === cat).map(m => (
                    <div
                      key={m.key}
                      style={{
                        flex: "1 1 150px", minWidth: 140,
                        border: `1px solid #1b2530`, borderLeft: `3px solid ${CATEGORY_COLOR[cat]}`,
                        background: "#0d1218", padding: "12px 14px",
                      }}
                    >
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "1.2px", color: "#5d6d80", marginBottom: 6 }}>
                        {m.label}
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24, color: "#f0f9ff" }}>
                        {m.format(data[m.key] as number)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
