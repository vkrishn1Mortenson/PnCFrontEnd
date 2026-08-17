from azure.identity import InteractiveBrowserCredential
import requests
import time
import json

WORKSPACE_ID = "6fa210ce-add4-4200-83f3-c84936e9cce6"
LAKEHOUSE_ID = "3dd2ed61-24ab-405c-92d0-f4f27aeadb7c"

BASE_URL = (
    f"https://api.fabric.microsoft.com/v1/"
    f"workspaces/{WORKSPACE_ID}/"
    f"lakehouses/{LAKEHOUSE_ID}/"
    f"livyapi/versions/2023-12-01"
)

# --------------------------------------------------
# AUTH
# --------------------------------------------------

credential = InteractiveBrowserCredential()

token = credential.get_token(
    "https://api.fabric.microsoft.com/.default"
)

headers = {
    "Authorization": f"Bearer {token.token}",
    "Content-Type": "application/json",
}

# --------------------------------------------------
# CREATE SESSION
# --------------------------------------------------

print("Creating session...")

response = requests.post(
    f"{BASE_URL}/sessions",
    headers=headers,
    json={
        "kind": "pyspark"
    }
)

print(response.status_code)
print(response.text)

session = response.json()
session_id = session["id"]

print("Session ID:", session_id)

# --------------------------------------------------
# WAIT FOR IDLE
# --------------------------------------------------

while True:
    status_response = requests.get(
        f"{BASE_URL}/sessions/{session_id}",
        headers=headers
    )

    status_json = status_response.json()

    print(json.dumps(status_json, indent=2))

    state = (
        status_json.get("state")
        or status_json.get("livyInfo", {}).get("currentState")
        or ""
    )

    print("State:", state)

    if str(state).lower() == "idle":
        break

    if str(state).lower() in ["error", "dead", "failed"]:
        raise Exception(f"Session failed: {status_json}")

    time.sleep(10)

# --------------------------------------------------
# RUN TEST STATEMENT
# --------------------------------------------------

print("Submitting statement...")

statement_response = requests.post(
    f"{BASE_URL}/sessions/{session_id}/statements",
    headers=headers,
    json={
        "kind": "pyspark",
        "code": """
spark.sql(\"\"\"
UPDATE WS_DesignServices_Engineering_Data_DEV.LH_DS_ENG_SLV.dbo.component
SET filepath = 'Terminal_Block'
WHERE component_id = '1f738669-e0c2-4758-961c-fc1aff0b9077'
\"\"\")

spark.sql(\"\"\"
SELECT
    component_id,
    filepath
FROM WS_DesignServices_Engineering_Data_DEV.LH_DS_ENG_SLV.dbo.component
WHERE component_id = '1f738669-e0c2-4758-961c-fc1aff0b9077'
\"\"\").show(truncate=False)
"""
    }
)

print(statement_response.status_code)
print(statement_response.text)

statement_id = statement_response.json()["id"]
# --------------------------------------------------
# WAIT FOR COMPLETION
# --------------------------------------------------

while True:
    stmt_status = requests.get(
        f"{BASE_URL}/sessions/{session_id}/statements/{statement_id}",
        headers=headers
    )

    stmt_json = stmt_status.json()

    print(json.dumps(stmt_json, indent=2))

    state = stmt_json.get("state", "")

    if state.lower() == "available":
        print("SUCCESS")
        break

    if state.lower() in ["error", "dead", "failed"]:
        raise Exception(json.dumps(stmt_json, indent=2))

    time.sleep(5)