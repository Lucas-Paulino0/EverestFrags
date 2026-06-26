"""
Router — ranking

GET /api/ranking → público, ranking completo ordenado por score_final

Não existe mais configuração de pesos editável (ver ranking_service.py) — os 3 pesos
são fixos e iguais (1/3 cada).
"""

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.ranking import RankingEntry
from app.services.ranking_service import get_ranking

router = APIRouter(prefix="/api/ranking", tags=["ranking"])


@router.get("", response_model=List[RankingEntry])
def ranking(db: Session = Depends(get_db)):
    """
    Retorna o ranking completo de todos os jogadores com ao menos 1 partida.
    Ordenado por score_final DESC. Inclui scores por categoria e todas as métricas brutas.
    """
    return get_ranking(db)
