from fastapi import APIRouter, HTTPException, Depends
from app.services.auth_service import get_current_user_id
from app.services.import_service import (
    list_imports,
    list_transactions_by_import,
)

router = APIRouter(tags=["imports"])


@router.get("/imports")
def get_imports(user_id: str = Depends(get_current_user_id)):
    return list_imports(user_id=user_id)


@router.get("/imports/{import_id}/transactions")
def get_import_transactions(
    import_id: int,
    user_id: str = Depends(get_current_user_id),
):
    transactions = list_transactions_by_import(import_id, user_id=user_id)

    if not transactions:
        raise HTTPException(status_code=404, detail="Import not found or empty")

    return transactions