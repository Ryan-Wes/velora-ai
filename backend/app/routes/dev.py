from fastapi import APIRouter
from app.database import get_connection

router = APIRouter()


@router.delete("/dev/reset")
def reset_database():
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("DELETE FROM transactions")
        cursor.execute("DELETE FROM imports")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'imports')")

        conn.commit()

    return {"message": "Database reset successfully"}