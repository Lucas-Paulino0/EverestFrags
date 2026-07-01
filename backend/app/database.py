# Módulo de conexão com o banco de dados PostgreSQL via SQLAlchemy
# Responsável por criar a engine, a sessão e a base declarativa dos modelos

# --- stdlib ---
import os

# --- third-party ---
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

# Lê a URL do banco de dados da variável de ambiente
# Formato esperado: postgresql://user:password@host:port/dbname
_db_url = os.environ.get("DATABASE_URL")
if not _db_url:
    raise RuntimeError(
        "DATABASE_URL não definida no ambiente. "
        "Configure no .env ou nas variáveis de ambiente do servidor."
    )
DATABASE_URL: str = _db_url

# Cria a engine do SQLAlchemy com pool de conexões
# pool_pre_ping=True verifica se a conexão ainda está ativa antes de usá-la
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Fábrica de sessões — cada requisição HTTP receberá uma sessão própria
# autocommit=False: transações precisam de commit explícito
# autoflush=False: evita flushs automáticos que podem gerar queries inesperadas
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Classe base declarativa para todos os modelos ORM do projeto."""
    pass


def get_db():
    """
    Gerador de dependência para injetar a sessão do banco de dados nas rotas.
    Garante que a sessão seja sempre fechada ao final da requisição,
    mesmo que ocorra uma exceção (via bloco finally).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
