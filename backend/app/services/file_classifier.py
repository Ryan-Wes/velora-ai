from pathlib import Path


def detect_file_format(filename: str) -> str:
    extension = Path(filename).suffix.lower()

    if extension == ".pdf":
        return "pdf"
    if extension == ".ofx":
        return "ofx"
    if extension == ".csv":
        return "csv"

    return "unknown"


def detect_source_name(filename: str) -> str:
    lowered_name = filename.lower()

    if "nubank" in lowered_name or lowered_name.startswith("nu_"):
        return "nubank"

    return "unknown"


def detect_source_type(filename: str) -> str:
    lowered_name = filename.lower()

    if "fatura" in lowered_name:
        return "credit_card"
    if "extrato" in lowered_name:
        return "bank_account"

    return "unknown"


def detect_nubank_csv_type(file_bytes: bytes) -> str:
    try:
        content = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        return "unknown"

    lines = content.splitlines()
    if not lines:
        return "unknown"

    first_line = lines[0].strip().lower()

    if first_line == "date,title,amount":
        return "credit_card"

    if first_line == "data,valor,identificador,descrição":
        return "bank_account"

    return "unknown"