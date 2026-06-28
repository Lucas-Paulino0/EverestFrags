/**
 * CompareModal — compara 2 players lado a lado
 *
 * Aberto pelo botão "COMPARAR" no Dashboard. Escolhe 2 jogadores do ranking
 * já carregado (allEntries — sem endpoint novo pra isso) e mostra cada métrica
 * lado a lado, destacando quem está melhor em cada uma (mesma lógica de
 * inversão do PlayerDetailModal: menor é melhor em DEATHS e TTK).
 *
 * Também busca o confronto direto (GET /api/players/{a}/vs/{b}) — quantas vezes
 * um matou/flashou o outro, somado em todas as partidas. Só existe pra partidas
 * cadastradas via upload de demo a partir desta feature (ver CLAUDE.md > Futuro).
 */

import { useEffect, useState } from "react";
import { playersVsApi, type RankingEntry, type HeadToHeadResponse } from "../api/client";

interface CompareModalProps {
  allEntries: RankingEntry[];
  initialA?: RankingEntry | null;
  onClose: () => void;
}

interface MetricDef {
  key: keyof RankingEntry;
  label: string;
  category: "COMBATE" | "DUELOS" | "UTILITY";
  inverted?: boolean;
  format: (v: number) => string;
}

const CATEGORY_COLOR: Record<string, string> = { COMBATE: "#0e7490", DUELOS: "#6366f1", UTILITY: "#e0a82e" };

const METRICS: MetricDef[] = [
  { key: "kd_ratio",          label: "K/D",            category: "COMBATE", format: v => v.toFixed(2) },
  { key: "kills",              label: "KILLS",          category: "COMBATE", format: v => String(v) },
  { key: "deaths",             label: "DEATHS",         category: "COMBATE", inverted: true, format: v => String(v) },
  { key: "assists",            label: "ASSISTS",        category: "COMBATE", format: v => String(v) },
  { key: "adr",                label: "ADR",            category: "COMBATE", format: v => v.toFixed(1) },
  { key: "hltv_rating",        label: "RATING",         category: "COMBATE", format: v => v.toFixed(2) },
  { key: "kast_percent",       label: "KAST%",          category: "COMBATE", format: v => `${v.toFixed(0)}%` },
  { key: "opening_kills",      label: "OPENING KILLS",  category: "DUELOS", format: v => String(v) },
  { key: "trade_kills",        label: "TRADE KILLS",    category: "DUELOS", format: v => String(v) },
  { key: "trade_denials",      label: "TRADE DENIALS",  category: "DUELOS", format: v => String(v) },
  { key: "time_to_kill_ms",    label: "TTK (MS)",       category: "DUELOS", inverted: true, format: v => v.toFixed(0) },
  { key: "flash_assists",      label: "FLASH ASSISTS",  category: "UTILITY", format: v => String(v) },
  { key: "grenade_damage",     label: "DANO GRANADA",   category: "UTILITY", format: v => String(v) },
  { key: "fire_damage",        label: "DANO MOLOTOV",   category: "UTILITY", format: v => String(v) },
];

function numOf(entry: RankingEntry, key: keyof RankingEntry): number {
  const v = entry[key];
  return typeof v === "number" ? v : 0;
}

export function CompareModal({ allEntries, initialA, onClose }: CompareModalProps) {
  const [idA, setIdA] = useState<number | "">(initialA?.player_id ?? "");
  const [idB, setIdB] = useState<number | "">("");
  const [h2h, setH2h] = useState<HeadToHeadResponse | null>(null);
  const [h2hLoading, setH2hLoading] = useState(false);

  const entryA = allEntries.find(e => e.player_id === idA) || null;
  const entryB = allEntries.find(e => e.player_id === idB) || null;

  useEffect(() => {
    if (!entryA || !entryB) {
      setH2h(null);
      return;
    }
    setH2hLoading(true);
    playersVsApi.headToHead(entryA.player_id, entryB.player_id)
      .then(setH2h)
      .catch(() => setH2h(null))
      .finally(() => setH2hLoading(false));
  }, [entryA?.player_id, entryB?.player_id]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.74)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24, overflowY: "auto" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "relative", width: 880, maxWidth: "100%", border: "1px solid #1e2a36", background: "linear-gradient(180deg,#0f161d,#0a0e13)", padding: "30px 32px 28px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#0e7490,#6366f1,#e0a82e)" }} />

        <button
          onClick={onClose}
          style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "#566476", fontSize: 19, cursor: "pointer", lineHeight: 1, padding: "2px 4px" }}
        >
          ✕
        </button>

        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: "1px", color: "#f0f9ff", marginBottom: 18 }}>
          COMPARAR JOGADORES
        </div>

        {/* Seletores */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <select
            value={idA}
            onChange={e => setIdA(e.target.value ? Number(e.target.value) : "")}
            style={{ flex: 1, background: "#0d1218", border: "1px solid #1e2a36", color: "#dde6f0", padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5 }}
          >
            <option value="">— escolha o jogador A —</option>
            {allEntries.map(e => (
              <option key={e.player_id} value={e.player_id} disabled={e.player_id === idB}>
                #{e.rank} {e.player_display_name || e.player_nickname}
              </option>
            ))}
          </select>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: "#5d6d80" }}>VS</span>
          <select
            value={idB}
            onChange={e => setIdB(e.target.value ? Number(e.target.value) : "")}
            style={{ flex: 1, background: "#0d1218", border: "1px solid #1e2a36", color: "#dde6f0", padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5 }}
          >
            <option value="">— escolha o jogador B —</option>
            {allEntries.map(e => (
              <option key={e.player_id} value={e.player_id} disabled={e.player_id === idA}>
                #{e.rank} {e.player_display_name || e.player_nickname}
              </option>
            ))}
          </select>
        </div>

        {!entryA || !entryB ? (
          <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#3a4757" }}>
            escolha 2 jogadores pra comparar
          </div>
        ) : (
          <>
            {/* Cabeçalho identidade dos 2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr", alignItems: "center", gap: 12, marginBottom: 20 }}>
              {[entryA, entryB].map((e, i) => (
                <div key={e.player_id} style={{ textAlign: i === 0 ? "left" : "right", display: "flex", flexDirection: i === 0 ? "row" : "row-reverse", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 50, height: 50, border: `2px solid ${i === 0 ? "#0e7490" : "#6366f1"}`, background: "#04222b",
                    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 19, color: i === 0 ? "#22d3ee" : "#818cf8", flexShrink: 0,
                  }}>
                    {e.avatar_url
                      ? <img src={e.avatar_url} alt={e.player_nickname} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : e.avatar_initials}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 19, color: "#f0f9ff", lineHeight: 1.1 }}>{e.player_display_name || e.player_nickname}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5d6d80", marginTop: 3 }}>#{e.rank} · {Math.round(e.score_final)} pts</div>
                  </div>
                </div>
              ))}
              <div style={{ textAlign: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: "#3a4757" }}>VS</div>
            </div>

            {/* Veredito rápido */}
            <div style={{ textAlign: "center", fontSize: 11.5, color: "#aebccd", marginBottom: 18, fontFamily: "'JetBrains Mono', monospace" }}>
              {entryA.score_final === entryB.score_final ? (
                "score final empatado"
              ) : (
                <>
                  <strong style={{ color: entryA.score_final > entryB.score_final ? "#22d3ee" : "#818cf8" }}>
                    {entryA.score_final > entryB.score_final
                      ? (entryA.player_display_name || entryA.player_nickname)
                      : (entryB.player_display_name || entryB.player_nickname)}
                  </strong>
                  {" "}está na frente por{" "}
                  <strong style={{ color: "#f0f9ff" }}>
                    {Math.abs(entryA.score_final - entryB.score_final).toFixed(1)} pts
                  </strong> no score final
                </>
              )}
            </div>

            {/* Tabela de métricas lado a lado */}
            {(["COMBATE", "DUELOS", "UTILITY"] as const).map(cat => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                  <span style={{ width: 9, height: 9, background: CATEGORY_COLOR[cat], flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "2px", color: "#aebccd" }}>{cat}</span>
                </div>
                <div style={{ border: "1px solid #1a222c" }}>
                  {METRICS.filter(m => m.category === cat).map((m, i, arr) => {
                    const va = numOf(entryA, m.key);
                    const vb = numOf(entryB, m.key);
                    const aWins = m.inverted ? va < vb : va > vb;
                    const bWins = m.inverted ? vb < va : vb > va;
                    return (
                      <div
                        key={m.key}
                        style={{
                          display: "grid", gridTemplateColumns: "1fr 150px 1fr", gap: 10, alignItems: "center",
                          padding: "8px 14px", background: i % 2 === 0 ? "#0c1015" : "#0a0d12",
                          borderBottom: i < arr.length - 1 ? "1px solid #161e27" : "none",
                        }}
                      >
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, textAlign: "left", color: aWins ? "#2dd4bf" : "#dde6f0" }}>
                          {m.format(va)}
                        </div>
                        <div style={{ fontSize: 10, letterSpacing: "0.5px", color: "#5d6d80", textAlign: "center" }}>{m.label}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, textAlign: "right", color: bWins ? "#818cf8" : "#dde6f0" }}>
                          {m.format(vb)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Confronto direto */}
            <div style={{ marginTop: 22, border: "1px solid #1a222c", background: "#0c1015", padding: "14px 16px" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "2px", color: "#aebccd", marginBottom: 10 }}>
                CONFRONTO DIRETO
              </div>
              {h2hLoading && (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#3a4757" }}>carregando...</div>
              )}
              {!h2hLoading && h2h && h2h.matches_together === 0 && (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5d6d80" }}>
                  ainda não jogaram juntos numa partida com esse dado disponível (só conta partidas cadastradas via upload de demo a partir desta feature)
                </div>
              )}
              {!h2hLoading && h2h && h2h.matches_together > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                  <div style={{ color: "#aebccd" }}>{h2h.matches_together} partida(s) juntos</div>
                  <div style={{ color: "#aebccd" }}>
                    <strong style={{ color: "#2dd4bf" }}>{h2h.player_nickname}</strong> matou <strong style={{ color: "#2dd4bf" }}>{h2h.opponent_nickname}</strong>{" "}
                    <strong style={{ color: "#f0f9ff" }}>{h2h.player_kills}x</strong>
                    {h2h.player_flash_assists > 0 && <> · flashou {h2h.player_flash_assists}x</>}
                  </div>
                  <div style={{ color: "#aebccd" }}>
                    <strong style={{ color: "#818cf8" }}>{h2h.opponent_nickname}</strong> matou <strong style={{ color: "#818cf8" }}>{h2h.player_nickname}</strong>{" "}
                    <strong style={{ color: "#f0f9ff" }}>{h2h.opponent_kills}x</strong>
                    {h2h.opponent_flash_assists > 0 && <> · flashou {h2h.opponent_flash_assists}x</>}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
