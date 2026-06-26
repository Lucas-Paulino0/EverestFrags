/**
 * Página /matches/:id — detalhes de uma partida
 *
 * Mostra apenas as stats básicas por jogador (K/D/A, +/-, ADR, RATING).
 * Admin pode deletar a partida direto desta tela, com confirmação.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { matchesApi, type MatchDetailResponse } from "../api/client";
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

  useEffect(() => {
    if (!id) return;
    matchesApi.get(Number(id))
      .then(setMatch)
      .catch(e => setError(e.message ?? "Partida não encontrada"))
      .finally(() => setLoading(false));
  }, [id]);

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
                return (
                  <tr key={p.player_id} style={{ borderBottom: "1px solid #111" }}>
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
      </div>
    </div>
  );
}
