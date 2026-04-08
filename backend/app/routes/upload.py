from sqlite3 import IntegrityError

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.file_classifier import detect_nubank_csv_type

from app.services.file_classifier import (
    detect_file_format,
    detect_source_name,
    detect_source_type,
)
from app.services.import_service import create_import
from app.services.parsers.credit_card_csv_parser import parse_credit_card_csv
from app.services.parsers.bank_account_csv_parser import parse_bank_account_csv
from app.services.transaction_service import save_transactions
from app.services.pdf_text_reader import extract_text_from_pdf
from app.services.source_detector import detect_source_type_from_text
from app.utils.file_handler import (
    generate_file_hash,
    get_uploaded_file_path,
    save_uploaded_file,
)

router = APIRouter()


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file")

    file_bytes = await file.read()
    file_hash = generate_file_hash(file_bytes)

    file_format = detect_file_format(file.filename)
    source_name = detect_source_name(file.filename)
    source_type = detect_source_type(file.filename)

    if file_format == "unknown":
        raise HTTPException(status_code=400, detail="Unsupported file format")

    saved_filename = save_uploaded_file(file_bytes, file.filename)

    extracted_text = ""
    parsed_transactions = []
    transactions = []
    save_result = {
        "inserted_count": 0,
        "skipped_count": 0,
        "skipped_transactions": [],
    }

    if file_format == "pdf":
        file_path = get_uploaded_file_path(saved_filename)
        extracted_text = extract_text_from_pdf(str(file_path))

        if source_type == "unknown":
            source_type = detect_source_type_from_text(extracted_text)

    if file_format == "csv" and source_name == "nubank":
        detected_csv_type = detect_nubank_csv_type(file_bytes)

        if detected_csv_type != "unknown":
            source_type = detected_csv_type

    try:
        import_id = create_import(
            filename=saved_filename,
            file_hash=file_hash,
            source_name=source_name,
            source_type=source_type,
            file_format=file_format,
        )
    except IntegrityError:
        raise HTTPException(status_code=409, detail="File already imported")

    if file_format == "csv" and source_name == "nubank":
        if source_type == "credit_card":
            transactions = parse_credit_card_csv(file_bytes)

        elif source_type == "bank_account":
            transactions = parse_bank_account_csv(file_bytes)

        parsed_transactions = transactions

        if transactions:
            save_result = save_transactions(
                import_id=import_id,
                transactions=transactions,
            )

    return {
        "import_id": import_id,
        "original_filename": file.filename,
        "saved_filename": saved_filename,
        "file_hash": file_hash,
        "file_format": file_format,
        "source_name": source_name,
        "source_type": source_type,
        "message": "File uploaded and registered successfully",
        "parsed_transactions_preview": parsed_transactions[:20],
        "parsed_transactions_count": len(parsed_transactions),
        "transactions_count": len(transactions),
        "inserted_count": save_result["inserted_count"],
        "skipped_count": save_result["skipped_count"],
        "skipped_transactions": save_result["skipped_transactions"],
    }