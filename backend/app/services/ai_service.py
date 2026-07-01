"""
Service — integração com Groq (LLM free tier)

Funções:
  coach_player     → análise individual do jogador vs média do grupo + histórico W/L
  match_narrative  → resumo estilo comentarista de uma partida completa, com resultado do time
  sort_prediction  → forma recente dos jogadores selecionados para o sorteio + W/L streak
  discord_digest   → resumo semanal para postar no Discord

Provider: Groq (Llama 3.3 70B — 14.400 req/dia, $0)
Fallback: se GROQ_API_KEY não estiver configurada, retorna mensagem amigável.

Tom: coach experiente tipo FalleN — técnico, direto, caloroso. Não é um robô jogando
estatísticas na tela; é alguém que conhece o grupo e quer ver cada um evoluir de verdade.
"""

import os
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _client():
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return None
    from groq import Groq
    return Groq(api_key=key)


def _chat(system: str, user: str, max_tokens: int = 300, model: str = "llama-3.3-70b-versatile") -> Optional[str]:
    """Envia prompt para Groq e retorna o texto. None se sem chave ou erro."""
    cli = _client()
    if not cli:
        logger.warning("GROQ_API_KEY não configurada — resposta de IA indisponível")
        return None
    try:
        resp = cli.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            max_tokens=max_tokens,
            temperature=0.75,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error("Groq API error: %s", e)
        return None


# ─── System prompts — tom FalleN: técnico, caloroso, focado em evolução ───────

_SYSTEM_COACH = (
    "Você é o coach da EverestFrags, um grupo de CS2 entre amigos. "
    "Seu estilo é como o FalleN: técnico, experiente, mas caloroso como um mentor. "
    "Fale naturalmente em português do Brasil — sem ser robótico, sem citar 'dados' ou 'estatísticas' no texto. "
    "Baseie-se APENAS nos números fornecidos. "
    "Máximo 150 palavras. Sem emojis. Texto corrido, sem asteriscos nem bullets."
)

_SYSTEM_NARRATIVE = (
    "Você escreve análises pós-jogo para o grupo EverestFrags. "
    "Estilo: comentarista técnico de CS2 com o calor de um coach que conhece o grupo — "
    "como o FalleN comentando uma partida de amigos. Envolvente, mas baseado nos dados reais. "
    "Use os times e o resultado para dar contexto à análise. "
    "Português do Brasil natural. Máximo 200 palavras. Sem emojis. Texto corrido, sem asteriscos nem bullets."
)

_SYSTEM_PREDICTION = (
    "Você é o coach da EverestFrags analisando a forma dos jogadores antes de um mix. "
    "Tom: capitão experiente preparando o time — objetivo, leve, motivador, como o FalleN antes de um jogo. "
    "Use os dados de forma recente e o histórico W/L de cada um. "
    "Máximo 120 palavras. Português do Brasil. Sem emojis. Texto corrido, sem asteriscos nem bullets."
)

_SYSTEM_DIGEST = (
    "Você escreve o boletim semanal da EverestFrags. "
    "Tom: amigo que entende muito de CS2 e quer ver o grupo evoluir — caloroso, com bom humor, com análise real. "
    "Máximo 250 palavras. Português do Brasil. Sem emojis. Texto corrido, sem asteriscos nem bullets."
)


# ─── Funções públicas ──────────────────────────────────────────────────────────

def coach_player(
    nickname: str,
    stats: dict,
    group_avg: dict,
    trend_adr: str,
    best_map: str,
    worst_map: str,
    wins: int = 0,
    losses: int = 0,
    win_rate: float = 0.0,
    win_streak: int = 0,
) -> Optional[str]:
    """Análise individual: ponto forte, fraqueza, sugestão prática + contexto W/L."""

    def diff(val, avg):
        if avg == 0:
            return "+0%"
        return f"{(val - avg) / avg * 100:+.0f}%"

    total_matches = wins + losses
    if total_matches > 0:
        wl_line = f"Histórico de resultados: {wins}V / {losses}D ({win_rate:.0f}% de vitórias)"
        if win_streak >= 3:
            wl_line += f" | Em alta — sequência de {win_streak} vitórias seguidas"
        elif win_streak == 0 and losses > 0:
            wl_line += " | Vindo de derrota recente"
    else:
        wl_line = "Histórico de resultados: sem partidas com resultado registrado ainda"

    prompt = f"""Jogador: {nickname}
{wl_line}

Performance vs média do grupo:
- ADR: {stats.get('adr', 0):.1f} ({diff(stats.get('adr', 0), group_avg.get('adr', 1))})
- Opening kills/partida: {stats.get('opening_kills', 0):.1f} ({diff(stats.get('opening_kills', 0), group_avg.get('opening_kills', 1))})
- Flash assists/partida: {stats.get('flash_assists', 0):.1f} ({diff(stats.get('flash_assists', 0), group_avg.get('flash_assists', 1))})
- KAST%: {stats.get('kast_percent', 0):.0f}% ({diff(stats.get('kast_percent', 0), group_avg.get('kast_percent', 1))})
- K/D: {stats.get('kd_ratio', 0):.2f} ({diff(stats.get('kd_ratio', 0), group_avg.get('kd_ratio', 1))})
- Rating HLTV: {stats.get('hltv_rating', 0):.2f}
- Tendência ADR: {trend_adr}
- Melhor mapa: {best_map or 'poucos dados'} | Pior mapa: {worst_map or 'poucos dados'}

Como coach: aponte 1 ponto forte real, 1 área concreta para melhorar com uma dica prática, e uma observação sobre a fase atual do jogador considerando o histórico de vitórias/derrotas."""

    return _chat(_SYSTEM_COACH, prompt, max_tokens=250)


def match_narrative(
    map_name: str,
    played_at: str,
    players: list[dict],
    team_a: list[dict] | None = None,
    team_b: list[dict] | None = None,
    winner: str | None = None,
) -> Optional[str]:
    """Resumo pós-jogo de uma partida. Usa times e resultado quando disponíveis."""

    has_teams = bool(team_a and team_b)

    if has_teams:
        def team_lines(team: list[dict]) -> str:
            return "\n".join(
                f"  {p.get('player_nickname', '?')}: "
                f"{p.get('kills', 0)}K/{p.get('deaths', 0)}D/{p.get('assists', 0)}A "
                f"ADR {p.get('adr', 0):.1f} Rating {p.get('hltv_rating', 0):.2f}"
                for p in sorted(team, key=lambda p: p.get('hltv_rating', 0), reverse=True)
            )

        result_a = "VENCEDOR" if winner == "A" else "PERDEDOR"
        result_b = "VENCEDOR" if winner == "B" else "PERDEDOR"

        mvp_a = max(team_a, key=lambda p: p.get('hltv_rating', 0), default={})
        mvp_b = max(team_b, key=lambda p: p.get('hltv_rating', 0), default={})

        prompt = f"""Mapa: {map_name or 'desconhecido'} | Data: {played_at}
Resultado: Time {'A' if winner == 'A' else 'B'} venceu

Time A ({result_a}):
{team_lines(team_a)}
Destaque: {mvp_a.get('player_nickname', '?')} (Rating {mvp_a.get('hltv_rating', 0):.2f})

Time B ({result_b}):
{team_lines(team_b)}
Destaque: {mvp_b.get('player_nickname', '?')} (Rating {mvp_b.get('hltv_rating', 0):.2f})

Escreva uma análise pós-jogo: o que definiu o resultado, destaque o melhor jogador de cada time, e uma observação técnica sobre como a partida foi resolvida."""

    else:
        players_sorted = sorted(players, key=lambda p: p.get("hltv_rating", 0), reverse=True)
        mvp = players_sorted[0] if players_sorted else {}
        lines = "\n".join(
            f"  {p.get('player_nickname', '?')}: "
            f"{p.get('kills', 0)}K/{p.get('deaths', 0)}D/{p.get('assists', 0)}A "
            f"ADR {p.get('adr', 0):.1f} Rating {p.get('hltv_rating', 0):.2f}"
            for p in players_sorted
        )
        prompt = f"""Mapa: {map_name or 'desconhecido'} | Data: {played_at}
(Resultado por time não registrado)

Stats dos jogadores:
{lines}

MVP da partida: {mvp.get('player_nickname', '?')} (Rating {mvp.get('hltv_rating', 0):.2f}, ADR {mvp.get('adr', 0):.1f})

Escreva uma análise pós-jogo em 2-3 parágrafos curtos, destacando as melhores performances e pontos técnicos da partida."""

    return _chat(_SYSTEM_NARRATIVE, prompt, max_tokens=350)


def sort_prediction(players_form: list[dict]) -> Optional[str]:
    """Forma recente + W/L streak dos jogadores selecionados para o sorteio."""
    if not players_form:
        return None

    avg_rating = sum(p.get("avg_rating", 0) for p in players_form) / len(players_form)
    hot   = [p for p in players_form if p.get("avg_rating", 0) > avg_rating * 1.1]
    cold  = [p for p in players_form if p.get("avg_rating", 0) < avg_rating * 0.9]
    on_streak = [p for p in players_form if p.get("win_streak", 0) >= 2]

    def player_line(p: dict) -> str:
        wl = f"{p.get('wins', 0)}V/{p.get('losses', 0)}D"
        streak = p.get("win_streak", 0)
        streak_str = f" | {streak} vitórias seguidas" if streak >= 2 else ""
        return (
            f"  {p['nickname']}: Rating médio {p.get('avg_rating', 0):.2f}, "
            f"ADR médio {p.get('avg_adr', 0):.1f}, {wl}{streak_str}"
        )

    lines = "\n".join(player_line(p) for p in players_form)

    hot_names  = ", ".join(p["nickname"] for p in hot)  or "ninguém destacado"
    cold_names = ", ".join(p["nickname"] for p in cold) or "ninguém em queda"
    streak_names = ", ".join(p["nickname"] for p in on_streak) or "ninguém"

    prompt = f"""Jogadores confirmados para a sessão de hoje ({len(players_form)} players):
{lines}

Em alta (rating acima da média): {hot_names}
Em baixa (rating abaixo da média): {cold_names}
Em sequência de vitórias (≥2): {streak_names}

Como coach: escreva uma análise rápida da forma do dia — quem tá dominando, quem precisa se reencontrar, e o que esperar da sessão."""

    return _chat(_SYSTEM_PREDICTION, prompt, max_tokens=200)


def weekly_digest(top5: list[dict], week_matches: list[dict], best_perf: dict) -> Optional[str]:
    """Resumo semanal para o Discord."""
    top_lines = "\n".join(
        f"  #{e['rank']} {e['player_nickname']}: score {e['score_final']:.1f}"
        for e in top5
    )
    match_lines = "\n".join(
        f"  {m.get('map_name', '?')} em {m.get('played_at', '?')}"
        for m in week_matches[:5]
    )

    prompt = f"""Top 5 ranking atual da EverestFrags:
{top_lines or '  (sem dados)'}

Partidas da semana:
{match_lines or '  (nenhuma partida esta semana)'}

Melhor performance individual da semana: {best_perf.get('nickname', '?')}
Rating {best_perf.get('hltv_rating', 0):.2f}, ADR {best_perf.get('adr', 0):.1f} no {best_perf.get('map_name', '?')}

Escreva o boletim semanal do grupo — destaque o ranking atual, celebre a melhor performance da semana, e deixe uma mensagem motivacional para as próximas partidas."""

    return _chat(_SYSTEM_DIGEST, prompt, max_tokens=400)
