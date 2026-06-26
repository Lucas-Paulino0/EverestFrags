/**
 * AuthContext — contexto global de autenticação
 *
 * Armazena o player logado e o token no localStorage.
 * Injeta o token em todas as chamadas via api/client.ts (que lê localStorage diretamente).
 *
 * Hook useAuth() para consumir o contexto em qualquer componente.
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, type PlayerPublic } from "../api/client";

interface AuthContextType {
  player: PlayerPublic | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (nickname: string, password: string) => Promise<void>;
  // Usado pelo SteamCallback após receber token e player via query string
  loginWithToken: (token: string, playerData: PlayerPublic) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<PlayerPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ao montar, valida o token com o servidor antes de considerar o usuário autenticado.
  // Usa fetch direto (não authApi.me()) para evitar o redirect automático do client.ts
  // em caso de 401 — quem redireciona é o ProtectedRoute, não o contexto.
  useEffect(() => {
    const token = localStorage.getItem("ef_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.ok) return res.json() as Promise<PlayerPublic>;
        return Promise.reject(new Error("unauthorized"));
      })
      .then((data: PlayerPublic) => {
        localStorage.setItem("ef_player", JSON.stringify(data));
        setPlayer(data);
      })
      .catch(() => {
        localStorage.removeItem("ef_token");
        localStorage.removeItem("ef_player");
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(nickname: string, password: string) {
    const res = await authApi.login(nickname, password);
    localStorage.setItem("ef_token", res.access_token);
    localStorage.setItem("ef_player", JSON.stringify(res.player));
    setPlayer(res.player);
  }

  function loginWithToken(token: string, playerData: PlayerPublic) {
    localStorage.setItem("ef_token", token);
    localStorage.setItem("ef_player", JSON.stringify(playerData));
    setPlayer(playerData);
  }

  function logout() {
    authApi.logout().catch(() => {}); // fire-and-forget
    localStorage.removeItem("ef_token");
    localStorage.removeItem("ef_player");
    setPlayer(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider
      value={{
        player,
        isAdmin: player?.role === "admin",
        isLoading,
        login,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
