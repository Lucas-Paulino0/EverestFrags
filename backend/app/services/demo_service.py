"""
demo_service — parse leve de .dem do CS2

Estratégia de memória:
  1. Salva bytes em arquivo temporário
  2. Parseia APENAS os eventos necessários (player_death, player_hurt, round_end,
     player_blind, item_purchase)
  3. Deleta o arquivo temporário imediatamente após o parse dos eventos
  4. Agrega métricas em memória (dicts leves, sem DataFrames)
  5. Retorna apenas as stats computadas

NÃO usa parse_ticks() — evita carregar todos os snapshots do demo em memória.
disadvantage_kills/advantage_kills/eco_kills/kast_percent também NÃO precisam de
parse_ticks: contagem de vivos por time e gasto por round são derivados só dos
eventos já parseados (player_death + item_purchase), em ordem cronológica de tick.
"""

import os
import tempfile
from typing import Any

TRADE_WINDOW_TICKS = 5 * 128   # 5 segundos a 128 tick
FLASH_WINDOW_TICKS = 3 * 128   # 3 segundos — janela para flash assist
ECO_THRESHOLD      = 1000       # equipamento < $1000 = eco round


def _s(val) -> str:
    """Converte valor do DataFrame para str limpa. Trata None, NaN (float) e números."""
    if val is None:
        return ""
    if isinstance(val, float):
        return ""  # NaN ou qualquer float no lugar de nome
    s = str(val).strip()
    return s


def parse_demo(dem_bytes: bytes) -> dict[str, Any]:
    try:
        from demoparser2 import DemoParser
    except ImportError:
        raise RuntimeError("demoparser2 não está instalado no servidor")

    errors: list[str] = []

    # ── 1. Grava temporário ────────────────────────────────────────────────────
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".dem")
    try:
        os.write(tmp_fd, dem_bytes)
        os.close(tmp_fd)

        parser = DemoParser(tmp_path)

        # ── 2. Header (mapa) ──────────────────────────────────────────────────
        map_name: str | None = None
        try:
            header = parser.parse_header()
            map_name = (header.get("map_name") or "").strip() or None
        except Exception:
            errors.append("Não foi possível ler o mapa do header.")

        # ── 3. Parseia apenas os eventos necessários ───────────────────────────
        kills_df = hurt_df = rounds_df = flash_df = purchase_df = None

        try:
            kills_df = parser.parse_event(
                "player_death",
                player=["team_num", "steamid"],
                other=["total_rounds_played"],
            )
        except Exception as e:
            raise RuntimeError(f"Falha ao ler kills do demo: {e}")

        try:
            hurt_df = parser.parse_event("player_hurt", player=["team_num", "steamid"])
        except Exception as e:
            errors.append(f"Eventos de dano indisponíveis: {e}")

        try:
            rounds_df = parser.parse_event("round_end")
        except Exception as e:
            errors.append(f"Eventos de round indisponíveis: {e}")

        try:
            flash_df = parser.parse_event(
                "player_blind",
                player=["team_num", "steamid"],
                other=["attacker_steamid", "attacker_name"],
            )
        except Exception as e:
            errors.append(f"Eventos de flash indisponíveis: {e}")

        try:
            purchase_df = parser.parse_event("item_purchase", other=["total_rounds_played"])
        except Exception as e:
            errors.append(f"Eventos de compra indisponíveis: {e}")

    finally:
        # ── 3b. Descarta o arquivo imediatamente ──────────────────────────────
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    # ─────────────────────────────────────────────────────────────────────────
    # A partir daqui: apenas dicts leves, sem DemoParser em memória
    # ─────────────────────────────────────────────────────────────────────────

    # ── 4. Normaliza kills para lista de dicts ────────────────────────────────
    # Jogadores são identificados por steamid (estável) — o nick é só para exibição,
    # já que pode mudar entre partidas ou colidir entre contas diferentes.
    nicknames: dict[str, str] = {}  # steamid -> último nick visto

    def _key(steamid: str, name: str) -> str:
        """Usa steamid como identidade; sem steamid (bot/anônimo), cai pro nome."""
        if steamid:
            if name:
                nicknames[steamid] = name
            return steamid
        return name

    kills: list[dict] = []
    if kills_df is not None and not kills_df.empty:
        for row in kills_df.to_dicts() if hasattr(kills_df, "to_dicts") else kills_df.to_dict("records"):
            atk_name = _s(row.get("attacker_name"))
            vic_name = _s(row.get("user_name"))
            asst_name = _s(row.get("assister_name"))
            atk_steamid = _s(row.get("attacker_steamid"))
            vic_steamid = _s(row.get("user_steamid"))
            asst_steamid = _s(row.get("assister_steamid"))
            kills.append({
                "tick":         row.get("tick") or 0,
                "attacker":     _key(atk_steamid, atk_name),
                "victim":       _key(vic_steamid, vic_name),
                "assister":     _key(asst_steamid, asst_name),
                "atk_team":     row.get("attacker_X_team_num") or row.get("attacker_team_num"),
                "vic_team":     row.get("user_X_team_num") or row.get("user_team_num"),
                "round":        row.get("total_rounds_played") or -1,
            })
    del kills_df

    hurt: list[dict] = []
    if hurt_df is not None and not hurt_df.empty:
        for row in hurt_df.to_dicts() if hasattr(hurt_df, "to_dicts") else hurt_df.to_dict("records"):
            atk_name = _s(row.get("attacker_name"))
            atk = _key(_s(row.get("attacker_steamid")), atk_name)
            dmg = row.get("dmg_health") or 0
            weapon = _s(row.get("weapon")).lower()
            if atk and dmg:
                hurt.append({"attacker": atk, "dmg": int(dmg), "weapon": weapon})
    del hurt_df

    # total_rounds via contagem de round_end — mas o round_end do ÚLTIMO round às vezes
    # não é capturado (demo termina logo após o kill decisivo, antes do evento disparar).
    # Sem isso, total_rounds fica menor que o maior índice de round visto nas kills, e
    # kast_percent (e adr) ficam inflados acima de 100% — usa o maior dos dois.
    total_rounds = 1
    if rounds_df is not None and not rounds_df.empty:
        total_rounds = max(len(rounds_df), 1)
    del rounds_df

    max_kill_round = max((k["round"] for k in kills if k["round"] is not None and k["round"] >= 0), default=-1)
    total_rounds = max(total_rounds, max_kill_round + 1)

    # Constrói lista de cegadas para cruzar com kills depois.
    # flash_by_attacker é calculado APÓS o loop de kills, quando a lista kills está completa.
    flash_events: list[dict] = []
    if flash_df is not None and not flash_df.empty:
        for row in flash_df.to_dicts() if hasattr(flash_df, "to_dicts") else flash_df.to_dict("records"):
            atk_sid  = _s(row.get("attacker_steamid"))
            atk_name = _s(row.get("attacker_name"))
            atk      = _key(atk_sid, atk_name) if (atk_sid or atk_name) else None
            vic_sid  = _s(row.get("user_X_steamid") or row.get("user_steamid") or "")
            vic_name = _s(row.get("user_name") or "")
            vic      = _key(vic_sid, vic_name) if (vic_sid or vic_name) else None
            atk_team = row.get("attacker_X_team_num") or row.get("attacker_team_num")
            vic_team = row.get("user_X_team_num") or row.get("user_team_num")
            tick     = row.get("tick") or 0
            if atk and vic and atk_team is not None and vic_team is not None:
                flash_events.append({
                    "tick": tick, "attacker": atk, "victim": vic,
                    "attacker_team": atk_team, "victim_team": vic_team,
                })
    del flash_df

    # Gasto por round (steamid -> valor comprado naquele round) — usado pra eco_kills.
    # Só conta compras NOVAS no round; não reflete equipamento já carregado de rounds
    # anteriores (ex: AWP comprada e mantida) — aproximação, não é o valor exato do loadout.
    round_spend: dict[int, dict[str, int]] = {}
    if purchase_df is not None and not purchase_df.empty:
        for row in purchase_df.to_dicts() if hasattr(purchase_df, "to_dicts") else purchase_df.to_dict("records"):
            steamid = _s(row.get("steamid"))
            cost = row.get("cost") or 0
            rnd = row.get("total_rounds_played")
            if steamid and cost and rnd is not None:
                bucket = round_spend.setdefault(rnd, {})
                bucket[steamid] = bucket.get(steamid, 0) + int(cost)
    del purchase_df

    # Effective spend por round — corrige viés de equipamento carregado entre rounds.
    # round_spend só conta compras NOVAS do round; jogador que sobreviveu com AWP do
    # round anterior aparecia como eco (spend=$0) por não ter comprado nada.
    # OPÇÃO B: demoparser2 não expõe inventory_value via parse_event (exigiria
    # parse_ticks, intencionalmente evitado). Estimamos propagando o gasto acumulado
    # desde a última morte — sobreviventes carregam o effective_spend para o próximo round.
    deaths_by_round: dict[int, set[str]] = {}
    for k in kills:
        if k["victim"]:
            deaths_by_round.setdefault(k["round"], set()).add(k["victim"])

    effective_spend: dict[int, dict[str, int]] = {}
    carried: dict[str, int] = {}
    max_rnd = max((k["round"] for k in kills if k["round"] is not None and k["round"] >= 0), default=0)
    for rnd in range(max_rnd + 1):
        buys = round_spend.get(rnd, {})
        rnd_players = set(buys.keys()) | set(carried.keys())
        effective_spend[rnd] = {p: max(buys.get(p, 0), carried.get(p, 0)) for p in rnd_players}
        died_this = deaths_by_round.get(rnd, set())
        carried = {p: v for p, v in effective_spend[rnd].items() if p not in died_this}
    del deaths_by_round, carried

    # ── 5. Coleta identidades únicas ──────────────────────────────────────────
    player_keys: set[str] = set()
    for k in kills:
        if k["attacker"]: player_keys.add(k["attacker"])
        if k["victim"]:   player_keys.add(k["victim"])
    for h in hurt:
        if h["attacker"]: player_keys.add(h["attacker"])

    if not player_keys:
        raise RuntimeError("Nenhum player encontrado no demo.")

    stats: dict[str, dict] = {
        key: _empty(nickname=nicknames.get(key, key), steam_id=key if key in nicknames else "")
        for key in player_keys
    }

    # ── 6. Agrega métricas ────────────────────────────────────────────────────
    seen_opening_rounds: set = set()
    recent_kills: list[dict] = []  # últimos kills (tick, atk_team, vic_team, atk, vic)

    # Estimativa do tamanho de cada time — usado só pra classificar advantage/
    # disadvantage kills. Assume times parelhos (mix 5v5 padrão do grupo).
    team_size = max(1, (len(player_keys) + 1) // 2)
    alive: dict[int, int] = {}
    current_round: int | None = None

    died_rounds: dict[str, set] = {}    # player -> rounds em que morreu
    kast_rounds: dict[str, set] = {}    # player -> rounds com K, A ou Trade

    for k in kills:
        atk, vic = k["attacker"], k["victim"]
        rnd, tick = k["round"], k["tick"]
        atk_team, vic_team = k["atk_team"], k["vic_team"]

        if rnd != current_round:
            current_round = rnd
            alive = {}

        if atk and atk in stats and atk != vic:
            stats[atk]["kills"] += 1
            stats[atk]["_ttk_ticks"].append(tick)
            kast_rounds.setdefault(atk, set()).add(rnd)

        if vic and vic in stats:
            stats[vic]["deaths"] += 1
            died_rounds.setdefault(vic, set()).add(rnd)

        if k["assister"] and k["assister"] in stats:
            stats[k["assister"]]["assists"] += 1
            kast_rounds.setdefault(k["assister"], set()).add(rnd)

        # Vantagem numérica / eco — contagem de vivos por time antes desse kill
        if atk and atk in stats and atk != vic and atk_team is not None and vic_team is not None and atk_team != vic_team:
            alive.setdefault(atk_team, team_size)
            alive.setdefault(vic_team, team_size)
            if alive[atk_team] < alive[vic_team]:
                stats[atk]["disadvantage_kills"] += 1
            elif alive[atk_team] > alive[vic_team]:
                stats[atk]["advantage_kills"] += 1

            vic_spend = effective_spend.get(rnd, {}).get(vic, 0)
            if vic_spend < ECO_THRESHOLD:
                stats[atk]["eco_kills"] += 1

        if vic_team is not None:
            alive[vic_team] = max(alive.get(vic_team, team_size) - 1, 0)

        # Opening kills
        if rnd >= 0 and rnd not in seen_opening_rounds:
            seen_opening_rounds.add(rnd)
            if atk and atk in stats and atk != vic:
                stats[atk]["opening_kills"] += 1

        # Trade kills — verifica se victim matou alguém do time do attacker recentemente
        if atk and atk in stats and atk != vic:
            for prev in reversed(recent_kills[-30:]):
                if (prev["atk"] == vic and
                        atk_team is not None and prev["vic_team"] == atk_team and
                        0 < tick - prev["tick"] <= TRADE_WINDOW_TICKS):
                    stats[atk]["trade_kills"] += 1
                    # quem morreu naquele kill anterior foi "vingado" — conta pro KAST
                    if prev["vic"] in stats:
                        kast_rounds.setdefault(prev["vic"], set()).add(rnd)
                    break

        # Trade denials — attacker matou inimigo que ia tradar
        for prev in reversed(recent_kills[-30:]):
            if (prev["atk"] and prev["atk"] in stats and
                    vic_team is not None and prev["vic_team"] != vic_team and
                    atk_team == prev["vic_team"] and
                    0 < tick - prev["tick"] <= TRADE_WINDOW_TICKS):
                stats[atk]["trade_denials"] += 1
                break

        recent_kills.append({"tick": tick, "atk_team": atk_team, "vic_team": vic_team, "atk": atk, "vic": vic})

    # Sobreviveu = não morreu naquele round — conta pro KAST de todo round jogado
    for player in stats:
        for r in range(total_rounds):
            if r not in died_rounds.get(player, set()):
                kast_rounds.setdefault(player, set()).add(r)

    # Flash assists reais: cegou inimigo que foi morto por aliado dentro de FLASH_WINDOW_TICKS.
    # Requer a lista kills completa — calculado aqui, antes do del kills.
    flash_by_attacker: dict[str, int] = {}
    for blind in flash_events:
        if blind["attacker_team"] == blind["victim_team"]:
            continue  # team flash — não conta
        for k in kills:
            if (k["victim"] == blind["victim"] and
                    k["atk_team"] == blind["attacker_team"] and
                    0 <= k["tick"] - blind["tick"] <= FLASH_WINDOW_TICKS):
                flash_by_attacker[blind["attacker"]] = flash_by_attacker.get(blind["attacker"], 0) + 1
                break
    del flash_events, kills, recent_kills, seen_opening_rounds, died_rounds, alive, round_spend, effective_spend

    # Dano / ADR / Weapon stats
    dmg_totals: dict[str, int] = {}
    for h in hurt:
        atk = h["attacker"]
        dmg = h["dmg"]
        weapon = h.get("weapon", "")
        dmg_totals[atk] = dmg_totals.get(atk, 0) + dmg
        if atk in stats:
            if "hegrenade" in weapon:
                stats[atk]["grenade_damage"] += dmg
                stats[atk]["he_enemies_hit"] += 1
            elif "inferno" in weapon or "molotov" in weapon or "incgrenade" in weapon:
                stats[atk]["fire_enemies_hit"] += 1
    del hurt

    for name, dmg in dmg_totals.items():
        if name in stats:
            stats[name]["damage_total"] = dmg
            stats[name]["adr"] = round(dmg / total_rounds, 1)
    del dmg_totals

    # adr_difference = ADR do jogador - ADR médio da partida
    all_adrs = [s["adr"] for s in stats.values()]
    mean_adr = sum(all_adrs) / len(all_adrs) if all_adrs else 0.0
    for s in stats.values():
        s["adr_difference"] = round(s["adr"] - mean_adr, 1)

    # Flash assists
    for name, cnt in flash_by_attacker.items():
        if name in stats:
            stats[name]["flash_assists"] = cnt
    del flash_by_attacker

    # ── 7. Métricas derivadas ─────────────────────────────────────────────────
    for player_key, s in stats.items():
        k = s["kills"]
        d = max(s["deaths"], 1)
        adr = s["adr"]
        # KAST = % de rounds em que o jogador teve Kill, Assist, Survived ou foi Traded
        # min(..., 100.0) é defesa extra: por definição rounds_que_contam <= total_rounds,
        # nunca deveria passar de 100, mas protege contra qualquer edge case de contagem.
        kast = min(round(len(kast_rounds.get(player_key, set())) / total_rounds * 100, 1), 100.0) if total_rounds else 0.0
        s["kast_percent"] = kast
        # ATENÇÃO: fórmula aproximada — HLTV Rating 2.0 oficial não é público.
        # Baseada em engenharia reversa documentada publicamente.
        # Resultados ficam próximos, mas podem divergir em condições extremas
        # (poucos rounds, K/D muito alto/baixo, ADR fora do padrão).
        # Ref: https://flashed.gg/posts/reverse-engineering-hltv-rating/
        s["hltv_rating"] = round(
            max(0.0073 * kast + 0.3591 * (k / total_rounds) - 0.5329 * (d / total_rounds)
                + 0.2372 * (k / d - 1) + 0.0032 * adr + 0.1587, 0.0), 2
        )

        ticks = s.pop("_ttk_ticks", [])
        if len(ticks) >= 2:
            diffs = [abs(ticks[i + 1] - ticks[i]) for i in range(len(ticks) - 1)]
            s["time_to_kill_ms"] = int(sum(diffs) / len(diffs) / 128 * 1000)

    return {
        "map_name":     map_name,
        "total_rounds": total_rounds,
        "players":      list(stats.values()),
        "errors":       errors,
    }


def _empty(nickname: str, steam_id: str) -> dict:
    return {
        "nickname":          nickname,
        "steam_id":          steam_id,
        "kills":             0,
        "deaths":            0,
        "assists":           0,
        "damage_total":      0,
        "adr":               0.0,
        "adr_difference":    0.0,
        "hltv_rating":       0.0,
        "kast_percent":      0.0,
        "opening_kills":     0,
        "trade_kills":       0,
        "trade_denials":     0,
        "time_to_kill_ms":   0,
        "flash_assists":     0,
        "grenade_damage":    0,
        "he_enemies_hit":    0,
        "fire_enemies_hit":  0,
        "disadvantage_kills":0,
        "advantage_kills":   0,
        "eco_kills":         0,
        "_ttk_ticks":        [],
    }
