import re
from pathlib import Path

import pandas as pd
import pdfplumber

PDF_PATH = Path("data/kcet-round-2-provisional-cutoff_0hzO8Jz.pdf")
OUTPUT_PATH = Path("outputs/final_cutoffs.csv")

COURSE_NAME_COL = 0
COLLEGE_CODE_COL = 1
CATEGORY_PATTERN = re.compile(r"^(?:GM|[123]?[A-Z]{1,2}[GRK]?)$")
DISTRICTS = [
    "Bagalkote",
    "Ballari",
    "Belagavi",
    "Bengaluru Rural",
    "Bengaluru Urban",
    "Bidar",
    "Chamarajanagara",
    "Chikkaballapura",
    "Chikkamagaluru",
    "Chitradurga",
    "Dakshina Kannada",
    "Davanagere",
    "Dharwad",
    "Gadag",
    "Hassan",
    "Haveri",
    "Kalaburagi",
    "Kodagu",
    "Kolar",
    "Koppal",
    "Mandya",
    "Mysuru",
    "Raichur",
    "Ramanagara",
    "Shivamogga",
    "Tumakuru",
    "Udupi",
    "Uttara Kannada",
    "Vijayapura",
    "Vijayanagara",
    "Yadgiri",
]
DISTRICT_ALIASES = {
    "Bangalore Urban": "Bengaluru Urban",
    "Bangalore Rural": "Bengaluru Rural",
    "Bangalore": "Bengaluru Urban",
    "Bengaluru": "Bengaluru Urban",
    "Mysore": "Mysuru",
}
CITY_TO_DISTRICT = {
    "MANGALURU": "Dakshina Kannada",
    "MANGALORE": "Dakshina Kannada",
    "PUTTUR": "Dakshina Kannada",
    "HOSPETE": "Vijayanagara",
    "HOSPET": "Vijayanagara",
    "BANGALORE": "Bengaluru Urban",
    "BENGALURU": "Bengaluru Urban",
    "MYSORE": "Mysuru",
    "MYSURU": "Mysuru",
}
DISTRICT_MATCH_LOOKUP = {
    re.sub(r"\s+", " ", district.upper()).strip(): district for district in DISTRICTS
}


def normalize_text(value):
    if not value:
        return ""
    # Joins multiline values like "COMPUTER SCIENCE\nAND ENGINEERING".
    return re.sub(r"\s+", " ", str(value)).strip()


def parse_rank(value):
    text = normalize_text(value).replace(",", "")
    return int(text) if text.isdigit() else None


def standardize_district(value):
    text = normalize_text(value)
    if not text:
        return ""
    return DISTRICT_ALIASES.get(text, text)


def strip_noise_tokens(value):
    text = normalize_text(value)
    text = re.sub(r"\bKARNATAKA\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b\d{6}\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" ,.-")
    return text


def extract_district(college_line):
    clean_line = strip_noise_tokens(college_line)
    upper_line = clean_line.upper()

    for lookup, district in DISTRICT_MATCH_LOOKUP.items():
        if re.search(rf"\b{re.escape(lookup)}\b", upper_line):
            return standardize_district(district)

    for city_key, district in CITY_TO_DISTRICT.items():
        if re.search(rf"\b{re.escape(city_key)}\b", upper_line):
            return standardize_district(district)

    return ""


def detect_category_columns(row):
    category_columns = {}

    for idx, cell in enumerate(row):
        text = normalize_text(cell).upper()
        if not text:
            continue
        if CATEGORY_PATTERN.match(text):
            category_columns[idx] = text

    # A valid category header should include GM and multiple category columns.
    if "GM" not in category_columns.values() or len(category_columns) < 4:
        return {}

    return category_columns


def is_probable_header_row(row):
    first_cell = normalize_text(row[COURSE_NAME_COL]).upper() if row else ""
    return "COURSE" in first_cell or "BRANCH" in first_cell


def extract_college_from_page(page):
    page_text = page.extract_text() or ""
    # Example header: "College: E001 University Visvesvaraya College ..."
    match = re.search(r"College:\s*([A-Z]\d{3})\s+(.+)", page_text)
    if not match:
        return None, None, None

    college_code = normalize_text(match.group(1))
    college_name = normalize_text(match.group(2))
    district = extract_district(college_name)
    return college_code, college_name, district


def extract_kcet_data(path):
    all_data = []
    current_college_code = ""
    current_college_name = ""
    current_district = ""
    print("Starting extraction... this might take a minute.")

    with pdfplumber.open(path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            page_college_code, page_college_name, page_district = extract_college_from_page(page)
            if page_college_code:
                current_college_code = page_college_code
                current_college_name = page_college_name
                current_district = page_district

            tables = page.extract_tables() or []

            for table in tables:
                category_columns = {}

                for row in table:
                    if not row:
                        continue

                    if not category_columns:
                        detected = detect_category_columns(row)
                        if detected:
                            category_columns = detected
                            continue

                    if not category_columns:
                        continue

                    course_name = normalize_text(row[COURSE_NAME_COL])
                    if not course_name or is_probable_header_row(row):
                        continue

                    row_college_code = (
                        normalize_text(row[COLLEGE_CODE_COL]) if len(row) > COLLEGE_CODE_COL else ""
                    )
                    college_code = row_college_code or current_college_code

                    for col_idx, category in category_columns.items():
                        if col_idx >= len(row):
                            continue

                        cutoff_rank = parse_rank(row[col_idx])
                        if cutoff_rank is None:
                            continue

                        all_data.append(
                            {
                                "college_code": college_code,
                                "college_name": current_college_name,
                                "district": current_district,
                                "branch": course_name,
                                "category": category,
                                "cutoff_rank": cutoff_rank,
                            }
                        )

            if page_num % 10 == 0:
                print(f"Processed {page_num} pages...")

    return all_data


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = extract_kcet_data(PDF_PATH)
    df = pd.DataFrame(
        data,
        columns=["college_code", "college_name", "district", "branch", "category", "cutoff_rank"],
    )
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Done! Created {OUTPUT_PATH} with {len(df)} entries.")


if __name__ == "__main__":
    main()