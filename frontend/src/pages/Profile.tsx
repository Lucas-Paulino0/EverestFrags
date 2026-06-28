/**
 * Perfil — página /profile
 *
 * Mostra o cartão de identidade do player logado:
 * - Posição no ranking + score final + barras de categoria
 * - Stats gerais: K/D, ADR, HLTV Rating, KAST%, total de partidas
 * - Aba "Alterar Senha" para trocar a senha (players com conta interna)
 *
 * Players que logaram APENAS via Steam não têm senha — o formulário fica oculto.
 *
 * Paleta rebrand v2: #070a0e fundo, #0e7490 teal, #6366f1 indigo, #e0a82e ouro.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { rankingApi, authApi, playersApi, type RankingEntry } from "../api/client";
import { RadarChart } from "../components/RadarChart";
import { CategoryBar } from "../components/CategoryBar";
import { Navbar } from "../components/Navbar";

export function Profile() {
  const { player, isLoading, refreshPlayer } = useAuth();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<RankingEntry | null>(null);
  const [loadingRank, setLoadingRank] = useState(true);

  // Campos de troca de senha
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdError, setPwdError] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  // Edição do apelido (display_name) — separado do nickname sincronizado com a Steam
  const [apelido, setApelido] = useState("");
  const [apelidoMsg, setApelidoMsg] = useState("");
  const [apelidoError, setApelidoError] = useState(false);
  const [savingApelido, setSavingApelido] = useState(false);

  useEffect(() => {
    setApelido(player?.display_name ?? "");
  }, [player]);

  // Redireciona se não estiver logado
  useEffect(() => {
    if (!isLoading && !player) navigate("/login");
  }, [player, isLoading, navigate]);

  async function handleSaveApelido() {
    if (!player) return;
    setApelidoMsg(""); setApelidoError(false);
    setSavingApelido(true);
    try {
      await playersApi.update(player.id, { display_name: apelido.trim() });
      await refreshPlayer();
      setApelidoMsg("Apelido salvo.");
    } catch (e: any) {
      setApelidoMsg(e.message ?? "Erro ao salvar apelido."); setApelidoError(true);
    } finally {
      setSavingApelido(false);
    }
  }

  // Carrega a posição no ranking do player logado
  useEffect(() => {
    if (!player) return;
    rankingApi.get().then(ranking => {
      const found = ranking.find(r => r.player_id === player.id) ?? null;
      setEntry(found);
    }).catch(console.error).finally(() => setLoadingRank(false));
  }, [player]);

  async function handleChangePassword() {
    setPwdMsg(""); setPwdError(false);
    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdMsg("Preencha todos os campos."); setPwdError(true); return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg("Nova senha e confirmação não coincidem."); setPwdError(true); return;
    }
    if (newPwd.length < 6) {
      setPwdMsg("Nova senha precisa ter no mínimo 6 caracteres."); setPwdError(true); return;
    }
    setSavingPwd(true);
    try {
      await authApi.changePassword(currentPwd, newPwd);
      setPwdMsg("Senha alterada com sucesso.");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (e: any) {
      setPwdMsg(e.message ?? "Erro ao alterar senha."); setPwdError(true);
    } finally {
      setSavingPwd(false);
    }
  }

  if (isLoading || !player) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#080c11", border: "1px solid #212d3a",
    color: "#e3ebf3", fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
    padding: "10px 12px", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#dde6f0", fontFamily: "'Inter', sans-serif", paddingBottom: 80 }}>

      {/* Scanlines */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, background: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.10) 4px, rgba(0,0,0,0) 5px)", opacity: 0.35 }} />

      {/* Header mínimo */}
      <header style={{ borderBottom: "1px solid #1b2530", background: "linear-gradient(180deg,#0d1218,#070a0e)", padding: "22px 48px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 38, height: 38, border: "2px solid #0e7490", display: "flex", alignItems: "center", justifyContent: "center", background: "#04222b" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M2 21 L9 7 L12.5 13 L15.5 6 L22 21 Z" fill="#0e7490" />
              <path d="M15.5 6 L13.2 10 L17.8 10 Z" fill="#cfe6ee" />
              <path d="M9 7 L7.3 10 L10.7 10 Z" fill="#cfe6ee" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: 1 }}>
            <span style={{ color: "#f0f9ff" }}>EVEREST</span>
            <span style={{ color: "#0e7490" }}>FRAGS</span>
          </span>
        </div>
      </header>

      <Navbar />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 48px 0", position: "relative", zIndex: 10 }}>

        {/* Título */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "3px", color: "#5d6d80" }}>MEU PERFIL</span>
          <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#1e2a36,transparent)" }} />
        </div>

        {/* Cartão de identidade */}
        <div style={{ border: "1px solid #1e2a36", background: "linear-gradient(180deg,#0f161d,#0a0e13)", padding: "28px 30px", marginBottom: 24, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#0e7490" }} />
          <div style={{ display: "flex", gap: 36, flexWrap: "wrap", alignItems: "flex-start" }}>

            {/* Avatar + info básica */}
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{
                width: 72, height: 72, border: "2px solid #0e7490", background: "#04222b",
                display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, color: "#22d3ee",
                boxShadow: "0 0 16px rgba(14,116,144,.25)",
              }}>
                {player.avatar_url
                  ? <img src={player.avatar_url} alt={player.nickname} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : player.avatar_initials}
              </div>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32, color: "#f0f9ff", lineHeight: 1 }}>
                  {player.display_name || player.nickname}
                </div>
                {player.display_name && (
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#4a5868", marginTop: 4 }}>
                    conta Steam: {player.nickname}
                  </div>
                )}
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "2px", color: player.role === "admin" ? "#22d3ee" : "#566476", marginTop: 6 }}>
                  {player.role === "admin" ? "GESTOR" : "PLAYER"}
                </div>
                {entry && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 42, color: "#22d3ee", lineHeight: 1 }}>
                      #{entry.rank}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a5868" }}>NO RANKING</span>
                  </div>
                )}
              </div>
            </div>

            {/* Radar + barras */}
            {entry && (
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <RadarChart
                    adr={entry.score_combat}
                    kast={entry.kast_percent}
                    rating={entry.hltv_rating * 50}
                    openK={entry.score_duel}
                    trade={Math.min(entry.kd_ratio * 33, 100)}
                    util={entry.score_utility}
                    color="#0e7490"
                    size={160}
                  />
                  <div style={{ flex: 1, minWidth: 160, paddingTop: 8 }}>
                    <CategoryBar label="COMBATE" value={entry.score_combat} color="#0e7490" textColor="#22d3ee" height={5} />
                    <CategoryBar label="DUELOS"  value={entry.score_duel}   color="#6366f1" textColor="#818cf8" height={5} />
                    <CategoryBar label="UTILITY" value={entry.score_utility} color="#e0a82e" textColor="#e8b948" height={5} />
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 28, color: "#f0f9ff", marginTop: 14 }}>
                      {Math.round(entry.score_final)}
                      <span style={{ fontSize: 10, color: "#566476", marginLeft: 6 }}>SCORE</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loadingRank && (
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#3a4757" }}>
                carregando stats...
              </div>
            )}
          </div>
        </div>

        {/* Stats em grid */}
        {entry && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
            {[
              { label: "PARTIDAS",    value: entry.total_matches },
              { label: "K/D RATIO",   value: entry.kd_ratio.toFixed(2) },
              { label: "ADR",         value: entry.adr.toFixed(1) },
              { label: "HLTV RATING", value: entry.hltv_rating.toFixed(2) },
              { label: "KAST%",       value: `${entry.kast_percent.toFixed(0)}%` },
            ].map(s => (
              <div key={s.label} style={{ border: "1px solid #1e2a36", background: "#0e141b", padding: "14px 16px" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 22, color: "#22d3ee" }}>{s.value}</div>
                <div style={{ fontSize: 9.5, letterSpacing: "1.5px", color: "#4a5868", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Apelido — nome de exibição editável, separado do nickname sincronizado com a Steam */}
        <div style={{ border: "1px solid #1e2a36", background: "linear-gradient(180deg,#0f161d,#0a0e13)", padding: "24px 28px", marginBottom: 24, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#0e7490,transparent)" }} />
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "2px", color: "#e3ebf3", marginBottom: 8 }}>
            APELIDO
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#4a5868", marginBottom: 16 }}>
            Nome de exibição no site. O nome da sua conta Steam ({player.nickname}) continua sincronizado por baixo e não muda.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              value={apelido}
              onChange={e => setApelido(e.target.value)}
              placeholder={player.nickname}
              maxLength={50}
              style={{ ...inputStyle, flex: 1, minWidth: 200, marginBottom: 0 }}
            />
            <button
              onClick={handleSaveApelido}
              disabled={savingApelido}
              style={{ background: savingApelido ? "#0a5567" : "#0e7490", border: "none", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: 1.5, padding: "11px 24px", cursor: savingApelido ? "wait" : "pointer" }}
            >
              {savingApelido ? "SALVANDO..." : "SALVAR APELIDO"}
            </button>
          </div>
          {apelidoMsg && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: apelidoError ? "#f87171" : "#34d399", marginTop: 10 }}>
              // {apelidoMsg}
            </div>
          )}
        </div>

        {/* Alterar senha — só para players com conta interna (não steam-only) */}
        <div style={{ border: "1px solid #1e2a36", background: "linear-gradient(180deg,#0f161d,#0a0e13)", padding: "24px 28px", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#6366f1,transparent)" }} />
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "2px", color: "#e3ebf3", marginBottom: 18 }}>
            ALTERAR SENHA
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 9.5, letterSpacing: "1.5px", color: "#566476", marginBottom: 6 }}>SENHA ATUAL</label>
              <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9.5, letterSpacing: "1.5px", color: "#566476", marginBottom: 6 }}>NOVA SENHA</label>
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9.5, letterSpacing: "1.5px", color: "#566476", marginBottom: 6 }}>CONFIRMAR</label>
              <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {pwdMsg && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: pwdError ? "#f87171" : "#34d399", marginBottom: 12 }}>
              // {pwdMsg}
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={savingPwd}
            style={{ background: savingPwd ? "#0a5567" : "#0e7490", border: "none", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 2, padding: "11px 28px", cursor: savingPwd ? "wait" : "pointer" }}
          >
            {savingPwd ? "SALVANDO..." : "SALVAR SENHA"}
          </button>
        </div>
      </main>
    </div>
  );
}
