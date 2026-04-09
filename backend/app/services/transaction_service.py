from sqlite3 import IntegrityError

from app.database import get_connection


def save_transactions(import_id: int, transactions: list[dict]) -> dict:
    inserted_count = 0
    skipped_count = 0
    skipped_transactions = []

    with get_connection() as connection:
        cursor = connection.cursor()

        for transaction in transactions:
            try:
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
                        source_name,
                        source_type,
                        file_format,
                        is_ignored_in_spending,
                        is_internal_transfer,
                        installment_current,
                        installment_total,
                        transaction_hash
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                        transaction["category"],
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
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    with get_connection() as connection:
        cursor = connection.cursor()

        query = """
            SELECT *
            FROM transactions
            WHERE 1=1
        """

        params = []

        if month:
            query += " AND competency_month = ?"
            params.append(month)

        if transaction_type:
            query += " AND transaction_type = ?"
            params.append(transaction_type)

        if source:
            query += " AND source_type = ?"
            params.append(source)

        query += " ORDER BY transaction_date DESC, id DESC"
        query += " LIMIT ? OFFSET ?"

        params.append(limit)
        params.append(offset)

        cursor.execute(query, params)

        rows = cursor.fetchall()
        return [dict(row) for row in rows]


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