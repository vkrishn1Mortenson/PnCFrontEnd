from azure.identity import InteractiveBrowserCredential
import requests
from urllib.parse import quote
from io import BytesIO
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import re
import json

# ============================================================
# CONFIG
# ============================================================

SITE_HOSTNAME = "mortenson.sharepoint.com"
SITE_PATH = "/sites/EngineeringServices-TM"

TARGET_PATH = "ENG SRV/09 PROJECTS"

SUBSTATION_FOLDER_NAME = "50 Substation"
DESIGN_BASIS_FOLDER_NAME = "501 Design Basis"

VALID_WORD_EXTENSIONS = {".docx"}

GRAPH_SCOPE = "https://graph.microsoft.com/.default"

MAX_PROJECTS = None

# --- METADATA WRITE-BACK CONFIG ---
# Start with DRY_RUN = True to preview every payload across ALL BODs.
# Flip to False only after the printed payloads look correct.
PATCH_ENABLED = True
DRY_RUN = False
# Display names that are writable. Name (FileLeafRef) and Sensitivity
# (_ComplianceTag retention label) are read-only and intentionally excluded.
PATCHABLE_DISPLAY_NAMES = [
    "Title",
    "Reviewed (yes/no)",
    "Project Name",
    "Project Size",
    "Project Type",
    "Project Location",
    "HV Voltage",
    "MV Voltage",
    "Elevation",
    "HV Max System 3P fault Current",
    "QTY of Main Power Transformers",
]

# ============================================================
# AUTH
# ============================================================

credential = InteractiveBrowserCredential()
token = credential.get_token(GRAPH_SCOPE)

headers = {
    "Authorization": f"Bearer {token.token}"
}

# ============================================================
# COUNTERS
# ============================================================

projects_checked = 0
substation_folders_found = 0
design_basis_folders_found = 0
word_docs_found = 0
metadata_reads_successful = 0
metadata_reads_failed = 0
docx_reads_successful = 0
docx_reads_failed = 0
missed_fields_by_file = []
missed_field_totals = {}
# ============================================================
# GRAPH HELPERS
# ============================================================
def track_missed_fields(project_folder_name, file_item, extracted):
    required_fields = [
        "Name",
        "Title",
        "Reviewed (yes/no)",
        "Project Name",
        "Project Size",
        "Project Type",
        "Project Location",
        "HV Voltage",
        "MV Voltage",
        "Elevation",
        "HV Max System 3P fault Current",
        "QTY of Main Power Transformers",
        "Sensitivity",
    ]

    missed = []

    for field in required_fields:
        result = extracted.get(field, {})
        value = result.get("value", "") if isinstance(result, dict) else ""

        if not value:
            missed.append(field)
            missed_field_totals[field] = missed_field_totals.get(field, 0) + 1

    if missed:
        missed_fields_by_file.append(
            {
                "project_folder": project_folder_name,
                "file_name": file_item.get("name", ""),
                "web_url": file_item.get("webUrl", ""),
                "missed_fields": missed,
            }
        )
def graph_get(url):
    resp = requests.get(url, headers=headers)

    if not resp.ok:
        print("\nREQUEST FAILED")
        print("URL:", url)
        print("STATUS:", resp.status_code)
        print("BODY:", resp.text)
        resp.raise_for_status()

    return resp.json()


def graph_get_binary(url):
    resp = requests.get(url, headers=headers)

    if not resp.ok:
        print("\nBINARY REQUEST FAILED")
        print("URL:", url)
        print("STATUS:", resp.status_code)
        print("BODY:", resp.text[:1000])
        resp.raise_for_status()

    return resp.content


def graph_get_all_pages(url):
    results = []

    while url:
        data = graph_get(url)
        results.extend(data.get("value", []))
        url = data.get("@odata.nextLink")

    return results


def get_site_id():
    site = graph_get(
        f"https://graph.microsoft.com/v1.0/sites/"
        f"{SITE_HOSTNAME}:{SITE_PATH}"
    )

    print("\nSITE FOUND")
    print("Name:", site.get("name"))
    print("Display Name:", site.get("displayName"))
    print("Web URL:", site.get("webUrl"))
    print("Site ID:", site.get("id"))

    return site["id"]


def get_documents_drive(site_id):
    drives = graph_get_all_pages(
        f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
    )

    print("\nDRIVES FOUND")
    for drive in drives:
        print(f"- {drive.get('name')} | {drive.get('webUrl')}")

    documents_drive = next(
        d for d in drives
        if d.get("name", "").lower() == "documents"
    )

    print("\nSELECTED DRIVE")
    print("Name:", documents_drive.get("name"))
    print("ID:", documents_drive.get("id"))
    print("Web URL:", documents_drive.get("webUrl"))

    return documents_drive


def get_target_folder(drive_id):
    encoded_path = quote(TARGET_PATH, safe="/")

    target = graph_get(
        f"https://graph.microsoft.com/v1.0/drives/"
        f"{drive_id}/root:/{encoded_path}"
    )

    print("\nTARGET FOLDER FOUND")
    print("Name:", target.get("name"))
    print("ID:", target.get("id"))
    print("Web URL:", target.get("webUrl"))

    return target


def list_children(drive_id, folder_id):
    return graph_get_all_pages(
        f"https://graph.microsoft.com/v1.0/drives/"
        f"{drive_id}/items/{folder_id}/children?$top=999"
    )


def get_file_listitem_fields(drive_id, item_id):
    data = graph_get(
        f"https://graph.microsoft.com/v1.0/drives/"
        f"{drive_id}/items/{item_id}/listItem?$expand=fields"
    )

    return data.get("id"), data.get("fields", {})


def download_file_content(drive_id, item_id):
    return graph_get_binary(
        f"https://graph.microsoft.com/v1.0/drives/"
        f"{drive_id}/items/{item_id}/content"
    )

# ============================================================
# TEXT CLEANING
# ============================================================

def clean_text(value):
    if value is None:
        return ""

    value = str(value)
    value = value.replace("\xa0", " ")
    value = value.replace("\u2013", "-")
    value = value.replace("\u2014", "-")
    value = value.replace("\u2010", "-")
    value = value.replace("‑", "-")
    value = value.replace("–", "-")
    value = value.replace("—", "-")
    value = value.replace("⁰", " degrees ")
    value = value.replace("°", " degrees ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def clean_key(value):
    value = clean_text(value)
    value = value.replace("*", "")
    value = value.replace(":", "")
    value = value.strip(" -")
    return value.lower().strip()


def normalize_number_spacing(value):
    value = clean_text(value)

    value = re.sub(
        r"\b([0-9])\s+([0-9]{3})\s+(ft|feet)\b",
        r"\1,\2 ft",
        value,
        flags=re.IGNORECASE,
    )

    value = re.sub(
        r"\b([0-9])\s+([0-9]{3})\b",
        r"\1,\2",
        value,
    )

    return clean_text(value)


def normalize_kv(value):
    value = clean_text(value)
    value = value.replace("KV", "kV")
    value = value.replace("kv", "kV")
    value = re.sub(r"([0-9.]+)\s*kV", r"\1 kV", value, flags=re.IGNORECASE)
    return clean_text(value)


def normalize_ka(value):
    value = clean_text(value)
    value = value.replace("KA", "kA")
    value = value.replace("ka", "kA")
    value = re.sub(r"([0-9.]+)\s*kA", r"\1 kA", value, flags=re.IGNORECASE)
    value = re.sub(r"\b(TBD|N/A|NA|Pending|Unknown)\s*kA\b", lambda m: f"{m.group(1)} kA", value, flags=re.IGNORECASE)
    return clean_text(value)

# ============================================================
# RAW DOCX XML READER
# ============================================================

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

def xml_text_from_element(el):
    parts = []

    for node in el.iter():
        if node.tag == f"{W_NS}t":
            if node.text:
                parts.append(node.text)
        elif node.tag == f"{W_NS}tab":
            parts.append(" ")
        elif node.tag == f"{W_NS}br":
            parts.append("\n")

    return clean_text("".join(parts))


def read_document_xml(file_bytes):
    with ZipFile(BytesIO(file_bytes)) as z:
        xml = z.read("word/document.xml")

    root = ET.fromstring(xml)
    body = root.find(f"{W_NS}body")

    return body


def parse_table(tbl):
    rows = []

    for tr in tbl.findall(f"{W_NS}tr"):
        row = []

        for tc in tr.findall(f"{W_NS}tc"):
            cell_text = xml_text_from_element(tc)

            if cell_text:
                row.append(cell_text)

        if row:
            rows.append(row)

    return rows


def is_actual_heading(text):
    raw = clean_text(text)

    # Do not treat TOC entries like "1.Project Description3" as real section headings.
    allowed = {
        "Project Description": "project_description",
        "Scope of Work": "scope_of_work",
        "Applicable Design Standards": "applicable_design_standards",
        "Permitting": "permitting",
        "Site and Climatological Data": "site_and_climatological_data",
        "Geotechnical": "geotechnical",
        "Structural": "structural",
        "Civil": "civil",
        "Design Requirements": "design_requirements",
        "Physical Electrical": "physical_electrical",
        "Substation Studies": "substation_studies",
        "Switchyard Studies": "substation_studies",
        "Protection and Control": "protection_and_control",
        "Equipment Enclosure/Mechanical": "equipment_enclosure_mechanical",
        "Metering": "metering",
        "SCADA & HMI": "scada_hmi",
        "Communication": "communication",
        "Line Termination": "line_termination",
        "System Studies": "system_studies",
        "Software": "software",
        "Drawing Index List": "drawing_index_list",
        "Reports & Supporting Documentation": "reports_supporting_documentation",
        "Design Risks and Mitigation Strategies": "design_risks",
        "Safety Considerations": "safety_considerations",
        "Construction Outage Considerations and Restrictions": "construction_outage",
        "Testing and Commissioning Considerations": "testing_commissioning",
    }

    raw_no_num = re.sub(r"^\d+\.\s+", "", raw).strip()

    for label, section in allowed.items():
        if raw == label or raw_no_num == label:
            return section

    return None


def extract_docx_content(file_bytes):
    body = read_document_xml(file_bytes)

    current_section = "cover_page"

    ordered_blocks = []
    sections = {"cover_page": []}
    section_tables = {"cover_page": []}
    tables = []
    paragraphs = []

    for child in body:
        if child.tag == f"{W_NS}p":
            text = xml_text_from_element(child)

            if not text:
                continue

            maybe_section = is_actual_heading(text)

            if maybe_section:
                current_section = maybe_section
                sections.setdefault(current_section, [])
                section_tables.setdefault(current_section, [])

            paragraphs.append(text)

            block = {
                "type": "paragraph",
                "section": current_section,
                "text": text,
            }

            ordered_blocks.append(block)
            sections.setdefault(current_section, []).append(text)

        elif child.tag == f"{W_NS}tbl":
            rows = parse_table(child)

            if not rows:
                continue

            table_text = "\n".join(" | ".join(row) for row in rows)

            table_obj = {
                "section": current_section,
                "rows": rows,
                "text": table_text,
            }

            tables.append(table_obj)
            section_tables.setdefault(current_section, []).append(table_obj)

            ordered_blocks.append(
                {
                    "type": "table",
                    "section": current_section,
                    "rows": rows,
                    "text": table_text,
                }
            )

            sections.setdefault(current_section, []).append(table_text)

    full_text = "\n".join(
        block["text"]
        for block in ordered_blocks
        if block.get("text")
    )

    cleaned_sections = {
        section: clean_text("\n".join(chunks))
        for section, chunks in sections.items()
    }

    return {
        "ordered_blocks": ordered_blocks,
        "paragraphs": paragraphs,
        "tables": tables,
        "sections": cleaned_sections,
        "section_tables": section_tables,
        "full_text": clean_text(full_text),
    }

# ============================================================
# RESULT HELPERS
# ============================================================

def found(value, source="", raw=""):
    return {
        "value": clean_text(value),
        "source": clean_text(source),
        "raw": clean_text(raw),
    }


def not_found():
    return {
        "value": "",
        "source": "",
        "raw": "",
    }


def first_match(text, patterns):
    if not text:
        return None

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE | re.MULTILINE | re.DOTALL,
        )

        if match:
            return match

    return None


def all_kv_values(text):
    if not text:
        return []

    raw_values = re.findall(
        r"\b([0-9]+(?:\.[0-9]+)?)\s*k?\s*V\b",
        text,
        flags=re.IGNORECASE,
    )

    values = []

    for value in raw_values:
        try:
            values.append(float(value))
        except ValueError:
            pass

    return values


def format_kv(value):
    value = float(value)

    if value.is_integer():
        return f"{int(value)} kV"

    return f"{value:g} kV"


def word_to_number(value):
    if value is None:
        return ""

    raw = str(value).strip()
    s = raw.lower()

    mapping = {
        "one": "1",
        "two": "2",
        "three": "3",
        "four": "4",
        "five": "5",
        "six": "6",
        "seven": "7",
        "eight": "8",
        "nine": "9",
        "ten": "10",
        "eleven": "11",
        "twelve": "12",
        "thirteen": "13",
    }

    return mapping.get(s, raw)


def get_cover_text(docx_content):
    return docx_content["sections"].get("cover_page", "")


def normalize_project_line(value):
    value = clean_text(value)

    value = re.sub(
        r"\s*Project\s+No\.?\s*#?\s*[0-9A-Z\-\.]+.*$",
        "",
        value,
        flags=re.IGNORECASE,
    )

    value = re.sub(r"\bProject No\b.*$", "", value, flags=re.IGNORECASE)
    value = value.strip(" -")

    if "STANDARD PROJECT" in value.upper():
        return ""

    if "XXX" in value.upper():
        return ""

    return clean_text(value)

# ============================================================
# FIELD EXTRACTION
# ============================================================

def extract_name_from_filename(file_item):
    filename = file_item.get("name", "")

    if filename:
        return found(filename, "Filename", filename)

    return not_found()


def extract_title(docx_content, fields):
    metadata_title = clean_text(fields.get("Title", ""))

    if metadata_title:
        return found(metadata_title, "SharePoint Title", metadata_title)

    cover_text = get_cover_text(docx_content)

    lines = [
        clean_text(x)
        for x in cover_text.splitlines()
        if clean_text(x)
    ]

    for i, line in enumerate(lines[:40]):
        if re.search(r"(SUBSTATION\s+)?BASIS\s+OF\s+DESIGN", line, flags=re.IGNORECASE):
            for candidate in reversed(lines[max(0, i - 8):i]):
                if (
                    candidate
                    and "DOCUMENT NO" not in candidate.upper()
                    and "PROJECT NO" not in candidate.upper()
                    and "STANDARD PROJECT" not in candidate.upper()
                    and "XXX" not in candidate.upper()
                ):
                    return found(candidate, "Cover Page before Basis of Design", line)

    for line in lines[:25]:
        if (
            line
            and "DOCUMENT NO" not in line.upper()
            and "PROJECT NO" not in line.upper()
            and "STANDARD PROJECT" not in line.upper()
            and "BASIS OF DESIGN" not in line.upper()
            and "TABLE OF CONTENTS" not in line.upper()
        ):
            return found(line, "Cover Page title fallback", line)

    return not_found()


def extract_project_name(docx_content, fields):
    cover_text = get_cover_text(docx_content)

    patterns = [
        r"([A-Z0-9\s\-\–\/\.]+?(?:SUBSTATION|SWITCHYARD))\s*Project\s+No",
        r"([A-Z0-9\s\-\–\/\.]+?(?:SUBSTATION|SWITCHYARD))\s*\n\s*Project\s+No",
    ]

    for pattern in patterns:
        matches = re.finditer(
            pattern,
            cover_text,
            flags=re.IGNORECASE | re.MULTILINE | re.DOTALL,
        )

        for match in matches:
            value = normalize_project_line(match.group(1))

            if value:
                return found(value, "Cover Page near Project No", match.group(0))

    metadata_project_name = clean_text(fields.get("ProjectName", ""))

    if metadata_project_name:
        return found(metadata_project_name, "SharePoint ProjectName", metadata_project_name)

    title = extract_title(docx_content, fields)

    if title["value"]:
        return found(title["value"], "Title fallback", title["raw"])

    return not_found()


def extract_project_type(project_name_result, title_result, docx_content):
    project_name = project_name_result.get("value", "")
    title = title_result.get("value", "")
    cover = get_cover_text(docx_content)
    desc = docx_content["sections"].get("project_description", "")

    primary = f"{project_name}\n{title}\n{cover}".upper()
    desc_upper = desc.upper()

    if "SWITCHYARD" in primary:
        return found("Switchyard", "Cover Page / Project Name", project_name or title)

    if "BESS" in primary or "BATTERY" in primary:
        return found("BESS", "Cover Page / Project Name", project_name or title)

    if "SOLAR" in primary:
        return found("Solar", "Cover Page / Project Name", project_name or title)

    if "WIND" in primary:
        return found("Wind", "Cover Page / Project Name", project_name or title)

    if "MW/" in desc_upper and "MWH" in desc_upper:
        return found("BESS", "Project Description", desc[:300])

    if "BESS" in desc_upper or "BATTERY ENERGY STORAGE" in desc_upper or "BATTERY STORAGE" in desc_upper:
        return found("BESS", "Project Description", desc[:300])

    if "SOLAR FARM" in desc_upper or "SOLAR" in desc_upper:
        return found("Solar", "Project Description", desc[:300])

    if "WIND FARM" in desc_upper or "WIND" in desc_upper:
        return found("Wind", "Project Description", desc[:300])

    return not_found()


def extract_project_size(docx_content):
    desc = docx_content["sections"].get("project_description", "")
    full = docx_content["full_text"]

    patterns = [
        r"\b([0-9,.]+\s*MW\s*/\s*[0-9,.]+\s*MWh)\b",
        r"\b([0-9,.]+\s*MW/[0-9,.]+\s*MWh)\b",
        r"\b([0-9,.]+\s*MW\s*AC)\b",
        r"\b([0-9,.]+\s*MW\s*\(gross\))",
        r"\b([0-9,.]+\s*MW)\b",
    ]

    for source, text in [
        ("Project Description", desc),
        ("Global fallback", full),
    ]:
        match = first_match(text, patterns)

        if match:
            value = clean_text(match.group(1))
            value = re.sub(r"\s*/\s*", "/", value)
            value = re.sub(r"([0-9])MW", r"\1 MW", value, flags=re.IGNORECASE)
            value = re.sub(r"([0-9])MWh", r"\1 MWh", value, flags=re.IGNORECASE)
            return found(value, source, match.group(0))

    return not_found()


def extract_project_location(docx_content):
    desc = docx_content["sections"].get("project_description", "")
    site = docx_content["sections"].get("site_and_climatological_data", "")
    full = docx_content["full_text"]

    patterns = [
        r"located\s+near\s+([A-Za-z0-9\s\.\-]+?County\s*,?\s*[A-Z]{2})",
        r"located\s+in\s+([A-Za-z0-9\s\.\-]+?County\s*,?\s*[A-Z]{2})",
        r"located\s+at\s+([A-Za-z0-9\s\.\-]+?County\s*,?\s*[A-Z]{2})",
        r"located\s+near\s+([A-Za-z0-9\s\.\-]+?,\s*[A-Z]{2})",
        r"located\s+in\s+([A-Za-z0-9\s\.\-]+?,\s*[A-Z]{2})",
        r"located\s+at\s+([A-Za-z0-9\s\.\-]+?,\s*[A-Z]{2})",
        r"located\s+near\s+([A-Za-z0-9\s\.\-]+?,\s*[A-Za-z]+)",
        r"located\s+in\s+([A-Za-z0-9\s\.\-]+?,\s*[A-Za-z]+)",
        r"located\s+at\s+([A-Za-z0-9\s\.\-]+?,\s*[A-Za-z]+)",
    ]

    for source, text in [
        ("Project Description", desc),
        ("Site and Climatological Data", site),
        ("Global fallback", full),
    ]:
        match = first_match(text, patterns)

        if match:
            value = clean_text(match.group(1))
            value = value.strip(" ,.")
            value = re.sub(r"\s+,", ",", value)
            return found(value, source, match.group(0))

    coord_patterns = [
        r"latitude\s*([\-0-9\.]+).*?longitude\s*([\-0-9\.]+)",
        r"latitude\s*([0-9]+ degrees [^,\n]+).*?longitude\s*([\-0-9]+ degrees [^,\n]+)",
    ]

    for source, text in [
        ("Site and Climatological Data coordinates", site),
        ("Project Description coordinates", desc),
        ("Global coordinates fallback", full),
    ]:
        match = first_match(text, coord_patterns)

        if match:
            value = f"latitude {match.group(1)}, longitude {match.group(2)}"
            return found(value, source, match.group(0))

    return not_found()


def extract_hv_mv_from_project_description(desc):
    patterns = [
        {
            "name": "low side bus then high side bus",
            "regex": r"rated\s+at\s+([0-9.]+)\s*k?\s*V\s+on\s+the\s+low\s+side\s+bus\s+and\s+([0-9.]+)\s*k?\s*V\s+on\s+the\s+high\s+side\s+bus",
            "mv": 1,
            "hv": 2,
        },
        {
            "name": "high side then low side",
            "regex": r"rated\s+at\s+([0-9.]+)\s*k?\s*V\s+on\s+the\s+high\s+side\s+and\s+([0-9.]+)\s*k?\s*V\s+on\s+the\s+low\s+side",
            "hv": 1,
            "mv": 2,
        },
        {
            "name": "low side then high side",
            "regex": r"rated\s+at\s+([0-9.]+)\s*k?\s*V\s+on\s+the\s+low\s+side\s+and\s+([0-9.]+)\s*k?\s*V\s+on\s+the\s+high\s+side",
            "mv": 1,
            "hv": 2,
        },
        {
            "name": "high voltage HV side then medium voltage MV side",
            "regex": r"rated\s+at\s+([0-9.]+)\s*k?\s*V\s+on\s+the\s+high\s+voltage\s*\(HV\)\s*side\s+and\s+([0-9.]+)\s*k?\s*V\s+on\s+the\s+medium\s+voltage\s*\(MV\)\s*side",
            "hv": 1,
            "mv": 2,
        },
    ]

    for item in patterns:
        match = re.search(item["regex"], desc, flags=re.IGNORECASE | re.DOTALL)

        if match:
            hv = found(
                f"{match.group(item['hv'])} kV",
                f"Project Description rated voltage pattern: {item['name']}",
                match.group(0),
            )

            mv = found(
                f"{match.group(item['mv'])} kV",
                f"Project Description rated voltage pattern: {item['name']}",
                match.group(0),
            )

            return hv, mv

    return not_found(), not_found()


def extract_hv_mv_from_physical(physical):
    patterns = [
        r"steps?\s+the\s+voltage\s+up\s+from\s+([0-9.]+)\s*k?\s*V\s+on\s+the\s+low\s+side\s+to\s+([0-9.]+)\s*k?\s*V\s+on\s+the\s+high\s+side",
        r"step\s+up\s+the\s+voltage\s+from\s+([0-9.]+)\s*k?\s*V\s+to\s+([0-9.]+)\s*k?\s*V",
        r"transforming\s+the\s+voltage\s+from\s+([0-9.]+)\s*k?\s*V\s+to\s+([0-9.]+)\s*k?\s*V",
    ]

    for pattern in patterns:
        match = re.search(pattern, physical, flags=re.IGNORECASE | re.DOTALL)

        if match:
            return (
                found(f"{match.group(2)} kV", "Physical Electrical step-up voltage", match.group(0)),
                found(f"{match.group(1)} kV", "Physical Electrical step-up voltage", match.group(0)),
            )

    return not_found(), not_found()


def extract_hv_mv_from_cover(docx_content):
    cover = get_cover_text(docx_content)

    match = first_match(
        cover,
        [
            r"([A-Z0-9\s\-\–\/\.]+?(?:SUBSTATION|SWITCHYARD))\s*Project\s+No",
        ],
    )

    if not match:
        return not_found(), not_found()

    raw = match.group(1)
    values = all_kv_values(raw)

    if len(values) >= 2:
        return (
            found(format_kv(max(values)), "Cover Page project line", raw),
            found(format_kv(min(values)), "Cover Page project line", raw),
        )

    if len(values) == 1:
        return (
            found(format_kv(values[0]), "Cover Page project line", raw),
            not_found(),
        )

    return not_found(), not_found()


def extract_nominal_phase_to_phase_from_design(docx_content):
    tables = docx_content["section_tables"].get("design_requirements", [])
    design_text = docx_content["sections"].get("design_requirements", "")

    for table in tables:
        for row in table["rows"]:
            row_text = " | ".join(row)
            row_lower = row_text.lower()

            if "nominal phase-to-phase voltage" in row_lower:
                values = all_kv_values(row_text)

                if len(values) >= 2:
                    return (
                        found(format_kv(max(values)), "Design Requirements nominal phase-to-phase table row", row_text),
                        found(format_kv(min(values)), "Design Requirements nominal phase-to-phase table row", row_text),
                    )

                if len(values) == 1:
                    return (
                        found(format_kv(values[0]), "Design Requirements nominal phase-to-phase table row", row_text),
                        not_found(),
                    )

    match = first_match(
        design_text,
        [
            r"Nominal Phase-to-Phase Voltage\s+([0-9.]+\s*k?\s*V\*?)\s+([0-9.]+\s*k?\s*V)",
            r"Nominal Phase-to-Phase Voltage(.{0,120}?)(?:Nominal Phase-to-Ground Voltage)",
        ],
    )

    if match:
        raw = match.group(0)
        values = all_kv_values(raw)

        if len(values) >= 2:
            return (
                found(format_kv(max(values)), "Design Requirements nominal phase-to-phase text row", raw),
                found(format_kv(min(values)), "Design Requirements nominal phase-to-phase text row", raw),
            )

        if len(values) == 1:
            return (
                found(format_kv(values[0]), "Design Requirements nominal phase-to-phase text row", raw),
                not_found(),
            )

    return not_found(), not_found()


def extract_hv_mv_voltages(docx_content):
    desc = docx_content["sections"].get("project_description", "")
    physical = docx_content["sections"].get("physical_electrical", "")

    hv, mv = extract_hv_mv_from_project_description(desc)

    if hv["value"] and mv["value"]:
        return hv, mv

    hv2, mv2 = extract_hv_mv_from_physical(physical)

    if hv2["value"] and mv2["value"]:
        return hv2, mv2

    hv_cover, mv_cover = extract_hv_mv_from_cover(docx_content)

    hv_nom, mv_nom = extract_nominal_phase_to_phase_from_design(docx_content)

    final_hv = hv if hv["value"] else hv2 if hv2["value"] else hv_cover if hv_cover["value"] else hv_nom
    final_mv = mv if mv["value"] else mv2 if mv2["value"] else mv_cover if mv_cover["value"] else mv_nom

    return final_hv, final_mv


def extract_elevation(docx_content):
    site_tables = docx_content["section_tables"].get("site_and_climatological_data", [])
    site_text = docx_content["sections"].get("site_and_climatological_data", "")

    for table in site_tables:
        for row in table["rows"]:
            if len(row) < 2:
                continue

            left = clean_key(row[0])
            right = normalize_number_spacing(row[1])

            if "elevation" in left and re.search(r"\d", right):
                return found(right, "Site and Climatological Data elevation table row", " | ".join(row))

    patterns = [
        r"Elevation\*?\s*[\n ]+([<>]?\s*[0-9,\s]+(?:\.[0-9]+)?\s*ft\.?\s*(?:Above\s+Sea-level)?)",
        r"Elevation.*?([<>]?\s*[0-9,\s]+(?:\.[0-9]+)?\s*ft\.?\s*(?:Above\s+Sea-level)?)",
    ]

    match = first_match(site_text, patterns)

    if match:
        value = normalize_number_spacing(match.group(1))

        if re.search(r"\d", value):
            return found(value, "Site and Climatological Data text", match.group(0))

    return not_found()


def extract_fault_current(docx_content):
    tables = docx_content["section_tables"].get("design_requirements", [])
    design_text = docx_content["sections"].get("design_requirements", "")

    value_pattern = r"((?:TBD|N/A|NA|Pending|Unknown|[0-9]+(?:\.[0-9]+)?)\s*k\s*A)"

    for table in tables:
        for row in table["rows"]:
            row_text = " | ".join(row)
            row_lower = row_text.lower()

            if (
                "maximum system" in row_lower
                and "fault current" in row_lower
                and ("3-phase" in row_lower or "3 phase" in row_lower or "3p" in row_lower)
            ):
                values = re.findall(value_pattern, row_text, flags=re.IGNORECASE)

                if values:
                    return found(
                        normalize_ka(values[-1]),
                        "Design Requirements maximum system 3-phase fault-current table row",
                        row_text,
                    )

    match = first_match(
        design_text,
        [
            r"Maximum system 3-phase available fault current(.{0,300})",
            r"Maximum system 3 phase available fault current(.{0,300})",
            r"3P\s+Fault\s+Current(.{0,300})",
            r"Three[\-\s]?Phase\s+Fault\s+Current(.{0,300})",
            r"Available\s+Fault\s+Current(.{0,300})",
        ],
    )

    if match:
        raw = match.group(0)
        values = re.findall(value_pattern, raw, flags=re.IGNORECASE)

        if values:
            return found(
                normalize_ka(values[-1]),
                "Design Requirements maximum system 3-phase fault-current text",
                raw,
            )

    for table in tables:
        for row in table["rows"]:
            row_text = " | ".join(row)
            row_lower = row_text.lower()

            if (
                ("3ph" in row_lower or "3-phase" in row_lower or "3 phase" in row_lower)
                and "symmetrical" in row_lower
            ):
                nums = re.findall(r"\b([0-9]+(?:\.[0-9]+)?)\b", row_text)

                filtered = [
                    n for n in nums
                    if n not in {"3", "34.5", "138", "345", "525"}
                ]

                if filtered:
                    return found(
                        f"{filtered[-1]} kA",
                        "Design Requirements 3PH symmetrical table row",
                        row_text,
                    )

    return not_found()


def extract_qty_mpt(docx_content):
    desc = docx_content["sections"].get("project_description", "")
    physical = docx_content["sections"].get("physical_electrical", "")
    full = docx_content["full_text"]

    patterns = [
        r"\b([0-9]+)\s+Main Power Transformers?\b",
        r"\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen)\s+Main Power Transformers?\b",
        r"\bmain power transformers?\s*\(MPT\).*?\b([0-9]+)\b",
        r"Main Power Transformer\s*\(Qty\s*([0-9]+)\)",
        r"Main Power Transformers?\s*\(Qty\s*([0-9]+)\)",
        r"\bMPT\s*\(Qty\s*([0-9]+)\)",
        r"\b([0-9]+)\s+MPTs?\b",
    ]

    for source, text in [
        ("Project Description", desc),
        ("Physical Electrical", physical),
        ("Global fallback", full),
    ]:
        match = first_match(text, patterns)

        if match:
            value = match.group(1)

            if not value:
                value = match.group(2)

            return found(word_to_number(value), source, match.group(0))

    tags = re.findall(
        r"\bMPT\s*([0-9]+)\b|\bMPT([0-9]+)\b|\bT([0-9]+)\s*\([^)]*\)\s*MPT\b",
        f"{desc}\n{physical}",
        flags=re.IGNORECASE,
    )

    unique_nums = set()

    for tag_tuple in tags:
        for item in tag_tuple:
            if item:
                unique_nums.add(item)

    if unique_nums:
        return found(
            str(len(unique_nums)),
            "MPT tag fallback",
            ", ".join(sorted(unique_nums)),
        )

    return not_found()


def extract_sensitivity(fields):
    value = clean_text(fields.get("_ComplianceTag", ""))

    if value:
        return found(value, "SharePoint metadata _ComplianceTag", "_ComplianceTag")

    return not_found()


def extract_reviewed(fields):
    keys = [
        "Reviewed_x0028_yes_x002f_no_x0029_",
        "Reviewed",
        "ReviewedYesNo",
        "Reviewed_x0020__x0028_yes_x002f_no_x0029_",
    ]

    for key in keys:
        if key in fields:
            return found(str(fields.get(key)), f"SharePoint metadata {key}", key)

    return not_found()


def extract_candidate_values(docx_content, fields, file_item):
    name = extract_name_from_filename(file_item)
    title = extract_title(docx_content, fields)
    project_name = extract_project_name(docx_content, fields)
    project_type = extract_project_type(project_name, title, docx_content)
    project_size = extract_project_size(docx_content)
    project_location = extract_project_location(docx_content)
    hv_voltage, mv_voltage = extract_hv_mv_voltages(docx_content)
    elevation = extract_elevation(docx_content)
    fault_current = extract_fault_current(docx_content)
    qty_mpt = extract_qty_mpt(docx_content)
    sensitivity = extract_sensitivity(fields)
    reviewed = extract_reviewed(fields)

    return {
        "Name": name,
        "Title": title,
        "Reviewed (yes/no)": reviewed,
        "Project Name": project_name,
        "Project Size": project_size,
        "Project Type": project_type,
        "Project Location": project_location,
        "HV Voltage": hv_voltage,
        "MV Voltage": mv_voltage,
        "Elevation": elevation,
        "HV Max System 3P fault Current": fault_current,
        "QTY of Main Power Transformers": qty_mpt,
        "Sensitivity": sensitivity,
    }

# ============================================================
# PRINT HELPERS
# ============================================================

def print_progress():
    print(
        f"\rProjects: {projects_checked:,} | "
        f"50 Substation: {substation_folders_found:,} | "
        f"501 Design Basis: {design_basis_folders_found:,} | "
        f"Word Docs: {word_docs_found:,}",
        end="",
        flush=True,
    )


def get_current_sharepoint_value(fields, display_name):
    candidates = {
        "Name": ["FileLeafRef", "LinkFilename", "LinkFilenameNoMenu"],
        "Title": ["Title"],
        "Reviewed (yes/no)": [
            "Reviewed_x0028_yes_x002f_no_x0029_",
            "Reviewed",
        ],
        "Project Name": ["ProjectName", "Project_x0020_Name"],
        "Project Size": ["ProjectSize", "Project_x0020_Size"],
        "Project Type": ["ProjectType", "Project_x0020_Type"],
        "Project Location": ["ProjectLocation", "Project_x0020_Location"],
        "HV Voltage": ["HVVoltage", "HV_x0020_Voltage"],
        "MV Voltage": ["MVVoltage", "MV_x0020_Voltage"],
        "Elevation": ["Elevation"],
        "HV Max System 3P fault Current": [
            "HVMaxSystem3PFaultCurrent",
            "HV_x0020_Max_x0020_System_x0020_3P_x0020_fault_x0020_Current",
        ],
        "QTY of Main Power Transformers": [
            "QTYofMainPowerTransformers",
            "QTY_x0020_of_x0020_Main_x0020_Power_x0020_Transformers",
        ],
        "Sensitivity": ["_ComplianceTag"],
    }

    for key in candidates.get(display_name, []):
        if key in fields:
            return fields.get(key)

    return ""


def print_extracted_value(label, result, fields):
    value = result.get("value", "")
    source = result.get("source", "")
    raw = result.get("raw", "")
    current_sp = get_current_sharepoint_value(fields, label)

    print(f"{label}:")
    print(f"  Extracted: {value if value else '[not found]'}")
    print(f"  Source:    {source if source else '[not found]'}")
    print(f"  Current SharePoint: {current_sp if current_sp not in [None, ''] else '[blank/not returned]'}")

    if raw:
        raw_one_line = re.sub(r"\s+", " ", raw).strip()

        if len(raw_one_line) > 300:
            raw_one_line = raw_one_line[:300] + "..."

        print(f"  Raw Match: {raw_one_line}")

    print("")


def print_metadata_block(project_folder_name, file_item, list_item_id, fields, extracted):
    print("\n")
    print("=" * 120)
    print("BOD WORD FILE FOUND")
    print("=" * 120)

    print("Project Folder:")
    print(f"  {project_folder_name}")

    print("\nFile:")
    print(f"  Name: {file_item.get('name')}")
    print(f"  Web URL: {file_item.get('webUrl')}")
    print(f"  Drive Item ID: {file_item.get('id')}")
    print(f"  List Item ID: {list_item_id}")

    print("\nEXTRACTED CANDIDATE VALUES FROM DOCUMENT CONTENT")
    print("-" * 120)

    ordered_labels = [
        "Name",
        "Title",
        "Reviewed (yes/no)",
        "Project Name",
        "Project Size",
        "Project Type",
        "Project Location",
        "HV Voltage",
        "MV Voltage",
        "Elevation",
        "HV Max System 3P fault Current",
        "QTY of Main Power Transformers",
        "Sensitivity",
    ]

    for label in ordered_labels:
        print_extracted_value(label, extracted.get(label, not_found()), fields)

    print("\nSHAREPOINT METADATA / CUSTOM COLUMNS CURRENTLY ON FILE")
    print("-" * 120)

    if not fields:
        print("[no fields returned]")
    else:
        for key in sorted(fields.keys()):
            if key.startswith("@odata"):
                continue

            value = fields.get(key)

            if isinstance(value, dict):
                value = str(value)

            if isinstance(value, list):
                value = ", ".join(str(x) for x in value)

            print(f"{key}: {value}")

    print("=" * 120)

# ============================================================
# METADATA WRITE-BACK (patch extracted values into SharePoint)
# ============================================================

def graph_patch(url, payload, raise_on_error=True):
    resp = requests.patch(url, headers=headers, json=payload)

    if not resp.ok:
        if raise_on_error:
            print("\nPATCH FAILED")
            print("URL:", url)
            print("Status:", resp.status_code)
            print("Payload:", json.dumps(payload, indent=2))
            print("Body:", resp.text)
            resp.raise_for_status()
        return None, resp

    return resp.json(), resp


def get_library_columns(drive_id):
    data = graph_get(
        f"https://graph.microsoft.com/v1.0/drives/{drive_id}/list/columns"
    )
    return data.get("value", [])


def build_column_maps(columns):
    by_display_name = {}
    by_internal_name = {}
    for col in columns:
        dn = col.get("displayName")
        nm = col.get("name")
        if dn:
            by_display_name[dn] = col
        if nm:
            by_internal_name[nm] = col
    return by_display_name, by_internal_name


def get_column_type(col):
    for t in ["text", "choice", "number", "boolean", "dateTime",
              "personOrGroup", "lookup", "term"]:
        if col and t in col:
            return t
    return "unknown"


def coerce_value(value, col_type, display_name):
    if col_type == "number":
        if isinstance(value, (int, float)):
            return value
        m = re.search(r"-?\d+(?:\.\d+)?", str(value))
        if not m:
            raise ValueError(f"{display_name}: no number in {value!r}")
        num = float(m.group())
        return int(num) if num.is_integer() else num
    if col_type == "boolean":
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in ("true", "yes", "1")
    return value if isinstance(value, str) else str(value)


def build_patch_payload(extracted, by_display_name):
    """Turn the extractor output into a type-correct field payload."""
    payload = {}
    skipped = []
    for display_name in PATCHABLE_DISPLAY_NAMES:
        result = extracted.get(display_name)
        value = result.get("value", "") if isinstance(result, dict) else ""
        if value in (None, ""):
            continue
        col = by_display_name.get(display_name)
        if not col:
            skipped.append((display_name, "no matching column"))
            continue
        internal_name = col.get("name")
        col_type = get_column_type(col)
        try:
            payload[internal_name] = coerce_value(value, col_type, display_name)
        except ValueError as e:
            skipped.append((display_name, str(e)))
    return payload, skipped


def patch_file_metadata(drive_id, file_item, extracted, by_display_name):
    """Patch one BOD file's list item fields. Returns a status string."""
    item_id = file_item["id"]
    payload, skipped = build_patch_payload(extracted, by_display_name)

    print("\nPATCH PLAN for:", file_item.get("name"))
    if payload:
        for k, v in payload.items():
            print(f"  {k} = {v!r}")
    else:
        print("  (nothing to write)")
    for name, reason in skipped:
        print(f"  SKIP {name}: {reason}")

    if not payload:
        return "empty"

    if DRY_RUN:
        print("  DRY_RUN: no changes written.")
        return "dry_run"

    url = (
        f"https://graph.microsoft.com/v1.0/drives/{drive_id}"
        f"/items/{item_id}/listItem/fields"
    )

    updated, resp = graph_patch(url, payload, raise_on_error=False)
    if updated is not None:
        print("  PATCH SUCCESS (batch)")
        return "patched"

    if resp.status_code == 423:
        print("  LOCKED (423): file is open/checked out. Skipped.")
        return "locked"

    # Batch failed for another reason. Isolate field-by-field.
    print(f"  Batch failed (HTTP {resp.status_code}). Isolating fields...")
    ok, bad = [], []
    for internal_name, value in payload.items():
        u, r = graph_patch(url, {internal_name: value}, raise_on_error=False)
        if u is not None:
            ok.append(internal_name)
            continue
        # A lock can surface here too. Treat it as a file-level skip.
        if r.status_code == 423:
            print("  LOCKED (423) during field isolation. Skipping file.")
            return "locked_partial" if ok else "locked"
        bad.append((internal_name, r.status_code, r.text))
    for name in ok:
        print(f"    OK   {name}")
    for name, code, body in bad:
        print(f"    FAIL {name} (HTTP {code}): {body}")
    return "partial" if ok else "failed"

# ============================================================
# MAIN
# ============================================================

def main():
    global projects_checked
    global substation_folders_found
    global design_basis_folders_found
    global word_docs_found
    global metadata_reads_successful
    global metadata_reads_failed
    global docx_reads_successful
    global docx_reads_failed

    print("\nStarting SharePoint BOD metadata inspection...")

    site_id = get_site_id()

    documents_drive = get_documents_drive(site_id)
    drive_id = documents_drive["id"]

    target_folder = get_target_folder(drive_id)
    target_id = target_folder["id"]

    print("\nLoading document library columns for write-back...")
    library_columns = get_library_columns(drive_id)
    by_display_name, _by_internal_name = build_column_maps(library_columns)
    patch_status_totals = {}

    print("\nLoading top-level project folders...")

    top_level_items = list_children(drive_id, target_id)

    top_level_projects = [
        item for item in top_level_items
        if "folder" in item
    ]

    if MAX_PROJECTS is not None:
        top_level_projects = top_level_projects[:MAX_PROJECTS]

    total_projects = len(top_level_projects)

    print(f"Top-level project folders found: {total_projects:,}")
    print("\nScanning for:")
    print(f"  {TARGET_PATH}/[PROJECT]/{SUBSTATION_FOLDER_NAME}/{DESIGN_BASIS_FOLDER_NAME}/*.docx")
    print("\n")

    for project in top_level_projects:
        projects_checked += 1
        print_progress()

        project_folder_name = project.get("name")
        project_id = project.get("id")

        project_children = list_children(drive_id, project_id)

        substation_folder = next(
            (
                item
                for item in project_children
                if "folder" in item
                and item.get("name", "").strip().lower() == SUBSTATION_FOLDER_NAME.lower()
            ),
            None,
        )

        if not substation_folder:
            continue

        substation_folders_found += 1
        print_progress()

        substation_children = list_children(drive_id, substation_folder["id"])

        design_basis_folder = next(
            (
                item
                for item in substation_children
                if "folder" in item
                and item.get("name", "").strip().lower() == DESIGN_BASIS_FOLDER_NAME.lower()
            ),
            None,
        )

        if not design_basis_folder:
            continue

        design_basis_folders_found += 1
        print_progress()

        design_basis_children = list_children(drive_id, design_basis_folder["id"])

        word_files = [
            item for item in design_basis_children
            if "folder" not in item
            and any(item.get("name", "").lower().endswith(ext) for ext in VALID_WORD_EXTENSIONS)
        ]

        for file_item in word_files:
            word_docs_found += 1
            print_progress()

            list_item_id = None
            fields = {}

            try:
                list_item_id, fields = get_file_listitem_fields(
                    drive_id=drive_id,
                    item_id=file_item["id"],
                )
                metadata_reads_successful += 1
            except Exception as ex:
                metadata_reads_failed += 1
                fields = {
                    "METADATA_READ_ERROR": str(ex)
                }

            extracted = {}

            try:
                file_bytes = download_file_content(
                    drive_id=drive_id,
                    item_id=file_item["id"],
                )

                docx_content = extract_docx_content(file_bytes)

                extracted = extract_candidate_values(
                    docx_content=docx_content,
                    fields=fields,
                    file_item=file_item,
                )

                docx_reads_successful += 1

            except Exception as ex:
                docx_reads_failed += 1
                extracted = {
                    "DOCX_READ_ERROR": found(str(ex), "DOCX read/extract error", str(ex))
                }

            print_metadata_block(
                project_folder_name=project_folder_name,
                file_item=file_item,
                list_item_id=list_item_id,
                fields=fields,
                extracted=extracted,
            )
            track_missed_fields(
                project_folder_name=project_folder_name,
                file_item=file_item,
                extracted=extracted,
            )

            if PATCH_ENABLED and "DOCX_READ_ERROR" not in extracted:
                try:
                    status = patch_file_metadata(
                        drive_id=drive_id,
                        file_item=file_item,
                        extracted=extracted,
                        by_display_name=by_display_name,
                    )
                except Exception as ex:
                    # Never let one file stop the whole traversal.
                    print(f"  PATCH ERROR on {file_item.get('name')}: {ex}")
                    status = "error"
                patch_status_totals[status] = (
                    patch_status_totals.get(status, 0) + 1
                )


    

    print("\n")
    print("=" * 120)
    print("COMPLETE")
    print("=" * 120)
    print(f"Projects Checked:              {projects_checked:,}")
    print(f"50 Substation Found:           {substation_folders_found:,}")
    print(f"501 Design Basis Found:        {design_basis_folders_found:,}")
    print(f"Word Docs Found:               {word_docs_found:,}")
    print(f"Metadata Reads Successful:     {metadata_reads_successful:,}")
    print(f"Metadata Reads Failed:         {metadata_reads_failed:,}")
    print(f"DOCX Reads Successful:         {docx_reads_successful:,}")
    print(f"DOCX Reads Failed:             {docx_reads_failed:,}")

    print("\nMETADATA WRITE-BACK SUMMARY")
    print("-" * 120)
    if not PATCH_ENABLED:
        print("PATCH_ENABLED = False (no writes attempted).")
    elif DRY_RUN:
        print("DRY_RUN = True (payloads printed, nothing written).")
    if patch_status_totals:
        for status, count in sorted(patch_status_totals.items()):
            print(f"  {status}: {count:,}")
    else:
        print("  No files processed for write-back.")

    print("\nMISSED FIELD SUMMARY")
    print("-" * 120)

    if not missed_fields_by_file:
        print("No missed fields found.")
    else:
        print("\nMissed field totals:")
        for field, total in sorted(missed_field_totals.items(), key=lambda x: x[0]):
            print(f"  {field}: {total}")

        print("\nMissed fields by file:")
        for item in missed_fields_by_file:
            print("\nProject Folder:", item["project_folder"])
            print("File:", item["file_name"])
            print("URL:", item["web_url"])
            print("Missed Fields:", ", ".join(item["missed_fields"]))
    print("=" * 120)


if __name__ == "__main__":
    main()