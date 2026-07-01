"""
Models ORM — tabelas 'matches' e 'player_match_stats'

Match armazena os metadados de cada partida (mapa, data, URL do scope.gg).
PlayerMatchStats é a tabela de junção enriquecida: uma linha por jogador por partida,
com todas as métricas usadas na fórmula de score.

ATENÇÃO (bug anterior): a versão antiga chamava essa tabela de 'match_players' e
tinha apenas kills/deaths/assists/adr/hs_percentage/mvps/score — campos insuficientes
para calcular o score por categoria (Combate 50% / Duelos 30% / Utility 20%).
Campos obrigatórios que faltavam: hltv_rating, kast_percent, opening_kills,
trade_kills, time_to_kill_ms, flash_assists, grenade_damage, he_enemies_hit,
fire_enemies_hit, damage_total, adr_difference.
"""

from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import Integer, String, Numeric, Text, Date, DateTime, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # URL do scope.gg para referência externa — só para consulta, não é processada
    scope_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Data em que a partida foi efetivamente jogada
    played_at: Mapped[date] = mapped_column(Date, nullable=False)

    # Mapa: de_dust2, de_mirage, de_inferno, etc.
    map_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Anotações livres do gestor (ex: "deu lag no server")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Sistema de vitórias — preenchido ao registrar resultado após o sorteio
    team_1_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)   # player_ids do time 1
    team_2_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)   # player_ids do time 2
    winning_team: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1 ou 2

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Lista de stats individuais dos jogadores nesta partida
    player_stats: Mapped[List["PlayerMatchStats"]] = relationship(
        "PlayerMatchStats", back_populates="match", cascade="all, delete-orphan"
    )

    # Confrontos diretos (player x player) nesta partida
    vs_stats: Mapped[List["PlayerVsPlayerStats"]] = relationship(
        "PlayerVsPlayerStats", back_populates="match", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Match id={self.id} map={self.map_name!r} played_at={self.played_at}>"


class PlayerMatchStats(Base):
    """
    Uma linha = um jogador em uma partida específica.
    Constraint UNIQUE(player_id, match_id) impede duplicatas.

    Métricas de SOMA (agregadas somando todas as partidas):
        kills, deaths, assists, damage_total, opening_kills, opening_deaths,
        trade_kills, trade_denials, flash_assists, grenade_damage, he_enemies_hit,
        fire_enemies_hit, disadvantage_kills, advantage_kills, eco_kills

    Métricas de MÉDIA (agregadas tirando média entre partidas):
        adr, adr_difference, hltv_rating, kast_percent, time_to_kill_ms
    """

    __tablename__ = "player_match_stats"
    __table_args__ = (UniqueConstraint("player_id", "match_id", name="uq_player_match"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True
    )
    match_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # --- COMBATE (peso 50% no score final) ---
    kills: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    deaths: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    assists: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    damage_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    adr: Mapped[float] = mapped_column(Numeric(6, 2), default=0, nullable=False)
    adr_difference: Mapped[float] = mapped_column(Numeric(6, 2), default=0, nullable=False)
    hltv_rating: Mapped[float] = mapped_column(Numeric(5, 3), default=0, nullable=False)
    kast_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    # Situacionais (Round Swing, estilo HLTV 3.0) — ajustam o peso de cada kill no
    # score Combate: eco_kills valem menos, disadvantage_kills valem mais.
    disadvantage_kills: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    advantage_kills: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    eco_kills: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # --- DUELOS (peso 30% no score final) ---
    opening_kills: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Morreu como vítima da 1a kill do round — invertido na normalização (menos é melhor)
    opening_deaths: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    trade_kills: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    trade_denials: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # TTK em milissegundos — menor é melhor, por isso é invertido na normalização
    time_to_kill_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Rounds em que foi MVP (mais kills do time vencedor; desempate por dano)
    mvps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # --- UTILITY (peso 20% no score final) ---
    flash_assists: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    grenade_damage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    he_enemies_hit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fire_enemies_hit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fire_damage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    match: Mapped["Match"] = relationship("Match", back_populates="player_stats")
    player: Mapped["Player"] = relationship("Player", back_populates="stats")  # noqa: F821

    def __repr__(self) -> str:
        return f"<PlayerMatchStats player_id={self.player_id} match_id={self.match_id} kills={self.kills}>"


class PlayerVsPlayerStats(Base):
    """
    Confronto direto entre 2 jogadores numa partida específica — uma linha por
    direção (player_id agiu sobre opponent_id), não por par não-ordenado.
    Ex: Fresh matou Alana 3x → 1 linha (player_id=Fresh, opponent_id=Alana, kills=3).
    A "morte" de Alana pra Fresh é só a linha inversa (player_id=Alana,
    opponent_id=Fresh) — não duplicamos a métrica em outro campo.

    Só calculável a partir do .dem (precisa de attacker+victim por evento), e só
    pras partidas processadas pelo parser depois desta feature — não retroativo
    pras partidas já cadastradas, já que o .dem é descartado após o parse (ver
    demo_service.py). Cobre só kills e flash_assists por enquanto; dano de
    HE/molotov por vítima específica fica para depois — ver CLAUDE.md > Futuro.
    """

    __tablename__ = "player_vs_player_stats"
    __table_args__ = (UniqueConstraint("match_id", "player_id", "opponent_id", name="uq_match_player_opponent"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    match_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True
    )
    opponent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True
    )

    kills: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    flash_assists: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    match: Mapped["Match"] = relationship("Match", back_populates="vs_stats")
    player: Mapped["Player"] = relationship("Player", foreign_keys=[player_id])  # noqa: F821
    opponent: Mapped["Player"] = relationship("Player", foreign_keys=[opponent_id])  # noqa: F821

    def __repr__(self) -> str:
        return f"<PlayerVsPlayerStats match_id={self.match_id} player_id={self.player_id} opponent_id={self.opponent_id} kills={self.kills}>"


class PlayerWins(Base):
    """
    Placar de vitórias paralelo ao ranking de performance.
    Atualizado automaticamente ao registrar o resultado de uma partida
    via POST /api/matches/{id}/result. Não influencia o score de ranking —
    é um placar social separado.
    """

    __tablename__ = "player_wins"

    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="CASCADE"), primary_key=True
    )
    wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    win_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_win_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    player: Mapped["Player"] = relationship("Player")  # noqa: F821

    @property
    def win_rate(self) -> float:
        total = self.wins + self.losses
        return round(self.wins / total * 100, 1) if total else 0.0

    def __repr__(self) -> str:
        return f"<PlayerWins player_id={self.player_id} wins={self.wins} losses={self.losses}>"
