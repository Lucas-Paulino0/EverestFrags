/**
 * Página /login — autenticação com nickname+senha ou Steam OpenID
 *
 * Paleta rebrand v2: fundo #070a0e, teal #0e7490, borda #1e2a36
 * Shake animation quando credenciais são inválidas.
 * Erro steam_auth_failed via query string (redirect do backend OpenID).
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const [nick, setNick] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("// credenciais inválidas");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error") === "steam_auth_failed") {
      setError(true);
      setErrorMsg("// falha na autenticação com a Steam");
    }
  }, [searchParams]);

  async function doLogin() {
    if (!nick || !pwd) return;
    setLoading(true); setError(false);
    try {
      await login(nick, pwd);
      navigate("/");
    } catch {
      setError(true);
      setErrorMsg("// credenciais inválidas");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") doLogin();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#080c11", border: `1px solid ${error ? "#0e7490" : "#212d3a"}`,
    color: "#e3ebf3", fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
    padding: "11px 13px", marginBottom: 16, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative" }}>
      {/* Scanlines */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, background: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.10) 4px, rgba(0,0,0,0) 5px)", opacity: 0.35 }} />
      {/* Glow teal */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 51, background: "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(14,116,144,0.08), transparent 62%)" }} />

      {/* Crosshair background */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06, pointerEvents: "none" }}>
        <line x1="50" y1="0" x2="50" y2="100" stroke="#0e7490" strokeWidth="0.25" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#0e7490" strokeWidth="0.25" />
        <circle cx="50" cy="50" r="13" fill="none" stroke="#0e7490" strokeWidth="0.25" />
        <circle cx="50" cy="50" r="0.5" fill="#0e7490" />
      </svg>

      {/* Card */}
      <div style={{
        position: "relative", width: 380, maxWidth: "100%",
        border: "1px solid #1e2a36", background: "linear-gradient(180deg,#0f161d,#0a0e13)",
        padding: "38px 34px 32px",
        animation: shake ? "efShake 0.5s ease" : undefined,
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#0e7490" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 28 }}>
          <div style={{ width: 40, height: 40, border: "2px solid #0e7490", display: "flex", alignItems: "center", justifyContent: "center", background: "#04222b" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M2 21 L9 7 L12.5 13 L15.5 6 L22 21 Z" fill="#0e7490" />
              <path d="M15.5 6 L13.2 10 L17.8 10 Z" fill="#cfe6ee" />
              <path d="M9 7 L7.3 10 L10.7 10 Z" fill="#cfe6ee" />
            </svg>
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 30, letterSpacing: 0.5 }}>
            <span style={{ color: "#f0f9ff" }}>EVEREST</span>
            <span style={{ color: "#0e7490" }}>FRAGS</span>
          </div>
        </div>

        <label style={{ display: "block", fontSize: 10, letterSpacing: "2px", color: "#566476", marginBottom: 7 }}>NICKNAME</label>
        <input value={nick} onChange={e => setNick(e.target.value)} onKeyDown={onKey} placeholder="seu nick" autoComplete="username" style={inputStyle} />

        <label style={{ display: "block", fontSize: 10, letterSpacing: "2px", color: "#566476", marginBottom: 7 }}>SENHA</label>
        <input value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={onKey} type="password" placeholder="senha" autoComplete="current-password" style={{ ...inputStyle, marginBottom: 10 }} />

        {error && (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#22d3ee", marginBottom: 8 }}>
            {errorMsg}
          </div>
        )}

        <button
          onClick={doLogin}
          disabled={loading || !nick || !pwd}
          style={{ width: "100%", marginTop: 8, background: loading ? "#0a5567" : "#0e7490", border: "none", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: 2, padding: 13, cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "AUTENTICANDO..." : "LOGIN"}
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
          <div style={{ flex: 1, height: 1, background: "#1e2a36" }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#3a4757", letterSpacing: "1px" }}>OU</span>
          <div style={{ flex: 1, height: 1, background: "#1e2a36" }} />
        </div>

        {/* Botão Steam */}
        <button
          onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL ?? ""}/api/auth/steam`; }}
          style={{ width: "100%", background: "#1b2838", border: "1px solid #2a4a63", color: "#dde6f0", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: 1.5, padding: "11px 13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#66c0f4">
            <path d="M12 2C6.6 2 2.2 6.2 2 11.5l5.4 2.2a2.9 2.9 0 0 1 1.7-.5l2.4-3.5v-.05A3.85 3.85 0 1 1 15.4 13l-3.45 2.45c0 .05.01.1.01.15a2.9 2.9 0 1 1-5.76-.43L2.6 13.6A10 10 0 1 0 12 2z"/>
          </svg>
          ENTRAR COM A STEAM
        </button>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "#3a4757", textAlign: "center", marginTop: 8 }}>
          players do grupo — acesso via conta Steam
        </div>
      </div>
    </div>
  );
}
