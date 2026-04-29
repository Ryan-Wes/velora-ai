from sqlite3 import IntegrityError

from fastapi import APIRouter, File, UploadFile, Depends

from app.services.file_classifier import (
    detect_file_format,
    detect_source_name,
    detect_source_type,
    detect_nubank_csv_type,
)
from app.services.import_service import create_import
from app.services.parsers.bank_account_csv_parser import parse_bank_account_csv
from app.services.parsers.bank_account_pdf_parser import (
    extract_statement_lines,
    parse_bank_account_pdf,
)
from app.services.parsers.credit_card_csv_parser import parse_credit_card_csv
from app.services.parsers.credit_card_pdf_parser import (
    extract_statement_metadata,
    extract_transaction_section_lines,
    parse_credit_card_pdf,
)
from app.services.pdf_text_reader import extract_text_from_pdf
from app.services.source_detector import detect_source_type_from_text
from app.services.statement_metadata import parse_nubank_period_from_filename
from app.services.transaction_service import save_transactions
from app.utils.file_handler import (
    generate_file_hash,
    get_uploaded_file_path,
    save_uploaded_file,
)

from app.services.auth_service import get_current_user_id

router = APIRouter()


@router.post("/upload")
async def upload_file(
    files: list[UploadFile] = File(...),
    user_id: str = Depends(get_current_user_id),
):
    results = []

    for file in files:
        if not file.filename:
            continue

        try:
            file_bytes = await file.read()
            file_hash = generate_file_hash(file_bytes)

            file_format = detect_file_format(file.filename)
            source_name = detect_source_name(file.filename)
            source_type = detect_source_type(file.filename)

            if file_format == "unknown":
                results.append(
                    {
                        "filename": file.filename,
                        "error": "Unsupported file format",
                    }
                )
                continue

            saved_filename = save_uploaded_file(file_bytes, file.filename)

            extracted_text = ""
            transactions = []
            parsed_transactions = []
            save_result = {
                "inserted_count": 0,
                "skipped_count": 0,
                "skipped_transactions": [],
            }

            statement_period_start = None
            statement_period_end = None
            due_date = None
            total_amount = None
            debug_transaction_lines = []

            # PDF FLOW
            if file_format == "pdf":
                file_path = get_uploaded_file_path(saved_filename)
                extracted_text = extract_text_from_pdf(str(file_path))

                if source_type == "unknown":
                    source_type = detect_source_type_from_text(extracted_text)

                if source_type == "credit_card":
                    metadata = extract_statement_metadata(extracted_text)

                    statement_period_start = metadata["statement_period_start"]
                    statement_period_end = metadata["statement_period_end"]
                    due_date = metadata["due_date"]
                    total_amount = metadata["total_amount"]

                    debug_transaction_lines = extract_transaction_section_lines(
                        extracted_text
                    )
                    transactions = parse_credit_card_pdf(extracted_text)

                elif source_type == "bank_account":
                    metadata = parse_nubank_period_from_filename(file.filename)

                    statement_period_start = metadata["statement_period_start"]
                    statement_period_end = metadata["statement_period_end"]
                    due_date = metadata["due_date"]

                    debug_transaction_lines = extract_statement_lines(extracted_text)
                    transactions = parse_bank_account_pdf(extracted_text)

            # CSV FLOW
            if file_format == "csv" and source_name == "nubank":
                detected_csv_type = detect_nubank_csv_type(file_bytes)

                if detected_csv_type != "unknown":
                    source_type = detected_csv_type

                if source_type == "credit_card":
                    transactions = parse_credit_card_csv(file_bytes)

                elif source_type == "bank_account":
                    transactions = parse_bank_account_csv(file_bytes)

            # CREATE IMPORT
            try:
                import_id = create_import(
                    user_id=user_id,
                    filename=saved_filename,
                    file_hash=file_hash,
                    source_name=source_name,
                    source_type=source_type,
                    file_format=file_format,
                    statement_period_start=statement_period_start,
                    statement_period_end=statement_period_end,
                    due_date=due_date,
                    total_amount=total_amount,
                )
            except IntegrityError:
                results.append(
                    {
                        "filename": file.filename,
                        "error": "File already imported",
                    }
                )
                continue

            # SAVE TRANSACTIONS
            parsed_transactions = transactions

            if transactions:
                save_result = save_transactions(
                    import_id=import_id,
                    transactions=transactions,
                    user_id=user_id,
                )

            results.append(
                {
                    "import_id": import_id,
                    "original_filename": file.filename,
                    "saved_filename": saved_filename,
                    "file_hash": file_hash,
                    "file_format": file_format,
                    "source_name": source_name,
                    "source_type": source_type,
                    "statement_period_start": statement_period_start,
                    "statement_period_end": statement_period_end,
                    "due_date": due_date,
                    "total_amount": total_amount,
                    "message": "File uploaded and registered successfully",
                    "parsed_transactions_preview": parsed_transactions[:20],
                    "parsed_transactions_count": len(parsed_transactions),
                    "transactions_count": len(transactions),
                    "inserted_count": save_result["inserted_count"],
                    "skipped_count": save_result["skipped_count"],
                    "skipped_transactions": save_result["skipped_transactions"],
                    "debug_transaction_lines_count": len(debug_transaction_lines),
                    "debug_transaction_lines_preview": debug_transaction_lines[:40],
                }
            )

        except Exception as e:
            results.append(
                {
                    "filename": file.filename,
                    "error": str(e),
                }
            )

    return {"results": results}