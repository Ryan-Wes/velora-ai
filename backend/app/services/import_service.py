from app.database import get_connection


def create_import(
    user_id: str,
    filename: str,
    file_hash: str,
    source_name: str,
    source_type: str,
    file_format: str,
    statement_period_start: str | None = None,
    statement_period_end: str | None = None,
    due_date: str | None = None,
    total_amount: float | None = None,
    import_status: str = "uploaded",
    warning_message: str | None = None,
) -> int:
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO imports (
                user_id,
                filename,
                file_hash,
                source_name,
                source_type,
                file_format,
                statement_period_start,
                statement_period_end,
                due_date,
                total_amount,
                import_status,
                warning_message
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                filename,
                file_hash,
                source_name,
                source_type,
                file_format,
                statement_period_start,
                statement_period_end,
                due_date,
                total_amount,
                import_status,
                warning_message,
            ),
        )

        connection.commit()
        return cursor.lastrowid


def list_imports():
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                i.id,
                i.filename,
                i.file_hash,
                i.source_name,
                i.source_type,
                i.file_format,
                i.statement_period_start,
                i.statement_period_end,
                i.due_date,
                i.total_amount,
                i.import_status,
                i.warning_message,
                i.created_at,
                COUNT(t.id) AS transactions_count
            FROM imports i
            LEFT JOIN transactions t ON t.import_id = i.id
            GROUP BY i.id
            ORDER BY i.id DESC
            """
        )

        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def list_transactions_by_import(import_id: int):
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT *
            FROM transactions
            WHERE import_id = ?
            ORDER BY transaction_date DESC, id DESC
            """,
            (import_id,),
        )

        rows = cursor.fetchall()
        return [dict(row) for row in rows]