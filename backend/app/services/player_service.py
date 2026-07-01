"""
Service — operações CRUD em jogadores

Funções:
  get_all_players   → lista todos os players ativos
  get_player_by_id  → busca um player por ID (lança 404 se não encontrar)
  create_player     → cria um novo player (lança 409 se nickname já existe)
  update_player     → atualiza campos de um player
  authenticate      → valida nickname + senha para login
"""

from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.player import Player
from app.schemas.player import PlayerCreate, PlayerUpdate
from app.services.auth_service import hash_password, verify_password

# Hash fixo para equalizar tempo de resposta quando o nickname não existe
# (sem isso, o servidor responde ~200ms mais rápido para nicks inexistentes,
# expondo via timing attack quais nicks estão cadastrados)
_DUMMY_HASH = hash_password("dummy_timing_prevention_ef")


def get_all_players(db: Session, include_inactive: bool = False) -> List[Player]:
    """Retorna todos os players. Por padrão, filtra apenas os ativos."""
    query = db.query(Player)
    if not include_inactive:
        query = query.filter(Player.is_active == True)  # noqa: E712
    return query.order_by(Player.nickname).all()


def get_player_by_id(db: Session, player_id: int) -> Player:
    """Busca player por ID. Lança 404 se não encontrar."""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Jogador {player_id} não encontrado",
        )
    return player


def create_player(db: Session, data: PlayerCreate) -> Player:
    """
    Cria um novo player. Lança 409 se o nickname já estiver em uso.
    O avatar_initials é derivado do nickname se não for fornecido.
    """
    existing = db.query(Player).filter(Player.nickname == data.nickname).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Nickname '{data.nickname}' já está em uso",
        )

    initials = (data.avatar_initials or data.nickname[:2]).upper()

    player = Player(
        nickname=data.nickname,
        steam_id=data.steam_id,
        avatar_initials=initials,
        password_hash=hash_password(data.password) if data.password else None,
        role=data.role,
        is_active=True,
    )
    db.add(player)
    db.commit()
    db.refresh(player)
    return player


def update_player(db: Session, player_id: int, data: PlayerUpdate) -> Player:
    """
    Atualiza os campos fornecidos de um player.
    Só altera o que foi explicitamente enviado (campo não None).
    """
    player = get_player_by_id(db, player_id)

    if data.nickname is not None:
        # Verifica conflito de nickname antes de atualizar
        conflict = db.query(Player).filter(
            Player.nickname == data.nickname,
            Player.id != player_id,
        ).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Nickname '{data.nickname}' já está em uso",
            )
        player.nickname = data.nickname

    if data.display_name is not None:
        # string vazia limpa o apelido — volta a exibir o nickname (sincronizado com a Steam)
        player.display_name = data.display_name.strip() or None
    if data.steam_id is not None:
        player.steam_id = data.steam_id
    if data.avatar_initials is not None:
        player.avatar_initials = data.avatar_initials.upper()
    if data.role is not None:
        player.role = data.role
    if data.is_active is not None:
        player.is_active = data.is_active

    db.commit()
    db.refresh(player)
    return player


def authenticate(db: Session, nickname: str, password: str) -> Optional[Player]:
    """
    Valida credenciais para login.
    Retorna o Player se válido, None se nickname não existe ou senha errada.
    Não lança exceção — o router decide o que fazer com None.
    """
    player = db.query(Player).filter(
        Player.nickname == nickname,
        Player.is_active == True,  # noqa: E712
    ).first()
    if not player or not player.password_hash:
        verify_password(password, _DUMMY_HASH)  # equaliza tempo de resposta
        return None
    if not verify_password(password, player.password_hash):
        return None
    return player


def get_or_create_by_steam(
    db: Session,
    steam_id: str,
    profile: dict | None = None,
    fallback_nickname: str | None = None,
) -> tuple["Player", bool]:
    """
    Busca um player pelo steam_id ou cria um novo com role 'viewer'.
    Retorna (player, created) — created=True se acabou de ser criado.

    Se o player já existe e veio um perfil atualizado da Steam,
    sincroniza nickname e avatar_initials.

    Para o nickname do novo player, tenta nesta ordem: perfil Steam,
    fallback_nickname (ex: nick visto numa demo), 'steam_XXXX' (últimos
    4 dígitos do steam_id). Se o nickname escolhido já estiver em uso
    por outro player, cai para 'steam_XXXX'.
    """
    player = db.query(Player).filter(Player.steam_id == steam_id).first()

    if player:
        # Player já cadastrado — atualiza dados do perfil se disponíveis
        if profile:
            new_nick = profile.get("personaname", player.nickname)
            conflict = db.query(Player).filter(
                Player.nickname == new_nick,
                Player.id != player.id,
            ).first()
            if not conflict:
                player.nickname = new_nick
                words = new_nick.split()
                player.avatar_initials = (
                    words[0][0] + (words[1][0] if len(words) > 1 else words[0][-1])
                ).upper()
            # avatar_url é só de exibição — sempre sincroniza com a Steam, mesmo
            # quando o nickname ficou preso por colisão (não afeta unicidade)
            if profile.get("avatarfull"):
                player.avatar_url = profile["avatarfull"]
            db.commit()
            db.refresh(player)
        return player, False

    # Primeiro acesso — cria o player
    nickname = (profile and profile.get("personaname")) or fallback_nickname or f"steam_{steam_id[-4:]}"
    conflict = db.query(Player).filter(Player.nickname == nickname).first()
    if conflict:
        nickname = f"steam_{steam_id[-4:]}"

    words = nickname.split()
    initials = (words[0][0] + (words[1][0] if len(words) > 1 else words[0][-1])).upper()

    player = Player(
        nickname=nickname,
        steam_id=steam_id,
        avatar_initials=initials,
        avatar_url=profile.get("avatarfull") if profile else None,
        password_hash=None,   # sem senha — acesso só via Steam ou criado via demo
        role="viewer",
        is_active=True,
    )
    db.add(player)
    db.commit()
    db.refresh(player)
    return player, True


def change_password(db: Session, player: Player, current_password: str, new_password: str) -> None:
    """
    Altera a senha de um player após verificar a senha atual.
    Lança 400 se a senha atual estiver errada.
    """
    if not player.password_hash or not verify_password(current_password, player.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta",
        )
    player.password_hash = hash_password(new_password)
    db.commit()
