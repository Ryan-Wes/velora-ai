import re

from app.database import get_connection
from app.services.transaction_normalizer import normalize_description

MIN_KEY_LENGTH = 3


def build_learning_key(normalized_description: str | None) -> str:
    """Reduz a descrição ao nome do estabelecimento, sem o que muda a cada cobrança
    (número da parcela, conversão em dólar, códigos longos)."""
    # A IA recebe o texto como aparece na tela; normalizar de novo é inofensivo nas já normalizadas
    key = normalize_description(normalized_description or "")

    key = re.sub(r"\s*-?\s*parcela\s*\d+\s*$", "", key)
    key = re.sub(r"\s+(usd|eur)\s*[\d.,]+.*$", "", key)
    key = re.sub(r"\b\d{4,}\b", " ", key)
    key = re.sub(r"\s+", " ", key)

    return key.strip(" -*")


def remember_decision(
    cursor,
    user_id: str,
    normalized_description: str | None,
    main_category: str | None,
    subcategory: str | None,
) -> bool:
    key = build_learning_key(normalized_description)

    if len(key) < MIN_KEY_LENGTH or not main_category or not subcategory:
        return False

    # Confirmar a mesma escolha reforça a regra; escolher outra recomeça a contagem
    cursor.execute(
        """
        INSERT INTO learned_rules (user_id, pattern, main_category, subcategory)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (user_id, pattern) DO UPDATE SET
            times_confirmed = CASE
                WHEN learned_rules.main_category = excluded.main_category
                 AND learned_rules.subcategory = excluded.subcategory
                THEN learned_rules.times_confirmed + 1
                ELSE 1
            END,
            main_category = excluded.main_category,
            subcategory = excluded.subcategory,
            updated_at = CURRENT_TIMESTAMP
        """,
        (user_id, key, main_category, subcategory),
    )

    return True


def remember_decisions_for_transactions(
    cursor,
    user_id: str,
    transaction_ids: list[int],
    main_category: str | None,
    subcategory: str | None,
) -> int:
    if not main_category or not subcategory:
        return 0

    # Uma regra por estabelecimento, mesmo que vários lançamentos dele tenham sido editados
    seen_keys = set()
    remembered = 0

    for transaction_id in transaction_ids:
        cursor.execute(
            "SELECT normalized_description FROM transactions WHERE id = ? AND user_id = ?",
            (transaction_id, user_id),
        )
        row = cursor.fetchone()

        if not row:
            continue

        key = build_learning_key(row["normalized_description"])

        if key in seen_keys:
            continue

        seen_keys.add(key)

        if remember_decision(
            cursor, user_id, row["normalized_description"], main_category, subcategory
        ):
            remembered += 1

    return remembered


def load_learned_rules(user_id: str) -> dict[str, dict]:
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT pattern, main_category, subcategory, times_confirmed
            FROM learned_rules
            WHERE user_id = ?
            """,
            (user_id,),
        )

        return {row["pattern"]: dict(row) for row in cursor.fetchall()}


def find_learned_rule(rules: dict[str, dict], normalized_description: str | None) -> dict | None:
    return rules.get(build_learning_key(normalized_description))


def get_recent_examples(user_id: str, limit: int = 15) -> list[dict]:
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT pattern, main_category, subcategory
            FROM learned_rules
            WHERE user_id = ?
            ORDER BY times_confirmed DESC, updated_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        )

        return [dict(row) for row in cursor.fetchall()]
