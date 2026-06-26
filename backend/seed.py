"""
Seed — dados iniciais do EverestFrags

Executa UMA vez para criar:
  1. Admin inicial (nickname: "admin", senha: "fragstack2025")
  2. Players reais do grupo (13 jogadores com Steam ID vinculado)

IMPORTANTE: Trocar a senha do admin após o primeiro login!

Como rodar:
  cd backend
  python seed.py

Se os dados já existirem (ex: rodar duas vezes), o script ignora silenciosamente
graças às checagens de existência antes de cada insert.
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal, engine, Base
from app.models.player import Player
from app.services.auth_service import hash_password

Base.metadata.create_all(bind=engine)


# nickname exato da Steam, steam_id 64-bit
# Nota: kadutx e hiraeth têm o mesmo display name na Steam.
# kadutx usa a vanity URL como nickname para evitar conflito de unicidade.
# Quando logar via Steam, o sistema vai tentar atualizar para "hiraeth" mas
# vai detectar o conflito e manter "kadutx" (comportamento esperado).
REAL_PLAYERS = [
    ("dx",                    "76561198957778494"),
    ("FalleN <HyperX>",       "76561198144449321"),
    ("Famoso degusta Forte",  "76561198278595427"),
    ("kadutx",                "76561199151136880"),
    ("4N6Z",                  "76561198401187819"),
    ("Andreyy",               "76561198365150318"),
    ("hiraeth",               "76561198433581475"),
    ("defxultzz",             "76561198872980462"),
    ("Macacaino",             "76561199214622140"),
    ("Motel de R$ 30",        "76561198884962636"),
    ("pintofreitas",          "76561199034174380"),
    ("k1lemod",               "76561199128919753"),
    ("teago",                 "76561198137528891"),
]


def make_initials(nickname: str) -> str:
    """Deriva 2 iniciais ignorando caracteres não-alfanuméricos."""
    clean = re.sub(r'[^a-zA-Z0-9 ]', '', nickname).strip()
    if not clean:
        return "??"
    words = clean.split()
    w0 = words[0]
    second = words[1][0] if len(words) > 1 else (w0[1] if len(w0) > 1 else w0[0])
    return (w0[0] + second).upper()


def seed():
    db = SessionLocal()
    try:
        # 1. Admin inicial
        if not db.query(Player).filter(Player.nickname == "admin").first():
            admin = Player(
                nickname="admin",
                steam_id="76561198874669603",
                avatar_initials="AD",
                password_hash=hash_password("fragstack2025"),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.flush()
            print("+ Admin criado (nick: admin, senha: fragstack2025) -- TROQUE A SENHA!")
        else:
            print("- Admin ja existe, pulando")

        # 2. Players reais
        created = 0
        skipped = 0
        for nickname, steam_id in REAL_PLAYERS:
            # Evita duplicata por steam_id ou nickname
            exists_by_steam = db.query(Player).filter(Player.steam_id == steam_id).first()
            exists_by_nick  = db.query(Player).filter(Player.nickname == nickname).first()

            if exists_by_steam or exists_by_nick:
                skipped += 1
                continue

            p = Player(
                nickname=nickname,
                steam_id=steam_id,
                avatar_initials=make_initials(nickname),
                password_hash=None,   # acesso apenas via Steam OpenID
                role="viewer",
                is_active=True,
            )
            db.add(p)
            db.flush()
            created += 1

        db.commit()
        print(f"+ {created} players criados, {skipped} ja existiam")

        print("\n== Seed concluido! ==")
        print("Inicie o servidor com:")
        print("  uvicorn main:app --reload --port 8001")
        print("\nATENCAO: Troque a senha do admin apos o primeiro login!")

    except Exception as e:
        db.rollback()
        print(f"\nERRO durante seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
