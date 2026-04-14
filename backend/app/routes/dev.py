from fastapi import APIRouter

from app.database import DB_PATH, create_tables, get_connection
from app.services.transaction_service import normalize_category_name

router = APIRouter(tags=["dev"])


@router.post("/dev/normalize-categories")
def normalize_categories():
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, category
            FROM transactions
            WHERE category IS NOT NULL
            """
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
                    """,
                    (normalized, transaction_id),
                )
                updated += 1

        connection.commit()

    return {
        "message": "Categories normalized",
        "updated_count": updated,
    }


@router.delete("/dev/reset")
def reset_database():
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute("DROP TABLE IF EXISTS transactions")
        cursor.execute("DROP TABLE IF EXISTS imports")

        connection.commit()

    create_tables()

    return {
        "message": "Database reset successfully",
    }