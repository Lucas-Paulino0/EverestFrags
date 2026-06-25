"""
demo_service — parse leve de .dem do CS2

Estratégia de memória:
  1. Salva bytes em arquivo temporário
  2. Parseia APENAS os eventos necessários (player_death, player_hurt, round_end, player_blind)
  3. Deleta o arquivo temporário imediatamente após o parse dos eventos
  4. Agrega métricas em memória (dicts leves, sem DataFrames)
  5. Retorna apenas as stats computadas

NÃO usa parse_ticks() — evita carregar todos os snapshots do demo em memória.
"""

import os
import tempfile
from typing import Any

TRADE_WINDOW_TICKS = 5 * 128   # 5 segundos a 128 tick
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
        kills_df = hurt_df = rounds_df = flash_df = None

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
            flash_df = parser.parse_event("player_blind", player=["team_num", "steamid"])
        except Exception as e:
            errors.append(f"Eventos de flash indisponíveis: {e}")

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

    total_rounds = 1
    if rounds_df is not None and not rounds_df.empty:
        total_rounds = max(len(rounds_df), 1)
    del rounds_df

    flash_by_attacker: dict[str, int] = {}
    if flash_df is not None and not flash_df.empty:
        cols = flash_df.columns if hasattr(flash_df, "columns") else []
        if "attacker_name" in cols:
            for row in flash_df.to_dicts() if hasattr(flash_df, "to_dicts") else flash_df.to_dict("records"):
                atk = _key(_s(row.get("attacker_steamid")), _s(row.get("attacker_name")))
                if atk:
                    flash_by_attacker[atk] = flash_by_attacker.get(atk, 0) + 1
    del flash_df

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
    recent_kills: list[tuple] = []  # (tick, victim_team, attacker_name)

    for k in kills:
        atk, vic = k["attacker"], k["victim"]
        rnd, tick = k["round"], k["tick"]

        if atk and atk in stats and atk != vic:
            stats[atk]["kills"] += 1
            stats[atk]["_ttk_ticks"].append(tick)

        if vic and vic in stats:
            stats[vic]["deaths"] += 1

        if k["assister"] and k["assister"] in stats:
            stats[k["assister"]]["assists"] += 1

        # Opening kills
        if rnd >= 0 and rnd not in seen_opening_rounds:
            seen_opening_rounds.add(rnd)
            if atk and atk in stats and atk != vic:
                stats[atk]["opening_kills"] += 1

        # Trade kills — verifica se victim matou alguém do time do attacker recentemente
        atk_team = k["atk_team"]
        if atk and atk in stats and atk != vic:
            for (prev_tick, prev_vic_team, prev_atk) in reversed(recent_kills[-30:]):
                if (prev_atk == vic and
                        atk_team is not None and prev_vic_team == atk_team and
                        0 < tick - prev_tick <= TRADE_WINDOW_TICKS):
                    stats[atk]["trade_kills"] += 1
                    break

        # Trade denials — attacker matou inimigo que ia tradar
        vic_team = k["vic_team"]
        for (prev_tick, prev_vic_team, prev_atk) in reversed(recent_kills[-30:]):
            if (prev_atk and prev_atk in stats and
                    vic_team is not None and prev_vic_team != vic_team and
                    atk_team == prev_vic_team and
                    0 < tick - prev_tick <= TRADE_WINDOW_TICKS):
                stats[atk]["trade_denials"] += 1
                break

        recent_kills.append((tick, vic_team, atk))

    del kills, recent_kills, seen_opening_rounds

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
    for s in stats.values():
        k = s["kills"]
        d = max(s["deaths"], 1)
        adr = s["adr"]
        kast = 50.0  # sem parse_ticks não dá para calcular exato
        s["kast_percent"] = kast
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
