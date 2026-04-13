import re

from app.services.hash_service import generate_transaction_hash
from app.services.parsers.credit_card_pdf_parser import parse_ptbr_date
from app.services.transaction_normalizer import normalize_description
from app.services.category_service import categorize_transaction


DATE_ONLY_PATTERN = re.compile(
    r"^(\d{2})\s+([A-ZÇ]{3})\s+(\d{4})$",
    re.IGNORECASE,
)

SECTION_LABEL_PATTERN = re.compile(
    r"^Total de (entradas|sa[ií]das)$",
    re.IGNORECASE,
)

SECTION_SIGN_PATTERN = re.compile(
    r"^([+\-−])\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})$",
    re.IGNORECASE,
)

MONEY_ONLY_PATTERN = re.compile(
    r"^(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})$",
    re.IGNORECASE,
)

INLINE_MONEY_PATTERN = re.compile(
    r"^(.*\S)\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})$",
    re.IGNORECASE,
)


def parse_money_br(value: str) -> float:
    return float(value.replace(".", "").replace(",", "."))


def should_ignore_line(line: str) -> bool:
    normalized = normalize_description(line)

    ignored_patterns = [
        r"^wesley ryan lopes da rocha$",
        r"^cpf$",
        r"^agencia$",
        r"^conta$",
        r"^0001$",
        r"^58468534-0$",
        r"^a$",
        r"^valores em r$",
        r"^\d{2} de [a-z]+ de \d{4}$",
        r"^saldo final do periodo$",
        r"^saldo inicial$",
        r"^rendimento liquido$",
        r"^total de entradas$",
        r"^total de saidas$",
        r"^movimentacoes$",
        r"^tem alguma duvida.*",
        r"^caso a solucao fornecida.*",
        r"^metropolitanas.*",
        r"^disponiveis em nubank.com.br.*",
        r"^extrato gerado.*",
        r"^o saldo liquido corresponde.*",
        r"^nao nos responsabilizamos.*",
        r"^asseguramos.*",
        r"^nu financeira.*",
        r"^nu pagamentos.*",
        r"^investimento$",
        r"^cnpj.*",
        r"^\d+ de \d+$",
        r"^\.+\d{3}\.\d{3}-.*$",   # cpf mascarado normalizado
        r"^conta:.*$",             # linha de conta inteira não deve virar transação
    ]

    return any(re.match(pattern, normalized, re.IGNORECASE) for pattern in ignored_patterns)


def clean_raw_description(raw_description: str) -> str:
    description = raw_description

    # remove cpf mascarado
    description = re.sub(r"•••\.\d{3}\.\d{3}-••", "", description, flags=re.IGNORECASE)
    description = re.sub(r"\.+\d{3}\.\d{3}-\.*", "", description, flags=re.IGNORECASE)

    # remove bloco Conta
    description = re.sub(r"\bConta:.*$", "", description, flags=re.IGNORECASE)

    # 🔥 remove Agência
    description = re.sub(r"\bAg[eê]ncia:\s*\d+", "", description, flags=re.IGNORECASE)

    # remove lixo de hífen duplicado
    description = re.sub(r"\s*-\s*-\s*", " - ", description)

    # remove múltiplos espaços
    description = re.sub(r"\s+", " ", description).strip()

    # remove pontuação solta no final
    description = re.sub(r"[:\-–]+$", "", description).strip()

    return description


def detect_bank_transaction_type(description: str) -> str:
    normalized = normalize_description(description)

    if "fatura" in normalized and "pagamento" in normalized:
        return "credit_card_bill_payment"

    if normalized.startswith("transferencia recebida"):
        return "transfer_in"

    if normalized.startswith("transferencia enviada pelo pix"):
        return "pix_out"

    if normalized.startswith("transferencia enviada"):
        return "transfer_out"

    if normalized.startswith("resgate rdb"):
        return "investment_redemption"

    if normalized.startswith("aplicacao rdb"):
        return "investment_application"

    if normalized.startswith("estorno"):
        return "refund"

    if normalized.startswith("pagamento de boleto efetuado"):
        return "bill_payment"

    return "bank_transaction"


def build_flags(transaction_type: str) -> tuple[int, int]:
    is_ignored_in_spending = 0
    is_internal_transfer = 0

    # investimentos → não entram no gasto
    if transaction_type in {
        "investment_application",
        "investment_redemption",
    }:
        is_ignored_in_spending = 1

    # transferências internas → não são gasto real
    if transaction_type in {
        "transfer_in",
        "transfer_out",
        "credit_card_bill_payment",
    }:
        is_internal_transfer = 1

    return is_ignored_in_spending, is_internal_transfer



def extract_statement_lines(pdf_text: str) -> list[str]:
    raw_lines = [line.strip() for line in pdf_text.splitlines() if line.strip()]

    movement_lines = []
    inside_movements = False

    for line in raw_lines:
        normalized = normalize_description(line)

        if normalized == "movimentacoes":
            inside_movements = True
            continue

        if not inside_movements:
            continue

        if normalized.startswith("o saldo liquido corresponde"):
            break

        if should_ignore_line(line):
            continue

        movement_lines.append(line)

    return movement_lines


def build_transaction(
    *,
    current_date: str,
    current_direction: str,
    raw_description: str,
    amount: float,
    row_index: int,
) -> dict:
    transaction_type = detect_bank_transaction_type(raw_description)
    is_ignored_in_spending, is_internal_transfer = build_flags(transaction_type)

    signed_amount = amount if current_direction == "in" else -amount

    transaction_hash = generate_transaction_hash(
        transaction_date=current_date,
        raw_description=raw_description,
        amount=signed_amount,
        source_type="bank_account",
        row_index=row_index,
    )

    return {
        "transaction_date": current_date,
        "competency_month": current_date[:7],
        "raw_description": raw_description,
        "normalized_description": normalize_description(raw_description),
        "amount": signed_amount,
        "absolute_amount": amount,
        "direction": current_direction,
        "transaction_type": transaction_type,
        "category": categorize_transaction(raw_description, transaction_type),
        "source_name": "nubank",
        "source_type": "bank_account",
        "file_format": "pdf",
        "is_ignored_in_spending": is_ignored_in_spending,
        "is_internal_transfer": is_internal_transfer,
        "installment_current": None,
        "installment_total": None,
        "transaction_hash": transaction_hash,
        "ai_merchant_suggestion": None,
        "ai_category_suggestion": None,
        "ai_confidence": None,
    }


def parse_bank_account_pdf(pdf_text: str) -> list[dict]:
    lines = extract_statement_lines(pdf_text)

    transactions = []
    row_index = 0

    current_date = None
    current_direction = None
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        date_match = DATE_ONLY_PATTERN.match(line)
        if date_match:
            day, month_abbr, year = date_match.groups()
            current_date = parse_ptbr_date(f"{day} {month_abbr}", year)
            i += 1
            continue

        label_match = SECTION_LABEL_PATTERN.match(line)
        if label_match:
            i += 1
            continue

        sign_match = SECTION_SIGN_PATTERN.match(line)
        if sign_match:
            sign = sign_match.group(1)
            current_direction = "in" if sign == "+" else "out"
            i += 1
            continue

        if not current_date or not current_direction:
            i += 1
            continue

        if should_ignore_line(line):
            i += 1
            continue

        # Caso simples: descrição + valor na mesma linha, mas só se o valor for monetário de verdade
        inline_match = INLINE_MONEY_PATTERN.match(line)
        if inline_match:
            raw_description = clean_raw_description(inline_match.group(1).strip())
            amount = parse_money_br(inline_match.group(2).strip())

            if raw_description:
                transactions.append(
                    build_transaction(
                        current_date=current_date,
                        current_direction=current_direction,
                        raw_description=raw_description,
                        amount=amount,
                        row_index=row_index,
                    )
                )
                row_index += 1

            i += 1
            continue

        # Caso multilinha
        description_parts = [line]
        amount = None
        i += 1

        while i < len(lines):
            current_line = lines[i].strip()

            if DATE_ONLY_PATTERN.match(current_line):
                break

            if SECTION_LABEL_PATTERN.match(current_line):
                break

            if SECTION_SIGN_PATTERN.match(current_line):
                break

            if should_ignore_line(current_line):
                i += 1
                continue

            money_only_match = MONEY_ONLY_PATTERN.match(current_line)
            if money_only_match:
                amount = parse_money_br(money_only_match.group(1))
                i += 1
                break

            next_inline_match = INLINE_MONEY_PATTERN.match(current_line)
            if next_inline_match:
                description_parts.append(next_inline_match.group(1).strip())
                amount = parse_money_br(next_inline_match.group(2).strip())
                i += 1
                break

            description_parts.append(current_line)
            i += 1

        if amount is None:
            continue

        raw_description = clean_raw_description(" ".join(description_parts))

        if not raw_description:
            continue

        transactions.append(
            build_transaction(
                current_date=current_date,
                current_direction=current_direction,
                raw_description=raw_description,
                amount=amount,
                row_index=row_index,
            )
        )
        row_index += 1

    return transactions