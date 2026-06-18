from fastapi import APIRouter, Body, Depends, Request, HTTPException
from slowapi import Limiter
from app.services.ai_service import suggest_category
from app.services.auth_service import get_current_user_id

router = APIRouter(prefix="/ai", tags=["AI"])
limiter = Limiter(key_func=lambda request: request.state.user_id)


@router.post("/suggest-category")
@limiter.limit("10/minute")
def suggest_category_route(
    request: Request,
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
):
    request.state.user_id = user_id

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