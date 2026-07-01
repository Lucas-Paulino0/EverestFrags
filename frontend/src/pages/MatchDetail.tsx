/**
 * Página /matches/:id — detalhes de uma partida
 *
 * Mostra apenas as stats básicas por jogador (K/D/A, +/-, ADR, RATING).
 * Admin pode deletar a partida direto desta tela, com confirmação.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { matchesApi, type MatchDetailResponse, winsApi, aiApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Navbar } from "../components/Navbar";

export function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [match, setMatch] = useState<MatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [winTeam1, setWinTeam1] = useState<number[]>([]);
  const [winTeam2, setWinTeam2] = useState<number[]>([]);
  const [winWinner, setWinWinner] = useState<1 | 2>(1);
  const [savingResult, setSavingResult] = useState(false);
  const [showResultForm, setShowResultForm] = useState(false);

  const [narrativeText, setNarrativeText] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeExpanded, setNarrativeExpanded] = useState(false);
  const [narrativeUnavailable, setNarrativeUnavailable] = useState(false);

  useEffect(() => {
    if (!id) return;
    matchesApi.get(Number(id))
      .then(setMatch)
      .catch(e => setError(e.message ?? "Partida não encontrada"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleNarrative() {
    if (!match) return;
    setNarrativeExpanded(true);
    if (narrativeText !== null) return;
    setNarrativeLoading(true);
    try {
      const res = await aiApi.narrative(match.id);
      setNarrativeUnavailable(res.unavailable);
      setNarrativeText(res.text ?? null);
    } catch {
      setNarrativeUnavailable(true);
    } finally {
      setNarrativeLoading(false);
    }
  }

  async function handleSaveResult() {
    if (!match) return;
    if (winTeam1.length === 0 || winTeam2.length === 0) {
      setError("Distribua os jogadores nos dois times antes de salvar.");
      return;
    }
    setSavingResult(true);
    try {
      await winsApi.registerResult(match.id, { winning_team: winWinner, team_1_ids: winTeam1, team_2_ids: winTeam2 });
      setShowResultForm(false);
      setError("");
    } catch (e: any) {
      setError(e.message ?? "Erro ao salvar resultado");
    } finally {
      setSavingResult(false);
    }
  }

  async function handleDelete() {
    if (!match) return;
    if (!confirm("Deletar esta partida e todas as suas stats? Essa ação não pode ser desfeita.")) return;
    setDeleting(true);
    try {
      await matchesApi.delete(match.id);
      navigate("/matches");
    } catch (e: any) {
      setError(e.message ?? "Erro ao deletar");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#070a0e", color: "#e8e8e8", fontFamily: "'Inter', sans-serif" }}>
        <Navbar />
        <div style={{ textAlign: "center", padding: 60, fontFamily: "'JetBrains Mono', monospace", color: "#444" }}>carregando...</div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div style={{ minHeight: "100vh", background: "#070a0e", color: "#e8e8e8", fontFamily: "'Inter', sans-serif" }}>
        <Navbar />
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#ff5a33" }}>
            // {error || "partida não encontrada"}
          </div>
        </div>
      </div>
    );
  }

  const players = [...match.players].sort((a, b) => b.hltv_rating - a.hltv_rating);
  const mvpId = players[0]?.player_id;

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#e8e8e8", fontFamily: "'Inter', sans-serif", paddingBottom: 32 }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: "#f4f4f4" }}>
              {match.map_name ?? `PARTIDA #${match.id}`}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5a5a5a", marginTop: 4, display: "flex", gap: 14, alignItems: "center" }}>
              <span>{match.played_at}</span>
              {match.scope_url && (
                <a href={match.scope_url} target="_blank" rel="noreferrer" style={{ color: "#0e7490" }}>
                  scope.gg ↗
                </a>
              )}
            </div>
            {match.notes && (
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#777", marginTop: 8 }}>
                // {match.notes}
              </div>
            )}
          </div>

          {isAdmin && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {error && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#ff5a33" }}>
                  // {error}
                </span>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ background: "transparent", border: "1px solid #7f1d1d", color: "#ff5a33", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 1.5, padding: "10px 18px", cursor: deleting ? "wait" : "pointer" }}
              >
                {deleting ? "DELETANDO..." : "DELETAR PARTIDA"}
              </button>
            </div>
          )}
        </div>

        {/* Tabela de stats básicas */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ background: "#101010", borderBottom: "1px solid #1c1c1c" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 9, letterSpacing: "2px", color: "#5a5a5a", fontWeight: 400 }}>PLAYER</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 9, letterSpacing: "1.5px", color: "#5a5a5a", fontWeight: 400 }}>K</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 9, letterSpacing: "1.5px", color: "#5a5a5a", fontWeight: 400 }}>D</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 9, letterSpacing: "1.5px", color: "#5a5a5a", fontWeight: 400 }}>A</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 9, letterSpacing: "1.5px", color: "#5a5a5a", fontWeight: 400 }}>+/-</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 9, letterSpacing: "1.5px", color: "#5a5a5a", fontWeight: 400 }}>ADR</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 9, letterSpacing: "1.5px", color: "#5a5a5a", fontWeight: 400 }}>RATING</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => {
                const diff = p.kills - p.deaths;
                const isMvp = p.player_id === mvpId;
                return (
                  <tr key={p.player_id} className={isMvp ? "ef-pulse-glow" : ""} style={{ borderBottom: "1px solid #111", background: isMvp ? "rgba(14,116,144,0.06)" : "transparent" }}>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 26, height: 26, background: "#161616", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#888", flexShrink: 0 }}>
                          {p.player_avatar_initials}
                        </div>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 600, color: "#d0d0d0" }}>
                          {p.player_nickname}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#e8e8e8" }}>{p.kills}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#e8e8e8" }}>{p.deaths}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#e8e8e8" }}>{p.assists}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: diff > 0 ? "#4ade80" : diff < 0 ? "#ff5a33" : "#888" }}>
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#aaa" }}>{p.adr.toFixed(1)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#0e7490" }}>{p.hltv_rating.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Narrativa IA */}
        <div style={{ marginTop: 28, border: "1px solid #1b2530", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#6366f1,transparent)" }} />
          <button
            onClick={handleNarrative}
            style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "2px", color: "#818cf8" }}>
                NARRATIVA IA
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#3a4d5e", marginTop: 2 }}>
                resumo comentarista desta partida
              </div>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "#6366f1" }}>
              {narrativeExpanded ? "▲" : "▼"}
            </span>
          </button>

          {narrativeExpanded && (
            <div style={{ borderTop: "1px solid #1b2530", padding: "16px 20px" }}>
              {narrativeLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 14, height: 14, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#4a5868" }}>gerando narrativa...</span>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : narrativeUnavailable ? (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#f87171" }}>
                  // IA indisponível — configure GROQ_API_KEY no backend
                </div>
              ) : (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#b8cad8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {narrativeText}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Registro de resultado — admin only */}
        {isAdmin && (
          <div style={{ marginTop: 32, borderTop: "1px solid #1b2530", paddingTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "2px", color: "#5d6d80" }}>
                RESULTADO DA PARTIDA
              </span>
              <button
                onClick={() => setShowResultForm(v => !v)}
                style={{ background: "transparent", border: "1px solid #1b2530", color: "#0e7490", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 1.5, padding: "6px 12px", cursor: "pointer" }}
              >
                {showResultForm ? "CANCELAR" : "REGISTRAR RESULTADO"}
              </button>
            </div>

            {showResultForm && (
              <div style={{ background: "#0d1218", border: "1px solid #1b2530", padding: 20 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5d6d80", marginBottom: 16 }}>
                  // distribua os jogadores nos dois times e selecione o vencedor
                </div>

                {/* Seleção simplificada: cada jogador tem um select de time */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {[1, 2].map(t => (
                    <div key={t}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, color: t === 1 ? "#0e7490" : "#6366f1", marginBottom: 10 }}>
                        TIME {t}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {players.map(p => {
                          const inThis = (t === 1 ? winTeam1 : winTeam2).includes(p.player_id);
                          const inOther = (t === 1 ? winTeam2 : winTeam1).includes(p.player_id);
                          return (
                            <label key={p.player_id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: inOther ? 0.3 : 1 }}>
                              <input
                                type="checkbox"
                                checked={inThis}
                                disabled={inOther}
                                onChange={e => {
                                  const setter = t === 1 ? setWinTeam1 : setWinTeam2;
                                  setter(prev => e.target.checked ? [...prev, p.player_id] : prev.filter(x => x !== p.player_id));
                                }}
                                style={{ accentColor: t === 1 ? "#0e7490" : "#6366f1" }}
                              />
                              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14 }}>{p.player_nickname}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 1, color: "#5d6d80" }}>VENCEDOR:</span>
                  {[1, 2].map(t => (
                    <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input type="radio" name="winner" value={t} checked={winWinner === t} onChange={() => setWinWinner(t as 1 | 2)} style={{ accentColor: t === 1 ? "#0e7490" : "#6366f1" }} />
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: t === 1 ? "#0e7490" : "#6366f1" }}>Time {t}</span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleSaveResult}
                  disabled={savingResult}
                  style={{ background: "#0e7490", border: "none", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2, padding: "10px 20px", cursor: savingResult ? "wait" : "pointer" }}
                >
                  {savingResult ? "SALVANDO..." : "SALVAR RESULTADO"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
