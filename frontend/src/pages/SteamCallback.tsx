/**
 * Página /auth/callback — processa o retorno do Login com Steam
 *
 * O backend redireciona para esta rota após autenticar com a Steam OpenID.
 * Query params esperados:
 *   token  → JWT gerado pelo backend
 *   player → JSON URL-encoded com id, nickname, role, avatar_initials
 *
 * Caso os params estejam ausentes (acesso direto ou erro), redireciona para /login.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { PlayerPublic } from "../api/client";

export function SteamCallback() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const playerRaw = params.get("player");

    if (!token || !playerRaw) {
      navigate("/login");
      return;
    }

    try {
      const player: PlayerPublic = JSON.parse(decodeURIComponent(playerRaw));
      loginWithToken(token, player);
      navigate("/", { replace: true });
    } catch {
      // JSON inválido ou token corrompido
      navigate("/login?error=steam_auth_failed", { replace: true });
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#070a0e",
        gap: 16,
      }}
    >
      {/* Spinner simples */}
      <div
        style={{
          width: 36,
          height: 36,
          border: "2px solid #1c1c1c",
          borderTopColor: "#0e7490",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: "#4a4a4a",
          letterSpacing: "2px",
        }}
      >
        autenticando com a steam...
      </span>
    </div>
  );
}
