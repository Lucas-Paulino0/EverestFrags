/**
 * Página /sort — sorteio de times equilibrados via Snake Draft
 *
 * Fluxo:
 *   1. Seleciona quais jogadores estão presentes
 *   2. Escolhe 2 ou 3 times
 *   3. Backend ordena por score_final e distribui em serpentina
 *   4. Resultado mostra times, score total/médio e diferença
 *
 * Paleta rebrand v2: #070a0e fundo, #0e7490 teal, #6366f1 indigo, #e0a82e ouro.
 */

import { useEffect, useState } from "react";
import { playersApi, sortApi, aiApi, type PlayerResponse, type SortTeamsResponse } from "../api/client";
import { Navbar } from "../components/Navbar";

const TEAM_COLORS  = ["#0e7490", "#6366f1", "#e0a82e"];
const TEAM_GLOWS   = ["rgba(14,116,144,.15)", "rgba(99,102,241,.15)", "rgba(224,168,46,.15)"];
const TEAM_BORDERS = ["rgba(14,116,144,.35)", "rgba(99,102,241,.35)", "rgba(224,168,46,.35)"];

export function Sort() {
  const [players, setPlayers]   = useState<PlayerResponse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [nTeams, setNTeams]     = useState(2);
  const [result, setResult]     = useState<SortTeamsResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [copied, setCopied]     = useState(false);

  const [predictionText, setPredictionText]       = useState<string | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionExpanded, setPredictionExpanded] = useState(false);
  const [predictionUnavailable, setPredictionUnavailable] = useState(false);

  useEffect(() => {
    playersApi.list().then(ps => {
      setPlayers(ps);
      setSelected(new Set(ps.map(p => p.id)));
    });
  }, []);

  function selectAll() { setPredictionText(null); setPredictionExpanded(false); setSelected(new Set(players.map(p => p.id))); }
  function clearAll()  { setPredictionText(null); setPredictionExpanded(false); setSelected(new Set()); }

  async function handleSort() {
    if (selected.size < nTeams * 2) {
      setError(`Selecione ao menos ${nTeams * 2} jogadores para ${nTeams} times`);
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await sortApi.sort(Array.from(selected), nTeams);
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? "Erro ao sortear");
    } finally {
      setLoading(false);
    }
  }

  function copyTeams() {
    if (!result) return;
    const lines = result.teams.map(t =>
      `TIME ${t.team_number} (score: ${t.total_score})\n` +
      t.players.map(p => `• ${p.player_nickname} (${p.score_final})`).join("\n")
    ).join("\n\n");
    const text = `EverestFrags — Sorteio\n${"─".repeat(24)}\n\n${lines}\n\nDiferença: ${result.diff_score} pts`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handlePrediction() {
    setPredictionExpanded(true);
    if (predictionText !== null) return;
    if (selected.size === 0) return;
    setPredictionLoading(true);
    try {
      const res = await aiApi.prediction(Array.from(selected));
      setPredictionUnavailable(res.unavailable);
      setPredictionText(res.text ?? null);
    } catch {
      setPredictionUnavailable(true);
    } finally {
      setPredictionLoading(false);
    }
  }

  // Reset prediction when selection changes
  function togglePlayer(id: number) {
    setPredictionText(null); setPredictionExpanded(false);
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const diffGood = result && result.diff_score < 15;

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#dde6f0", fontFamily: "'Inter', sans-serif", paddingBottom: 80 }}>

      {/* Scanlines */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, background: "repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 3px,rgba(0,0,0,.10) 4px,rgba(0,0,0,0) 5px)", opacity: 0.35 }} />

      {/* Header */}
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

        {/* Título */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "3px", color: "#5d6d80" }}>SORTEAR TIMES</span>
          <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#1e2a36,transparent)" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 32, alignItems: "start" }}>

          {/* ── Painel esquerdo — seleção ─────────────────────────────── */}
          <div>
            <div style={{ border: "1px solid #172029", background: "#0a0e13" }}>

              {/* Header da lista */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #172029", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "1.5px", color: "#4a5868" }}>
                  PRESENTES ({selected.size}/{players.length})
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={selectAll} style={{ background: "none", border: "1px solid #1e2a36", color: "#566476", fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, padding: "3px 8px", cursor: "pointer" }}>TODOS</button>
                  <button onClick={clearAll}  style={{ background: "none", border: "1px solid #1e2a36", color: "#566476", fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, padding: "3px 8px", cursor: "pointer" }}>NENHUM</button>
                </div>
              </div>

              {/* Lista de players */}
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {players.map(p => (
                  <label
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 16px", cursor: "pointer", userSelect: "none",
                      borderBottom: "1px solid #111820",
                      background: selected.has(p.id) ? "rgba(14,116,144,.05)" : "transparent",
                      transition: "background .1s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => togglePlayer(p.id)}
                      style={{ accentColor: "#0e7490", width: 13, height: 13, flexShrink: 0 }}
                    />
                    <div style={{
                      width: 26, height: 26, border: `1px solid ${selected.has(p.id) ? "#0e7490" : "#1e2a36"}`,
                      background: selected.has(p.id) ? "#04222b" : "#0d1218",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: selected.has(p.id) ? "#22d3ee" : "#566476",
                      flexShrink: 0, transition: "border-color .1s, color .1s",
                    }}>
                      {p.avatar_initials}
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: selected.has(p.id) ? "#e3ebf3" : "#3a4757", flex: 1, transition: "color .1s" }}>
                      {p.nickname}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nº de times */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setNTeams(n)}
                  style={{
                    flex: 1, padding: "10px",
                    background: nTeams === n ? "rgba(14,116,144,.15)" : "none",
                    border: `1px solid ${nTeams === n ? "#0e7490" : "#1e2a36"}`,
                    color: nTeams === n ? "#22d3ee" : "#566476",
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: 16, letterSpacing: "2px", cursor: "pointer",
                  }}
                >
                  {n} TIMES
                </button>
              ))}
            </div>

            {error && (
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#f87171", marginTop: 10, padding: "8px 12px", background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.2)" }}>
                // {error}
              </div>
            )}

            <button
              onClick={handleSort}
              disabled={loading}
              style={{
                width: "100%", marginTop: 12, padding: "13px",
                background: loading ? "#0a2733" : "#0e7490",
                border: `1px solid ${loading ? "#1a3a45" : "#0e7490"}`,
                color: loading ? "#2a5060" : "#fff",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: 18, letterSpacing: "3px", cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "SORTEANDO..." : "SORTEAR"}
            </button>

            {/* Previsão de forma — card colapsável */}
            {selected.size > 0 && (
              <div style={{ marginTop: 12, border: "1px solid #172029", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#6366f1,transparent)" }} />
                <button
                  onClick={handlePrediction}
                  style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "2px", color: "#818cf8" }}>
                    FORMA DO DIA
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#6366f1" }}>
                    {predictionExpanded ? "▲" : "▼"}
                  </span>
                </button>

                {predictionExpanded && (
                  <div style={{ borderTop: "1px solid #172029", padding: "12px 14px" }}>
                    {predictionLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 12, height: 12, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a5868" }}>analisando forma...</span>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      </div>
                    ) : predictionUnavailable ? (
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#f87171" }}>
                        // IA indisponível
                      </div>
                    ) : (
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#9cadb9", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                        {predictionText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Painel direito — resultado ────────────────────────────── */}
          <div>
            {result ? (
              <>
                {/* Barra de resultado */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#566476" }}>
                    diferença de score:{" "}
                    <span style={{ color: diffGood ? "#34d399" : "#f87171", fontWeight: 700 }}>
                      {result.diff_score} pts
                    </span>
                    {diffGood && <span style={{ color: "#34d399", marginLeft: 8 }}>// equilibrado</span>}
                  </div>
                  <button
                    onClick={copyTeams}
                    style={{
                      background: copied ? "rgba(52,211,153,.1)" : "none",
                      border: `1px solid ${copied ? "rgba(52,211,153,.4)" : "#1e2a36"}`,
                      color: copied ? "#34d399" : "#566476",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                      letterSpacing: "1px", padding: "6px 14px", cursor: "pointer",
                    }}
                  >
                    {copied ? "COPIADO!" : "COPIAR"}
                  </button>
                </div>

                {result.algorithm === "best_effort" && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
                    color: "#e0a82e", padding: "10px 14px", marginBottom: 14,
                    background: "rgba(224,168,46,.06)", border: "1px solid rgba(224,168,46,.2)",
                  }}>
                    ⚠ Nenhuma distribuição equilibrada foi encontrada. Os times foram formados com a menor diferença possível, mas podem estar desbalanceados.
                  </div>
                )}

                {/* Cards de times */}
                {result.teams.map((team, ti) => (
                  <div
                    key={team.team_number}
                    className={ti % 2 === 0 ? "ef-slide-left" : "ef-slide-right"}
                    style={{
                      border: `1px solid ${TEAM_BORDERS[ti]}`,
                      background: TEAM_GLOWS[ti],
                      marginBottom: 12, position: "relative",
                      animationDelay: `${ti * 120}ms`,
                    }}
                  >
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: TEAM_COLORS[ti] }} />

                    {/* Header do time */}
                    <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid rgba(255,255,255,.04)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: "3px", color: TEAM_COLORS[ti] }}>
                        TIME {team.team_number}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: "#e3ebf3" }}>
                          {team.total_score}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "1.5px", color: "#4a5868" }}>
                          TOTAL · média {team.avg_score}
                        </div>
                      </div>
                    </div>

                    {/* Jogadores */}
                    <div style={{ padding: "8px 0" }}>
                      {team.players.map((p, pi) => (
                        <div
                          key={p.player_id}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 18px", borderBottom: pi < team.players.length - 1 ? "1px solid rgba(255,255,255,.03)" : "none" }}
                        >
                          <div style={{ width: 26, height: 26, border: `1px solid ${TEAM_BORDERS[ti]}`, background: "#0d1218", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: TEAM_COLORS[ti], flexShrink: 0 }}>
                            {p.avatar_initials}
                          </div>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: "#e3ebf3", flex: 1 }}>
                            {p.player_nickname}
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#4a5868" }}>
                            {p.score_final}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, border: "1px dashed #172029", color: "#2a3a4a" }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, letterSpacing: "2px", marginBottom: 8 }}>AGUARDANDO SORTEIO</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>// selecione os jogadores presentes e clique em SORTEAR</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
