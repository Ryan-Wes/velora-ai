from app.services.transaction_service import list_transactions, normalize_category_name

INCOME_TYPES = {
    "transfer_in",
    "pix_in",
}

EXPENSE_TYPES = {
    "credit_card_bill_payment",
    "pix_out",
    "transfer_out",
    "bill_payment",
    "bank_transaction",
}


def is_real_income_transaction(transaction: dict) -> bool:
    return transaction.get("transaction_type") in INCOME_TYPES


def is_real_expense_transaction(transaction: dict) -> bool:
    return transaction.get("transaction_type") in EXPENSE_TYPES


def consolidate_transactions(
    user_id: str,
    month: str | None = None,
    year: str | None = None,
    transaction_type: str | None = None,
    source: str | None = None,
) -> dict:
    transactions_data = list_transactions(
        user_id=user_id,
        month=month,
        year=year,
        transaction_type=transaction_type,
        source=source,
        limit=100000,
        offset=0,
    )

    transactions = transactions_data["items"]

    total_income = 0.0
    total_expenses = 0.0
    real_income = 0.0
    real_expenses = 0.0
    internal_transfers_total = 0.0
    ignored_total = 0.0
    reserve_redemption_total = 0.0
    reserve_application_total = 0.0

    income_transactions = []
    expense_transactions = []
    ignored_transactions = []
    internal_transfer_transactions = []

    for transaction in transactions:
        absolute_amount = float(transaction["absolute_amount"])
        is_ignored_in_spending = int(transaction["is_ignored_in_spending"])
        is_internal_transfer = int(transaction["is_internal_transfer"])

        if is_real_income_transaction(transaction):
            total_income += absolute_amount
            real_income += absolute_amount
            income_transactions.append(transaction)

        if is_real_expense_transaction(transaction):
            total_expenses += absolute_amount
            real_expenses += absolute_amount
            expense_transactions.append(transaction)

        if is_ignored_in_spending:
            ignored_total += absolute_amount
            ignored_transactions.append(transaction)

        if is_internal_transfer:
            internal_transfers_total += absolute_amount
            internal_transfer_transactions.append(transaction)

        if transaction.get("transaction_type") == "investment_redemption":
            reserve_redemption_total += absolute_amount

        if transaction.get("transaction_type") == "investment_application":
            reserve_application_total += absolute_amount

    reserve_net = reserve_application_total - reserve_redemption_total

    net_cashflow = real_income - real_expenses

    reserve_dependency = 0.0

    if real_expenses > 0 and reserve_net < 0:
        reserve_dependency = (abs(reserve_net) / real_expenses) * 100

    return {
        "transactions_count": len(transactions),
        "income_count": len(income_transactions),
        "expense_count": len(expense_transactions),
        "ignored_count": len(ignored_transactions),
        "internal_transfer_count": len(internal_transfer_transactions),
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "real_income": round(real_income, 2),
        "real_expenses": round(real_expenses, 2),
        "ignored_total": round(ignored_total, 2),
        "internal_transfers_total": round(internal_transfers_total, 2),
        "reserve_redemption_total": round(reserve_redemption_total, 2),
        "reserve_dependency": round(reserve_dependency, 2),
        "net_cashflow": round(net_cashflow, 2),
        "by_type": build_consolidated_by_type(transactions),
        "by_source_type": build_consolidated_by_source_type(transactions),
        "reserve_application_total": round(reserve_application_total, 2),
        "reserve_net": round(reserve_net, 2),
    }


def build_consolidated_by_type(transactions: list[dict]) -> list[dict]:
    grouped = {}

    for transaction in transactions:
        transaction_type = transaction["transaction_type"]
        absolute_amount = float(transaction["absolute_amount"])
        is_ignored_in_spending = int(transaction["is_ignored_in_spending"])
        is_internal_transfer = int(transaction["is_internal_transfer"])

        if transaction_type not in grouped:
            grouped[transaction_type] = {
                "transaction_type": transaction_type,
                "count": 0,
                "income_total": 0.0,
                "expense_total": 0.0,
                "real_total": 0.0,
                "ignored_total": 0.0,
                "internal_transfer_total": 0.0,
            }

        grouped[transaction_type]["count"] += 1

        if is_real_income_transaction(transaction):
            grouped[transaction_type]["income_total"] += absolute_amount

        if is_real_expense_transaction(transaction):
            grouped[transaction_type]["expense_total"] += absolute_amount

        if is_ignored_in_spending:
            grouped[transaction_type]["ignored_total"] += absolute_amount

        if is_internal_transfer:
            grouped[transaction_type]["internal_transfer_total"] += absolute_amount

        if is_real_income_transaction(transaction):
            grouped[transaction_type]["real_total"] += absolute_amount
        elif is_real_expense_transaction(transaction):
            grouped[transaction_type]["real_total"] -= absolute_amount

    return sorted(
        [
            {
                "transaction_type": item["transaction_type"],
                "count": item["count"],
                "income_total": round(item["income_total"], 2),
                "expense_total": round(item["expense_total"], 2),
                "real_total": round(item["real_total"], 2),
                "ignored_total": round(item["ignored_total"], 2),
                "internal_transfer_total": round(item["internal_transfer_total"], 2),
            }
            for item in grouped.values()
        ],
        key=lambda item: (
            -(item["income_total"] + item["expense_total"]),
            -item["count"],
            item["transaction_type"],
        ),
    )


def build_consolidated_by_source_type(transactions: list[dict]) -> list[dict]:
    grouped = {}

    for transaction in transactions:
        source_type = transaction["source_type"]
        absolute_amount = float(transaction["absolute_amount"])
        is_ignored_in_spending = int(transaction["is_ignored_in_spending"])
        is_internal_transfer = int(transaction["is_internal_transfer"])

        if source_type not in grouped:
            grouped[source_type] = {
                "source_type": source_type,
                "count": 0,
                "income_total": 0.0,
                "expense_total": 0.0,
                "real_income": 0.0,
                "real_expenses": 0.0,
                "ignored_total": 0.0,
                "internal_transfer_total": 0.0,
            }

        grouped[source_type]["count"] += 1

        if is_real_income_transaction(transaction):
            grouped[source_type]["income_total"] += absolute_amount
            grouped[source_type]["real_income"] += absolute_amount

        if is_real_expense_transaction(transaction):
            grouped[source_type]["expense_total"] += absolute_amount
            grouped[source_type]["real_expenses"] += absolute_amount

        if is_ignored_in_spending:
            grouped[source_type]["ignored_total"] += absolute_amount

        if is_internal_transfer:
            grouped[source_type]["internal_transfer_total"] += absolute_amount

    return sorted(
        [
            {
                "source_type": item["source_type"],
                "count": item["count"],
                "income_total": round(item["income_total"], 2),
                "expense_total": round(item["expense_total"], 2),
                "real_income": round(item["real_income"], 2),
                "real_expenses": round(item["real_expenses"], 2),
                "ignored_total": round(item["ignored_total"], 2),
                "internal_transfer_total": round(item["internal_transfer_total"], 2),
            }
            for item in grouped.values()
        ],
        key=lambda item: (
            -(item["income_total"] + item["expense_total"]),
            -item["count"],
            item["source_type"],
        ),
    )


def get_by_category_summary(
    user_id: str,
    month: str | None = None,
    transaction_type: str | None = None,
    source: str | None = None,
) -> list[dict]:
    transactions_data = list_transactions(
        user_id=user_id,
        month=month,
        transaction_type=transaction_type,
        source=source,
        limit=100000,
        offset=0,
    )

    transactions = transactions_data["items"]
    grouped = {}

    category_expense_types = {
        "purchase",
        "pix_out",
        "transfer_out",
        "bill_payment",
        "bank_transaction",
    }

    for transaction in transactions:
        is_ignored = int(transaction["is_ignored_in_spending"])
        is_internal = int(transaction["is_internal_transfer"])
        transaction_type_value = transaction.get("transaction_type")
        direction = transaction["direction"]
        absolute_amount = float(transaction["absolute_amount"])

        # transferências internas nunca entram no donut
        if is_internal:
            continue

        # itens ignorados ficam fora, exceto compras no cartão,
        # porque elas são consumo real por categoria no donut
        if is_ignored and transaction_type_value != "purchase":
            continue

        raw_main_category = transaction.get("main_category")
        raw_legacy_category = transaction.get("category")

        category = (
            normalize_category_name(raw_main_category)
            or normalize_category_name(raw_legacy_category)
            or "sem categoria"
        )

        # movimentações não entram no donut
        if category == "movimentacoes":
            continue

        # no donut entram só gastos de consumo por categoria
        # fatura do cartão fica fora para não duplicar as compras
        if transaction_type_value not in category_expense_types:
            continue

        if category not in grouped:
            grouped[category] = {
                "category": category,
                "count": 0,
                "income_total": 0.0,
                "expense_total": 0.0,
            }

        grouped[category]["count"] += 1

        if direction == "in":
            grouped[category]["income_total"] += absolute_amount
        elif direction == "out":
            grouped[category]["expense_total"] += absolute_amount

    return sorted(
        [
            {
                "category": item["category"],
                "count": item["count"],
                "income_total": round(item["income_total"], 2),
                "expense_total": round(item["expense_total"], 2),
            }
            for item in grouped.values()
        ],
        key=lambda item: (-item["expense_total"], -item["count"], item["category"]),
    )


def get_monthly_trend_summary(
    user_id: str,
    transaction_type: str | None = None,
    source: str | None = None,
) -> list[dict]:
    transactions_data = list_transactions(
        user_id=user_id,
        month=None,
        transaction_type=transaction_type,
        source=source,
        limit=100000,
        offset=0,
    )

    transactions = transactions_data["items"]
    grouped = {}

    for transaction in transactions:
        month = transaction["competency_month"]
        absolute_amount = float(transaction["absolute_amount"])

        if month not in grouped:
            grouped[month] = {
                "month": month,
                "income": 0.0,
                "expenses": 0.0,
                "cashflow": 0.0,
            }

        if is_real_income_transaction(transaction):
            grouped[month]["income"] += absolute_amount

        if is_real_expense_transaction(transaction):
            grouped[month]["expenses"] += absolute_amount

        grouped[month]["cashflow"] = (
            grouped[month]["income"] - grouped[month]["expenses"]
        )

    return [
        {
            "month": month,
            "income": round(data["income"], 2),
            "expenses": round(data["expenses"], 2),
            "cashflow": round(data["cashflow"], 2),
        }
        for month, data in sorted(grouped.items())
    ]


def get_daily_trend_summary(transactions: list[dict], month: str):
    from collections import defaultdict

    daily_data = defaultdict(lambda: {
        "date": "",
        "income": 0,
        "expense": 0,
        "items": [],
    })

    for transaction in transactions:
        if transaction.get("competency_month") != month:
            continue

        date = transaction.get("transaction_date")
        if not date:
            continue

        day = date[-2:]  # pega só o dia (01, 02, etc)

        key = day
        daily_data[key]["date"] = day

        transaction_type = transaction.get("transaction_type")
        absolute_amount = transaction.get("absolute_amount", 0)
        is_ignored = transaction.get("is_ignored_in_spending", 0)

        description = (
            transaction.get("display_description")
            or transaction.get("raw_description")
            or transaction.get("normalized_description")
            or "Transação"
)

        # ENTRADA REAL
        if transaction_type in ["transfer_in", "pix_in"]:
            daily_data[key]["income"] += absolute_amount
            daily_data[key]["items"].append({
                "type": "income",
                "description": description,
                "amount": round(absolute_amount, 2),
            })

        # SAÍDA REAL
        if (
            transaction_type in [
                "credit_card_bill_payment",
                "pix_out",
                "transfer_out",
                "bill_payment",
                "bank_transaction",
            ]
            and not is_ignored
        ):
            daily_data[key]["expense"] += absolute_amount
            daily_data[key]["items"].append({
                "type": "expense",
                "description": description,
                "amount": round(absolute_amount, 2),
            })

    # ordenar por dia
    result = sorted(daily_data.values(), key=lambda x: x["date"])

    return [
        {
            "date": item["date"],
            "income": round(item["income"], 2),
            "expense": round(item["expense"], 2),
            "items": item["items"],
        }
        for item in result
    ]