/**
 * API Client — wrapper tipado para todas as chamadas ao backend
 *
 * - Lê o token do localStorage automaticamente em toda requisição
 * - Em resposta 401: limpa token e redireciona para /login
 * - BASE_URL vazio em dev (usa proxy do Vite → localhost:8001)
 * - BASE_URL = VITE_API_URL em produção (URL do Render no Vercel)
 *
 * ATENÇÃO: nunca importar fetch diretamente nos componentes/pages.
 * Sempre usar as funções exportadas deste arquivo para centralizar a lógica de auth.
 *
 * Bug anterior: BASE_URL defaultava para "http://localhost:8000" mesmo em dev,
 * bypassando o proxy do Vite e quebrando CORS. Agora default é "" (string vazia)
 * para que /api/... vá pelo proxy configurado no vite.config.ts.
 */

export const BASE_URL = import.meta.env.VITE_API_URL ?? "";

function getToken(): string | null {
  return localStorage.getItem("ef_token");
}

/**
 * Formata o campo "detail" de um erro do FastAPI pra texto legível.
 * Em erros de validação (422), "detail" não é string — é um array de
 * { loc, msg, type, ... } do Pydantic. Sem isso, `new Error(arrayDeObjetos)`
 * vira "[object Object],[object Object]" (toString padrão de array de objetos).
 */
function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(d => {
        if (d && typeof d === "object" && "msg" in d) {
          const loc = Array.isArray((d as any).loc) ? (d as any).loc.join(".") : "";
          return loc ? `${loc}: ${(d as any).msg}` : String((d as any).msg);
        }
        return JSON.stringify(d);
      })
      .join(" · ");
  }
  return "Erro na requisição";
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expirado ou inválido — força logout
    localStorage.removeItem("ef_token");
    localStorage.removeItem("ef_player");
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Erro desconhecido" }));
    throw new Error(formatErrorDetail(error.detail));
  }

  // 204 No Content — sem body
  if (res.status === 204) return undefined as T;

  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface PlayerPublic {
  id: number;
  nickname: string;
  display_name: string | null;
  role: "admin" | "viewer";
  avatar_initials: string;
  avatar_url: string | null;
}

/** Apelido (display_name) se definido, senão o nickname sincronizado com a Steam. */
export function displayNameOf(p: { nickname: string; display_name?: string | null }): string {
  return p.display_name || p.nickname;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  player: PlayerPublic;
}

export const authApi = {
  login: (nickname: string, password: string) =>
    request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ nickname, password }),
    }),

  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  me: () => request<PlayerPublic>("/api/auth/me"),

  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
};

// ─── Ranking ────────────────────────────────────────────────────────────────

export interface RankingEntry {
  rank: number;
  player_id: number;
  player_nickname: string;
  player_display_name: string | null;
  avatar_initials: string;
  avatar_url: string | null;
  total_matches: number;

  // Métricas brutas agregadas — soma
  kills: number;
  deaths: number;
  assists: number;
  damage_total: number;
  opening_kills: number;
  trade_kills: number;
  trade_denials: number;
  flash_assists: number;
  grenade_damage: number;
  he_enemies_hit: number;
  fire_enemies_hit: number;
  fire_damage: number;
  disadvantage_kills: number;
  advantage_kills: number;
  eco_kills: number;

  // Métricas brutas agregadas — média
  kd_ratio: number;
  adr: number;
  adr_difference: number;
  hltv_rating: number;
  kast_percent: number;
  time_to_kill_ms: number;

  // Scores por categoria + final (0-100)
  score_combat: number;
  score_duel: number;
  score_utility: number;
  score_final: number;
}

export const rankingApi = {
  get: () => request<RankingEntry[]>("/api/ranking"),
};

// ─── Stats consolidadas do grupo ────────────────────────────────────────────

export interface GroupAveragesResponse {
  total_matches: number;
  total_player_entries: number;
  kills: number;
  deaths: number;
  assists: number;
  damage_total: number;
  adr: number;
  adr_difference: number;
  hltv_rating: number;
  kast_percent: number;
  opening_kills: number;
  trade_kills: number;
  trade_denials: number;
  time_to_kill_ms: number;
  flash_assists: number;
  grenade_damage: number;
  he_enemies_hit: number;
  fire_enemies_hit: number;
  fire_damage: number;
  disadvantage_kills: number;
  advantage_kills: number;
  eco_kills: number;
}

export const statsApi = {
  groupAverages: () => request<GroupAveragesResponse>("/api/stats/group-averages"),
};

// ─── Confronto direto (head-to-head) ────────────────────────────────────────

export interface HeadToHeadResponse {
  player_id: number;
  player_nickname: string;
  opponent_id: number;
  opponent_nickname: string;
  matches_together: number;
  player_kills: number;
  opponent_kills: number;
  player_flash_assists: number;
  opponent_flash_assists: number;
}

export const playersVsApi = {
  headToHead: (playerId: number, opponentId: number) =>
    request<HeadToHeadResponse>(`/api/players/${playerId}/vs/${opponentId}`),
};

// ─── Players ────────────────────────────────────────────────────────────────

export interface PlayerResponse {
  id: number;
  nickname: string;
  display_name: string | null;
  steam_id: string | null;
  avatar_initials: string;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface PlayerCreate {
  nickname: string;
  steam_id?: string;
  avatar_initials?: string;
  password?: string;
  role?: string;
}

export const playersApi = {
  list: () => request<PlayerResponse[]>("/api/players"),

  get: (id: number) => request<PlayerResponse>(`/api/players/${id}`),

  create: (data: PlayerCreate) =>
    request<PlayerResponse>("/api/players", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Omit<PlayerCreate, "steam_id">> & { is_active?: boolean; role?: string; steam_id?: string | null; display_name?: string }) =>
    request<PlayerResponse>(`/api/players/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  steamLookup: (steamId: string) =>
    request<{ nickname: string | null; avatar_url: string | null }>(
      `/api/players/steam-lookup?steam_id=${encodeURIComponent(steamId)}`
    ),
};

// ─── Matches ────────────────────────────────────────────────────────────────

export interface PlayerStatsCreate {
  player_id: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  damage_total?: number;
  adr?: number;
  adr_difference?: number;
  hltv_rating?: number;
  kast_percent?: number;
  disadvantage_kills?: number;
  advantage_kills?: number;
  eco_kills?: number;
  opening_kills?: number;
  trade_kills?: number;
  trade_denials?: number;
  time_to_kill_ms?: number;
  flash_assists?: number;
  grenade_damage?: number;
  he_enemies_hit?: number;
  fire_enemies_hit?: number;
  fire_damage?: number;
}

export interface MatchupCreate {
  player_id: number;
  opponent_id: number;
  kills?: number;
  flash_assists?: number;
}

export interface MatchCreate {
  scope_url?: string;
  played_at: string;
  map_name?: string;
  notes?: string;
  players: PlayerStatsCreate[];
  matchups?: MatchupCreate[];
}

export interface MatchResponse {
  id: number;
  scope_url: string | null;
  played_at: string;
  map_name: string | null;
  notes: string | null;
  player_count: number;
  created_at: string;
}

export interface PaginatedMatchResponse {
  total: number;
  page: number;
  limit: number;
  items: MatchResponse[];
}

export interface PlayerStatsInMatch {
  player_id: number;
  player_nickname: string;
  player_avatar_initials: string;
  kills: number;
  deaths: number;
  assists: number;
  damage_total: number;
  adr: number;
  adr_difference: number;
  hltv_rating: number;
  kast_percent: number;
  disadvantage_kills: number;
  advantage_kills: number;
  eco_kills: number;
  opening_kills: number;
  trade_kills: number;
  trade_denials: number;
  time_to_kill_ms: number;
  flash_assists: number;
  grenade_damage: number;
  he_enemies_hit: number;
  fire_enemies_hit: number;
  fire_damage: number;
}

export interface MatchDetailResponse {
  id: number;
  scope_url: string | null;
  played_at: string;
  map_name: string | null;
  notes: string | null;
  created_at: string;
  players: PlayerStatsInMatch[];
}

export const matchesApi = {
  list: (page = 1, limit = 20) =>
    request<PaginatedMatchResponse>(`/api/matches?page=${page}&limit=${limit}`),

  get: (id: number) => request<MatchDetailResponse>(`/api/matches/${id}`),

  create: (data: MatchCreate) =>
    request<MatchDetailResponse>("/api/matches", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<void>(`/api/matches/${id}`, { method: "DELETE" }),
};

// ─── Sort ────────────────────────────────────────────────────────────────────

export interface PlayerInTeam {
  player_id: number;
  player_nickname: string;
  avatar_initials: string;
  score_final: number;
}

export interface TeamResult {
  team_number: number;
  players: PlayerInTeam[];
  total_score: number;
  avg_score: number;
}

export interface SortTeamsResponse {
  teams: TeamResult[];
  diff_score: number;
  algorithm: string;
}

export const sortApi = {
  sort: (playerIds: number[], teams = 2) =>
    request<SortTeamsResponse>(
      `/api/sort-teams?players=${playerIds.join(",")}&teams=${teams}`
    ),
};

// ─── Demo parser ────────────────────────────────────────────────────────────

export interface DemoPlayerStat {
  nickname: string;
  steam_id: string;
  player_id: number | null;
  kills: number;
  deaths: number;
  assists: number;
  damage_total: number;
  adr: number;
  adr_difference: number;
  hltv_rating: number;
  kast_percent: number;
  opening_kills: number;
  trade_kills: number;
  trade_denials: number;
  time_to_kill_ms: number;
  flash_assists: number;
  grenade_damage: number;
  he_enemies_hit: number;
  fire_enemies_hit: number;
  fire_damage: number;
  disadvantage_kills: number;
  advantage_kills: number;
  eco_kills: number;
}

export interface DemoCreatedPlayer {
  id: number;
  nickname: string;
  steam_id: string;
}

export interface DemoMatchup {
  player_id: number;
  opponent_id: number;
  kills: number;
  flash_assists: number;
}

export interface DemoParseResult {
  map_name: string | null;
  total_rounds: number;
  players: DemoPlayerStat[];
  matchups: DemoMatchup[];
  created_players: DemoCreatedPlayer[];
  inactive_players: DemoCreatedPlayer[];
  errors: string[];
}

export const demoApi = {
  // Upload multipart — não usa request() porque o Content-Type (boundary)
  // precisa ser definido automaticamente pelo browser, não como JSON.
  parse: async (file: File): Promise<DemoParseResult> => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}/api/demo/parse`, { method: "POST", headers, body: fd });

    if (res.status === 401) {
      localStorage.removeItem("ef_token");
      localStorage.removeItem("ef_player");
      window.location.href = "/login";
      throw new Error("Sessão expirada");
    }
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Erro desconhecido" }));
      throw new Error(formatErrorDetail(error.detail));
    }
    return res.json();
  },
};
