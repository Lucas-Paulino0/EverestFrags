/**
 * Página /matches/new — formulário para adicionar partida
 *
 * Tabela de entrada: uma linha por jogador, colunas = todas as métricas.
 * O admin seleciona quais jogadores participaram via checkboxes, ou então
 * arrasta um .dem do CS2 — o backend extrai as métricas e casa cada jogador
 * do demo com sua conta via steam_id (criando a conta automaticamente se
 * for a primeira vez), preenchendo a tabela abaixo na mesma tela.
 * Ao salvar: POST /api/matches → redireciona para /matches.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { playersApi, matchesApi, demoApi, type PlayerResponse, type PlayerStatsCreate, type DemoPlayerStat, type DemoCreatedPlayer, type DemoMatchup } from "../api/client";
import { Navbar } from "../components/Navbar";

const MAPS = ["de_dust2", "de_mirage", "de_inferno", "de_nuke", "de_ancient", "de_anubis", "de_vertigo"];
const MAX_DEMO_MB = 750;

type StatRow = PlayerStatsCreate & { selected: boolean };

const STAT_COLS: { key: keyof PlayerStatsCreate; label: string; min: number; max: number; step: number }[] = [
  { key: "kills", label: "K", min: 0, max: 60, step: 1 },
  { key: "deaths", label: "D", min: 0, max: 60, step: 1 },
  { key: "assists", label: "A", min: 0, max: 30, step: 1 },
  { key: "damage_total", label: "DMG", min: 0, max: 5000, step: 1 },
  { key: "adr", label: "ADR", min: 0, max: 500, step: 0.1 },
  { key: "adr_difference", label: "ADR+/-", min: -200, max: 200, step: 0.1 },
  { key: "hltv_rating", label: "RATING", min: 0, max: 5, step: 0.001 },
  { key: "kast_percent", label: "KAST%", min: 0, max: 100, step: 0.1 },
  { key: "disadvantage_kills", label: "DISADV K", min: 0, max: 30, step: 1 },
  { key: "advantage_kills", label: "ADVTG K", min: 0, max: 30, step: 1 },
  { key: "eco_kills", label: "ECO K", min: 0, max: 30, step: 1 },
  { key: "opening_kills", label: "OPEN K", min: 0, max: 20, step: 1 },
  { key: "trade_kills", label: "TRADE", min: 0, max: 20, step: 1 },
  { key: "trade_denials", label: "T.DENIAL", min: 0, max: 20, step: 1 },
  { key: "time_to_kill_ms", label: "TTK(ms)", min: 0, max: 2000, step: 1 },
  { key: "flash_assists", label: "FA", min: 0, max: 20, step: 1 },
  { key: "grenade_damage", label: "NADE DMG", min: 0, max: 500, step: 1 },
  { key: "he_enemies_hit", label: "HE HIT", min: 0, max: 20, step: 1 },
  { key: "fire_enemies_hit", label: "FIRE HIT", min: 0, max: 20, step: 1 },
  { key: "fire_damage", label: "FIRE DMG", min: 0, max: 500, step: 1 },
];

function emptyRow(playerId: number, selected = false): StatRow {
  return {
    player_id: playerId, selected,
    kills: 0, deaths: 0, assists: 0, damage_total: 0,
    adr: 0, adr_difference: 0, hltv_rating: 0, kast_percent: 0,
    disadvantage_kills: 0, advantage_kills: 0, eco_kills: 0,
    opening_kills: 0, trade_kills: 0, trade_denials: 0, time_to_kill_ms: 0,
    flash_assists: 0, grenade_damage: 0, he_enemies_hit: 0, fire_enemies_hit: 0, fire_damage: 0,
  };
}

function buildRows(ps: PlayerResponse[], demoPlayers?: DemoPlayerStat[]): StatRow[] {
  if (!demoPlayers) return ps.map(p => emptyRow(p.id));

  const demoByPlayerId = new Map<number, DemoPlayerStat>();
  for (const dp of demoPlayers) {
    if (dp.player_id != null) demoByPlayerId.set(dp.player_id, dp);
  }

  return ps.map(p => {
    const match = demoByPlayerId.get(p.id);
    if (!match) return emptyRow(p.id);
    return {
      player_id: p.id, selected: true,
      kills: match.kills ?? 0,
      deaths: match.deaths ?? 0,
      assists: match.assists ?? 0,
      damage_total: match.damage_total ?? 0,
      adr: match.adr ?? 0,
      adr_difference: match.adr_difference ?? 0,
      hltv_rating: match.hltv_rating ?? 0,
      kast_percent: match.kast_percent ?? 0,
      disadvantage_kills: match.disadvantage_kills ?? 0,
      advantage_kills: match.advantage_kills ?? 0,
      eco_kills: match.eco_kills ?? 0,
      opening_kills: match.opening_kills ?? 0,
      trade_kills: match.trade_kills ?? 0,
      trade_denials: match.trade_denials ?? 0,
      time_to_kill_ms: match.time_to_kill_ms ?? 0,
      flash_assists: match.flash_assists ?? 0,
      grenade_damage: match.grenade_damage ?? 0,
      he_enemies_hit: match.he_enemies_hit ?? 0,
      fire_enemies_hit: match.fire_enemies_hit ?? 0,
      fire_damage: match.fire_damage ?? 0,
    };
  });
}

export function AddMatch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [rows, setRows] = useState<StatRow[]>([]);
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().slice(0, 10));
  const [mapName, setMapName] = useState("");
  const [scopeUrl, setScopeUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Upload de .dem
  const [dragging, setDragging] = useState(false);
  const [demoFile, setDemoFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [demoError, setDemoError] = useState("");
  const [demoCreated, setDemoCreated] = useState<DemoCreatedPlayer[]>([]);
  const [demoUnmatched, setDemoUnmatched] = useState<string[]>([]);
  const [demoInactive, setDemoInactive] = useState<DemoCreatedPlayer[]>([]);
  const [demoMatchups, setDemoMatchups] = useState<DemoMatchup[]>([]);

  useEffect(() => {
    playersApi.list().then(ps => {
      setPlayers(ps);
      setRows(buildRows(ps));
    });
  }, []);

  function handleDemoFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".dem")) {
      setDemoError("Apenas arquivos .dem do CS2 são aceitos.");
      return;
    }
    if (f.size > MAX_DEMO_MB * 1024 * 1024) {
      setDemoError(`Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(0)}MB). Limite: ${MAX_DEMO_MB}MB`);
      return;
    }
    setDemoFile(f);
    setDemoError("");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleDemoFile(f);
  }

  async function uploadDemo() {
    if (!demoFile) return;
    setParsing(true);
    setDemoError("");
    try {
      const result = await demoApi.parse(demoFile);

      // Refaz a lista de players — o parse pode ter criado contas novas via steam_id
      const ps = await playersApi.list();
      setPlayers(ps);
      setRows(buildRows(ps, result.players));

      if (result.map_name) setMapName(result.map_name);
      setDemoCreated(result.created_players);
      setDemoUnmatched(result.players.filter(p => p.player_id == null).map(p => p.nickname));
      setDemoInactive(result.inactive_players);
      setDemoMatchups(result.matchups);
      setDemoFile(null);
    } catch (e: any) {
      setDemoError(e.message ?? "Erro ao processar demo");
    } finally {
      setParsing(false);
    }
  }

  function toggleRow(idx: number) {
    setRows(r => r.map((row, i) => i === idx ? { ...row, selected: !row.selected } : row));
  }

  function updateStat(idx: number, key: keyof PlayerStatsCreate, value: number) {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [key]: value } : row));
  }

  async function handleSave() {
    const selected = rows.filter(r => r.selected);
    if (selected.length === 0) { setError("Selecione ao menos 1 jogador"); return; }
    if (!playedAt) { setError("Informe a data da partida"); return; }

    setSaving(true);
    setError("");
    try {
      // Confrontos diretos só valem pros jogadores que continuam selecionados
      // (o usuário pode desmarcar alguém do demo antes de salvar).
      const selectedIds = new Set(selected.map(r => r.player_id));
      const matchups = demoMatchups.filter(m => selectedIds.has(m.player_id) && selectedIds.has(m.opponent_id));

      await matchesApi.create({
        scope_url: scopeUrl || undefined,
        played_at: playedAt,
        map_name: mapName || undefined,
        notes: notes || undefined,
        players: selected.map(({ selected: _s, ...stats }) => stats),
        matchups: matchups.length ? matchups : undefined,
      });
      navigate("/matches");
    } catch (e: any) {
      setError(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = rows.filter(r => r.selected).length;
  const demoSz = demoFile ? (demoFile.size / (1024 * 1024)).toFixed(1) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#e8e8e8", fontFamily: "'Inter', sans-serif", paddingBottom: 32 }}>
      <Navbar />
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: "#f4f4f4" }}>
              ADICIONAR PARTIDA
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {error && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#ff5a33" }}>
                // {error}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || selectedCount === 0}
              style={{
                background: selectedCount > 0 ? "#0e7490" : "#2a2a2a",
                border: "none", color: selectedCount > 0 ? "#fff" : "#555",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: 16, letterSpacing: 1.5, padding: "12px 22px", cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "SALVANDO..." : `SALVAR PARTIDA (${selectedCount} players)`}
            </button>
          </div>
        </div>

        {/* Upload de .dem */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `1px dashed ${dragging ? "#0e7490" : "#1f1f1f"}`,
            background: dragging ? "rgba(14,116,144,0.06)" : "#0e0e0e",
            padding: "16px 20px", marginBottom: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
          }}
        >
          <input ref={inputRef} type="file" accept=".dem" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleDemoFile(f); }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: demoFile ? "#22d3ee" : "#5a5a5a" }}>
            {demoFile ? `${demoFile.name} · ${demoSz}MB` : "// arraste um .dem do CS2 aqui (ou clique) para extrair e preencher automaticamente · limite 750MB"}
          </span>
          {demoFile && (
            <button
              onClick={e => { e.stopPropagation(); uploadDemo(); }}
              disabled={parsing}
              style={{ background: "#0e7490", border: "none", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "1.5px", padding: "9px 20px", cursor: parsing ? "wait" : "pointer" }}
            >
              {parsing ? "PROCESSANDO..." : "EXTRAIR DO DEMO"}
            </button>
          )}
        </div>

        {demoError && (
          <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", padding: "10px 16px", marginBottom: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#f87171" }}>
            // erro: {demoError}
          </div>
        )}

        {demoCreated.length > 0 && (
          <div style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.2)", padding: "10px 16px", marginBottom: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#22d3ee" }}>
            // {demoCreated.length} conta(s) nova(s) criada(s) automaticamente: {demoCreated.map(p => p.nickname).join(", ")}
          </div>
        )}

        {demoUnmatched.length > 0 && (
          <div style={{ background: "rgba(224,168,46,0.05)", border: "1px solid rgba(224,168,46,0.2)", padding: "10px 16px", marginBottom: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#e0a82e" }}>
            ⚠ sem steam_id no demo, não foi possível criar/casar conta: {demoUnmatched.join(", ")}
          </div>
        )}

        {demoInactive.length > 0 && (
          <div style={{ background: "rgba(224,168,46,0.05)", border: "1px solid rgba(224,168,46,0.2)", padding: "10px 16px", marginBottom: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#e0a82e" }}>
            ⚠ conta desativada (is_active=False), não aparece pra selecionar — reative em /admin antes de salvar: {demoInactive.map(p => p.nickname).join(", ")}
          </div>
        )}

        {/* Metadados */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "DATA", value: playedAt, onChange: setPlayedAt, type: "date", required: true },
            { label: "URL SCOPE.GG", value: scopeUrl, onChange: setScopeUrl, type: "text", required: false },
            { label: "NOTAS", value: notes, onChange: setNotes, type: "text", required: false },
          ].map(f => (
            <div key={f.label} style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: 9, letterSpacing: "2px", color: "#6a6a6a", marginBottom: 5 }}>{f.label}</label>
              <input
                type={f.type}
                value={f.value}
                onChange={e => f.onChange(e.target.value)}
                style={{ width: "100%", background: "#0e0e0e", border: "1px solid #1f1f1f", color: "#e8e8e8", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}
          <div style={{ minWidth: 160 }}>
            <label style={{ display: "block", fontSize: 9, letterSpacing: "2px", color: "#6a6a6a", marginBottom: 5 }}>MAPA</label>
            <select
              value={mapName}
              onChange={e => setMapName(e.target.value)}
              style={{ width: "100%", background: "#0e0e0e", border: "1px solid #1f1f1f", color: "#e8e8e8", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "8px 10px", outline: "none" }}
            >
              <option value="">—</option>
              {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Tabela de stats */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            <thead>
              <tr style={{ background: "#101010", borderBottom: "1px solid #1c1c1c" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 9, letterSpacing: "2px", color: "#5a5a5a", fontWeight: 400 }}>✓</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 9, letterSpacing: "2px", color: "#5a5a5a", fontWeight: 400 }}>PLAYER</th>
                {STAT_COLS.map(c => (
                  <th key={c.key} style={{ padding: "8px 8px", textAlign: "center", fontSize: 9, letterSpacing: "1.5px", color: "#5a5a5a", fontWeight: 400 }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const player = players.find(p => p.id === row.player_id);
                return (
                  <tr
                    key={row.player_id}
                    style={{ borderBottom: "1px solid #111", background: row.selected ? "#0d0d0d" : "transparent", opacity: row.selected ? 1 : 0.5 }}
                  >
                    <td style={{ padding: "6px 12px" }}>
                      <input type="checkbox" checked={row.selected} onChange={() => toggleRow(idx)} style={{ accentColor: "#0e7490", cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "6px 12px" }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 600, color: "#d0d0d0" }}>
                        {player?.nickname}
                      </div>
                    </td>
                    {STAT_COLS.map(c => (
                      <td key={c.key} style={{ padding: "4px 4px" }}>
                        <input
                          type="number"
                          value={row[c.key] as number}
                          min={c.min}
                          max={c.max}
                          step={c.step}
                          disabled={!row.selected}
                          onChange={e => updateStat(idx, c.key, parseFloat(e.target.value) || 0)}
                          style={{
                            width: "100%", background: row.selected ? "#0a0a0a" : "#070707",
                            border: "1px solid #1a1a1a", color: row.selected ? "#e8e8e8" : "#444",
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                            padding: "5px 6px", outline: "none", textAlign: "center",
                            minWidth: 60,
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
