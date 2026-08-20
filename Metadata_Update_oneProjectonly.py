from azure.identity import InteractiveBrowserCredential
import requests
import json

# ============================================================
# CONFIG
# ============================================================

# ============================================================
# CONFIG
# ============================================================

SITE_HOSTNAME = "mortenson.sharepoint.com"
SITE_PATH = "/sites/EngineeringServices-TM"

LIST_ID = "9a06e912-1e44-4e24-9f04-064740785fa1"
LIST_ITEM_ID = "782905"

# Start True. Flip to False only after payload prints correctly.
DRY_RUN = False

GRAPH_SCOPE = "https://graph.microsoft.com/.default"

# ============================================================
# TARGET METADATA VALUES - ELISABETH TEST FILE
# ============================================================

TARGET_VALUES_DISPLAY = {
    "Title": "Elisabeth SUBSTATIoN",
    "Project Name": "ELISABETH - 525kV Substation",
    "Project Size": "237.5 MW AC",
    "Project Type": "Solar",
    "Project Location": "Yuma County, Arizona",
    "HV Voltage": "525 kV",
    "MV Voltage": "34.5 kV",
    "Elevation": "558 ft Above Sea-level",
    "HV Max System 3P fault Current": "XXX KA",
    "QTY of Main Power Transformers": 1,
}

# These are likely internal names based on SharePoint naming conventions.
# The script also prints available fields so you can correct mappings if needed.
FIELD_NAME_CANDIDATES = {
    "Title": [
        "Title",
    ],
    "Project Name": [
        "ProjectName",
        "Project_x0020_Name",
    ],
    "Project Size": [
        "ProjectSize",
        "Project_x0020_Size",
    ],
    "Project Type": [
        "ProjectType",
        "Project_x0020_Type",
    ],
    "Project Location": [
        "ProjectLocation",
        "Project_x0020_Location",
    ],
    "HV Voltage": [
        "HVVoltage",
        "HV_x0020_Voltage",
    ],
    "MV Voltage": [
        "MVVoltage",
        "MV_x0020_Voltage",
    ],
    "Elevation": [
        "Elevation",
    ],
    "HV Max System 3P fault Current": [
        "HVMaxSystem3PFaultCurrent",
        "HVMaxSystem3PfaultCurrent",
        "HV_x0020_Max_x0020_System_x0020_3P_x0020_fault_x0020_Current",
        "HV_x0020_Max_x0020_System_x0020_3P_x0020_Fault_x0020_Current",
    ],
    "QTY of Main Power Transformers": [
        "QTYofMainPowerTransformers",
        "QtyofMainPowerTransformers",
        "QTY_x0020_of_x0020_Main_x0020_Power_x0020_Transformers",
        "Qty_x0020_of_x0020_Main_x0020_Power_x0020_Transformers",
    ],
}

# ============================================================
# AUTH
# ============================================================

credential = InteractiveBrowserCredential()
token = credential.get_token(GRAPH_SCOPE)

headers = {
    "Authorization": f"Bearer {token.token}",
    "Content-Type": "application/json",
}

# ============================================================
# GRAPH HELPERS
# ============================================================

def graph_get(url):
    resp = requests.get(url, headers=headers)

    if not resp.ok:
        print("\nGET FAILED")
        print("URL:", url)
        print("Status:", resp.status_code)
        print("Body:", resp.text)
        resp.raise_for_status()


    


    return resp.json()


def graph_patch(url, payload):
    resp = requests.patch(url, headers=headers, json=payload)

    if not resp.ok:
        print("\nPATCH FAILED")
        print("URL:", url)
        print("Status:", resp.status_code)
        print("Payload:")
        print(json.dumps(payload, indent=2))
        print("Body:", resp.text)
        resp.raise_for_status()

    return resp.json()


def get_site():
    return graph_get(
        f"https://graph.microsoft.com/v1.0/sites/"
        f"{SITE_HOSTNAME}:{SITE_PATH}"
    )


def get_list_item_fields(site_id, list_id):
    return graph_get(
        f"https://graph.microsoft.com/v1.0/sites/"
        f"{site_id}/lists/{list_id}/items/{LIST_ITEM_ID}?$expand=fields"
    )


def get_drive_list(site_id):
    drives = graph_get(
        f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
    )

    documents_drive = next(
        d for d in drives["value"]
        if d["name"] == "Documents"
    )

    drive_id = documents_drive["id"]

    print("Documents Drive ID:", drive_id)

    return graph_get(
        f"https://graph.microsoft.com/v1.0/drives/{drive_id}/list"
    )


def get_columns(site_id, list_id):
    data = graph_get(
        f"https://graph.microsoft.com/v1.0/sites/"
        f"{site_id}/lists/{list_id}/columns"
    )

    return data.get("value", [])


def build_column_maps(columns):
    by_display_name = {}
    by_internal_name = {}

    for col in columns:
        display_name = col.get("displayName")
        name = col.get("name")

        if display_name:
            by_display_name[display_name] = col

        if name:
            by_internal_name[name] = col

    return by_display_name, by_internal_name


def resolve_internal_field_names(columns, existing_fields):
    by_display_name, by_internal_name = build_column_maps(columns)

    resolved = {}
    unresolved = {}

    for display_name, value in TARGET_VALUES_DISPLAY.items():
        internal_name = None

        # 1. Exact display name from list columns.
        if display_name in by_display_name:
            internal_name = by_display_name[display_name].get("name")

        # 2. Candidate internal names.
        if not internal_name:
            for candidate in FIELD_NAME_CANDIDATES.get(display_name, []):
                if candidate in by_internal_name or candidate in existing_fields:
                    internal_name = candidate
                    break

        if internal_name:
            resolved[display_name] = {
                "internal_name": internal_name,
                "value": value,
            }
        else:
            unresolved[display_name] = value

    return resolved, unresolved


def print_current_fields(fields):
    print("\nCURRENT RETURNED FIELD VALUES")
    print("=" * 100)

    for key in sorted(fields.keys()):
        if key.startswith("@odata"):
            continue

        print(f"{key}: {fields.get(key)}")


def print_columns(columns):
    print("\nDOCUMENT LIBRARY COLUMNS")
    print("=" * 100)

    for col in sorted(columns, key=lambda c: c.get("displayName", "")):
        display_name = col.get("displayName")
        internal_name = col.get("name")
        column_type = "unknown"

        for possible_type in [
            "text",
            "choice",
            "number",
            "boolean",
            "dateTime",
            "personOrGroup",
            "lookup",
            "term",
        ]:
            if possible_type in col:
                column_type = possible_type
                break

        print(f"{display_name}  ->  {internal_name}  [{column_type}]")


def print_patch_plan(resolved, unresolved):
    print("\nPATCH PLAN")
    print("=" * 100)

    if resolved:
        print("\nWill patch:")
        for display_name, item in resolved.items():
            print(
                f"{display_name} -> {item['internal_name']} = {item['value']}"
            )

    if unresolved:
        print("\nCould not resolve these display names to internal field names:")
        for display_name, value in unresolved.items():
            print(f"{display_name} = {value}")

    print("\nDRY_RUN:", DRY_RUN)


def patch_fields(site_id, list_id, resolved):
   

    for display_name, item in resolved.items():
        payload[item["internal_name"]] = item["value"]

    print("\nPATCH PAYLOAD")
    print("=" * 100)
    print(json.dumps(payload, indent=2))

    if DRY_RUN:
        print("\nDRY RUN ENABLED. No SharePoint changes were made.")
        return None

    patch_url = (
        f"https://graph.microsoft.com/v1.0/sites/"
        f"{site_id}/lists/{list_id}/items/{LIST_ITEM_ID}/fields"
    )
    payload = {
    "ProjectName": "MEITNER WIND SUBSTATION"
    }
    updated = graph_patch(patch_url, payload)

    print("\nPATCH SUCCESS")
    print("=" * 100)
    print(json.dumps(updated, indent=2))

    return updated


# ============================================================
# MAIN
# ============================================================

def main():
    print("\nConnecting to SharePoint site...")

    site = get_site()
    site_id = site["id"]

    print("Site:", site.get("displayName"))
    print("Site ID:", site_id)

    print("\nGetting document library list backing the drive...")

    drive_list = get_drive_list(site_id)
    list_id = drive_list["id"]

    print("List Display Name:", drive_list.get("displayName"))
    print("List ID:", list_id)

    print("\nGetting current file metadata...")

    list_item = get_list_item_fields(
    site_id=site_id,
    list_id=list_id,
    )
    fields = list_item.get("fields", {})

    #print("Drive Item ID:", DRIVE_ITEM_ID)
    print("List Item ID:", LIST_ITEM_ID)

    print_current_fields(fields)

    print("\nGetting document library column definitions...")

    columns = get_columns(site_id, list_id)

    print_columns(columns)

    resolved, unresolved = resolve_internal_field_names(
        columns=columns,
        existing_fields=fields,
    )

    print_patch_plan(resolved, unresolved)

    if unresolved:
        print("\nSTOPPING BECAUSE SOME FIELDS WERE NOT RESOLVED.")
        print("Fix FIELD_NAME_CANDIDATES using the printed column internal names, then rerun.")
        return

    patch_fields(site_id, list_id, resolved)

    print("\nDone.")


if __name__ == "__main__":
    main()