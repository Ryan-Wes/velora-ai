from app.services.transaction_normalizer import normalize_description


CATEGORY_SCHEMA = {
    "movimentacoes": {
        "label": "Movimentações",
        "color": "#60a5fa",
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
        "color": "#f97316",
        "subcategories": {
            "internet": "Internet",
            "aluguel": "Aluguel",
            "casa": "Casa",
        },
    },
    "carro": {
        "label": "Carro",
        "color": "#facc15",
        "subcategories": {
            "combustivel": "Combustível",
            "manutencao": "Manutenção",
            "financiamento": "Financiamento",
        },
    },
    "alimentacao": {
        "label": "Alimentação",
        "color": "#ef4444",
        "subcategories": {
            "mercado": "Mercado",
            "restaurante": "Restaurante",
        },
    },
    "transporte": {
        "label": "Transporte",
        "color": "#38bdf8",
        "subcategories": {
            "uber": "Uber",
            "transporte_app": "Transporte por app",
        },
    },
    "assinaturas": {
        "label": "Assinaturas",
        "color": "#8b5cf6",
        "subcategories": {
            "software": "Software",
            "streaming": "Streaming",
        },
    },
    "compras": {
        "label": "Compras",
        "color": "#22c55e",
        "subcategories": {
            "online": "Online",
            "acessorios": "Acessórios",
        },
    },
    "saude": {
        "label": "Saúde",
        "color": "#14b8a6",
        "subcategories": {
            "farmacia": "Farmácia",
            "consulta": "Consulta",
            "academia": "Academia",
            "pet": "Pet",
        },
    },
    "vestuario": {
        "label": "Vestuário",
        "color": "#ec4899",
        "subcategories": {
            "roupas": "Roupas",
        },
    },
    "lazer": {
        "label": "Lazer",
        "color": "#a855f7",
        "subcategories": {
            "entretenimento": "Entretenimento",
        },
    },
    "nao_identificado": {
        "label": "Não identificado",
        "color": "#71717a",
        "subcategories": {
            "nao_identificado": "Não identificado",
        },
    },
}


def get_category_schema() -> dict:
    ordered_categories = []

    for key, value in CATEGORY_SCHEMA.items():
        ordered_categories.append(
            {
                "key": key,
                "label": value["label"],
                "color": value["color"],
                "subcategories": [
                    {"key": sub_key, "label": sub_label}
                    for sub_key, sub_label in value["subcategories"].items()
                ],
            }
        )

    return {"categories": ordered_categories}


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