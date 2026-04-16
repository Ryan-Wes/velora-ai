from fastapi import APIRouter

from app.services.category_service import get_category_schema

router = APIRouter(tags=["categories"])


@router.get("/categories/schema")
def read_category_schema():
    return get_category_schema()