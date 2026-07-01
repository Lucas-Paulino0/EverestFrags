/**
 * Página /auth/callback — processa o retorno do Login com Steam
 *
 * O backend redireciona para esta rota com ?code=UUID (código opaco de 30s).
 * O código é trocado pelo JWT via POST /api/auth/steam/exchange — o token
 * nunca aparece na URL, evitando exposição em logs de servidor.
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
    const code = params.get("code");

    if (!code) {
      navigate("/login");
      return;
    }

    const apiBase = import.meta.env.VITE_API_URL || "";
    fetch(`${apiBase}/api/auth/steam/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then(res => {
        if (!res.ok) throw new Error("exchange failed");
        return res.json();
      })
      .then(({ access_token, player }: { access_token: string; player: PlayerPublic }) => {
        loginWithToken(access_token, player);
        navigate("/", { replace: true });
      })
      .catch(() => {
        navigate("/login?error=steam_auth_failed", { replace: true });
      });
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
