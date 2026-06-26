/**
 * Página /matches — histórico de partidas
 *
 * Lista paginada de partidas com mapa, data, URL scope.gg e número de players.
 * Botão "Adicionar Partida" (só admin) navega para /matches/new.
 * Admin pode deletar partidas com confirmação.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { matchesApi, type MatchResponse } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Navbar } from "../components/Navbar";

export function Matches() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  async function load(p = 1) {
    setLoading(true);
    try {
      const res = await matchesApi.list(p, 20);
      setMatches(res.items);
      setTotal(res.total);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number) {
    if (!confirm("Deletar esta partida e todas as suas stats?")) return;
    try {
      await matchesApi.delete(id);
      load(page);
    } catch (e: any) {
      alert(e.message);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#e8e8e8", fontFamily: "'Inter', sans-serif", paddingBottom: 32 }}>

      <Navbar />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: "#f4f4f4" }}>
              HISTÓRICO DE PARTIDAS
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5a5a5a", marginTop: 4 }}>
              {total} partidas registradas
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate("/matches/new")}
              style={{ background: "#0e7490", border: "none", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 1.5, padding: "12px 22px", cursor: "pointer" }}
            >
              + ADICIONAR PARTIDA
            </button>
          )}
        </div>

        {/* Tabela */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, fontFamily: "'JetBrains Mono', monospace", color: "#444" }}>carregando...</div>
        ) : (
          <>
            {/* Cabeçalho */}
            <div style={{ display: "grid", gridTemplateColumns: "60px 100px 1fr 80px 80px", gap: 12, padding: "8px 16px", background: "#101010", borderBottom: "1px solid #1c1c1c", fontSize: 9, letterSpacing: "2px", color: "#5a5a5a" }}>
              <span>#</span>
              <span>DATA</span>
              <span>MAPA</span>
              <span style={{ textAlign: "center" }}>PLAYERS</span>
              {isAdmin && <span />}
            </div>

            {matches.map(m => (
              <div
                key={m.id}
                style={{ display: "grid", gridTemplateColumns: "60px 100px 1fr 80px 80px", gap: 12, padding: "12px 16px", borderBottom: "1px solid #141414", alignItems: "center", cursor: "pointer" }}
                onClick={() => navigate(`/matches/${m.id}`)}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#4a4a4a" }}>
                  #{m.id}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#aaa" }}>
                  {m.played_at}
                </span>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 600, color: "#d0d0d0" }}>
                    {m.map_name ?? "—"}
                  </div>
                  {m.scope_url && (
                    <a href={m.scope_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: "#0e7490", fontFamily: "'JetBrains Mono', monospace" }}>
                      scope.gg ↗
                    </a>
                  )}
                </div>
                <span style={{ textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#888" }}>
                  {m.player_count}
                </span>
                {isAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(m.id); }}
                    style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#555", fontSize: 10, padding: "4px 8px", cursor: "pointer" }}
                  >
                    DEL
                  </button>
                )}
              </div>
            ))}

            {/* Paginação */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => load(p)}
                    style={{
                      background: p === page ? "#0e7490" : "transparent",
                      border: "1px solid #2a2a2a",
                      color: p === page ? "#fff" : "#666",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12, padding: "6px 12px", cursor: "pointer",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
