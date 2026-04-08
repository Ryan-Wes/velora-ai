import csv
import io

from app.services.hash_service import generate_transaction_hash
from app.services.transaction_normalizer import normalize_description


def detect_transaction_type(description: str) -> str:
    normalized = normalize_description(description)

    if "estorno" in normalized:
        return "refund"

    if "pagamento de fatura" in normalized:
        return "credit_card_bill_payment"

    if "aplicacao rdb" in normalized:
        return "investment_application"

    if "resgate rdb" in normalized:
        return "investment_redemption"

    if "transferencia recebida" in normalized:
        return "transfer_in"

    if "transferencia enviada pelo pix" in normalized:
        return "pix_out"

    if "pagamento de boleto efetuado" in normalized:
        return "bill_payment"

    return "bank_transaction"


def build_flags(transaction_type: str) -> tuple[int, int]:
    is_ignored_in_spending = 0
    is_internal_transfer = 0

    if transaction_type in {
        "credit_card_bill_payment",
        "investment_application",
        "investment_redemption",
    }:
        is_ignored_in_spending = 1

    return is_ignored_in_spending, is_internal_transfer


def convert_date_to_iso(raw_date: str) -> str:
    day, month, year = raw_date.split("/")
    return f"{year}-{month}-{day}"

def parse_bank_account_csv(file_bytes: bytes) -> list[dict]:
    content = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))

    transactions = []

    for row_index, row in enumerate(reader):
        raw_date = row["Data"].strip()
        raw_amount = row["Valor"].strip()
        raw_description = row["Descrição"].strip()

        transaction_date = convert_date_to_iso(raw_date)

        amount = float(raw_amount.replace(",", "."))
        direction = "in" if amount > 0 else "out"
        absolute_amount = abs(amount)

        transaction_type = detect_transaction_type(raw_description)
        is_ignored_in_spending, is_internal_transfer = build_flags(transaction_type)

        normalized_description = normalize_description(raw_description)
        competency_month = transaction_date[:7]

        transaction_hash = generate_transaction_hash(
            transaction_date=transaction_date,
            raw_description=raw_description,
            amount=amount,
            source_type="bank_account",
            row_index=row_index,
        )

        transactions.append(
            {
                "transaction_date": transaction_date,
                "competency_month": competency_month,
                "raw_description": raw_description,
                "normalized_description": normalized_description,
                "amount": amount,
                "absolute_amount": absolute_amount,
                "direction": direction,
                "transaction_type": transaction_type,
                "category": None,
                "source_name": "nubank",
                "source_type": "bank_account",
                "file_format": "csv",
                "is_ignored_in_spending": is_ignored_in_spending,
                "is_internal_transfer": is_internal_transfer,
                "installment_current": None,
                "installment_total": None,
                "transaction_hash": transaction_hash,
                "ai_merchant_suggestion": None,
                "ai_category_suggestion": None,
                "ai_confidence": None,
            }
        )

    return transactions