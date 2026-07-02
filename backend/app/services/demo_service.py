"""
demo_service — parse leve de .dem do CS2

Estratégia:
  1. Recebe o caminho do arquivo (já salvo pelo router)
  2. Parseia APENAS os eventos necessários (player_death, player_hurt, round_end,
     player_blind, item_purchase, round_mvp)
  3. Agrega métricas em memória (dicts leves, sem DataFrames)
  4. Retorna apenas as stats computadas — não deleta o arquivo (responsabilidade do caller)

NÃO usa parse_ticks() — evita carregar todos os snapshots do demo em memória.
disadvantage_kills/advantage_kills/eco_kills/kast_percent também NÃO precisam de
parse_ticks: contagem de vivos por time e gasto por round são derivados só dos
eventos já parseados (player_death + item_purchase), em ordem cronológica de tick.
"""

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


def parse_demo(dem_path: str) -> dict[str, Any]:
    """Parseia um demo CS2 a partir de um caminho de arquivo.

    Recebe o caminho direto para evitar escrever um segundo arquivo temporário —
    o caller (demo router) já salvou o arquivo descomprimido em disco.
    O arquivo NÃO é deletado aqui; quem chama é responsável pela limpeza.
    """
    try:
        from demoparser2 import DemoParser
    except ImportError:
        raise RuntimeError("demoparser2 não está instalado no servidor")

    errors: list[str] = []

    parser = DemoParser(dem_path)

    # ── 2. Header (mapa) ──────────────────────────────────────────────────
    map_name: str | None = None
    try:
        header = parser.parse_header()
        map_name = (header.get("map_name") or "").strip() or None
    except Exception:
        errors.append("Não foi possível ler o mapa do header.")

    # ── 3. Parseia eventos necessários (sequencial — free tier tem 512MB RAM) ─
    # Nota: parse_event() reusa o mesmo DemoParser; cada chamada escaneia o
    # arquivo inteiro. Em Render free tier (0.1 vCPU, 512MB) leva ~300s para
    # demos de 270MB. Paralelismo foi testado mas causava OOM (5× DemoParser
    # simultâneos excede 512MB). Para parse < 60s: upgrade para Starter plan.
    # round_mvp não existe no formato CS2 (Bug 27) — não é chamado.
    kills_df = hurt_df = rounds_df = flash_df = purchase_df = mvp_df = None

    try:
        kills_df = parser.parse_event(
            "player_death",
            player=["team_num", "steamid"],
            other=["total_rounds_played"],
        )
    except Exception as e:
        raise RuntimeError(f"Falha ao ler kills do demo: {e}")

    try:
        hurt_df = parser.parse_event(
            "player_hurt",
            player=["team_num", "steamid"],
            other=["total_rounds_played", "health", "dmg_health"],
        )
    except Exception as e:
        errors.append(f"Eventos de dano indisponíveis: {e}")

    try:
        rounds_df = parser.parse_event("round_end", other=["total_rounds_played"])
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
            rnd = row.get("total_rounds_played")
            kills.append({
                "tick":         row.get("tick") or 0,
                "attacker":     _key(atk_steamid, atk_name),
                "victim":       _key(vic_steamid, vic_name),
                "assister":     _key(asst_steamid, asst_name),
                "atk_team":     row.get("attacker_X_team_num") or row.get("attacker_team_num"),
                "vic_team":     row.get("user_X_team_num") or row.get("user_team_num"),
                # `or -1` quebrava o round 0 (0 é falsy em Python — virava -1, "round
                # desconhecido"), fazendo a morte/kill do round 0 desaparecer do
                # round certo: inflava o KAST de todo mundo (a "morte" ficava
                # invisível pro contador de "sobreviveu") e sempre comia o
                # opening_kill/opening_death do round 0 da partida.
                "round":        rnd if rnd is not None else -1,
            })
    del kills_df

    # ── Detecta reinício de partida (mp_restartgame) ──────────────────────────
    # total_rounds_played no player_death reseta para 0 quando o servidor executa
    # mp_restartgame. Sem este filtro, os rounds pré-restart são somados com os
    # pós-restart — jogadores acumulam kills/mortes de duas sequências de rounds
    # diferentes, causando stats assimétricas (ex: de_train com restart na metade).
    # Fix: ordena kills por tick e detecta quando total_rounds_played cai;
    # descarta tudo que veio antes do último reset.
    kills.sort(key=lambda k: k["tick"])
    _restart_tick: int = 0
    _max_rnd_seen: int = -1
    for _k in kills:
        _rnd = _k.get("round")
        if _rnd is None or _rnd < 0:
            continue
        if _max_rnd_seen >= 0 and _rnd < _max_rnd_seen:
            # total_rounds_played voltou para trás → mp_restartgame detectado
            _restart_tick = _k["tick"]
            _max_rnd_seen = _rnd
        else:
            _max_rnd_seen = max(_max_rnd_seen, _rnd)
    if _restart_tick > 0:
        _before = len(kills)
        kills = [k for k in kills if k["tick"] >= _restart_tick]
        errors.append(
            f"Reinício de partida detectado (tick {_restart_tick}) — "
            f"{_before - len(kills)} kills anteriores descartados."
        )

    # round_dmg: acumulado de dano por (round, player) — usado só no fallback MVP.
    # Declarado aqui porque o loop de hurt popula este dict antes do loop de kills.
    round_dmg: dict[int, dict[str, int]] = {}

    # dmg_health de cada player_hurt NÃO é capado pela vida restante da vítima — o
    # hit que mata reporta o dano "teórico" da arma, não o quanto de HP realmente
    # sobrava (ex: jogador com 25 de vida leva um tiro de 75, e o evento ainda
    # mostra dmg_health=75 mesmo só "removendo" 25). Isso inflava ADR/dano de quem
    # dá mais kills com overkill (rifle/headshot), de forma desigual entre players
    # — confirmado comparando tick a tick contra o campo `health` (pós-hit) do
    # próprio evento num demo real. Fix: reconstrói o HP de cada vítima rodada a
    # rodada (sempre reseta pra 100 num round novo) e credita só
    # health_antes - health_depois, nunca o dmg_health bruto do evento.
    hurt: list[dict] = []
    if hurt_df is not None and not hurt_df.empty:
        hurt_rows = hurt_df.to_dicts() if hasattr(hurt_df, "to_dicts") else hurt_df.to_dict("records")
        hurt_rows.sort(key=lambda r: r.get("tick") or 0)

        hp_state: dict[str, int] = {}     # vítima -> HP atual conhecido
        hp_round: dict[str, int] = {}     # vítima -> round do último hit registrado

        for row in hurt_rows:
            if _restart_tick and (row.get("tick") or 0) < _restart_tick:
                continue
            atk_name = _s(row.get("attacker_name"))
            atk = _key(_s(row.get("attacker_steamid")), atk_name)
            vic_name = _s(row.get("user_name"))
            vic = _key(_s(row.get("user_steamid")), vic_name)
            atk_team = row.get("attacker_X_team_num") or row.get("attacker_team_num")
            vic_team = row.get("user_X_team_num") or row.get("user_team_num")
            rnd = row.get("total_rounds_played")
            weapon = _s(row.get("weapon")).lower()

            if not vic:
                continue
            if hp_round.get(vic) != rnd:
                hp_round[vic] = rnd
                hp_state[vic] = 100  # vida cheia no início de cada round
            health_before = hp_state[vic]
            health_after_raw = row.get("health")
            if health_after_raw is not None:
                # Reconstrução exata a partir do HP restante
                health_after = int(health_after_raw)
                real_dmg = max(0, health_before - health_after)
                hp_state[vic] = health_after
            else:
                # Fallback: usa dmg_health do evento, capado pelo HP disponível
                # (evita overkill: tiro de 120 em jogador com 25 HP conta só 25)
                dmg_raw = int(row.get("dmg_health") or 0)
                real_dmg = min(dmg_raw, health_before)
                hp_state[vic] = max(0, health_before - real_dmg)

            # Só conta dano em INIMIGO — fogo amigo (mesmo time) e autodano (própria
            # granada/queda, que sempre cai no mesmo time do atacante) são excluídos,
            # igual ao ADR oficial do scope.gg/HLTV.
            if (atk and real_dmg and atk_team is not None and vic_team is not None
                    and atk_team != vic_team):
                hurt.append({"attacker": atk, "dmg": real_dmg, "weapon": weapon})
                rnd_rd = round_dmg.setdefault(rnd if rnd is not None else -1, {})
                rnd_rd[atk] = rnd_rd.get(atk, 0) + real_dmg
    del hurt_df

    # total_rounds via contagem de round_end — mas o round_end do ÚLTIMO round às vezes
    # não é capturado (demo termina logo após o kill decisivo, antes do evento disparar).
    # Sem isso, total_rounds fica menor que o maior índice de round visto nas kills, e
    # kast_percent (e adr) ficam inflados acima de 100% — usa o maior dos dois.
    # O primeiro round_end do demo às vezes é um registro fantasma (tick=1, sem
    # `winner`/`reason`, antes da partida começar) — contá-lo infla total_rounds em
    # +1 e dilui ADR/KAST igualmente para todo mundo na partida.
    total_rounds = 1
    round_winner: dict[int, int] = {}  # índice_sequencial → team_num do vencedor
    # round_end retorna winner como string "CT"/"T" — mapeia para team_num int (CT=3, T=2).
    _WINNER_TEAM = {"CT": 3, "T": 2}
    if rounds_df is not None and not rounds_df.empty:
        round_records = rounds_df.to_dicts() if hasattr(rounds_df, "to_dicts") else rounds_df.to_dict("records")
        if _restart_tick:
            round_records = [r for r in round_records if (r.get("tick") or 0) >= _restart_tick]
        real_rounds = [r for r in round_records if _s(r.get("winner"))]
        total_rounds = max(len(real_rounds), 1)
        # O N-ésimo round_end real (0-indexado) corresponde ao round N das kills.
        for i, r in enumerate(real_rounds):
            team_num = _WINNER_TEAM.get(_s(r.get("winner")))
            if team_num is not None:
                round_winner[i] = team_num
    del rounds_df

    max_kill_round = max((k["round"] for k in kills if k["round"] is not None and k["round"] >= 0), default=-1)
    total_rounds = max(total_rounds, max_kill_round + 1)

    # Constrói lista de cegadas para cruzar com kills depois.
    # flash_by_attacker é calculado APÓS o loop de kills, quando a lista kills está completa.
    flash_events: list[dict] = []
    if flash_df is not None and not flash_df.empty:
        for row in flash_df.to_dicts() if hasattr(flash_df, "to_dicts") else flash_df.to_dict("records"):
            if _restart_tick and (row.get("tick") or 0) < _restart_tick:
                continue
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
            if _restart_tick and (row.get("tick") or 0) < _restart_tick:
                continue
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

    # MVP oficial: evento round_mvp do CS2 → a estrela do placar.
    # Cada round_mvp dispara uma vez por round com o steamid do MVP.
    # Se o evento não existir no demo, mvp_counts fica vazio e a heurística é usada.
    mvp_counts: dict[str, int] = {}
    _mvp_rows = (mvp_df.to_dicts() if hasattr(mvp_df, "to_dicts")
                 else mvp_df.to_dict("records") if hasattr(mvp_df, "to_dict")
                 else mvp_df if isinstance(mvp_df, list) else [])
    if _mvp_rows:
        for row in _mvp_rows:
            sid = _s(row.get("user_steamid") or row.get("user_X_steamid") or "")
            if sid:
                mvp_counts[sid] = mvp_counts.get(sid, 0) + 1
    del mvp_df

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
    round_kills: dict[int, dict[str, int]] = {}   # rnd → player_key → nº kills
    round_team: dict[int, dict[str, int]] = {}    # rnd → player_key → team_num
    # round_dmg declarado antes do loop de hurt (já foi definido acima)

    # Estimativa do tamanho de cada time — usado só pra classificar advantage/
    # disadvantage kills. Assume times parelhos (mix 5v5 padrão do grupo).
    team_size = max(1, (len(player_keys) + 1) // 2)
    alive: dict[int, int] = {}
    current_round: int | None = None

    died_rounds: dict[str, set] = {}    # player -> rounds em que morreu
    kast_rounds: dict[str, set] = {}    # player -> rounds com K, A ou Trade

    # Mapeamento player → {round: team_num} para detectar equipes e half-point
    player_sides: dict[str, dict[int, int]] = {}

    # Confronto direto (player x player) — só kills e flash_assists por enquanto.
    # Dano de HE/molotov por vítima específica não dá: o evento player_hurt não
    # carrega o steamid da vítima no parse atual (só do atacante) — ver Futuro.
    vs_pairs: dict[tuple[str, str], dict[str, int]] = {}

    def _vs_add(actor: str | None, target: str | None, field: str) -> None:
        if not actor or not target or actor == target:
            return
        if actor not in stats or target not in stats:
            return
        vs_pairs.setdefault((actor, target), {"kills": 0, "flash_assists": 0})[field] += 1

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
            _vs_add(atk, vic, "kills")
            # Tracking por round para MVP
            if rnd >= 0 and atk_team is not None:
                rnd_rk = round_kills.setdefault(rnd, {})
                rnd_rk[atk] = rnd_rk.get(atk, 0) + 1
                round_team.setdefault(rnd, {})[atk] = atk_team

        if vic and vic in stats:
            stats[vic]["deaths"] += 1
            died_rounds.setdefault(vic, set()).add(rnd)

        # Registra lado de cada jogador por round (para detecção de equipes)
        if rnd >= 0:
            if atk and atk in stats and atk_team is not None:
                player_sides.setdefault(atk, {})[rnd] = atk_team
            if vic and vic in stats and vic_team is not None:
                player_sides.setdefault(vic, {})[rnd] = vic_team

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

        # Opening kills / opening deaths — primeira kill do round
        if rnd >= 0 and rnd not in seen_opening_rounds:
            seen_opening_rounds.add(rnd)
            if atk and atk in stats and atk != vic:
                stats[atk]["opening_kills"] += 1
            if vic and vic in stats:
                stats[vic]["opening_deaths"] += 1

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
                _vs_add(blind["attacker"], blind["victim"], "flash_assists")
                break

    matchups = [
        {"player_steamid": actor, "opponent_steamid": target, **counts}
        for (actor, target), counts in vs_pairs.items()
    ]

    # MVP: usa o evento oficial round_mvp do CS2 (estrela do placar).
    # Fallback: mais kills do time vencedor por round, desempate por dano.
    if mvp_counts:
        for key, count in mvp_counts.items():
            if key in stats:
                stats[key]["mvps"] = count
    else:
        for rnd, winning_team in round_winner.items():
            rk = round_kills.get(rnd, {})
            rt = round_team.get(rnd, {})
            rd = round_dmg.get(rnd, {})
            candidates = [
                (key, cnt) for key, cnt in rk.items()
                if rt.get(key) == winning_team and key in stats
            ]
            if not candidates:
                continue
            mvp_key = max(candidates, key=lambda x: (x[1], rd.get(x[0], 0)))[0]
            stats[mvp_key]["mvps"] += 1

    del flash_events, kills, recent_kills, seen_opening_rounds, died_rounds, alive, round_spend, effective_spend, vs_pairs, round_kills, round_team, round_dmg

    # ── 7b. Detecção de equipes e vencedor ────────────────────────────────────
    # Estratégia: agrupa jogadores pelo team_num da primeira metade da partida.
    # Half-point = primeiro round em que algum jogador troca de lado.
    # Para cada round, verifica qual time estava no lado vencedor (lookup direto
    # no player_sides do jogador, sem assumir posição fixa de T/CT).
    from collections import Counter as _Counter

    team_a_score = 0
    team_b_score = 0
    team_winner: str | None = None

    if player_sides and round_winner:
        # Detecta half-point
        half_point = total_rounds // 2
        for _pkey, _rmap in player_sides.items():
            _sorted = sorted(_rmap)
            for _i in range(len(_sorted) - 1):
                _r1, _r2 = _sorted[_i], _sorted[_i + 1]
                if _rmap[_r1] != _rmap[_r2] and _r2 - _r1 <= 4:
                    half_point = _r2
                    break
            else:
                continue
            break

        # Atribui jogadores a equipes pelo lado predominante na primeira metade
        _team_by_num: dict[int, list[str]] = {}
        for _pkey, _rmap in player_sides.items():
            _first = [t for r, t in _rmap.items() if r < half_point] or list(_rmap.values())
            if _first:
                _tnum = _Counter(_first).most_common(1)[0][0]
                _team_by_num.setdefault(_tnum, []).append(_pkey)

        _tnums = sorted(_team_by_num)
        if len(_tnums) == 2:
            _a_num, _b_num = _tnums[0], _tnums[1]
            _team_a = set(_team_by_num[_a_num])
            _team_b = set(_team_by_num[_b_num])

            for _pk in _team_a:
                if _pk in stats:
                    stats[_pk]["team"] = "A"
            for _pk in _team_b:
                if _pk in stats:
                    stats[_pk]["team"] = "B"

            # Conta rounds: para cada round ganho, verifica se algum jogador
            # do time A estava no lado vencedor naquele round
            for _rnd, _w_num in round_winner.items():
                _a_side = next(
                    (player_sides[_pk][_rnd] for _pk in _team_a
                     if _rnd in player_sides.get(_pk, {})),
                    None,
                )
                if _a_side is not None:
                    if _a_side == _w_num:
                        team_a_score += 1
                    else:
                        team_b_score += 1

            if team_a_score > team_b_score:
                team_winner = "A"
            elif team_b_score > team_a_score:
                team_winner = "B"
            else:
                team_winner = "tie"

    del player_sides

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
                stats[atk]["fire_damage"] += dmg
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
        "team_a_score": team_a_score,
        "team_b_score": team_b_score,
        "team_winner":  team_winner,
        "players":      list(stats.values()),
        "matchups":     matchups,
        "errors":       errors,
    }


def _empty(nickname: str, steam_id: str) -> dict:
    return {
        "nickname":          nickname,
        "steam_id":          steam_id,
        "team":              None,
        "kills":             0,
        "deaths":            0,
        "assists":           0,
        "damage_total":      0,
        "adr":               0.0,
        "adr_difference":    0.0,
        "hltv_rating":       0.0,
        "kast_percent":      0.0,
        "opening_kills":     0,
        "opening_deaths":    0,
        "trade_kills":       0,
        "mvps":              0,
        "trade_denials":     0,
        "time_to_kill_ms":   0,
        "flash_assists":     0,
        "grenade_damage":    0,
        "he_enemies_hit":    0,
        "fire_enemies_hit":  0,
        "fire_damage":       0,
        "disadvantage_kills":0,
        "advantage_kills":   0,
        "eco_kills":         0,
        "_ttk_ticks":        [],
    }
