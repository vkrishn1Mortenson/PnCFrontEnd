from azure.identity import InteractiveBrowserCredential
import requests
from flask import Flask, jsonify

# Acquire a token
# DO NOT USE IN PRODUCTION.
# Below code to acquire token is for development purpose only to test the GraphQL endpoint
# For production, always register an application in a Microsoft Entra ID tenant and use the appropriate client_id and scopes
# https://learn.microsoft.com/en-us/fabric/data-engineering/connect-apps-api-graphql#create-a-microsoft-entra-app

app = Flask(__name__)

@app.route('/active-projects', methods=['GET'])
def get_active_projects():
    credential = InteractiveBrowserCredential()
    scp = 'https://analysis.windows.net/powerbi/api/user_impersonation'
    result = credential.get_token(scp)

    if not getattr(result, 'token', None):
        return jsonify({'error': 'Could not get access token'}), 500

    headers = {
        'Authorization': f'Bearer {result.token}',
        'Content-Type': 'application/json'
    }

    endpoint = 'https://6fa210ceadd4420083f3c84936e9cce6.z6f.graphql.fabric.microsoft.com/v1/workspaces/6fa210ce-add4-4200-83f3-c84936e9cce6/graphqlapis/d2ff8165-b5a4-4b9d-b6d2-865de66ec2e9/graphql'
    query = """
        query {
      projects(first: 10) {
        items {
          project_id
          project_code
          project_name
          location
          status
        }
      }
    }
    """

    variables = {}

    try:
        response = requests.post(endpoint, json={'query': query, 'variables': variables}, headers=headers)
        response.raise_for_status()
        data = response.json()

        if 'errors' in data:
            return jsonify({'errors': data['errors']}), 500

        projects = data.get('data', {}).get('projects', {}).get('items', [])
        return jsonify(projects)
    except Exception as error:
        return jsonify({'error': str(error)}), 500


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
