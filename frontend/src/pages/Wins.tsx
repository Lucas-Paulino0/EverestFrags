import { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { BASE_URL } from "../api/client";

interface WinsEntry {
  rank: number;
  player_id: number;
  nickname: string;
  display_name: string | null;
  avatar_initials: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  win_rate: number;
  win_streak: number;
  max_win_streak: number;
  points: number;
}

const s: Record<string, React.CSSProperties> = {
  page:    { minHeight: "100vh", background: "#070a0e", color: "#f0f9ff" },
  inner:   { maxWidth: 860, margin: "0 auto", padding: "48px 24px 80px" },
  header:  { display: "flex", alignItems: "center", gap: 14, marginBottom: 28 },
  title:   { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: "4px", color: "#f0f9ff" },
  table:   { width: "100%", borderCollapse: "collapse" as const, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 },
  th:      { padding: "10px 12px", textAlign: "left" as const, color: "#5d6d80", letterSpacing: "1.5px", fontSize: 10.5, fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "1px solid #1b2530" },
  td:      { padding: "11px 12px", borderBottom: "1px solid #0f1a23" },
  empty:   { textAlign: "center" as const, padding: 48, color: "#5d6d80", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 },
};

function Avatar({ entry }: { entry: WinsEntry }) {
  if (entry.avatar_url) {
    return <img src={entry.avatar_url} alt={entry.nickname} style={{ width: 32, height: 32, borderRadius: 2, objectFit: "cover" }} />;
  }
  return (
    <span style={{ width: 32, height: 32, background: "#0e7490", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0 }}>
      {entry.avatar_initials}
    </span>
  );
}

export function Wins() {
  const [entries, setEntries] = useState<WinsEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/api/wins/ranking`)
      .then(r => r.json())
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const name = (e: WinsEntry) => e.display_name || e.nickname;

  return (
    <div style={s.page}>
      <Navbar />
      <main className="ig-main">
        <div style={s.inner}>
          <div style={s.header}>
            <span style={{ width: 3, height: 24, background: "#0e7490", flexShrink: 0 }} />
            <span style={s.title}>PLACAR DE VITÓRIAS</span>
            <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#1e2a36,transparent)" }} />
          </div>

          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#2e3e50", letterSpacing: "0.5px", marginBottom: 18 }}>
            // placar paralelo ao ranking — baseado em resultado real das partidas
          </div>

          {loading ? (
            <div style={s.empty}>carregando...</div>
          ) : entries.length === 0 ? (
            <div style={s.empty}>
              Nenhum resultado registrado ainda.<br />
              <span style={{ color: "#3d4e5e", fontSize: 11 }}>
                Após uma partida, o admin pode registrar qual time ganhou em /matches/:id
              </span>
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>PLAYER</th>
                  <th style={{ ...s.th, textAlign: "center" as const }}>V</th>
                  <th style={{ ...s.th, textAlign: "center" as const }}>D</th>
                  <th style={{ ...s.th, textAlign: "center" as const }}>WR%</th>
                  <th style={{ ...s.th, textAlign: "center" as const }}>STREAK</th>
                  <th style={{ ...s.th, textAlign: "center" as const }}>RECORD</th>
                  <th style={{ ...s.th, textAlign: "center" as const }}>PTS</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.player_id} style={{ background: i % 2 === 0 ? "transparent" : "#0a0f15" }}>
                    <td style={{ ...s.td, color: "#5d6d80", width: 36 }}>
                      {e.rank <= 3 ? (
                        <span style={{ color: e.rank === 1 ? "#0e7490" : e.rank === 2 ? "#6366f1" : "#e0a82e", fontWeight: 700 }}>
                          #{e.rank}
                        </span>
                      ) : `#${e.rank}`}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar entry={e} />
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15 }}>
                          {name(e)}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: "center" as const, color: "#22c55e", fontWeight: 700 }}>{e.wins}</td>
                    <td style={{ ...s.td, textAlign: "center" as const, color: "#ef4444" }}>{e.losses}</td>
                    <td style={{ ...s.td, textAlign: "center" as const }}>
                      <span style={{ color: e.win_rate >= 50 ? "#0e7490" : "#5d6d80" }}>{e.win_rate}%</span>
                    </td>
                    <td style={{ ...s.td, textAlign: "center" as const }}>
                      {e.win_streak > 0 ? (
                        <span style={{ color: "#e0a82e" }}>🔥 {e.win_streak}</span>
                      ) : <span style={{ color: "#3d4e5e" }}>—</span>}
                    </td>
                    <td style={{ ...s.td, textAlign: "center" as const, color: "#5d6d80" }}>{e.max_win_streak}</td>
                    <td style={{ ...s.td, textAlign: "center" as const }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: "#0e7490" }}>
                        {e.points}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
