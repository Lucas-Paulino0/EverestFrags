"""
Service — cálculo do ranking

Implementa a fórmula de score em 3 passos:
  1. Agrega métricas de todas as partidas por jogador (soma ou média)
  2. Normaliza cada métrica com min-max dentro do grupo (0–100)
  3. Calcula score por categoria e score final ponderado por pesos fixos

Pesos fixos (WEIGHT_COMBAT/DUEL/UTILITY abaixo) — não são mais editáveis. Pesos
ajustáveis por admin foram removidos: a fração de cada categoria não tem nenhuma base
objetiva pra justificar um valor diferente de outro, e com o histórico de partidas do
grupo ainda pequeno (~10-20 partidas), tentar derivar pesos via regressão estatística
(correlacionar cada score com taxa de vitória, por exemplo) seria instável — mudaria a
cada partida nova e seria difícil de explicar pro grupo. Pesos iguais (1/3 cada) são a
opção mais justa e estável disponível: nenhuma categoria é privilegiada por decisão de
alguém, e não se move sozinha conforme mais dados entram.

Métricas de SOMA:
  kills, deaths, assists, damage_total, opening_kills, opening_deaths, trade_kills,
  trade_denials, flash_assists, grenade_damage, he_enemies_hit, fire_enemies_hit,
  fire_damage, disadvantage_kills, advantage_kills, eco_kills

Métricas de MÉDIA:
  adr, adr_difference, hltv_rating, kast_percent, time_to_kill_ms

Métricas INVERTIDAS na normalização (menor é melhor):
  deaths, time_to_kill_ms, opening_deaths

weighted_kills (Round Swing, estilo HLTV 3.0):
  Métrica derivada usada SÓ no score Combate, no lugar de "kills" puro — kills
  ajustadas pelo contexto da rodada, ANTES da normalização:
    weighted_kills = kills - eco_kills*0.5 + disadvantage_kills*0.3 - advantage_kills*0.2
  Ou seja: kill contra eco vale 0.5x, kill em desvantagem numérica vale 1.3x,
  kill em vantagem numérica vale 0.8x. "kills" puro continua sendo o que aparece
  no ranking pro usuário (K/D, etc.) — só o score Combate usa o valor ajustado.
"""

from typing import List, Dict, Any
from sqlalchemy.orm import Session

from app.models.match import PlayerMatchStats, Match
from app.models.player import Player
from app.schemas.ranking import RankingEntry, GroupAveragesResponse

# Pesos fixos das 3 categorias no score final — ver docstring do módulo.
# Em teste: 30/36/34 (era 33/33/33).
WEIGHT_COMBAT = 0.30
WEIGHT_DUEL = 0.36
WEIGHT_UTILITY = 0.34


# Métricas de soma — agregadas somando valores de todas as partidas
SOMA_METRICS = [
    "kills", "deaths", "assists", "damage_total",
    "opening_kills", "opening_deaths", "trade_kills", "trade_denials", "mvps",
    "flash_assists", "grenade_damage", "he_enemies_hit", "fire_enemies_hit", "fire_damage",
    "disadvantage_kills", "advantage_kills", "eco_kills",
]

# Métricas de média — agregadas tirando média entre partidas
MEDIA_METRICS = [
    "adr", "adr_difference", "hltv_rating", "kast_percent", "time_to_kill_ms",
]

# Métricas onde MENOR é melhor — normalizadas de forma invertida
INVERTED_METRICS = {"deaths", "time_to_kill_ms", "opening_deaths"}

# Agrupamento por categoria para cálculo do score parcial
# weighted_kills substitui "kills" puro — ver docstring do módulo (Round Swing).
COMBAT_METRICS = [
    "weighted_kills", "deaths", "assists", "damage_total",
    "adr", "adr_difference", "hltv_rating", "kast_percent", "grenade_damage",
]
DUEL_METRICS = ["opening_kills", "opening_deaths", "trade_kills", "trade_denials", "time_to_kill_ms"]
UTILITY_METRICS = ["flash_assists", "grenade_damage", "he_enemies_hit", "fire_enemies_hit", "fire_damage"]


_XP_LEVELS = [
    (9000, "Imortal"),
    (5500, "Lenda"),
    (3500, "Atirador"),
    (2000, "Elite"),
    (1000, "Veterano"),
    (500,  "Soldado"),
    (0,    "Recruta"),
]


def _calc_xp(kills: int, assists: int, opening_kills: int, trade_kills: int,
             flash_assists: int, mvps: int, total_matches: int, hltv_rating: float) -> int:
    """XP on-the-fly — retroativo, sem coluna no banco."""
    xp = (kills * 10 + assists * 5 + opening_kills * 20
          + trade_kills * 10 + flash_assists * 5 + mvps * 15)
    # Bônus por partida jogada (presença = 50 XP)
    xp += total_matches * 50
    # Bônus de rating médio (por partida)
    if hltv_rating >= 1.4:
        xp += total_matches * 25
    elif hltv_rating >= 1.2:
        xp += total_matches * 15
    elif hltv_rating >= 1.0:
        xp += total_matches * 5
    return int(xp)


def _xp_to_level(xp: int) -> str:
    for threshold, name in _XP_LEVELS:
        if xp >= threshold:
            return name
    return "Recruta"


def _normalize(value: float, min_val: float, max_val: float, inverted: bool = False) -> float:
    """
    Normalização min-max para o intervalo [0, 100].
    Se todos os valores são iguais (max == min), retorna 50 para todos.
    """
    if max_val == min_val:
        return 50.0
    normalized = (value - min_val) / (max_val - min_val) * 100.0
    return (100.0 - normalized) if inverted else normalized


def _score_category(normalized: Dict[str, float], metrics: List[str]) -> float:
    """Calcula o score de uma categoria como média simples das métricas normalizadas."""
    values = [normalized[m] for m in metrics if m in normalized]
    if not values:
        return 0.0
    return sum(values) / len(values)


def get_ranking(db: Session) -> List[RankingEntry]:
    """
    Calcula e retorna o ranking completo de todos os players com ao menos 1 partida.

    Passos:
      1. Agrega stats por player (soma/média conforme a métrica)
      2. Normaliza cada métrica dentro do grupo
      3. Calcula scores por categoria e score final (pesos fixos, ver topo do módulo)
      4. Ordena por score_final DESC e atribui posições
    """
    # Passo 1 — agrega stats por player
    stats_rows = (
        db.query(PlayerMatchStats)
        .join(Player)
        .filter(Player.is_active == True)  # noqa: E712
        .all()
    )

    if not stats_rows:
        return []

    # Agrupa por player_id
    raw: Dict[int, Dict[str, Any]] = {}
    for row in stats_rows:
        pid = row.player_id
        if pid not in raw:
            raw[pid] = {
                "player": row.player,
                "match_count": 0,
                **{m: 0 for m in SOMA_METRICS},
                **{m: [] for m in MEDIA_METRICS},
            }
        raw[pid]["match_count"] += 1
        for m in SOMA_METRICS:
            raw[pid][m] += getattr(row, m)
        for m in MEDIA_METRICS:
            raw[pid][m].append(float(getattr(row, m)))

    # Finaliza médias
    players_data: List[Dict[str, Any]] = []
    for pid, d in raw.items():
        aggregated = {**d}
        for m in MEDIA_METRICS:
            vals = d[m]
            aggregated[m] = sum(vals) / len(vals) if vals else 0.0

        # weighted_kills — ajusta o valor da kill pelo contexto da rodada (Round Swing)
        aggregated["weighted_kills"] = max(
            aggregated["kills"]
            - aggregated["eco_kills"] * 0.5
            + aggregated["disadvantage_kills"] * 0.3
            - aggregated["advantage_kills"] * 0.2,
            0.0,
        )
        # Taxa por partida — neutraliza viés de volume: jogador com 10 partidas
        # não pontua mais que um com 3 só por ter acumulado mais eventos.
        # Soma metrics viram "por partida"; média metrics já são naturalmente neutras.
        mc = max(aggregated["match_count"], 1)
        aggregated["score_rate"] = {m: aggregated[m] / mc for m in SOMA_METRICS}
        aggregated["score_rate"]["weighted_kills"] = aggregated["weighted_kills"] / mc
        for m in MEDIA_METRICS:
            aggregated["score_rate"][m] = aggregated[m]
        players_data.append(aggregated)

    # Passo 2 — normaliza cada métrica
    all_metrics = SOMA_METRICS + MEDIA_METRICS + ["weighted_kills"]
    min_max: Dict[str, tuple] = {}
    for m in all_metrics:
        vals = [p["score_rate"][m] for p in players_data]
        min_max[m] = (min(vals), max(vals))

    for p in players_data:
        p["normalized"] = {}
        for m in all_metrics:
            mn, mx = min_max[m]
            p["normalized"][m] = _normalize(p["score_rate"][m], mn, mx, inverted=(m in INVERTED_METRICS))

    # Passo 3 — calcula scores
    for p in players_data:
        norm = p["normalized"]
        p["score_combat"] = _score_category(norm, COMBAT_METRICS)
        p["score_duel"] = _score_category(norm, DUEL_METRICS)
        p["score_utility"] = _score_category(norm, UTILITY_METRICS)
        p["score_final"] = (
            p["score_combat"] * WEIGHT_COMBAT
            + p["score_duel"] * WEIGHT_DUEL
            + p["score_utility"] * WEIGHT_UTILITY
        )

    # Passo 4 — ordena e gera ranking
    players_data.sort(key=lambda x: x["score_final"], reverse=True)

    result = []
    for rank, p in enumerate(players_data, start=1):
        player = p["player"]
        deaths = p["deaths"] or 1  # evita divisão por zero no K/D
        result.append(
            RankingEntry(
                rank=rank,
                player_id=player.id,
                player_nickname=player.nickname,
                player_display_name=player.display_name,
                avatar_initials=player.avatar_initials,
                avatar_url=player.avatar_url,
                total_matches=p["match_count"],
                kills=p["kills"],
                deaths=p["deaths"],
                assists=p["assists"],
                damage_total=p["damage_total"],
                opening_kills=p["opening_kills"],
                opening_deaths=p["opening_deaths"],
                trade_kills=p["trade_kills"],
                trade_denials=p["trade_denials"],
                mvps=p["mvps"],
                flash_assists=p["flash_assists"],
                grenade_damage=p["grenade_damage"],
                he_enemies_hit=p["he_enemies_hit"],
                fire_enemies_hit=p["fire_enemies_hit"],
                fire_damage=p["fire_damage"],
                disadvantage_kills=p["disadvantage_kills"],
                advantage_kills=p["advantage_kills"],
                eco_kills=p["eco_kills"],
                kd_ratio=round(p["kills"] / deaths, 2),
                adr=round(p["adr"], 2),
                adr_difference=round(p["adr_difference"], 2),
                hltv_rating=round(p["hltv_rating"], 3),
                kast_percent=round(p["kast_percent"], 2),
                time_to_kill_ms=round(p["time_to_kill_ms"], 1),
                score_combat=round(p["score_combat"], 1),
                score_duel=round(p["score_duel"], 1),
                score_utility=round(p["score_utility"], 1),
                score_final=round(p["score_final"], 1),
                xp_total=_calc_xp(
                    kills=p["kills"], assists=p["assists"],
                    opening_kills=p["opening_kills"], trade_kills=p["trade_kills"],
                    flash_assists=p["flash_assists"], mvps=p["mvps"],
                    total_matches=p["match_count"], hltv_rating=round(p["hltv_rating"], 3),
                ),
                level_name=_xp_to_level(_calc_xp(
                    kills=p["kills"], assists=p["assists"],
                    opening_kills=p["opening_kills"], trade_kills=p["trade_kills"],
                    flash_assists=p["flash_assists"], mvps=p["mvps"],
                    total_matches=p["match_count"], hltv_rating=round(p["hltv_rating"], 3),
                )),
            )
        )
    return result


def get_player_match_history(db: Session, player_id: int) -> list:
    """
    Retorna stats por partida de um jogador em ordem cronológica.
    Usado para o gráfico de evolução histórica no perfil.
    """
    from sqlalchemy.orm import joinedload

    rows = (
        db.query(PlayerMatchStats)
        .options(joinedload(PlayerMatchStats.match))
        .filter(PlayerMatchStats.player_id == player_id)
        .join(Match, PlayerMatchStats.match_id == Match.id)
        .order_by(Match.played_at.asc(), Match.id.asc())
        .all()
    )
    return [
        {
            "match_id": row.match_id,
            "played_at": str(row.match.played_at),
            "map_name": row.match.map_name,
            "kills": row.kills,
            "deaths": row.deaths,
            "assists": row.assists,
            "adr": float(row.adr),
            "hltv_rating": float(row.hltv_rating),
            "kast_percent": float(row.kast_percent),
        }
        for row in rows
    ]


def get_player_stats(db: Session, player_id: int) -> Dict[str, Any]:
    """
    Retorna métricas brutas + scores de um jogador específico.
    Usa o mesmo ranking completo e filtra pelo player_id.
    Retorna None se o player não tiver partidas.
    """
    ranking = get_ranking(db)
    for entry in ranking:
        if entry.player_id == player_id:
            return entry
    return None


def get_group_averages(db: Session) -> GroupAveragesResponse:
    """
    Médias da EverestFrags — um número por métrica representando o grupo todo,
    não por jogador. Cada valor é a média entre TODAS as linhas de
    player_match_stats (1 linha = 1 jogador em 1 partida), não a média dos
    totais agregados por jogador (get_ranking) — isso evita que quem jogou
    mais partidas pese diferente de quem jogou menos: cada partida individual
    de cada jogador conta como 1 amostra, com o mesmo peso.
    """
    rows = (
        db.query(PlayerMatchStats)
        .join(Player)
        .filter(Player.is_active == True)  # noqa: E712
        .all()
    )

    if not rows:
        return GroupAveragesResponse()

    total_entries = len(rows)
    metrics = SOMA_METRICS + MEDIA_METRICS
    averages = {m: sum(float(getattr(r, m)) for r in rows) / total_entries for m in metrics}

    return GroupAveragesResponse(
        total_matches=len({r.match_id for r in rows}),
        total_player_entries=total_entries,
        **{m: round(v, 2) for m, v in averages.items()},
    )
