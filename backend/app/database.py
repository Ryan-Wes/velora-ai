import os
import sqlite3
from pathlib import Path

import psycopg
from psycopg_pool import ConnectionPool


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "finsight.db"

# Aceita a violação de unicidade dos dois bancos: `except IntegrityError` funciona com tupla
IntegrityError = (sqlite3.IntegrityError, psycopg.errors.IntegrityError)


def _database_url() -> str | None:
    # Lido a cada chamada porque o .env é carregado depois deste import
    return os.getenv("DATABASE_URL") or None


def use_postgres() -> bool:
    return _database_url() is not None


class Row(dict):
    """Linha acessível por nome ou por posição, como o sqlite3.Row que o resto do código espera."""

    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


def _row_factory(cursor):
    names = [column.name for column in cursor.description] if cursor.description else []

    def make_row(values):
        return Row(zip(names, values))

    return make_row


def _translate_sql(sql: str) -> str:
    # O código escreve `?` (estilo SQLite); o psycopg usa `%s`, e `%` literal precisa ser escapado
    translated = sql.replace("%", "%%").replace("?", "%s")
    # Mantém o mesmo formato de data de texto que o SQLite grava
    return translated.replace("CURRENT_TIMESTAMP", _PG_NOW)


class _PostgresCursor:
    def __init__(self, cursor):
        self._cursor = cursor
        self.lastrowid = None

    def execute(self, sql: str, params=()):
        translated = _translate_sql(sql)
        stripped = translated.lstrip()
        returns_id = (
            stripped[:6].upper() == "INSERT" and "RETURNING" not in translated.upper()
        )

        if returns_id:
            translated = f"{translated.rstrip().rstrip(';')} RETURNING id"

        self._cursor.execute(translated, params)

        if returns_id:
            row = self._cursor.fetchone()
            self.lastrowid = row["id"] if row else None

        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount


class _PostgresConnection:
    def __init__(self, pool: ConnectionPool):
        self._pool = pool
        self._connection = pool.getconn()
        self._closed = False

    def cursor(self) -> _PostgresCursor:
        return _PostgresCursor(self._connection.cursor())

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        if self._closed:
            return

        self._closed = True
        # putconn descarta a transação aberta, então nada fica pendente no pool
        self._pool.putconn(self._connection)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        try:
            if exc_type is None:
                self.commit()
            else:
                self.rollback()
        finally:
            self.close()

        return False


_pool: ConnectionPool | None = None


def _get_pool() -> ConnectionPool:
    global _pool

    if _pool is None:
        _pool = ConnectionPool(
            conninfo=_database_url(),
            min_size=1,
            max_size=int(os.getenv("DB_POOL_MAX", "5")),
            timeout=15,
            check=ConnectionPool.check_connection,
            kwargs={
                "row_factory": _row_factory,
                # O pooler do Supabase em modo transação não aceita prepared statements
                "prepare_threshold": None,
            },
            open=False,
        )
        _pool.open()

    return _pool


def get_connection():
    if use_postgres():
        return _PostgresConnection(_get_pool())

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
        "user_id": "TEXT DEFAULT 'default_user'",
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


def _ensure_imports_columns(cursor: sqlite3.Cursor) -> None:
    existing_columns = _get_existing_columns(cursor, "imports")

    if "user_id" not in existing_columns:
        cursor.execute(
            "ALTER TABLE imports ADD COLUMN user_id TEXT DEFAULT 'default_user'"
        )


def _create_tables_sqlite() -> None:
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
        _ensure_imports_columns(cursor)

        connection.commit()


# Mesmo formato de data do SQLite ("2026-10-25 14:03:00", em UTC)
_PG_NOW = "(to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))"

_POSTGRES_SCHEMA = [
    f"""
    CREATE TABLE IF NOT EXISTS imports (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default_user',
        filename TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        file_format TEXT NOT NULL,
        statement_period_start TEXT,
        statement_period_end TEXT,
        due_date TEXT,
        total_amount DOUBLE PRECISION,
        import_status TEXT NOT NULL,
        warning_message TEXT,
        created_at TEXT NOT NULL DEFAULT {_PG_NOW},
        UNIQUE (user_id, file_hash)
    )
    """,
    f"""
    CREATE TABLE IF NOT EXISTS categories (
        id BIGSERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        color TEXT NOT NULL,
        is_system INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT {_PG_NOW},
        updated_at TEXT NOT NULL DEFAULT {_PG_NOW}
    )
    """,
    f"""
    CREATE TABLE IF NOT EXISTS subcategories (
        id BIGSERIAL PRIMARY KEY,
        category_id BIGINT NOT NULL REFERENCES categories (id),
        key TEXT NOT NULL,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT {_PG_NOW},
        updated_at TEXT NOT NULL DEFAULT {_PG_NOW},
        UNIQUE (category_id, key)
    )
    """,
    # import_id sem FOREIGN KEY: lançamentos manuais usam import_id = 0
    f"""
    CREATE TABLE IF NOT EXISTS transactions (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default_user',
        import_id BIGINT NOT NULL,
        transaction_date TEXT NOT NULL,
        competency_month TEXT NOT NULL,
        raw_description TEXT NOT NULL,
        normalized_description TEXT,
        amount DOUBLE PRECISION NOT NULL,
        absolute_amount DOUBLE PRECISION NOT NULL,
        direction TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        category TEXT,
        main_category TEXT,
        subcategory TEXT,
        display_description TEXT,
        user_note TEXT,
        entry_mode TEXT DEFAULT 'imported',
        category_source TEXT NOT NULL DEFAULT 'rule',
        category_reviewed INTEGER NOT NULL DEFAULT 0,
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        file_format TEXT NOT NULL,
        is_ignored_in_spending INTEGER NOT NULL DEFAULT 0,
        is_internal_transfer INTEGER NOT NULL DEFAULT 0,
        installment_current INTEGER,
        installment_total INTEGER,
        transaction_hash TEXT NOT NULL,
        ai_merchant_suggestion TEXT,
        ai_category_suggestion TEXT,
        ai_confidence DOUBLE PRECISION,
        created_at TEXT NOT NULL DEFAULT {_PG_NOW},
        UNIQUE (user_id, transaction_hash)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_transactions_user_month ON transactions (user_id, competency_month)",
    "CREATE INDEX IF NOT EXISTS idx_transactions_user_description ON transactions (user_id, normalized_description)",
    "CREATE INDEX IF NOT EXISTS idx_transactions_import ON transactions (import_id)",
]

# No Supabase toda tabela do schema public fica exposta pela API REST com a chave pública (anon).
# Com RLS ligado e sem nenhuma policy, essa chave não lê nada; o backend conecta como dono do
# banco, que ignora o RLS.
_POSTGRES_RLS_TABLES = ["imports", "categories", "subcategories", "transactions"]


def _create_tables_postgres() -> None:
    with get_connection() as connection:
        cursor = connection.cursor()

        for statement in _POSTGRES_SCHEMA:
            cursor.execute(statement)

        for table_name in _POSTGRES_RLS_TABLES:
            cursor.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")

        connection.commit()


def create_tables() -> None:
    if use_postgres():
        _create_tables_postgres()
    else:
        _create_tables_sqlite()
