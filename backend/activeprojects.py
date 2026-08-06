from azure.identity import InteractiveBrowserCredential
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from azure.storage.filedatalake import DataLakeServiceClient

app = Flask(__name__)
CORS(app)

workspace_name = "WS_DesignServices_Engineering_Data_DEV"
# Development authentication only.
credential = InteractiveBrowserCredential()
onelake_service_client = DataLakeServiceClient(

account_url="https://onelake.dfs.fabric.microsoft.com",

credential=credential,

)
scope = (
    "https://analysis.windows.net/powerbi/api/"
    "user_impersonation"
)

endpoint = (
    "https://6fa210ceadd4420083f3c84936e9cce6."
    "z6f.graphql.fabric.microsoft.com/v1/workspaces/"
    "6fa210ce-add4-4200-83f3-c84936e9cce6/"
    "graphqlapis/"
    "d2ff8165-b5a4-4b9d-b6d2-865de66ec2e9/graphql"
)

files_query = """
query {
  files(first: 5000) {
    items {
      project_id
      Name
      Extension
      dateaccessed
      datemodified
      datecreated
      folderPath
    }
  }
}
"""

projects_query = """
query {
  projects(first: 10) {
    items {
      project_id
      project_name
      project_code
      location
      generation_type
      iso
    }
  }
}
"""


components_query = """
query {
  components(first: 5000) {
    items {
      component_id
      project_id
      parent_component_id
      component_tag
      display_name
      component_type
      component_subtype
      component_class
    }
  }
}
"""


@app.route("/files", methods=["GET"])
def get_files():
    project_id = request.args.get("project_id")

    if not project_id:
        return jsonify(
            {"error": "project_id is required"}
        ), 400

    try:
        workspace_name = (
            "WS_DesignServices_Engineering_Data_DEV"
        )

        lakehouse_name = "LH_DS_ENG_SLV.Lakehouse"

        file_system_client = (
            onelake_service_client.get_file_system_client(
                file_system=workspace_name
            )
        )

        project_folder = (
            f"{lakehouse_name}/Files/{project_id}"
        )

        paths = file_system_client.get_paths(
            path=project_folder,
            recursive=True,
        )

        files = []

        for path in paths:
            if path.is_directory:
                continue

            full_path = path.name
            file_name = full_path.split("/")[-1]

            if "." in file_name:
                name, extension = file_name.rsplit(".", 1)
                extension = f".{extension}"
            else:
                name = file_name
                extension = ""

            files.append(
                {
                    "project_id": project_id,
                    "Name": name,
                    "Extension": extension,
                    "folderPath": full_path,
                    "dateaccessed": None,
                    "datemodified": (
                        path.last_modified.isoformat()
                        if path.last_modified
                        else None
                    ),
                    "datecreated": (
                        path.creation_time.isoformat()
                        if getattr(path, "creation_time", None)
                        else None
                    ),
                }
            )

        return jsonify(
            {
                "project_id": project_id,
                "count": len(files),
                "files": files,
            }
        )

    except Exception as error:
        return jsonify(
            {
                "error": "Could not load project files",
                "details": str(error),
            }
        ), 500

def get_headers():
    token_result = credential.get_token(scope)

    return {
        "Authorization": f"Bearer {token_result.token}",
        "Content-Type": "application/json",
    }


@app.route("/", methods=["GET"])
def active_projects():
    try:
        response = requests.post(
            endpoint,
            headers=get_headers(),
            json={"query": projects_query},
            timeout=60,
        )

        response_data = response.json()

        if not response.ok:
            return jsonify(
                {
                    "error": "GraphQL request failed",
                    "details": response_data,
                }
            ), response.status_code

        if response_data.get("errors"):
            return jsonify(
                {
                    "error": "GraphQL returned errors",
                    "details": response_data["errors"],
                }
            ), 500

        projects = (
            response_data
            .get("data", {})
            .get("projects", {})
            .get("items", [])
        )

        return jsonify(
            {
                "count": len(projects),
                "projects": projects,
                "hasNextPage": False,
                "endCursor": None,
            }
        )

    except Exception as error:
        return jsonify(
            {
                "error": "Could not load active projects",
                "details": str(error),
            }
        ), 500


@app.route("/components", methods=["GET"])
def get_components():
    project_id = request.args.get("project_id")

    if not project_id:
        return jsonify(
            {
                "error": "project_id is required"
            }
        ), 400

    try:
        response = requests.post(
            endpoint,
            headers=get_headers(),
            json={"query": components_query},
            timeout=60,
        )

        response_data = response.json()

        if not response.ok:
            return jsonify(
                {
                    "error": "GraphQL request failed",
                    "details": response_data,
                }
            ), response.status_code

        if response_data.get("errors"):
            return jsonify(
                {
                    "error": "GraphQL returned errors",
                    "details": response_data["errors"],
                }
            ), 500

        all_components = (
            response_data
            .get("data", {})
            .get("components", {})
            .get("items", [])
        )

        components = [
            component
            for component in all_components
            if str(component.get("project_id")) == str(project_id)
        ]

        components_by_id = {
            str(component["component_id"]): component
            for component in components
            if component.get("component_id") is not None
        }

        formatted_components = []

        for component in components:
            parent_component = None
            parent_component_id = component.get(
                "parent_component_id"
            )

            if parent_component_id is not None:
                parent = components_by_id.get(
                    str(parent_component_id)
                )

                if parent:
                    parent_component = {
                        "component_id": parent.get("component_id"),
                        "display_name": parent.get("display_name"),
                        "component_tag": parent.get("component_tag"),
                        "component_type": parent.get("component_type"),
                    }

            children = []

            for possible_child in components:
                if str(
                    possible_child.get("parent_component_id")
                ) == str(component.get("component_id")):
                    children.append(
                        {
                            "component_id": possible_child.get(
                                "component_id"
                            ),
                            "display_name": possible_child.get(
                                "display_name"
                            ),
                            "component_tag": possible_child.get(
                                "component_tag"
                            ),
                            "component_type": possible_child.get(
                                "component_type"
                            ),
                        }
                    )

            formatted_components.append(
                {
                    **component,
                    "parent_component": parent_component,
                    "children": children,
                }
            )

        return jsonify(
            {
                "count": len(formatted_components),
                "components": formatted_components,
            }
        )

    except Exception as error:
        return jsonify(
            {
                "error": "Could not load components",
                "details": str(error),
            }
        ), 500


if __name__ == "__main__":
    print(app.url_map)
    app.run(
    port=5000,
    debug=True,
    use_reloader=False,
)