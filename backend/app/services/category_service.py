import re
import unicodedata
from sqlite3 import IntegrityError

from app.database import get_connection
from app.services.transaction_normalizer import normalize_description

def slugify_key(value: str) -> str:
    cleaned = " ".join((value or "").strip().split())

    if not cleaned:
        return ""

    normalized = unicodedata.normalize("NFKD", cleaned)
    normalized = normalized.encode("ascii", "ignore").decode("utf-8")
    normalized = normalized.lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    normalized = re.sub(r"_+", "_", normalized).strip("_")

    return normalized

CATEGORY_SCHEMA = {
    "movimentacoes": {
        "label": "Movimentações",
        "color": "#94a3b8",
        "subcategories": {
            "caixinha": "Caixinha",
            "fatura": "Fatura",
            "pix_enviado": "Pix enviado",
            "pix_recebido": "Pix recebido",
            "transferencia_enviada": "Transferência enviada",
            "transferencia_recebida": "Transferência recebida",
            "boleto": "Boleto",
            "estorno": "Estorno",
            "ajuste": "Ajuste",
        },
    },
    "moradia": {
        "label": "Moradia",
        "color": "#e54ba4",
        "subcategories": {
            "internet": "Internet",
            "aluguel": "Aluguel",
            "casa": "Casa",
        },
    },
    "carro": {
        "label": "Carro",
        "color": "#92d4f7",
        "subcategories": {
            "combustivel": "Combustível",
            "manutencao": "Manutenção",
            "financiamento": "Financiamento",
        },
    },
    "alimentacao": {
        "label": "Alimentação",
        "color": "#8b5cf6",
        "subcategories": {
            "mercado": "Mercado",
            "restaurante": "Restaurante",
        },
    },
    "transporte": {
        "label": "Transporte",
        "color": "#93c5fd",
        "subcategories": {
            "uber": "Uber",
            "transporte_app": "Transporte por app",
        },
    },
    "assinaturas": {
        "label": "Assinaturas",
        "color": "#fde68a",
        "subcategories": {
            "software": "Software",
            "streaming": "Streaming",
        },
    },
    "compras": {
        "label": "Compras",
        "color": "#c1f2ad",
        "subcategories": {
            "online": "Online",
            "acessorios": "Acessórios",
        },
    },
    "saude": {
        "label": "Saúde",
        "color": "#99f6e4",
        "subcategories": {
            "farmacia": "Farmácia",
            "consulta": "Consulta",
            "academia": "Academia",
            "pet": "Pet",
        },
    },
    "vestuario": {
        "label": "Vestuário",
        "color": "#f3b3d8",
        "subcategories": {
            "roupas": "Roupas",
        },
    },
    "lazer": {
        "label": "Lazer",
        "color": "#d8b4fe",
        "subcategories": {
            "entretenimento": "Entretenimento",
        },
    },
    "nao_identificado": {
        "label": "Não identificado",
        "color": "#a8a8b3",
        "subcategories": {
            "nao_identificado": "Não identificado",
        },
    },
    "outros": {
        "label": "Outros",
        "color": "#ffd",
        "subcategories": {
            "outros": "Outros",
        },
    },
}


def seed_categories_if_needed() -> None:
    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute("SELECT COUNT(*) AS total FROM categories")
        row = cursor.fetchone()
        total = row["total"] if row else 0

        if total > 0:
            return

        for category_key, category_data in CATEGORY_SCHEMA.items():
            cursor.execute(
                """
                INSERT INTO categories (key, label, color, is_system)
                VALUES (?, ?, ?, ?)
                """,
                (
                    category_key,
                    category_data["label"],
                    category_data["color"],
                    1,
                ),
            )

            category_id = cursor.lastrowid

            for subcategory_key, subcategory_label in category_data["subcategories"].items():
                cursor.execute(
                    """
                    INSERT INTO subcategories (category_id, key, label)
                    VALUES (?, ?, ?)
                    """,
                    (
                        category_id,
                        subcategory_key,
                        subcategory_label,
                    ),
                )

        connection.commit()


def get_category_schema() -> dict:
    seed_categories_if_needed()

    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                key,
                label,
                color
            FROM categories
            ORDER BY is_system DESC, label COLLATE NOCASE ASC
            """
        )
        category_rows = cursor.fetchall()

        ordered_categories = []

        for category_row in category_rows:
            category_id = category_row["id"]

            cursor.execute(
                """
                SELECT
                    key,
                    label
                FROM subcategories
                WHERE category_id = ?
                ORDER BY label COLLATE NOCASE ASC
                """,
                (category_id,),
            )
            subcategory_rows = cursor.fetchall()

            ordered_categories.append(
                {
                    "key": category_row["key"],
                    "label": category_row["label"],
                    "color": category_row["color"],
                    "subcategories": [
                        {
                            "key": subcategory_row["key"],
                            "label": subcategory_row["label"],
                        }
                        for subcategory_row in subcategory_rows
                    ],
                }
            )

    return {"categories": ordered_categories}


def is_valid_category_selection(
    main_category: str | None,
    subcategory: str | None,
) -> bool:
    normalized_main_category = (main_category or "").strip().lower()
    normalized_subcategory = (subcategory or "").strip().lower()

    if not normalized_main_category or not normalized_subcategory:
        return False

    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT 1
            FROM categories c
            INNER JOIN subcategories s ON s.category_id = c.id
            WHERE c.key = ?
              AND s.key = ?
            LIMIT 1
            """,
            (normalized_main_category, normalized_subcategory),
        )

        row = cursor.fetchone()

    return row is not None


def create_category(label: str, color: str | None = None) -> dict:
    seed_categories_if_needed()

    normalized_label = " ".join((label or "").strip().split())
    generated_key = slugify_key(normalized_label)

    if not normalized_label:
        return {
            "success": False,
            "message": "Label da categoria é obrigatório",
        }

    if not generated_key:
        return {
            "success": False,
            "message": "Não foi possível gerar uma key válida para a categoria",
        }

    final_color = (color or "").strip() or "#a78bfa"

    try:
        with get_connection() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                INSERT INTO categories (key, label, color, is_system)
                VALUES (?, ?, ?, ?)
                """,
                (generated_key, normalized_label, final_color, 0),
            )
            connection.commit()

        return {
            "success": True,
            "message": "Categoria criada com sucesso",
            "key": generated_key,
            "label": normalized_label,
            "color": final_color,
        }
    except IntegrityError:
        return {
            "success": False,
            "message": "Já existe uma categoria com esse nome/chave",
        }


def update_category(category_key: str, label: str, color: str | None = None) -> dict:
    normalized_label = " ".join((label or "").strip().split()) or None

    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, key, label, color
            FROM categories
            WHERE key = ?
            """,
            (category_key,),
        )
        existing_category = cursor.fetchone()

        if not existing_category:
            return {
                "success": False,
                "message": "Categoria não encontrada",
            }

        final_color = (color or "").strip() or existing_category["color"]

        cursor.execute(
            """
            UPDATE categories
            SET
                label = COALESCE(?, label),
                color = COALESCE(?, color),
                updated_at = CURRENT_TIMESTAMP
            WHERE key = ?
            """,
            (normalized_label, color, category_key),
        )
        connection.commit()

    return {
        "success": True,
        "message": "Categoria atualizada com sucesso",
        "key": category_key,
        "label": normalized_label or existing_category["label"],
        "color": final_color,
    }


def create_subcategory(category_key: str, label: str) -> dict:
    normalized_label = " ".join((label or "").strip().split())
    generated_key = slugify_key(normalized_label)

    if not normalized_label:
        return {
            "success": False,
            "message": "Label da subcategoria é obrigatório",
        }

    if not generated_key:
        return {
            "success": False,
            "message": "Não foi possível gerar uma key válida para a subcategoria",
        }

    try:
        with get_connection() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id
                FROM categories
                WHERE key = ?
                """,
                (category_key,),
            )
            category_row = cursor.fetchone()

            if not category_row:
                return {
                    "success": False,
                    "message": "Categoria não encontrada",
                }

            cursor.execute(
                """
                INSERT INTO subcategories (category_id, key, label)
                VALUES (?, ?, ?)
                """,
                (category_row["id"], generated_key, normalized_label),
            )
            connection.commit()

        return {
            "success": True,
            "message": "Subcategoria criada com sucesso",
            "category_key": category_key,
            "key": generated_key,
            "label": normalized_label,
        }
    except IntegrityError:
        return {
            "success": False,
            "message": "Já existe uma subcategoria com esse nome/chave nessa categoria",
        }


def update_subcategory(category_key: str, subcategory_key: str, label: str) -> dict:
    normalized_label = " ".join((label or "").strip().split())

    if not normalized_label:
        return {
            "success": False,
            "message": "Label da subcategoria é obrigatório",
        }

    with get_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT s.id
            FROM subcategories s
            INNER JOIN categories c ON c.id = s.category_id
            WHERE c.key = ? AND s.key = ?
            """,
            (category_key, subcategory_key),
        )
        subcategory_row = cursor.fetchone()

        if not subcategory_row:
            return {
                "success": False,
                "message": "Subcategoria não encontrada",
            }

        cursor.execute(
            """
            UPDATE subcategories
            SET label = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (normalized_label, subcategory_row["id"]),
        )
        connection.commit()

    return {
        "success": True,
        "message": "Subcategoria atualizada com sucesso",
        "category_key": category_key,
        "key": subcategory_key,
        "label": normalized_label,
    }


CATEGORY_RULES = {
    "mercado": [
        "zaffari",
        "carrefour",
        "big",
        "nacional",
        "atacadao",
        "assai",
        "guanabara",
        "condor",
        "mercado livre",
        "pao de acucar",
        "supermercado",
    ],
    "alimentacao": [
        "ifood",
        "aiqfome",
        "restaurante",
        "lancheria",
        "lanche",
        "hamburguer",
        "pizza",
        "sushi",
        "cafeteria",
        "padaria",
        "burger king",
        "mcdonald",
        "subway",
    ],
    "transporte": [
        "uber",
        "99",
        "taxi",
        "cabify",
        "onibus",
        "metro",
        "passagem",
    ],
    "carro": [
        "posto",
        "ipiranga",
        "shell",
        "petrobras",
        "combustivel",
        "gasolina",
        "etanol",
        "estacionamento",
        "lavacar",
        "mecanica",
        "oficina",
        "detran",
        "pedagio",
    ],
    "roupas": [
        "renner",
        "cea",
        "riachuelo",
        "hering",
        "nike",
        "adidas",
        "netshoes",
        "centauro",
        "zara",
        "shein",
        "textil",
        "moda",
        "loja",
        "boutique",
    ],
    "saude": [
        "farmacia",
        "droga",
        "drogaria",
        "panvel",
        "sao joao",
        "consulta",
        "clinica",
        "hospital",
        "exame",
        "odonto",
        "gym",
        "gympass",
        "wellhub",
    ],
    "casa": [
        "leroy",
        "tumelero",
        "cassol",
        "madeira",
        "magazine luiza",
        "casas bahia",
        "movel",
        "eletro",
    ],
    "assinaturas": [
        "spotify",
        "netflix",
        "amazon prime",
        "prime video",
        "youtube",
        "google one",
        "icloud",
        "hbo",
        "disney",
        "deezer",
        "tecnologia",
        "software",
        "servico",
        "serviços",
        "trivvo",
    ],
    "lazer": [
        "cinema",
        "ingresso",
        "teatro",
        "show",
        "steam",
        "playstation",
        "xbox",
        "epic games",
    ],
    "compras": [
        "mercadolivre",
        "mercado livre",
        "shopee",
        "amazon",
        "amazonmktplc",
        "aliexpress",
        "alipay",
        "temu",
        "magalu",
        "americanas",
    ],
}


def categorize_transaction(raw_description: str, transaction_type: str) -> str:
    normalized_description = normalize_description(raw_description)

    if transaction_type in {
        "investment_application",
        "investment_redemption",
    }:
        return "movimentacoes"

    if transaction_type in {
        "credit_card_bill_payment",
        "transfer_in",
        "transfer_out",
        "pix_in",
        "pix_out",
        "refund",
        "bill_payment",
    }:
        return "movimentacoes"

    for category, keywords in CATEGORY_RULES.items():
        if any(keyword.replace(" ", "") in normalized_description.replace(" ", "") for keyword in keywords):
            return category

    if transaction_type in {"purchase", "bank_transaction"}:
        return "nao_identificado"

    return "movimentacoes"


def map_to_main_and_subcategory(
    category: str | None,
    normalized_description: str | None,
    transaction_type: str | None,
) -> tuple[str | None, str | None]:
    text = (normalized_description or "").lower().strip()
    compact_text = text.replace(" ", "")
    category = (category or "").lower().strip()

    def has_any(*keywords: str) -> bool:
        return any(keyword in text for keyword in keywords)

    def has_any_compact(*keywords: str) -> bool:
        return any(keyword.replace(" ", "") in compact_text for keyword in keywords)

    # 1) Movimentações e transações que não são gasto categorizável por merchant
    if transaction_type == "investment_application":
        return "movimentacoes", "caixinha"

    if transaction_type == "investment_redemption":
        return "movimentacoes", "caixinha"

    if transaction_type == "credit_card_bill_payment":
        return "movimentacoes", "fatura"

    if transaction_type == "transfer_in":
        return "movimentacoes", "transferencia_recebida"

    if transaction_type == "transfer_out":
        return "movimentacoes", "transferencia_enviada"

    if transaction_type == "pix_in":
        return "movimentacoes", "pix_recebido"

    if transaction_type == "pix_out":
        return "movimentacoes", "pix_enviado"

    if transaction_type == "refund":
        return "movimentacoes", "estorno"

    # 2) Contas e boletos
    if transaction_type == "bill_payment":
        if has_any("claro", "powernet", "cnnet", "hz telecom", "telefonica", "vivo", "tim"):
            return "moradia", "internet"

        if has_any("aymore", "financiamento", "financ"):
            return "carro", "financiamento"

        return "movimentacoes", "boleto"

    # 3) Assinaturas / software
    if has_any_compact("openai", "chatgpt", "openai*chatgpt", "chatgptsubscr"):
        return "assinaturas", "software"

    if has_any_compact(
        "applecombill",
        "apple.combill",
        "apple.com/bill",
        "itunes",
        "appstore",
        "icloud",
    ):
        return "assinaturas", "software"

    if has_any("youtube", "youtube member", "google youtube", "youtube mem"):
        return "assinaturas", "streaming"

    if has_any("spotify", "netflix", "prime video", "amazon prime", "disney", "hbo", "deezer"):
        return "assinaturas", "streaming"

    if has_any("wellhub", "gympass"):
        return "saude", "academia"

    if has_any("trivvo", "software", "servico de software", "serviço de software"):
        return "assinaturas", "software"

    # 4) Transporte
    if has_any_compact("uber", "uber*trip", "triphelp"):
        return "transporte", "uber"

    if has_any("99", "taxi", "cabify", "onibus", "ônibus", "metro", "metrô", "passagem"):
        return "transporte", "transporte_app"

    # 5) Carro
    if has_any(
        "posto",
        "ipiranga",
        "shell",
        "petrobras",
        "combust",
        "gasolina",
        "etanol",
        "sim camaqua",
        "ricall combustiveis",
        "abastecedora",
        "rede furnas",
        "sem parar",
        "egr",
    ):
        return "carro", "combustivel"

    if has_any(
        "mecanica",
        "mecânica",
        "oficina",
        "auto eletrica",
        "auto eletrica canaan",
        "grala auto service",
        "hidraumec",
        "positron",
        "guinchos",
        "seguro",
        "detran",
        "pedagio",
        "pedágio",
    ):
        return "carro", "manutencao"

    # 6) Saúde
    if has_any(
        "farmacia",
        "farmácia",
        "droga",
        "drogaria",
        "farma",
        "farmaflores",
        "panvel",
        "sao joao",
        "são joão",
    ):
        return "saude", "farmacia"

    if has_any("consulta", "clinica", "clínica", "hospital", "exame", "medimagem", "odonto"):
        return "saude", "consulta"

    if has_any("univeterinari", "veterinari", "veterinaria", "veterinário", "veterinario"):
        return "saude", "pet"

    # 7) Alimentação
    if has_any(
        "ifood",
        "aiqfome",
        "ze delivery",
        "zé delivery",
        "delivery",
        "subway",
        "burger",
        "burguer",
        "pizza",
        "lancheria",
        "lanche",
        "cafeteria",
        "cafe",
        "café",
        "padaria",
        "cheirin bao",
        "quiosque art dos sabor",
        "burgers do gigante",
        "burguer boss",
        "romy alimentos",
        "gordao delivery",
        "gordão delivery",
        "mix bebidas",
        "joaobebidas",
        "joao bebidas",
    ):
        return "alimentacao", "restaurante"

    if has_any(
        "zaffari",
        "carrefour",
        "big",
        "nacional",
        "atacadao",
        "atacadão",
        "assai",
        "açai",
        "macro atacado",
        "macro atacado krolow",
        "supermercado",
    ):
        return "alimentacao", "mercado"

    # 8) Compras / marketplace
    if has_any_compact("mercadolivre", "mercadolivre*"):
        return "compras", "online"

    if has_any_compact("shopee", "aliexpress", "alipay", "temu", "amazonmktplc", "amazon"):
        return "compras", "online"

    if has_any("gocase"):
        return "compras", "acessorios"

    # 9) Vestuário
    if has_any(
        "shein",
        "kl10 modas",
        "miss make",
        "cea",
        "cea slg",
        "renner",
        "riachuelo",
        "hering",
        "zara",
        "textil",
        "textil lt",
        "modas",
        "lojadamada",
        "bazar esporte",
    ):
        return "vestuario", "roupas"

    # 10) Moradia / utilidades
    if has_any(
        "casa sutil",
        "leroy",
        "tumelero",
        "cassol",
        "madeira",
        "magazine luiza",
        "casas bahia",
        "movel",
        "móvel",
        "eletro",
        "eletrica",
        "elétrica",
    ):
        return "moradia", "casa"

    # 11) Lazer
    if has_any("cinema", "ingresso", "teatro", "show", "steam", "playstation", "xbox", "velox tickets"):
        return "lazer", "entretenimento"

    # 12) Fallbacks mais seguros
    fallback_map = {
        "mercado": ("alimentacao", "mercado"),
        "alimentacao": ("alimentacao", "restaurante"),
        "transporte": ("transporte", "transporte_app"),
        "carro": ("carro", "manutencao"),
        "saude": ("saude", "consulta"),
        "assinaturas": ("assinaturas", "software"),
        "lazer": ("lazer", "entretenimento"),
        "roupas": ("vestuario", "roupas"),
        "vestuario": ("vestuario", "roupas"),
        "compras": ("compras", "online"),
        "casa": ("moradia", "casa"),
        "moradia": ("moradia", "casa"),
        "investimentos": ("movimentacoes", "caixinha"),
        "movimentacoes": ("movimentacoes", "ajuste"),
        "outros": ("nao_identificado", "nao_identificado"),
        "nao_identificado": ("nao_identificado", "nao_identificado"),
    }

    return fallback_map.get(category, ("nao_identificado", "nao_identificado"))