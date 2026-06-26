/**
 * Navbar — barra de navegação com abas
 *
 * Abas: RANKING → / | MEU PERFIL → /profile | CHAT → /chat | GESTÃO → /admin (só admin)
 * A aba ativa é detectada via useLocation().
 */

import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();

  const tabs = [
    { label: "RANKING",    path: "/" },
    { label: "MÉTRICAS",   path: "/metrics" },
    { label: "SORTEIO",    path: "/sort" },
    { label: "PARTIDAS",   path: "/matches" },
    { label: "MEU PERFIL", path: "/profile" },
    { label: "CHAT",       path: "/chat" },
    ...(isAdmin ? [
      { label: "GESTÃO",  path: "/admin" },
    ] : []),
  ];

  function isActive(path: string) {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  }

  return (
    <nav style={{
      position: "relative",
      zIndex: 10,
      borderBottom: "1px solid #151d26",
      background: "#0a0e13",
    }}>
      <div style={{
        maxWidth: 1320,
        margin: "0 auto",
        padding: "0 48px",
        display: "flex",
        gap: 4,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${isActive(tab.path) ? "#0e7490" : "transparent"}`,
              cursor: "pointer",
              padding: "14px 6px",
              marginRight: 24,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "2.5px",
              color: isActive(tab.path) ? "#22d3ee" : "#566476",
              transition: "color .15s, border-color .15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
