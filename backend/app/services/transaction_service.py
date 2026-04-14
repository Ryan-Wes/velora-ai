import re
import unicodedata
from sqlite3 import IntegrityError
from app.services.category_service import map_to_main_and_subcategory
from app.database import get_connection


def normalize_category_name(category: str | None) -> str:
    if category is None:
        return ""

    cleaned = " ".join(str(category).strip().split())

    if not cleaned:
        return ""

    normalized = unicodedata.normalize("NFKD", cleaned)
    normalized = normalized.encode("ascii", "ignore").decode("utf-8")
    normalized = normalized.lower()
    normalized = re.sub(r"\s*/\s*", "/", normalized)
    normalized = re.sub(r"\s+", " ", normalized)

    return normalized.strip()


def save_transactions(import_id: int, transactions: list[dict]) -> dict:
    inserted_count = 0
    skipped_count = 0
    skipped_transactions = []

    with get_connection() as connection:
        cursor = connection.cursor()

        for transaction in transactions:
            try:
                normalized_category = normalize_category_name(transaction.get("category"))
                main_category, subcategory = map_to_main_and_subcategory(
                    normalized_category,
                    transaction.get("normalized_description"),
                    transaction.get("transaction_type"),
                )

                cursor.execute(
                    """
                    INSERT INTO transactions (
                        import_id,
                        transaction_date,
                        competency_month,
                        raw_description,
                        normalized_description,
                        amount,
                        absolute_amount,
                        direction,
                        transaction_type,
                        category,
                        main_category,
                        subcategory,
                        display_description,
                        category_source,
                        category_reviewed,
                        source_name,
                        source_type,
                        file_format,
                        is_ignored_in_spending,
                        is_internal_transfer,
                        installment_current,
                        installment_total,
                        transaction_hash
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        import_id,
                        transaction["transaction_date"],
                        transaction["competency_month"],
                        transaction["raw_description"],
                        transaction["normalized_description"],
                        transaction["amount"],
                        transaction["absolute_amount"],
                        transaction["direction"],
                        transaction["transaction_type"],
                        normalized_category,
                        main_category,
                        subcategory,
                        transaction.get("display_description") or transaction["raw_description"],
                        transaction.get("category_source", "rule"),
                        transaction.get("category_reviewed", 0),
                        transaction["source_name"],
                        transaction["source_type"],
                        transaction["file_format"],
                        transaction["is_ignored_in_spending"],
                        transaction["is_internal_transfer"],
                        transaction["installment_current"],
                        transaction["installment_total"],
                        transaction["transaction_hash"],
                    ),
                )
                inserted_count += 1
            except IntegrityError:
                skipped_count += 1
                skipped_transactions.append(
                    {
                        "transaction_date": transaction["transaction_date"],
                        "raw_description": transaction["raw_description"],
                        "amount": transaction["amount"],
                        "transaction_hash": transaction["transaction_hash"],
                    }
                )

        connection.commit()

    return {
        "inserted_count": inserted_count,
        "skipped_count": skipped_count,
        "skipped_transactions": skipped_transactions,
    }


def list_transactions(
    month: str | None = None,
    transaction_type: str | None = None,
    source: str | None = None,
    sort: str = "date_desc",
    limit: int = 50,
    offset: int = 0,
) -> dict:
    with get_connection() as connection:
        cursor = connection.cursor()

        base_query = """
            FROM transactions
            WHERE 1=1
        """

        params = []

        if month:
            base_query += " AND substr(transaction_date, 1, 7) = ?"
            params.append(month)

        if transaction_type:
            base_query += " AND transaction_type = ?"
            params.append(transaction_type)

        if source:
            base_query += " AND source_type = ?"
            params.append(source)

        sort_map = {
            "date_desc": "transaction_date DESC, id DESC",
            "date_asc": "transaction_date ASC, id ASC",
            "amount_desc": "absolute_amount DESC, id DESC",
            "amount_asc": "absolute_amount ASC, id ASC",
        }

        order_by = sort_map.get(sort, "transaction_date DESC, id DESC")

        count_query = "SELECT COUNT(*) " + base_query
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        data_query = "SELECT * " + base_query
        data_query += f" ORDER BY {order_by}"
        data_query += " LIMIT ? OFFSET ?"

        data_params = params + [limit, offset]

        cursor.execute(data_query, data_params)
        rows = cursor.fetchall()

        items = [dict(row) for row in rows]

        return {
            "items": items,
            "limit": limit,
            "offset": offset,
            "count": len(items),
            "total": total,
        }


def get_transactions_summary() -> dict:
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                COUNT(*) AS transactions_count,
                COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN direction = 'out' THEN absolute_amount ELSE 0 END), 0) AS total_expenses,
                COALESCE(SUM(CASE
                    WHEN direction = 'out' AND is_ignored_in_spending = 0
                    THEN absolute_amount
                    ELSE 0
                END), 0) AS real_spending,
                COALESCE(SUM(CASE WHEN direction = 'in' THEN 1 ELSE 0 END), 0) AS income_count,
                COALESCE(SUM(CASE WHEN direction = 'out' THEN 1 ELSE 0 END), 0) AS expense_count,
                COALESCE(SUM(CASE WHEN is_ignored_in_spending = 1 THEN 1 ELSE 0 END), 0) AS ignored_count
            FROM transactions
            """
        )

        summary_row = dict(cursor.fetchone())

        cursor.execute(
            """
            SELECT
                transaction_type,
                COUNT(*) AS count,
                COALESCE(SUM(amount), 0) AS net_amount,
                COALESCE(SUM(absolute_amount), 0) AS absolute_total
            FROM transactions
            GROUP BY transaction_type
            ORDER BY absolute_total DESC, count DESC, transaction_type ASC
            """
        )

        by_type_rows = [dict(row) for row in cursor.fetchall()]

    return {
        "total_income": summary_row["total_income"],
        "total_expenses": summary_row["total_expenses"],
        "real_spending": summary_row["real_spending"],
        "transactions_count": summary_row["transactions_count"],
        "income_count": summary_row["income_count"],
        "expense_count": summary_row["expense_count"],
        "ignored_count": summary_row["ignored_count"],
        "by_type": by_type_rows,
    }


def get_available_months():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT DISTINCT substr(transaction_date, 1, 7) as month
        FROM transactions
        ORDER BY month DESC
        """
    )

    months = [row[0] for row in cursor.fetchall()]
    conn.close()

    return months


def get_available_categories() -> list[str]:
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT DISTINCT category
            FROM transactions
            WHERE category IS NOT NULL
              AND TRIM(category) != ''
            ORDER BY category COLLATE NOCASE ASC
            """
        )

        raw_categories = [row["category"] for row in cursor.fetchall()]

    normalized_categories = {
        normalize_category_name(category)
        for category in raw_categories
        if normalize_category_name(category)
    }

    return sorted(normalized_categories)


def update_transaction_category(transaction_id: int, category: str) -> dict:
    normalized_category = normalize_category_name(category)

    if not normalized_category:
        return {
            "success": False,
            "message": "Category cannot be empty",
        }

    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE transactions
            SET category = ?,
                category_source = ?,
                category_reviewed = ?
            WHERE id = ?
            """,
            (normalized_category, "manual", 1, transaction_id),
        )

        connection.commit()

        if cursor.rowcount == 0:
            return {
                "success": False,
                "message": "Transaction not found",
            }

    return {
        "success": True,
        "message": "Category updated successfully",
        "transaction_id": transaction_id,
        "category": normalized_category,
        "category_source": "manual",
        "category_reviewed": 1,
    }