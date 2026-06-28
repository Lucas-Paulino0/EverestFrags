/**
 * Ranking — página /ranking
 *
 * Tela de ranking "clássica": pódio top-3 + grade de classificação (4-11) +
 * lista compacta (12+). Era a Home original antes do redesign social do
 * Dashboard (commit 9bfb2df) — trazida de volta como página dedicada.
 */

import { useEffect, useState } from "react";
import { rankingApi, playersApi, type RankingEntry } from "../api/client";
import { PodiumCard } from "../components/PodiumCard";
import { RankCard } from "../components/RankCard";
import { PlayerDetailModal } from "../components/PlayerDetailModal";
import { CompareModal } from "../components/CompareModal";
import { Navbar } from "../components/Navbar";

export function Ranking() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<RankingEntry | null>(null);
  const [comparing, setComparing] = useState(false);

  async function loadData() {
    try {
      const [r, players] = await Promise.all([rankingApi.get(), playersApi.list()]);
      setRanking(r);
      setTotalPlayers(players.length);
    } catch (e) {
      console.error("Erro ao carregar ranking:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const podium  = ranking.slice(0, 3);
  const midGrid = ranking.slice(3, 11);
  const tail    = ranking.slice(11);

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#dde6f0", fontFamily: "'Inter', sans-serif", paddingBottom: 64 }}>

      {/* Scanlines overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, background: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.10) 4px, rgba(0,0,0,0) 5px)", opacity: 0.35 }} />
      {/* Glow radial teal no topo */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 51, background: "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(14,116,144,0.08), transparent 62%)" }} />

      <Navbar />

      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "32px 48px 0", position: "relative", zIndex: 10 }}>

        {loading && (
          <div style={{ textAlign: "center", padding: 80, fontFamily: "'JetBrains Mono', monospace", color: "#3a4757" }}>
            carregando ranking...
          </div>
        )}

        {!loading && ranking.length === 0 && (
          <div style={{ textAlign: "center", padding: 80, fontFamily: "'JetBrains Mono', monospace", color: "#3a4757" }}>
            nenhum jogador com partidas registradas ainda
          </div>
        )}

        {!loading && ranking.length > 0 && (
          <>
            {/* Seção pódio */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "0 0 8px" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "3px", color: "#5d6d80" }}>PÓDIO</span>
              <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#1e2a36,transparent)" }} />
              <button
                onClick={() => setComparing(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  border: "1px solid #1e2a36", background: "#0d1218", cursor: "pointer",
                  padding: "8px 14px",
                }}
              >
                <span style={{ width: 6, height: 6, background: "#6366f1", flexShrink: 0 }} />
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12.5, letterSpacing: "1.5px", color: "#c6d2e0" }}>
                  COMPARAR
                </span>
              </button>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#2e3e50", letterSpacing: "0.5px", marginBottom: 18 }}>
              // score relativo ao grupo — atualiza a cada nova partida registrada
            </div>
            {/* 3 colunas com o centro levemente maior (1º lugar destacado) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.08fr 1fr", gap: 18, alignItems: "end" }}>
              {podium.map(e => <PodiumCard key={e.player_id} entry={e} onClick={() => setSelectedEntry(e)} />)}
            </div>

            {/* Seção classificação (4–11) */}
            {midGrid.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "40px 0 22px" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "3px", color: "#5d6d80" }}>CLASSIFICAÇÃO</span>
                  <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#1e2a36,transparent)" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                  {midGrid.map(e => <RankCard key={e.player_id} entry={e} onClick={() => setSelectedEntry(e)} />)}
                </div>
              </>
            )}

            {/* Lista compacta (12+) */}
            {tail.length > 0 && (
              <div style={{ border: "1px solid #172029", background: "#0a0e13", marginTop: 14 }}>
                {tail.map(e => <RankCard key={e.player_id} entry={e} compact onClick={() => setSelectedEntry(e)} />)}
              </div>
            )}

            {/* Legenda de categorias */}
            <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginTop: 34, paddingTop: 20, borderTop: "1px solid #151d26" }}>
              <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
                {[
                  { color: "#0e7490", label: "Combate 30%", detail: "kills, dano, ADR, rating, KAST" },
                  { color: "#6366f1", label: "Duelos 36%",  detail: "opening, trades, TTK" },
                  { color: "#e0a82e", label: "Utility 34%", detail: "flashes, HE, incendiária" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 10, height: 10, background: l.color }} />
                    <span style={{ fontSize: 11, color: "#5d6d80" }}>
                      <b style={{ color: "#aebccd" }}>{l.label}</b> — {l.detail}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "1.5px", color: "#334155" }}>
                SCORE NORMALIZADO MIN-MAX · GRUPO DE {totalPlayers} · CLIQUE EM UM PLAYER PRO DETALHE
              </div>
            </footer>
          </>
        )}
      </main>

      {selectedEntry && (
        <PlayerDetailModal entry={selectedEntry} allEntries={ranking} onClose={() => setSelectedEntry(null)} />
      )}

      {comparing && (
        <CompareModal allEntries={ranking} onClose={() => setComparing(false)} />
      )}
    </div>
  );
}
