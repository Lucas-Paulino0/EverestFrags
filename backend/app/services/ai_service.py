"""
Service — integração com Groq (LLM free tier)

Funções:
  coach_player     → análise individual do jogador vs média do grupo
  match_narrative  → resumo estilo comentarista de uma partida completa
  sort_prediction  → forma recente dos jogadores selecionados para o sorteio
  discord_digest   → resumo semanal para postar no Discord

Provider: Groq (Llama 3.1 70B — 14.400 req/dia, $0)
Fallback: se GROQ_API_KEY não estiver configurada, retorna mensagem amigável.
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
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error("Groq API error: %s", e)
        return None


_SYSTEM_COACH = (
    "Você é analista de CS2. Seja direto e baseado APENAS nos dados fornecidos. "
    "Máximo 150 palavras. Responda em português do Brasil sem emojis."
)

_SYSTEM_NARRATIVE = (
    "Você é um comentarista esportivo de CS2. Escreva em estilo narrativo e envolvente. "
    "Máximo 200 palavras. Português do Brasil, sem emojis, sem formatação markdown."
)

_SYSTEM_PREDICTION = (
    "Você é analista de CS2. Baseie-se APENAS nos dados de forma recente fornecidos. "
    "Máximo 120 palavras. Português do Brasil, sem emojis."
)

_SYSTEM_DIGEST = (
    "Você escreve resumos esportivos semanais de CS2 para um grupo de amigos. "
    "Tom descontraído mas baseado em dados. Máximo 250 palavras. Português do Brasil."
)


def coach_player(nickname: str, stats: dict, group_avg: dict, trend_adr: str, best_map: str, worst_map: str) -> Optional[str]:
    """Análise individual: 1 ponto forte, 1 fraqueza, 1 sugestão prática."""

    def diff(val, avg):
        if avg == 0:
            return "+0%"
        return f"{(val - avg) / avg * 100:+.0f}%"

    prompt = f"""Jogador: {nickname}

vs média do grupo:
ADR: {stats.get('adr', 0):.1f} ({diff(stats.get('adr', 0), group_avg.get('adr', 1))})
Opening kills/partida: {stats.get('opening_kills', 0)} ({diff(stats.get('opening_kills', 0), group_avg.get('opening_kills', 1))})
Flash assists/partida: {stats.get('flash_assists', 0)} ({diff(stats.get('flash_assists', 0), group_avg.get('flash_assists', 1))})
KAST%: {stats.get('kast_percent', 0):.0f}% ({diff(stats.get('kast_percent', 0), group_avg.get('kast_percent', 1))})
K/D: {stats.get('kd_ratio', 0):.2f} ({diff(stats.get('kd_ratio', 0), group_avg.get('kd_ratio', 1))})
Rating HLTV: {stats.get('hltv_rating', 0):.2f}

Tendência ADR (últimas partidas vs anteriores): {trend_adr}
Melhor mapa: {best_map or 'poucos dados'}
Pior mapa: {worst_map or 'poucos dados'}

Escreva: 1 ponto forte real, 1 fraqueza real, 1 sugestão prática."""

    return _chat(_SYSTEM_COACH, prompt, max_tokens=250)


def match_narrative(map_name: str, played_at: str, players: list[dict]) -> Optional[str]:
    """Resumo estilo comentarista de uma partida completa."""
    players_sorted = sorted(players, key=lambda p: p.get("hltv_rating", 0), reverse=True)
    mvp = players_sorted[0] if players_sorted else {}

    lines = "\n".join(
        f"  {p.get('player_nickname','?')}: {p.get('kills',0)}K/{p.get('deaths',0)}D/{p.get('assists',0)}A "
        f"ADR {p.get('adr',0):.1f} Rating {p.get('hltv_rating',0):.2f}"
        for p in players_sorted
    )

    prompt = f"""Partida: {map_name or 'mapa desconhecido'} em {played_at}

Stats dos jogadores:
{lines}

MVP aparente: {mvp.get('player_nickname','?')} (Rating {mvp.get('hltv_rating',0):.2f}, ADR {mvp.get('adr',0):.1f})

Escreva um resumo narrativo da partida em 3 parágrafos curtos."""

    return _chat(_SYSTEM_NARRATIVE, prompt, max_tokens=350)


def sort_prediction(players_form: list[dict]) -> Optional[str]:
    """Forma recente dos jogadores selecionados para o sorteio."""
    if not players_form:
        return None

    avg_rating = sum(p.get("avg_rating", 0) for p in players_form) / len(players_form)
    high = [p for p in players_form if p.get("avg_rating", 0) > avg_rating * 1.1]
    low  = [p for p in players_form if p.get("avg_rating", 0) < avg_rating * 0.9]

    lines = "\n".join(
        f"  {p['nickname']}: Rating médio {p.get('avg_rating',0):.2f}, "
        f"ADR médio {p.get('avg_adr',0):.1f}, "
        f"últimas {p.get('n_matches',0)} partidas"
        for p in players_form
    )

    prompt = f"""Jogadores presentes hoje ({len(players_form)} players):
{lines}

Em alta (acima da média): {', '.join(p['nickname'] for p in high) or 'nenhum em destaque'}
Em baixa (abaixo da média): {', '.join(p['nickname'] for p in low) or 'nenhum em queda'}

Escreva uma previsão rápida de forma para a sessão de hoje."""

    return _chat(_SYSTEM_PREDICTION, prompt, max_tokens=200)


def weekly_digest(top5: list[dict], week_matches: list[dict], best_perf: dict) -> Optional[str]:
    """Resumo semanal para o Discord."""
    top_lines = "\n".join(
        f"  #{e['rank']} {e['player_nickname']}: score {e['score_final']:.1f}"
        for e in top5
    )
    match_lines = "\n".join(
        f"  {m.get('map_name','?')} em {m.get('played_at','?')}"
        for m in week_matches[:5]
    )

    prompt = f"""Top 5 ranking atual:
{top_lines or '  (sem dados)'}

Partidas da semana:
{match_lines or '  (nenhuma partida esta semana)'}

Melhor performance da semana: {best_perf.get('nickname','?')}
(Rating {best_perf.get('hltv_rating',0):.2f}, ADR {best_perf.get('adr',0):.1f}, {best_perf.get('map_name','?')})

Escreva o digest semanal do grupo EverestFrags."""

    return _chat(_SYSTEM_DIGEST, prompt, max_tokens=400)
