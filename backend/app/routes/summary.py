from typing import Optional

from fastapi import APIRouter, Query

from app.services.consolidation_service import consolidate_transactions
from app.services.transaction_service import get_transactions_summary
from app.services import consolidation_service

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

@router.get("/summary/by-category")
def get_summary_by_category(
    month: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
):
    data = consolidation_service.get_by_category_summary(
        month=month,
        transaction_type=type,
        source=source,
    )
    return {"by_category": data}

@router.get("/summary/monthly-trend")
def get_monthly_trend(
    type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
):
    data = consolidation_service.get_monthly_trend_summary(
        transaction_type=type,
        source=source,
    )
    return {"monthly_trend": data}