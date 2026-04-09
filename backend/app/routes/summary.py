from typing import Optional

from fastapi import APIRouter, Query

from app.services.consolidation_service import consolidate_transactions
from app.services.transaction_service import get_transactions_summary

router = APIRouter(tags=["summary"])


@router.get("/summary")
def get_summary():
    return get_transactions_summary()


@router.get("/summary/consolidated")
def get_consolidated_summary(
    month: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
):
    return consolidate_transactions(
        month=month,
        transaction_type=type,
        source=source,
    )