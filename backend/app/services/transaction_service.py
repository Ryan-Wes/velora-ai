import re
import unicodedata
from sqlite3 import IntegrityError
from app.services.category_service import (
    is_valid_category_selection,
    map_to_main_and_subcategory,
)
from app.database import get_connection

import uuid
from datetime import datetime


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


def normalize_display_description(
    raw_description: str | None,
    display_description: str | None = None,
    transaction_type: str | None = None,
) -> str:
    original_text = (display_description or raw_description or "").strip()

    if not original_text:
        return ""

    text = re.sub(r"\s+", " ", original_text).strip()

    # Só mexe em descrições realmente longas
    if len(text) <= 70:
        return text

    # Transferências / Pix muito longos:
    # remove CPF/CNPJ e trechos extras depois do nome
    if transaction_type in {"pix_out", "pix_in", "transfer_out", "transfer_in"}:
        shortened = re.sub(r"\s+\d{11,14}.*$", "", text).strip()
        shortened = re.sub(r"\s+-\s+.*$", "", shortened).strip()

        if shortened and len(shortened) < len(text):
            return shortened

        return text

    # Boleto muito longo:
    # mantém mais legível, mas sem mutilar compras normais
    if text.lower().startswith("pagamento de boleto"):
        shortened = re.sub(
            r"(?i)^pagamento de boleto efetuado\s+",
            "Boleto - ",
            text,
        ).strip()

        return shortened if shortened else text

    # Fora desses casos, mantém exatamente como veio
    return text


def save_transactions(import_id: int, transactions: list[dict]) -> dict:
    inserted_count = 0
    skipped_count = 0
    skipped_transactions = []

    with get_connection() as connection:
        cursor = connection.cursor()

        user_id = "default_user"

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
                        user_id,
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
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
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
    year: str | None = None,
    transaction_type: str | None = None,
    source: str | None = None,
    main_category: str | None = None,
    subcategory: str | None = None,
    category_source: str | None = None,
    reviewed: int | None = None,
    pending_review: int | None = None,
    sort: str = "date_desc",
    limit: int = 50,
    offset: int = 0,
) -> dict:
    with get_connection() as connection:
        cursor = connection.cursor()

        user_id = "default_user"
        

        base_query = """
            FROM transactions
            WHERE user_id = ?
        """

        params = [user_id]

        if month:
            base_query += " AND competency_month = ?"
            params.append(month)

        elif year:
            base_query += " AND substr(competency_month, 1, 4) = ?"
            params.append(year)

        if transaction_type:
            base_query += " AND transaction_type = ?"
            params.append(transaction_type)

        if source:
            base_query += " AND source_type = ?"
            params.append(source)

        if main_category:
            base_query += " AND main_category = ?"
            params.append(main_category)

        if subcategory:
            base_query += " AND subcategory = ?"
            params.append(subcategory)

        if category_source:
            base_query += " AND category_source = ?"
            params.append(category_source)

        if reviewed is not None:
            base_query += " AND category_reviewed = ?"
            params.append(reviewed)

        if pending_review == 1:
            base_query += """
                AND (
                    main_category IS NULL
                    OR TRIM(main_category) = ''
                    OR subcategory IS NULL
                    OR TRIM(subcategory) = ''
                    OR main_category = 'nao_identificado'
                    OR subcategory = 'nao_identificado'
                    OR (
                        main_category = 'outros'
                        AND (
                            subcategory IS NULL
                            OR TRIM(subcategory) = ''
                        )
                    )
                    OR (
                        subcategory = 'outros'
                        AND (
                            main_category IS NULL
                            OR TRIM(main_category) = ''
                        )
                    )
                )
            """

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

        items = []

        for row in rows:
            item = dict(row)

            item["display_description"] = normalize_display_description(
                raw_description=item.get("raw_description"),
                display_description=item.get("display_description"),
                transaction_type=item.get("transaction_type"),
            )

            items.append(item)

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

        user_id = "default_user"

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
            WHERE user_id = ?
            """,
            (user_id,),
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
            WHERE user_id = ?
            GROUP BY transaction_type
            ORDER BY absolute_total DESC, count DESC, transaction_type ASC
            """,
            (user_id,),
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

    user_id = "default_user"

    cursor.execute(
        """
        SELECT DISTINCT substr(competency_month, 1, 7) as month
        FROM transactions
        WHERE user_id = ?
        ORDER BY month DESC
        """,
        (user_id,)
    )

    months = [row[0] for row in cursor.fetchall()]
    conn.close()

    return months


def get_available_categories() -> list[str]:
    with get_connection() as connection:
        cursor = connection.cursor()
        
        user_id = "default_user"
        cursor.execute(
            """
            SELECT DISTINCT category
            FROM transactions
            WHERE user_id = ?
            AND category IS NOT NULL
            AND TRIM(category) != ''
            ORDER BY category COLLATE NOCASE ASC
            """,
            (user_id,)
        )

        raw_categories = [row["category"] for row in cursor.fetchall()]

    normalized_categories = {
        normalize_category_name(category)
        for category in raw_categories
        if normalize_category_name(category)
    }

    return sorted(normalized_categories)


def update_transaction_category(
    transaction_id: int,
    category: str | None = None,
    main_category: str | None = None,
    subcategory: str | None = None,
    display_description: str | None = None,
    user_note: str | None = None,
    apply_to_similar: bool = False,
) -> dict:
    user_id = "default_user"

    normalized_category = normalize_category_name(category) if category else None

    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, normalized_description
            FROM transactions
            WHERE id = ?
              AND user_id = ?
            """,
            (transaction_id, user_id),
        )
        base_transaction = cursor.fetchone()

        if not base_transaction:
            return {
                "success": False,
                "message": "Transaction not found",
            }

        base_transaction = dict(base_transaction)
        base_normalized_description = base_transaction.get("normalized_description")

        fields = []
        values = []

        category_fields_changed = any(
            value is not None
            for value in [category, main_category, subcategory]
        )

        normalized_main_category = (
            str(main_category).strip().lower()
            if main_category is not None
            else None
        )
        normalized_subcategory = (
            str(subcategory).strip().lower()
            if subcategory is not None
            else None
        )

        if main_category is not None:
            main_category = normalized_main_category

        if subcategory is not None:
            subcategory = normalized_subcategory

        if main_category is not None or subcategory is not None:
            if not main_category or not subcategory:
                return {
                    "success": False,
                    "message": "Categoria principal e subcategoria devem ser enviadas juntas",
                }

            if not is_valid_category_selection(main_category, subcategory):
                return {
                    "success": False,
                    "message": "Combinação de categoria e subcategoria inválida",
                }

        if normalized_category:
            fields.append("category = ?")
            values.append(normalized_category)

        if main_category is not None:
            fields.append("main_category = ?")
            values.append(main_category)

        if subcategory is not None:
            fields.append("subcategory = ?")
            values.append(subcategory)

        if display_description is not None:
            fields.append("display_description = ?")
            values.append(display_description)

        if user_note is not None:
            fields.append("user_note = ?")
            values.append(user_note)

        if category_fields_changed:
            fields.append("category_source = ?")
            values.append("manual")

            fields.append("category_reviewed = ?")
            values.append(1)

        if not fields:
            return {
                "success": False,
                "message": "No fields to update",
            }

        query = f"""
            UPDATE transactions
            SET {', '.join(fields)}
            WHERE id = ?
              AND user_id = ?
        """

        values_for_current_transaction = [*values, transaction_id, user_id]
        cursor.execute(query, values_for_current_transaction)
        connection.commit()

        if cursor.rowcount == 0:
            return {
                "success": False,
                "message": "Transaction not found",
            }

        similar_updated_count = 0

        if apply_to_similar and base_normalized_description:
            similar_query = f"""
                UPDATE transactions
                SET {', '.join(fields)}
                WHERE normalized_description = ?
                  AND id != ?
                  AND user_id = ?
            """

            similar_values = [
                *values,
                base_normalized_description,
                transaction_id,
                user_id,
            ]
            cursor.execute(similar_query, similar_values)
            similar_updated_count = cursor.rowcount
            connection.commit()

        cursor.execute(
            """
            SELECT
                category,
                main_category,
                subcategory,
                display_description,
                user_note,
                category_source,
                category_reviewed
            FROM transactions
            WHERE id = ?
              AND user_id = ?
            """,
            (transaction_id, user_id),
        )
        updated_row = dict(cursor.fetchone())

    return {
        "success": True,
        "message": "Transaction updated successfully",
        "transaction_id": transaction_id,
        "category": updated_row["category"],
        "main_category": updated_row["main_category"],
        "subcategory": updated_row["subcategory"],
        "display_description": updated_row["display_description"],
        "user_note": updated_row["user_note"],
        "category_source": updated_row["category_source"],
        "category_reviewed": updated_row["category_reviewed"],
        "apply_to_similar": apply_to_similar,
        "similar_updated_count": similar_updated_count,
    }


def get_similar_transactions_preview(transaction_id: int) -> dict:
    user_id = "default_user"

    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, normalized_description
            FROM transactions
            WHERE id = ?
              AND user_id = ?
            """,
            (transaction_id, user_id),
        )
        base_transaction = cursor.fetchone()

        if not base_transaction:
            return {
                "success": False,
                "message": "Transaction not found",
                "transaction_id": transaction_id,
                "similar_count": 0,
            }

        base_transaction = dict(base_transaction)
        base_normalized_description = base_transaction.get("normalized_description")

        if not base_normalized_description:
            return {
                "success": True,
                "transaction_id": transaction_id,
                "similar_count": 0,
            }

        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM transactions
            WHERE normalized_description = ?
              AND id != ?
              AND user_id = ?
            """,
            (base_normalized_description, transaction_id, user_id),
        )
        row = cursor.fetchone()
        similar_count = row["total"] if row else 0

    return {
        "success": True,
        "transaction_id": transaction_id,
        "similar_count": similar_count,
    }


def bulk_update_transaction_category(
    transaction_ids: list[int],
    category: str | None = None,
    main_category: str | None = None,
    subcategory: str | None = None,
    display_description: str | None = None,
    user_note: str | None = None,
) -> dict:
    user_id = "default_user"

    if not transaction_ids:
        return {
            "success": False,
            "updated_count": 0,
            "message": "Nenhuma transação foi enviada para atualização",
        }

    normalized_category = normalize_category_name(category) if category else None

    normalized_main_category = (
        str(main_category).strip().lower()
        if main_category is not None
        else None
    )
    normalized_subcategory = (
        str(subcategory).strip().lower()
        if subcategory is not None
        else None
    )

    if main_category is not None:
        main_category = normalized_main_category

    if subcategory is not None:
        subcategory = normalized_subcategory

    if main_category is not None or subcategory is not None:
        if not main_category or not subcategory:
            return {
                "success": False,
                "updated_count": 0,
                "message": "Categoria principal e subcategoria devem ser enviadas juntas",
            }

        if not is_valid_category_selection(main_category, subcategory):
            return {
                "success": False,
                "updated_count": 0,
                "message": "Combinação de categoria e subcategoria inválida",
            }

    with get_connection() as connection:
        cursor = connection.cursor()

        category_fields_changed = any(
            value is not None
            for value in [category, main_category, subcategory]
        )

        updated_count = 0

        for transaction_id in transaction_ids:
            fields = []
            values = []

            if normalized_category:
                fields.append("category = ?")
                values.append(normalized_category)

            if main_category is not None:
                fields.append("main_category = ?")
                values.append(main_category)

            if subcategory is not None:
                fields.append("subcategory = ?")
                values.append(subcategory)

            if display_description is not None:
                fields.append("display_description = ?")
                values.append(display_description)

            if user_note is not None:
                fields.append("user_note = ?")
                values.append(user_note)

            if category_fields_changed:
                fields.append("category_source = ?")
                values.append("manual")

                fields.append("category_reviewed = ?")
                values.append(1)

            if not fields:
                continue

            query = f"""
                UPDATE transactions
                SET {", ".join(fields)}
                WHERE id = ?
                  AND user_id = ?
            """

            cursor.execute(query, [*values, transaction_id, user_id])

            if cursor.rowcount > 0:
                updated_count += 1

        connection.commit()

    return {
        "success": True,
        "updated_count": updated_count,
        "message": f"{updated_count} transações atualizadas com sucesso",
    }


def create_manual_transaction(data: dict) -> dict:
    try:
        transaction_date = data.get("transaction_date")
        description = data.get("description")
        amount = data.get("amount")
        direction = data.get("direction")
        transaction_type = data.get("transaction_type")
        main_category = data.get("main_category")
        subcategory = data.get("subcategory")
        source_name = (data.get("source_name") or "").strip().lower()
        source_type = (data.get("source_type") or "").strip().lower()

        # validações básicas
        if not transaction_date or not description or amount is None:
            return {"success": False, "message": "Dados obrigatórios faltando"}

        if direction not in {"in", "out"}:
            return {"success": False, "message": "Direction inválido"}

        if source_type not in {"bank_account", "credit_card"}:
            return {"success": False, "message": "Origem financeira inválida"}

        if not source_name:
            return {"success": False, "message": "Informe a fonte da transação"}

        if not main_category or not subcategory:
            return {"success": False, "message": "Categoria incompleta"}

        if not is_valid_category_selection(main_category, subcategory):
            return {"success": False, "message": "Categoria inválida"}

        competency_month = transaction_date[:7]

        absolute_amount = abs(amount)

        normalized_description = normalize_display_description(
            raw_description=description,
            display_description=description,
            transaction_type=transaction_type,
        )

        transaction_hash = str(uuid.uuid4())

        with get_connection() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                INSERT INTO transactions (
                    user_id,
                    import_id,
                    transaction_date,
                    competency_month,
                    raw_description,
                    normalized_description,
                    amount,
                    absolute_amount,
                    direction,
                    transaction_type,
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
                    transaction_hash,
                    entry_mode
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "default_user",
                    0,  # import_id
                    transaction_date,
                    competency_month,
                    description,
                    normalized_description,
                    amount,
                    absolute_amount,
                    direction,
                    transaction_type,
                    main_category,
                    subcategory,
                    description,
                    "manual",  # category_source
                    1,         # category_reviewed
                    source_name,
                    source_type,
                    "manual",  # file_format
                    0,         # is_ignored_in_spending
                    0,         # is_internal_transfer
                    transaction_hash,
                    "manual",  # entry_mode
                )
            )

            connection.commit()

        return {"success": True}

    except Exception as e:
        return {"success": False, "message": str(e)}