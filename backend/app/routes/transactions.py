from typing import Optional

from fastapi import APIRouter, Query, Body

from app.services import transaction_service

router = APIRouter()


@router.get("/transactions")
def get_transactions(
    month: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None, alias="type"),
    source: Optional[str] = Query(None),
    sort: str = Query("date_desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return transaction_service.list_transactions(
        month=month,
        transaction_type=transaction_type,
        source=source,
        sort=sort,
        limit=limit,
        offset=offset,
    )

@router.get("/transactions/months")
def get_available_months():
    months = transaction_service.get_available_months()
    return {"months": months}


@router.get("/transactions/categories")
def get_available_categories():
    categories = transaction_service.get_available_categories()
    return {"categories": categories}


@router.patch("/transactions/{transaction_id}/category")
def update_transaction_category(
    transaction_id: int,
    category: str = Body(..., embed=True),
):
    return transaction_service.update_transaction_category(
        transaction_id=transaction_id,
        category=category,
    )