from fastapi import APIRouter, Body, Depends
from app.services.ai_service import suggest_category
from app.services.auth_service import get_current_user_id

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/suggest-category")
def suggest_category_route(
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
):
    description = payload.get("description", "")

    if not description:
        return {
            "success": False,
            "message": "Descrição é obrigatória"
        }

    result = suggest_category(description)

    return {
        "success": True,
        "result": result
    }