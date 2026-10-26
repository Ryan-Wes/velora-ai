from fastapi import APIRouter, Body, Depends, Request, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.services.ai_service import suggest_category
from app.services.auth_service import get_current_user_id

router = APIRouter(prefix="/ai", tags=["AI"])
limiter = Limiter(key_func=lambda request: getattr(request.state, "user_id", None) or get_remote_address(request))


@router.post("/suggest-category")
@limiter.limit("10/minute")
def suggest_category_route(
    request: Request,
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
):
    description = payload.get("description", "")

    if not description:
        return {
            "success": False,
            "message": "Descrição é obrigatória"
        }

    result = suggest_category(description, user_id)

    return {
        "success": True,
        "result": result
    }