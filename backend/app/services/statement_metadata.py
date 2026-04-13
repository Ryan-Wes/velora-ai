import re
from datetime import datetime, timedelta


MONTH_MAP = {
    "JAN": 1,
    "FEV": 2,
    "MAR": 3,
    "ABR": 4,
    "MAI": 5,
    "JUN": 6,
    "JUL": 7,
    "AGO": 8,
    "SET": 9,
    "OUT": 10,
    "NOV": 11,
    "DEZ": 12,
}


def parse_nubank_period_from_filename(filename: str) -> dict:
    upper_name = filename.upper()

    match = re.search(r"(\d{2})([A-Z]{3})(\d{4})_(\d{2})([A-Z]{3})(\d{4})", upper_name)

    if not match:
        return {
            "statement_period_start": None,
            "statement_period_end": None,
            "due_date": None,
        }

    start_day, start_mon, start_year, end_day, end_mon, end_year = match.groups()

    start_date = datetime(
        int(start_year),
        MONTH_MAP[start_mon],
        int(start_day),
    ).date()

    end_date = datetime(
        int(end_year),
        MONTH_MAP[end_mon],
        int(end_day),
    ).date()

    inferred_due_date = infer_due_date_from_period_end(end_date)

    return {
        "statement_period_start": start_date.isoformat(),
        "statement_period_end": end_date.isoformat(),
        "due_date": inferred_due_date,
    }


def infer_due_date_from_period_end(period_end_date) -> str:
    inferred_date = period_end_date + timedelta(days=1)
    return inferred_date.isoformat()