import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "finsight.db"


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _get_existing_columns(cursor: sqlite3.Cursor, table_name: str) -> set[str]:
    cursor.execute(f"PRAGMA table_info({table_name})")
    rows = cursor.fetchall()
    return {row["name"] for row in rows}


def _ensure_transactions_columns(cursor: sqlite3.Cursor) -> None:
    existing_columns = _get_existing_columns(cursor, "transactions")

    columns_to_add = {
        "main_category": "TEXT",
        "subcategory": "TEXT",
        "display_description": "TEXT",
        "user_note": "TEXT",
        "entry_mode": "TEXT DEFAULT 'imported'",
    }

    for column_name, column_definition in columns_to_add.items():
        if column_name not in existing_columns:
            cursor.execute(
                f"ALTER TABLE transactions ADD COLUMN {column_name} {column_definition}"
            )


def create_tables() -> None:
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS imports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                file_hash TEXT NOT NULL UNIQUE,
                source_name TEXT NOT NULL,
                source_type TEXT NOT NULL,
                file_format TEXT NOT NULL,
                statement_period_start TEXT,
                statement_period_end TEXT,
                due_date TEXT,
                total_amount REAL,
                import_status TEXT NOT NULL,
                warning_message TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL,
                color TEXT NOT NULL,
                is_system INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS subcategories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL,
                key TEXT NOT NULL,
                label TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(category_id, key),
                FOREIGN KEY (category_id) REFERENCES categories (id)
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS transactions (
                user_id TEXT DEFAULT 'default_user',
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_id INTEGER NOT NULL,
                transaction_date TEXT NOT NULL,
                competency_month TEXT NOT NULL,
                raw_description TEXT NOT NULL,
                normalized_description TEXT,
                amount REAL NOT NULL,
                absolute_amount REAL NOT NULL,
                direction TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                category TEXT,
                main_category TEXT,
                subcategory TEXT,
                display_description TEXT,
                user_note TEXT,
                category_source TEXT NOT NULL DEFAULT 'rule',
                category_reviewed INTEGER NOT NULL DEFAULT 0,
                source_name TEXT NOT NULL,
                source_type TEXT NOT NULL,
                file_format TEXT NOT NULL,
                is_ignored_in_spending INTEGER NOT NULL DEFAULT 0,
                is_internal_transfer INTEGER NOT NULL DEFAULT 0,
                installment_current INTEGER,
                installment_total INTEGER,
                transaction_hash TEXT NOT NULL UNIQUE,
                ai_merchant_suggestion TEXT,
                ai_category_suggestion TEXT,
                ai_confidence REAL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (import_id) REFERENCES imports (id)
            )
            """
        )

        _ensure_transactions_columns(cursor)

        connection.commit()