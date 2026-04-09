from typing import Optional

from fastapi import APIRouter, Query

from app.services import transaction_service

router = APIRouter()


@router.get("/transactions")
def get_transactions(
    month: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None, alias="type"),
    source: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return transaction_service.list_transactions(
        month=month,
        transaction_type=transaction_type,
        source=source,
        limit=limit,
        offset=offset,
    )