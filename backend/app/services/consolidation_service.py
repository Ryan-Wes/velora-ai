from app.services.transaction_service import list_transactions


from app.services.transaction_service import list_transactions


def consolidate_transactions(
    month: str | None = None,
    transaction_type: str | None = None,
    source: str | None = None,
) -> dict:
    transactions_data = list_transactions(
        month=month,
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

    income_transactions = []
    expense_transactions = []
    ignored_transactions = []
    internal_transfer_transactions = []

    for transaction in transactions:
        absolute_amount = float(transaction["absolute_amount"])
        direction = transaction["direction"]
        is_ignored_in_spending = int(transaction["is_ignored_in_spending"])
        is_internal_transfer = int(transaction["is_internal_transfer"])

        if direction == "in":
            total_income += absolute_amount
            income_transactions.append(transaction)

            if not is_ignored_in_spending and not is_internal_transfer:
                real_income += absolute_amount

        elif direction == "out":
            total_expenses += absolute_amount
            expense_transactions.append(transaction)

            if not is_ignored_in_spending and not is_internal_transfer:
                real_expenses += absolute_amount

        if is_ignored_in_spending:
            ignored_total += absolute_amount
            ignored_transactions.append(transaction)

        if is_internal_transfer:
            internal_transfers_total += absolute_amount
            internal_transfer_transactions.append(transaction)

    net_cashflow = real_income - real_expenses

    by_type = build_consolidated_by_type(transactions)
    by_source_type = build_consolidated_by_source_type(transactions)

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
        "net_cashflow": round(net_cashflow, 2),
        "by_type": build_consolidated_by_type(transactions),
        "by_source_type": build_consolidated_by_source_type(transactions),
    }


def build_consolidated_by_type(transactions: list[dict]) -> list[dict]:
    grouped = {}

    for transaction in transactions:
        transaction_type = transaction["transaction_type"]
        direction = transaction["direction"]
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

        if direction == "in":
            grouped[transaction_type]["income_total"] += absolute_amount
        elif direction == "out":
            grouped[transaction_type]["expense_total"] += absolute_amount

        if is_ignored_in_spending:
            grouped[transaction_type]["ignored_total"] += absolute_amount

        if is_internal_transfer:
            grouped[transaction_type]["internal_transfer_total"] += absolute_amount

        if not is_ignored_in_spending and not is_internal_transfer:
            if direction == "in":
                grouped[transaction_type]["real_total"] += absolute_amount
            elif direction == "out":
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
        direction = transaction["direction"]
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

        if direction == "in":
            grouped[source_type]["income_total"] += absolute_amount
        elif direction == "out":
            grouped[source_type]["expense_total"] += absolute_amount

        if is_ignored_in_spending:
            grouped[source_type]["ignored_total"] += absolute_amount

        if is_internal_transfer:
            grouped[source_type]["internal_transfer_total"] += absolute_amount

        if not is_ignored_in_spending and not is_internal_transfer:
            if direction == "in":
                grouped[source_type]["real_income"] += absolute_amount
            elif direction == "out":
                grouped[source_type]["real_expenses"] += absolute_amount

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