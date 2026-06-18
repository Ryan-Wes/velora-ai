from fastapi import APIRouter, Depends

from app.database import create_tables, get_connection
from app.services.auth_service import get_current_user_id
from app.services.transaction_service import normalize_category_name

router = APIRouter(tags=["dev"])


@router.post("/account/normalize-categories")
def normalize_categories(user_id: str = Depends(get_current_user_id)):
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, category
            FROM transactions
            WHERE category IS NOT NULL
              AND user_id = ?
            """,
            (user_id,),
        )

        rows = cursor.fetchall()
        updated = 0

        for row in rows:
            transaction_id = row["id"]
            original_category = row["category"]
            normalized = normalize_category_name(original_category)

            if normalized != original_category:
                cursor.execute(
                    """
                    UPDATE transactions
                    SET category = ?
                    WHERE id = ?
                      AND user_id = ?
                    """,
                    (normalized, transaction_id, user_id),
                )
                updated += 1

        connection.commit()

    return {
        "message": "Categories normalized",
        "updated_count": updated,
    }


@router.delete("/account/reset")
def reset_database(user_id: str = Depends(get_current_user_id)):
    create_tables()

    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM transactions
            WHERE user_id = ?
            """,
            (user_id,),
        )

        cursor.execute(
            """
            DELETE FROM imports
            WHERE user_id = ?
            """,
            (user_id,),
        )

        connection.commit()

    create_tables()

    return {
        "message": "User database reset successfully",
    }