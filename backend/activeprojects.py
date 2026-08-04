from azure.identity import InteractiveBrowserCredential
from flask import Flask, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)  # allow the Vite dev server (different origin) to call this API

# Acquire a token
# DO NOT USE IN PRODUCTION.
# Below code to acquire token is for development purpose only to test the GraphQL endpoint
# For production, always register an application in a Microsoft Entra ID tenant and use the appropriate client_id and scopes
# https://learn.microsoft.com/en-us/fabric/data-engineering/connect-apps-api-graphql#create-a-microsoft-entra-app

credential = InteractiveBrowserCredential()
scp = 'https://analysis.windows.net/powerbi/api/user_impersonation'
token_result = credential.get_token(scp)

if not token_result.token:
    print('Error:', "Could not get access token")

endpoint = 'https://6fa210ceadd4420083f3c84936e9cce6.z6f.graphql.fabric.microsoft.com/v1/workspaces/6fa210ce-add4-4200-83f3-c84936e9cce6/graphqlapis/d2ff8165-b5a4-4b9d-b6d2-865de66ec2e9/graphql'

# Expanded to include the fields Dashboard.tsx actually displays.
# Verify these field names exist on your `projects` type in the Fabric GraphQL schema —
# the original script only ever requested project_id.
query = """
    query {
  projects(first: 10) {
     items {
        project_id
     }
  }
}
"""


@app.route("/", methods=["GET"])
def active_projects():
    headers = {
        'Authorization': f'Bearer {token_result.token}',
        'Content-Type': 'application/json'
    }

    try:
        response = requests.post(
            endpoint, json={'query': query, 'variables': {}}, headers=headers
        )
        response.raise_for_status()
        data = response.json()
    except Exception as error:
        return jsonify({"error": f"Query failed with error: {error}"}), 502

    if "errors" in data:
        return jsonify({"error": data["errors"]}), 502

    items = data.get("data", {}).get("projects", {}).get("items", [])

    return jsonify({
        "count": len(items),
        "projects": items,
        "hasNextPage": False,
        "endCursor": None,
    })


if __name__ == "__main__":
    app.run(port=5000, debug=True)