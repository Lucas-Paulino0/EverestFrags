/**
 * Gestão — página /admin (somente admin)
 *
 * Duas abas:
 *  1. PLAYERS — lista todos os players; modal de cadastro completo; ativar/desativar; promover/rebaixar
 *  2. PARTIDAS — lista paginada; deletar
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { playersApi, matchesApi, aiApi, type PlayerResponse, type MatchResponse } from "../api/client";
import { Navbar } from "../components/Navbar";

type Tab = "players" | "matches";

// ─── Modal de Cadastro ────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePlayerModal({ onClose, onSuccess }: CreateModalProps) {
  const [nick, setNick] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [role, setRole] = useState("viewer");
  const [steamId, setSteamId] = useState("");
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  async function handleLookup() {
    if (!steamId.trim()) return;
    setLookingUp(true);
    setMsg(""); setIsError(false);
    try {
      const profile = await playersApi.steamLookup(steamId.trim());
      if (profile.nickname) setNick(profile.nickname);
    } catch (e: any) {
      setMsg(e.message ?? "Erro ao buscar perfil Steam.");
      setIsError(true);
    } finally {
      setLookingUp(false);
    }
  }

  const initials = nick.trim()
    ? (() => {
        const words = nick.trim().split(/\s+/);
        return (words[0][0] + (words[1]?.[0] ?? words[0].slice(-1)[0])).toUpperCase();
      })()
    : "??";

  const pwdMismatch = pwd && pwdConfirm && pwd !== pwdConfirm;
  const canSubmit = nick.trim() && (!pwd || !pwdMismatch) && !loading;

  async function handleSubmit() {
    setMsg(""); setIsError(false);
    if (!nick.trim()) { setMsg("Nickname é obrigatório."); setIsError(true); return; }
    if (pwdMismatch) { setMsg("As senhas não coincidem."); setIsError(true); return; }
    setLoading(true);
    try {
      await playersApi.create({
        nickname: nick.trim(),
        password: pwd || undefined,
        role,
        steam_id: steamId.trim() || undefined,
      });
      setMsg("Player criado com sucesso!");
      setIsError(false);
      setTimeout(() => { onSuccess(); onClose(); }, 1000);
    } catch (e: any) {
      setMsg(e.message ?? "Erro ao criar player.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#080c11", border: "1px solid #1e2a36",
    color: "#e3ebf3", fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
    padding: "10px 12px", outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 9.5, letterSpacing: "1.5px",
    color: "#566476", marginBottom: 6,
  };

  return (
    <div
      onKeyDown={onKey}
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,8,12,0.85)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 520, maxWidth: "95vw", border: "1px solid #1e2a36", background: "linear-gradient(180deg,#0f161d,#0a0e13)", position: "relative", boxShadow: "0 0 60px rgba(14,116,144,0.12)" }}>

        {/* Barra teal topo */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#0e7490,#6366f1)" }} />

        {/* Header */}
        <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid #131d27", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: "3px", color: "#e3ebf3" }}>NOVO PLAYER</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#3a4757", marginTop: 4, letterSpacing: "0.5px" }}>// cadastrar membro do grupo</div>
          </div>
          {/* Preview do avatar */}
          <div style={{ width: 56, height: 56, border: "2px solid #0e7490", background: "#04222b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, color: nick ? "#22d3ee" : "#2a3a4a", letterSpacing: 1 }}>{initials}</span>
            {nick && <div style={{ position: "absolute", bottom: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: "#0e7490" }} />}
          </div>
        </div>

        {/* Formulário */}
        <div style={{ padding: "24px 32px 28px" }}>

          {/* Nickname */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>NICKNAME <span style={{ color: "#0e7490" }}>*</span></label>
            <input
              autoFocus
              value={nick}
              onChange={e => setNick(e.target.value)}
              placeholder="ex: GodBR"
              style={inputStyle}
            />
          </div>

          {/* Senha + Confirmar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>SENHA <span style={{ fontSize: 9, color: "#3a4757" }}>(opcional)</span></label>
              <input
                type="password"
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                placeholder="vazio = Steam only"
                style={{ ...inputStyle, borderColor: pwdMismatch ? "#7f1d1d" : "#1e2a36" }}
              />
            </div>
            <div>
              <label style={labelStyle}>CONFIRMAR SENHA</label>
              <input
                type="password"
                value={pwdConfirm}
                onChange={e => setPwdConfirm(e.target.value)}
                placeholder="repita a senha"
                style={{ ...inputStyle, borderColor: pwdMismatch ? "#7f1d1d" : "#1e2a36" }}
              />
            </div>
          </div>
          {pwdMismatch && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#f87171", marginBottom: 12, marginTop: -8 }}>
              // senhas não coincidem
            </div>
          )}

          {/* Role + Steam ID */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>ROLE</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>STEAM ID <span style={{ fontSize: 9, color: "#3a4757" }}>(opcional)</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={steamId}
                  onChange={e => setSteamId(e.target.value)}
                  placeholder="76561198xxxxxxxxx"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={!steamId.trim() || lookingUp}
                  title="Buscar nickname desse Steam ID na Steam Web API"
                  style={{ flexShrink: 0, background: "none", border: "1px solid #1e2a36", color: steamId.trim() ? "#22d3ee" : "#3a4757", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "0 14px", cursor: steamId.trim() ? "pointer" : "default" }}
                >
                  {lookingUp ? "..." : "BUSCAR"}
                </button>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div style={{ background: "rgba(14,116,144,0.05)", border: "1px solid rgba(14,116,144,0.15)", padding: "10px 14px", marginBottom: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#3a5060", lineHeight: 1.8 }}>
            <span style={{ color: "#0e7490" }}>viewer</span> → acessa ranking e sorteio · <span style={{ color: "#6366f1" }}>admin</span> → gestão completa
            <br />
            Sem senha → player só consegue entrar via Steam OpenID
          </div>

          {/* Feedback */}
          {msg && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: isError ? "#f87171" : "#34d399", marginBottom: 16, padding: "8px 12px", background: isError ? "rgba(248,113,113,0.06)" : "rgba(52,211,153,0.06)", border: `1px solid ${isError ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}` }}>
              {isError ? "// erro: " : "// "}{msg}
            </div>
          )}

          {/* Botões */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, background: "none", border: "1px solid #1e2a36", color: "#566476", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "2px", padding: "12px", cursor: "pointer" }}
            >
              CANCELAR
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{ flex: 2, background: canSubmit ? "#0e7490" : "#0a2733", border: `1px solid ${canSubmit ? "#0e7490" : "#1a3a45"}`, color: canSubmit ? "#fff" : "#2a5060", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "2px", padding: "12px", cursor: canSubmit ? "pointer" : "default" }}
            >
              {loading ? "CRIANDO..." : "CRIAR PLAYER"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Edição ──────────────────────────────────────────────────────────

interface EditModalProps {
  player: PlayerResponse;
  onClose: () => void;
  onSuccess: () => void;
}

function EditPlayerModal({ player, onClose, onSuccess }: EditModalProps) {
  const [nick, setNick] = useState(player.nickname);
  const [apelido, setApelido] = useState(player.display_name ?? "");
  const [steamId, setSteamId] = useState(player.steam_id ?? "");
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = nick.trim() && !loading;

  async function handleSubmit() {
    setMsg(""); setIsError(false);
    if (!nick.trim()) { setMsg("Nickname é obrigatório."); setIsError(true); return; }
    setLoading(true);
    try {
      await playersApi.update(player.id, {
        nickname: nick.trim() !== player.nickname ? nick.trim() : undefined,
        display_name: apelido.trim() !== (player.display_name ?? "") ? apelido.trim() : undefined,
        steam_id: steamId.trim() || null,
      });
      setMsg("Player atualizado!");
      setIsError(false);
      setTimeout(() => { onSuccess(); onClose(); }, 800);
    } catch (e: any) {
      setMsg(e.message ?? "Erro ao atualizar.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#080c11", border: "1px solid #1e2a36",
    color: "#e3ebf3", fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
    padding: "10px 12px", outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 9.5, letterSpacing: "1.5px",
    color: "#566476", marginBottom: 6,
  };

  return (
    <div
      onKeyDown={e => e.key === "Escape" && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,8,12,0.85)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 480, maxWidth: "95vw", border: "1px solid #1e2a36", background: "linear-gradient(180deg,#0f161d,#0a0e13)", position: "relative", boxShadow: "0 0 60px rgba(14,116,144,0.12)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#0e7490,#6366f1)" }} />

        <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid #131d27" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: "3px", color: "#e3ebf3" }}>
            EDITAR PLAYER
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#3a4757", marginTop: 4 }}>
            // #{player.id} · {player.nickname}
          </div>
        </div>

        <div style={{ padding: "24px 32px 28px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>NICKNAME</label>
            <input
              autoFocus
              value={nick}
              onChange={e => setNick(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>APELIDO <span style={{ fontSize: 9, color: "#3a4757" }}>(opcional — sobrepõe o nickname na exibição)</span></label>
            <input
              value={apelido}
              onChange={e => setApelido(e.target.value)}
              placeholder={player.nickname}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>STEAM ID <span style={{ fontSize: 9, color: "#3a4757" }}>(vazio = desvincular)</span></label>
            <input
              value={steamId}
              onChange={e => setSteamId(e.target.value)}
              placeholder="76561198xxxxxxxxx"
              style={inputStyle}
            />
            <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "#3a4757" }}>
              // encontre em steamid.io digitando o perfil do jogador
            </div>
          </div>

          {msg && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: isError ? "#f87171" : "#34d399", marginBottom: 16, padding: "8px 12px", background: isError ? "rgba(248,113,113,0.06)" : "rgba(52,211,153,0.06)", border: `1px solid ${isError ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}` }}>
              {isError ? "// erro: " : "// "}{msg}
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, background: "none", border: "1px solid #1e2a36", color: "#566476", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "2px", padding: "12px", cursor: "pointer" }}
            >
              CANCELAR
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{ flex: 2, background: canSubmit ? "#0e7490" : "#0a2733", border: `1px solid ${canSubmit ? "#0e7490" : "#1a3a45"}`, color: canSubmit ? "#fff" : "#2a5060", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "2px", padding: "12px", cursor: canSubmit ? "pointer" : "default" }}
            >
              {loading ? "SALVANDO..." : "SALVAR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export function Admin() {
  const { player, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("players");
  const [showModal, setShowModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerResponse | null>(null);

  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [matchPage, setMatchPage] = useState(1);
  const [matchTotal, setMatchTotal] = useState(0);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const [digestText, setDigestText] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && (!player || !isAdmin)) navigate("/");
  }, [player, isAdmin, isLoading, navigate]);

  function loadPlayers() {
    setLoadingPlayers(true);
    playersApi.list().then(setPlayers).catch(console.error).finally(() => setLoadingPlayers(false));
  }

  function loadMatches(page: number) {
    setLoadingMatches(true);
    matchesApi.list(page, 15)
      .then(res => { setMatches(res.items); setMatchTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoadingMatches(false));
  }

  useEffect(() => { if (!isLoading && isAdmin) loadPlayers(); }, [isAdmin, isLoading]);
  useEffect(() => { if (!isLoading && isAdmin && tab === "matches") loadMatches(matchPage); }, [tab, matchPage, isAdmin, isLoading]);

  async function toggleActive(p: PlayerResponse) {
    try {
      await playersApi.update(p.id, { is_active: !p.is_active });
      loadPlayers();
    } catch (e: any) { alert(e.message); }
  }

  async function toggleRole(p: PlayerResponse) {
    const newRole = p.role === "admin" ? "viewer" : "admin";
    if (!confirm(`Alterar ${p.nickname} para ${newRole}?`)) return;
    try {
      await playersApi.update(p.id, { role: newRole });
      loadPlayers();
    } catch (e: any) { alert(e.message); }
  }

  async function handleDeleteMatch(id: number) {
    if (!confirm("Apagar esta partida permanentemente?")) return;
    try {
      await matchesApi.delete(id);
      loadMatches(matchPage);
    } catch (e: any) { alert(e.message); }
  }

  async function handleDigest() {
    setDigestLoading(true);
    setDigestText(null);
    try {
      const res = await aiApi.digest();
      setDigestText(res.unavailable ? "// IA indisponível — configure GROQ_API_KEY" : (res.text ?? "// Sem resposta"));
    } catch (e: any) {
      setDigestText(`// Erro: ${e.message}`);
    } finally {
      setDigestLoading(false);
    }
  }

  if (isLoading || !player || !isAdmin) return null;

  const totalPages = Math.ceil(matchTotal / 15);

  const TAB_STYLES = (active: boolean): React.CSSProperties => ({
    background: "none", border: "none", cursor: "pointer",
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
    fontSize: 15, letterSpacing: "2px", padding: "8px 22px",
    color: active ? "#22d3ee" : "#566476",
    borderBottom: active ? "2px solid #0e7490" : "2px solid transparent",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#dde6f0", fontFamily: "'Inter', sans-serif", paddingBottom: 80 }}>

      {/* Scanlines */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, background: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.10) 4px, rgba(0,0,0,0) 5px)", opacity: 0.35 }} />

      {/* Header */}
      <header style={{ borderBottom: "1px solid #1b2530", background: "linear-gradient(180deg,#0d1218,#070a0e)", padding: "22px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 18 }}>
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

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px 0", position: "relative", zIndex: 10 }}>

        {/* Título + botão */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "3px", color: "#5d6d80" }}>GESTÃO</span>
          <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#1e2a36,transparent)" }} />
          {tab === "players" && (
            <button
              onClick={() => setShowModal(true)}
              style={{ background: "#0e7490", border: "none", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "2px", padding: "8px 20px", cursor: "pointer" }}
            >
              + NOVO PLAYER
            </button>
          )}
          {tab === "matches" && (
            <button
              onClick={() => navigate("/matches/new")}
              style={{ background: "#0e7490", border: "none", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "2px", padding: "8px 20px", cursor: "pointer" }}
            >
              + NOVA PARTIDA
            </button>
          )}
        </div>

        {/* Abas */}
        <div style={{ display: "flex", borderBottom: "1px solid #1b2530", marginBottom: 28 }}>
          <button style={TAB_STYLES(tab === "players")} onClick={() => setTab("players")}>PLAYERS</button>
          <button style={TAB_STYLES(tab === "matches")} onClick={() => setTab("matches")}>PARTIDAS</button>
        </div>

        {/* ── ABA PLAYERS ─────────────────────────────────────────────────── */}
        {tab === "players" && (
          loadingPlayers ? (
            <div style={{ textAlign: "center", padding: 60, fontFamily: "'JetBrains Mono', monospace", color: "#3a4757" }}>carregando...</div>
          ) : (
            <div style={{ border: "1px solid #172029", background: "#0a0e13" }}>
              {/* Header da tabela */}
              <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 100px 120px 100px 240px", borderBottom: "1px solid #172029", padding: "10px 18px" }}>
                {["ID", "NICKNAME", "ROLE", "STEAM", "STATUS", "AÇÕES"].map(h => (
                  <span key={h} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "1.5px", color: "#4a5868" }}>{h}</span>
                ))}
              </div>
              {players.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#2a3a4a" }}>
                  // nenhum player encontrado
                </div>
              )}
              {players.map(p => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "50px 1fr 100px 120px 100px 240px", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #11171f", opacity: p.is_active ? 1 : 0.45 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#3a4757" }}>#{p.id}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, border: "1px solid #1e2a36", background: "#0d1218", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: "#566476", flexShrink: 0 }}>
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt={p.nickname} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : p.avatar_initials}
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, color: "#e3ebf3" }}>
                      {p.nickname}
                      {p.display_name && <span style={{ color: "#566476", fontWeight: 500, fontSize: 13 }}> ({p.display_name})</span>}
                    </span>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "1px", color: p.role === "admin" ? "#22d3ee" : "#566476" }}>
                    {p.role}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: p.steam_id ? "#34d399" : "#3a4757" }}>
                    {p.steam_id ? "VINCULADO" : "—"}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: p.is_active ? "#34d399" : "#f87171" }}>
                    {p.is_active ? "ATIVO" : "INATIVO"}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setEditingPlayer(p)}
                      style={{ fontSize: 10, letterSpacing: "1px", padding: "5px 8px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", background: "rgba(14,116,144,.08)", border: "1px solid rgba(14,116,144,.3)", color: "#22d3ee" }}
                    >
                      EDITAR
                    </button>
                    <button
                      onClick={() => toggleActive(p)}
                      style={{ fontSize: 10, letterSpacing: "1px", padding: "5px 8px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", background: p.is_active ? "#1a0d0d" : "#0a1a0a", border: `1px solid ${p.is_active ? "#5a1010" : "#1a4a1a"}`, color: p.is_active ? "#f87171" : "#34d399" }}
                    >
                      {p.is_active ? "DESAT." : "ATIVAR"}
                    </button>
                    <button
                      onClick={() => toggleRole(p)}
                      style={{ fontSize: 10, letterSpacing: "1px", padding: "5px 8px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.25)", color: "#818cf8" }}
                    >
                      {p.role === "admin" ? "→ VIEW" : "→ ADM"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── ABA PARTIDAS ────────────────────────────────────────────────── */}
        {tab === "matches" && (
          loadingMatches ? (
            <div style={{ textAlign: "center", padding: 60, fontFamily: "'JetBrains Mono', monospace", color: "#3a4757" }}>carregando...</div>
          ) : (
            <>
              <div style={{ border: "1px solid #172029", background: "#0a0e13" }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 130px 160px 1fr 100px", borderBottom: "1px solid #172029", padding: "10px 18px" }}>
                  {["ID", "DATA", "MAPA", "SCOPE", "AÇÃO"].map(h => (
                    <span key={h} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "1.5px", color: "#4a5868" }}>{h}</span>
                  ))}
                </div>
                {matches.length === 0 && (
                  <div style={{ padding: 40, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#2a3a4a" }}>// nenhuma partida encontrada</div>
                )}
                {matches.map(m => (
                  <div key={m.id} style={{ display: "grid", gridTemplateColumns: "60px 130px 160px 1fr 100px", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #11171f" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#3a4757" }}>#{m.id}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#aebccd" }}>
                      {new Date(m.played_at).toLocaleDateString("pt-BR")}
                    </span>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: "#e3ebf3" }}>
                      {m.map_name ?? "—"}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#566476", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.scope_url ?? "sem link"}
                    </span>
                    <button
                      onClick={() => handleDeleteMatch(m.id)}
                      style={{ fontSize: 10, letterSpacing: "1px", padding: "5px 10px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", background: "#1a0d0d", border: "1px solid #5a1010", color: "#f87171" }}
                    >
                      APAGAR
                    </button>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setMatchPage(p)}
                      style={{ width: 34, height: 34, border: `1px solid ${p === matchPage ? "#0e7490" : "#1e2a36"}`, background: p === matchPage ? "rgba(14,116,144,.15)" : "#0d1218", color: p === matchPage ? "#22d3ee" : "#566476", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )
        )}
        {/* Digest semanal IA */}
        <div style={{ marginTop: 40, border: "1px solid #1b2530", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#6366f1,transparent)" }} />
          <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "2px", color: "#818cf8" }}>
                DIGEST SEMANAL IA
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#3a4d5e", marginTop: 3 }}>
                resumo da semana — ranking + partidas + melhor performance
              </div>
            </div>
            <button
              onClick={handleDigest}
              disabled={digestLoading}
              style={{ background: digestLoading ? "#22235a" : "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.4)", color: "#818cf8", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "2px", padding: "9px 18px", cursor: digestLoading ? "wait" : "pointer" }}
            >
              {digestLoading ? "GERANDO..." : "GERAR DIGEST"}
            </button>
          </div>
          {digestText && (
            <div style={{ borderTop: "1px solid #1b2530", padding: "16px 22px", fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#9cadb9", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {digestText}
            </div>
          )}
        </div>
      </main>

      {/* Modal de cadastro */}
      {showModal && (
        <CreatePlayerModal
          onClose={() => setShowModal(false)}
          onSuccess={loadPlayers}
        />
      )}

      {/* Modal de edição */}
      {editingPlayer && (
        <EditPlayerModal
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSuccess={loadPlayers}
        />
      )}
    </div>
  );
}
