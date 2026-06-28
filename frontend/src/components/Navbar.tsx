import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { displayNameOf } from "../api/client";

function Logo() {
  return (
    <Link to="/" className="ig-sidebar-logo" aria-label="EverestFrags">
      <span className="ig-sidebar-logo-mark">EF</span>
      <span className="ig-sidebar-logo-text">
        <strong>EVEREST</strong><b>FRAGS</b>
      </span>
    </Link>
  );
}

export function Navbar() {
  const { player, isAdmin, logout } = useAuth();

  const mainItems = [
    { label: "Início", path: "/", icon: "⌂" },
    { label: "Partidas", path: "/matches", icon: "▶" },
    { label: "Ranking", path: "/ranking", icon: "★" },
    { label: "Times", path: "/sort", icon: "⚡" },
    { label: "Chat", path: "/chat", icon: "●" },
  ];

  const secondaryItems = [
    { label: "Métricas", path: "/metrics", icon: "▣" },
    { label: "Médias", path: "/averages", icon: "◇" },
    ...(player ? [{ label: "Perfil", path: "/profile", icon: "◉" }] : []),
    ...(isAdmin ? [
      { label: "Gestão", path: "/admin", icon: "✎" },
      { label: "Nova partida", path: "/matches/new", icon: "+" },
    ] : []),
  ];

  return (
    <aside className="ig-sidebar" aria-label="Navegação principal">
      <Logo />

      <nav className="ig-sidebar-nav">
        {mainItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) => `ig-sidebar-item ${isActive ? "active" : ""}`}
          >
            <span className="ig-sidebar-icon">{item.icon}</span>
            <span className="ig-sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <nav className="ig-sidebar-nav ig-sidebar-secondary">
        {secondaryItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `ig-sidebar-item ${isActive ? "active" : ""}`}
          >
            <span className="ig-sidebar-icon">{item.icon}</span>
            <span className="ig-sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="ig-sidebar-account">
        {player ? (
          <>
            <Link to="/profile" className="ig-account-link">
              <span className="ig-account-avatar">
                {player.avatar_url ? <img src={player.avatar_url} alt={player.nickname} /> : player.avatar_initials}
              </span>
              <span className="ig-account-text">
                <strong>{displayNameOf(player)}</strong>
                <small>{isAdmin ? "admin" : "player"}</small>
              </span>
            </Link>

            <button type="button" className="ig-logout-button" onClick={logout}>
              <span className="ig-sidebar-icon">↩</span>
              <span className="ig-sidebar-label">Sair</span>
            </button>
          </>
        ) : (
          <Link to="/login" className="ig-login-button">
            <span className="ig-sidebar-icon">↪</span>
            <span className="ig-sidebar-label">Entrar</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
