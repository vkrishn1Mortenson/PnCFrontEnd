from azure.identity import InteractiveBrowserCredential
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from azure.storage.filedatalake import DataLakeServiceClient
from flask import send_file
from io import BytesIO
from urllib.parse import quote, unquote

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
      source_component_template_id
      component_tag
      display_name
      component_type
      component_subtype
      component_class
      status
      filepath
    }
  }
}
"""



from flask import send_file
from io import BytesIO
import mimetypes




@app.route("/files/content", methods=["GET"])
def get_file_content():
    file_path = request.args.get("path")
    if not file_path:
        return jsonify({"error": "path is required"}), 400

    try:
        file_system_client = onelake_service_client.get_file_system_client(
            file_system=workspace_name
        )
        file_client = file_system_client.get_file_client(file_path)
        file_bytes = file_client.download_file().readall()

        filename = file_path.split("/")[-1]
        mime_type, _ = mimetypes.guess_type(filename)
        if mime_type is None:
            mime_type = "application/octet-stream"

        return send_file(
            BytesIO(file_bytes),
            download_name=filename,
            mimetype=mime_type,
            as_attachment=False,  # inline -> browser renders PDF
        )
    except Exception as error:
        return jsonify(
            {"error": "Could not load file", "details": str(error)}
        ), 500


symbol_library_folder = "LH_DS_ENG_BRZ.Lakehouse/Files/Symbol Library"


@app.route("/symbols", methods=["GET"])
def get_symbols():
    try:
        file_system_client = (
            onelake_service_client.get_file_system_client(
                file_system=workspace_name
            )
        )

        paths = list(
            file_system_client.get_paths(
                path=symbol_library_folder,
                recursive=False,
            )
        )
        

        symbols = []

        for path in paths:
            if path.is_directory:
                continue

            full_path = path.name
            file_name = full_path.split("/")[-1]

            # Only expose PNGs.
            if not file_name.lower().endswith(".png"):
                continue

            name_without_ext = file_name.rsplit(".", 1)[0]

            symbols.append(
                {
                    "Name": name_without_ext,          # e.g. "Capacitor"
                    "fileName": file_name,             # e.g. "Capacitor.png"
                    "folderPath": full_path,           # full lakehouse path
                    # Reuse the existing /files/content endpoint to stream bytes.
                    "contentUrl": f"/files/content?path={quote(full_path)}",
                }
            )
        
        return jsonify(
            {
                "count": len(symbols),
                "symbols": symbols,
            }
        )

    except Exception as error:
        return jsonify(
            {
                "error": "Could not load symbol library",
                "details": str(error),
            }
        ), 500



@app.route("/files", methods=["GET"])
def get_files():
    
    project_id = request.args.get("project_id")

    if not project_id:
        return jsonify(
            {"error": "project_id is required"}
        ), 400

    try:
        # Get projects from GraphQL
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

        projects = (
            response_data
            .get("data", {})
            .get("projects", {})
            .get("items", [])
        )

        project = next(
            (
                p
                for p in projects
                if str(p.get("project_id")) == str(project_id)
            ),
            None,
        )

        if not project:
            return jsonify(
                {
                    "error": "Project not found",
                    "project_id": project_id,
                }
            ), 404

        project_name = project.get("project_name")

        file_system_client = (
            onelake_service_client.get_file_system_client(
                file_system=workspace_name
            )
        )

        project_folder = (
            f"LH_DS_ENG_BRZ.Lakehouse/Files/{project_name}"
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
            file_client = file_system_client.get_file_client(full_path)

            try:
                props = file_client.get_file_properties()
                print("SUCCESS:", full_path)
            except Exception as e:
                print("FAILED:", full_path, e)
            if "." in file_name:
                name, extension = file_name.rsplit(".", 1)
                extension = f".{extension}"
            else:
                name = file_name
                extension = ""

            files.append(
                {
                    "project_id": project_id,
                    "project_name": project_name,
                    "Name": name,
                    "Extension": extension,
                    "folderPath": full_path,
                    "dateaccessed": None,
                    "contentUrl": f"/files/content?path={quote(full_path)}",
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
                "project_name": project_name,
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

            if parent_component_id:
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