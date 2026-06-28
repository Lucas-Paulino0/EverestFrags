import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  matchesApi,
  playersApi,
  rankingApi,
  displayNameOf,
  type MatchResponse,
  type PlayerResponse,
  type RankingEntry,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Navbar } from "../components/Navbar";
import { Avatar } from "../components/Avatar";
import { PlayerDetailModal } from "../components/PlayerDetailModal";
import { CompareModal } from "../components/CompareModal";

function entryName(entry: RankingEntry): string {
  return entry.player_display_name || entry.player_nickname;
}

function number(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

function score(value: number) {
  return Math.round(value || 0);
}

function percent(value: number) {
  return `${Math.max(4, Math.min(100, score(value)))}%`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function getBestBy(ranking: RankingEntry[], key: keyof RankingEntry) {
  if (ranking.length === 0) return null;

  return ranking.reduce((best, current) => {
    const bestValue = Number(best[key] || 0);
    const currentValue = Number(current[key] || 0);
    return currentValue > bestValue ? current : best;
  }, ranking[0]);
}

function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ig-metric-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MatchPost({ match }: { match: MatchResponse }) {
  return (
    <Link to={`/matches/${match.id}`} className="ig-post ig-match-post ef-feed-post">
      <header className="ig-post-header">
        <div className="ig-map-avatar">{(match.map_name || "?").replace("de_", "").slice(0, 2).toUpperCase()}</div>
        <div>
          <strong>Nova partida no feed</strong>
          <span>Mix #{match.id} · {formatDate(match.played_at)} · {match.player_count} jogadores</span>
        </div>
      </header>

      <div className="ig-match-body ef-match-post-body">
        <div>
          <span className="ig-post-label">mapa</span>
          <h3>{match.map_name || "Mapa não informado"}</h3>
        </div>

        <div className="ig-match-count">
          <strong>{match.player_count}</strong>
          <span>players</span>
        </div>
      </div>

      {match.notes && <p className="ig-post-text">{match.notes}</p>}

      <footer className="ig-post-footer">
        <span>Ver detalhes da partida</span>
        {match.scope_url && <span>Scope disponível ↗</span>}
      </footer>
    </Link>
  );
}

function RankingPost({
  entry,
  title,
  text,
  onOpen,
}: {
  entry: RankingEntry;
  title: string;
  text: string;
  onOpen: () => void;
}) {
  return (
    <article className="ig-post ig-ranking-post ef-feed-post">
      <header className="ig-post-header">
        <Avatar avatarUrl={entry.avatar_url} initials={entry.avatar_initials} nickname={entryName(entry)} size="md" shape="squircle" />
        <div>
          <strong>{entryName(entry)}</strong>
          <span>{title}</span>
        </div>
      </header>

      <p className="ig-post-text">{text}</p>

      <div className="ef-score-breakdown">
        <div>
          <span>Combate</span>
          <b>{score(entry.score_combat)}</b>
          <em style={{ width: percent(entry.score_combat) }} />
        </div>
        <div>
          <span>Duelos</span>
          <b>{score(entry.score_duel)}</b>
          <em style={{ width: percent(entry.score_duel) }} />
        </div>
        <div>
          <span>Utility</span>
          <b>{score(entry.score_utility)}</b>
          <em style={{ width: percent(entry.score_utility) }} />
        </div>
      </div>

      <div className="ig-post-metrics">
        <MetricChip label="Score" value={score(entry.score_final)} />
        <MetricChip label="K/D" value={number(entry.kd_ratio, 2)} />
        <MetricChip label="ADR" value={number(entry.adr)} />
      </div>

      <button type="button" className="ig-post-action" onClick={onOpen}>
        Ver perfil do jogador
      </button>
    </article>
  );
}

export function Dashboard() {
  const { player, isAdmin } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<RankingEntry | null>(null);
  const [comparing, setComparing] = useState(false);

  async function loadData() {
    try {
      setLoading(true);

      const [rankingData, playersData, matchesData] = await Promise.all([
        rankingApi.get(),
        playersApi.list(),
        matchesApi.list(1, 6),
      ]);

      setRanking(rankingData);
      setPlayers(playersData);
      setMatches(matchesData.items);
      setTotalMatches(matchesData.total);
    } catch (error) {
      console.error("Erro ao carregar feed:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const leader = ranking[0] ?? null;
  const topAdr = useMemo(() => getBestBy(ranking, "adr"), [ranking]);
  const topUtility = useMemo(() => getBestBy(ranking, "score_utility"), [ranking]);
  const topFrag = useMemo(() => getBestBy(ranking, "kills"), [ranking]);
  const topDuel = useMemo(() => getBestBy(ranking, "score_duel"), [ranking]);
  const topPlayers = ranking.slice(0, 6);

  return (
    <div className="ig-page ef-social-app">
      <Navbar />

      <main className="ig-layout ef-feed-layout">
        <section className="ig-feed-column">
          <header className="ig-mobile-header">
            <div className="ig-mobile-logo">EF</div>
            <strong>EverestFrags</strong>
            {!player && <Link to="/login">Entrar</Link>}
          </header>

          <section className="ig-feed-topbar ef-feed-topbar">
            <div>
              <span>Feed do squad</span>
              <h1>{player ? `Boa, ${displayNameOf(player)}` : "EverestFrags"}</h1>
            </div>

            {ranking.length >= 2 && (
              <button type="button" onClick={() => setComparing(true)}>
                Comparar
              </button>
            )}
          </section>

          {loading ? (
            <div className="ig-loading-card">
              <div className="ig-loader" />
              <p>Carregando o feed da comunidade...</p>
            </div>
          ) : (
            <>
              <section className="ig-composer ef-quick-panel">
                <div className="ig-composer-left">
                  <Avatar avatarUrl={player?.avatar_url} initials={player?.avatar_initials} nickname={player ? displayNameOf(player) : "Visitante"} size="sm" shape="squircle" />
                  <div>
                    <strong>{ranking.length > 0 ? "Escolha o que quer acompanhar" : "O feed aparece conforme o grupo joga"}</strong>
                    <span>
                      {ranking.length > 0
                        ? "Partidas recentes, ranking, comparações e sorteio ficam a um clique."
                        : "Quando o backend estiver com partidas, os posts entram aqui automaticamente."}
                    </span>
                  </div>
                </div>

                <div className="ig-composer-actions">
                  <Link to="/matches">Partidas</Link>
                  <Link to="/ranking">Ranking</Link>
                  <Link to="/sort">Times</Link>
                  {isAdmin && <Link to="/matches/new">Nova partida</Link>}
                </div>
              </section>

              <div className="ig-post-stack">
                {matches.map(match => <MatchPost key={match.id} match={match} />)}

                {leader && (
                  <RankingPost
                    entry={leader}
                    title="lidera o Everest agora"
                    text={`#1 do squad com ${score(leader.score_final)} pontos, ${leader.total_matches} partidas e K/D ${number(leader.kd_ratio, 2)}.`}
                    onOpen={() => setSelectedEntry(leader)}
                  />
                )}

                {topAdr && topAdr.player_id !== leader?.player_id && (
                  <RankingPost
                    entry={topAdr}
                    title="está causando mais dano"
                    text={`${entryName(topAdr)} aparece com ${number(topAdr.adr)} de ADR médio.`}
                    onOpen={() => setSelectedEntry(topAdr)}
                  />
                )}

                {topDuel && topDuel.player_id !== leader?.player_id && topDuel.player_id !== topAdr?.player_id && (
                  <RankingPost
                    entry={topDuel}
                    title="está forte nos duelos"
                    text={`Duel score ${score(topDuel.score_duel)} com destaque nas entradas e trocas.`}
                    onOpen={() => setSelectedEntry(topDuel)}
                  />
                )}

                {matches.length === 0 && (
                  <article className="ig-post ig-empty-post ef-feed-post">
                    <div className="ig-empty-icon">🎮</div>
                    <h2>Nenhuma partida no feed ainda</h2>
                    <p>
                      Assim que uma partida for cadastrada ou uma demo for importada, ela aparece aqui como uma publicação.
                    </p>
                    <div className="ig-empty-actions">
                      <Link to="/matches">Ver histórico</Link>
                      {isAdmin && <Link to="/matches/new">Cadastrar partida</Link>}
                    </div>
                  </article>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="ig-right-column ef-right-column">
          <section className="ig-panel ig-profile-panel">
            <div className="ig-panel-header">
              <span>Comunidade</span>
              <strong>{players.length} players</strong>
            </div>
            <div className="ig-profile-stats">
              <MetricChip label="Partidas" value={totalMatches} />
              <MetricChip label="Ranking" value={ranking.length} />
            </div>
          </section>

          <section className="ig-panel">
            <div className="ig-panel-title-row">
              <h2>Em alta</h2>
              <Link to="/ranking">ver tudo</Link>
            </div>

            {topPlayers.length === 0 ? (
              <p className="ig-muted-text">O ranking aparece quando houver partidas.</p>
            ) : (
              <div className="ig-mini-ranking">
                {topPlayers.map(entry => (
                  <button key={entry.player_id} type="button" onClick={() => setSelectedEntry(entry)}>
                    <span>#{entry.rank}</span>
                    <Avatar avatarUrl={entry.avatar_url} initials={entry.avatar_initials} nickname={entryName(entry)} size="sm" shape="squircle" />
                    <strong>{entryName(entry)}</strong>
                    <b>{score(entry.score_final)}</b>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="ig-panel">
            <div className="ig-panel-title-row">
              <h2>Destaques</h2>
            </div>

            <div className="ig-highlight-list">
              <div>
                <span>🔥 Fragger</span>
                <strong>{topFrag ? entryName(topFrag) : "—"}</strong>
              </div>
              <div>
                <span>💣 ADR</span>
                <strong>{topAdr ? `${entryName(topAdr)} · ${number(topAdr.adr)}` : "—"}</strong>
              </div>
              <div>
                <span>🤝 Utility</span>
                <strong>{topUtility ? entryName(topUtility) : "—"}</strong>
              </div>
            </div>
          </section>

          <section className="ig-panel ef-shortcuts-panel">
            <h2>Acesso rápido</h2>
            <Link to="/matches">Histórico de partidas</Link>
            <Link to="/ranking">Ranking completo</Link>
            <Link to="/sort">Sortear times</Link>
            {isAdmin && <Link to="/admin">Gestão</Link>}
          </section>
        </aside>
      </main>

      {selectedEntry && (
        <PlayerDetailModal
          entry={selectedEntry}
          allEntries={ranking}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {comparing && (
        <CompareModal allEntries={ranking} onClose={() => setComparing(false)} />
      )}
    </div>
  );
}
