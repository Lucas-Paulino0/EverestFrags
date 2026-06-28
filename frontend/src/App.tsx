/**
 * App.tsx — roteamento principal do EverestFrags
 *
 * Rotas:
 *   /login         → público (Login)
 *   /auth/callback → público (SteamCallback — processa redirect do Steam OpenID)
 *   /              → público (Dashboard — feed social)
 *   /ranking       → público (pódio top-3 + grade de classificação)
 *   /matches       → público (histórico de partidas)
 *   /matches/new   → admin (adicionar partida)
 *   /matches/:id   → público (detalhes da partida — stats básicas)
 *   /sort          → público (sorteio de times)
 *   /metrics       → público (leaderboard por métrica crua)
 *   /averages      → público (médias consolidadas da EverestFrags)
 *   /profile       → autenticado (perfil pessoal + alterar senha)
 *   /admin         → admin (gestão de players e partidas)
 *   /chat          → público (placeholder — WebSocket em desenvolvimento)
 *
 * Upload de .dem foi unificado em /matches/new — não existe mais rota /demo.
 *
 * AuthProvider envolve tudo para que qualquer componente acesse useAuth().
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AdminRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { SteamCallback } from "./pages/SteamCallback";
import { Dashboard } from "./pages/Dashboard";
import { Ranking } from "./pages/Ranking";
import { Matches } from "./pages/Matches";
import { MatchDetail } from "./pages/MatchDetail";
import { AddMatch } from "./pages/AddMatch";
import { Sort } from "./pages/Sort";
import { Metrics } from "./pages/Metrics";
import { Averages } from "./pages/Averages";
import { Profile } from "./pages/Profile";
import { Admin } from "./pages/Admin";
import { Chat } from "./pages/Chat";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<SteamCallback />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/matches/new" element={<AdminRoute><AddMatch /></AdminRoute>} />
          <Route path="/matches/:id" element={<MatchDetail />} />
          <Route path="/sort" element={<Sort />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/averages" element={<Averages />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/chat" element={<Chat />} />
          {/* Rota curinga — redireciona para o dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
