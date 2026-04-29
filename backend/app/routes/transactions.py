from typing import Optional

from fastapi import APIRouter, Query, Body

from app.services import transaction_service

from fastapi import Depends
from app.services.auth_service import get_current_user_id

router = APIRouter()


@router.get("/transactions")
def get_transactions(
    user_id: str = Depends(get_current_user_id),
    month: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None, alias="type"),
    source: Optional[str] = Query(None),
    main_category: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    category_source: Optional[str] = Query(None),
    reviewed: Optional[int] = Query(None),
    pending_review: Optional[int] = Query(None),
    sort: str = Query("date_desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return transaction_service.list_transactions(
        user_id=user_id,
        month=month,
        transaction_type=transaction_type,
        source=source,
        main_category=main_category,
        subcategory=subcategory,
        category_source=category_source,
        reviewed=reviewed,
        pending_review=pending_review,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get("/transactions/months")
def get_available_months(
    user_id: str = Depends(get_current_user_id),
):
    months = transaction_service.get_available_months(user_id=user_id)
    return {"months": months}


@router.get("/transactions/categories")
def get_available_categories(
    user_id: str = Depends(get_current_user_id),
):
    categories = transaction_service.get_available_categories(user_id=user_id)
    return {"categories": categories}


@router.patch("/transactions/{transaction_id}/category")
def update_transaction_category(
    transaction_id: int,
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
):
    return transaction_service.update_transaction_category(
        transaction_id=transaction_id,
        user_id=user_id,
        category=payload.get("category"),
        main_category=payload.get("main_category"),
        subcategory=payload.get("subcategory"),
        display_description=payload.get("display_description"),
        user_note=payload.get("user_note"),
        apply_to_similar=payload.get("apply_to_similar", False),
    )


@router.get("/transactions/{transaction_id}/similar-preview")
def get_similar_transactions_preview(
    transaction_id: int,
    user_id: str = Depends(get_current_user_id),
):
    return transaction_service.get_similar_transactions_preview(
        transaction_id=transaction_id,
        user_id=user_id,
)


@router.patch("/transactions/bulk-category")
def update_transactions_bulk_category(
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
):
    return transaction_service.bulk_update_transaction_category(
        transaction_ids=payload.get("transaction_ids", []),
        user_id=user_id,
        category=payload.get("category"),
        main_category=payload.get("main_category"),
        subcategory=payload.get("subcategory"),
        display_description=payload.get("display_description"),
        user_note=payload.get("user_note"),
    )


@router.post("/transactions/manual")
def create_manual_transaction(
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
):
    return transaction_service.create_manual_transaction(
        payload,
        user_id=user_id,
    )