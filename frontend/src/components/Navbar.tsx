import { NavLink, Link } from "react-router-dom";
import {
  Home,
  Swords,
  Trophy,
  Users,
  MessageCircle,
  BarChart3,
  Gauge,
  CircleUser,
  Settings,
  PlusCircle,
  LogOut,
  LogIn,
  Crosshair,
  Medal,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { displayNameOf } from "../api/client";

function Logo() {
  return (
    <Link to="/" viewTransition className="ig-sidebar-logo" aria-label="EverestFrags">
      <span className="ig-sidebar-logo-mark">EF</span>
      <span className="ig-sidebar-logo-text">
        <strong>EVEREST</strong><b>FRAGS</b>
      </span>
    </Link>
  );
}

function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="ig-sidebar-icon">
      <Icon size={20} strokeWidth={2.2} />
    </span>
  );
}

export function Navbar() {
  const { player, isAdmin, logout } = useAuth();

  const mainItems = [
    { label: "Início", path: "/", icon: Home },
    { label: "Partidas", path: "/matches", icon: Swords },
    { label: "Ranking", path: "/ranking", icon: Trophy },
    { label: "Times", path: "/sort", icon: Users },
    { label: "Chat", path: "/chat", icon: MessageCircle },
  ];

  const secondaryItems = [
    { label: "Métricas", path: "/metrics", icon: BarChart3 },
    { label: "Médias", path: "/averages", icon: Gauge },
    { label: "H2H", path: "/h2h", icon: Crosshair },
    { label: "Vitórias", path: "/wins", icon: Medal },
    { label: "Fórmula", path: "/como-funciona", icon: BookOpen },
    ...(player ? [{ label: "Perfil", path: "/profile", icon: CircleUser }] : []),
    ...(isAdmin ? [
      { label: "Gestão", path: "/admin", icon: Settings },
      { label: "Nova partida", path: "/matches/new", icon: PlusCircle },
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
            viewTransition
            className={({ isActive }) => `ig-sidebar-item ${isActive ? "active" : ""}`}
          >
            <NavIcon icon={item.icon} />
            <span className="ig-sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <nav className="ig-sidebar-nav ig-sidebar-secondary">
        {secondaryItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            viewTransition
            className={({ isActive }) => `ig-sidebar-item ${isActive ? "active" : ""}`}
          >
            <NavIcon icon={item.icon} />
            <span className="ig-sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="ig-sidebar-account">
        {player ? (
          <>
            <Link to="/profile" viewTransition className="ig-account-link">
              <span className="ig-account-avatar">
                {player.avatar_url ? <img src={player.avatar_url} alt={player.nickname} /> : player.avatar_initials}
              </span>
              <span className="ig-account-text">
                <strong>{displayNameOf(player)}</strong>
                <small>{isAdmin ? "admin" : "player"}</small>
              </span>
            </Link>

            <button type="button" className="ig-logout-button" onClick={logout}>
              <NavIcon icon={LogOut} />
              <span className="ig-sidebar-label">Sair</span>
            </button>
          </>
        ) : (
          <Link to="/login" viewTransition className="ig-login-button">
            <NavIcon icon={LogIn} />
            <span className="ig-sidebar-label">Entrar</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
