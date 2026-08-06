import { useEffect, useState } from "react";
import {
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  FileText,
  Folder,
} from "lucide-react";
import { AppSidebar } from "@/components/ui/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";

interface SelectedProject {
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
}

interface FilesRecord {
  project_id: string | null;
  Name: string;
  Extension: string;
  dateaccessed: string | null;
  datemodified: string | null;
  datecreated: string | null;
  folderPath: string;
}

export default function Symbol() {
  const location = useLocation();

  const selectedProject =
    location.state as SelectedProject | null;

  const [files, setFiles] = useState<FilesRecord[]>([]);
  const [selectedFile, setSelectedFile] =
    useState<FilesRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!selectedProject?.projectId) {
      setLoading(false);
      return;
    }

    const projectId = encodeURIComponent(
      selectedProject.projectId
    );

    setLoading(true);
    setError(null);

    fetch(
      `http://localhost:5000/files?project_id=${projectId}`
    )
      .then(async (res) => {
        if (!res.ok) {
          const responseText = await res.text();

          throw new Error(
            `Request failed: ${res.status} ${responseText}`
          );
        }

        return res.json();
      })
      .then((data) => {
        console.log("FILE DATA:", data.files);
        console.log(
          "FILE COUNT:",
          data.files?.length
        );

        const rawFiles: FilesRecord[] =
          data.files || [];

        setFiles(rawFiles);

        if (rawFiles.length > 0) {
          setSelectedFile(rawFiles[0]);
        }
      })
      .catch((err: unknown) => {
        console.error(
          "Failed to load project files:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load project files"
        );

        setFiles([]);
        setSelectedFile(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedProject?.projectId]);

  if (!selectedProject?.projectId) {
    return <Navigate to="/" replace />;
  }

  return (
    
    <SidebarProvider>
      <AppSidebar
        files={files}
        selectedFile={selectedFile}
        onFileSelect={setSelectedFile}
      />

      <SidebarInset>
        <header className="flex h-16 items-center border-b px-6">
          <div>
            <h1 className="text-lg font-semibold">
              Project Drawings
            </h1>

            <p className="text-sm text-muted-foreground">
              {selectedProject.projectName ??
                selectedProject.projectCode ??
                selectedProject.projectId}
            </p>
          </div>
        </header>

        <main className="flex flex-1 flex-col p-6">
          {loading && (
            <p className="text-sm text-muted-foreground">
              Loading project files...
            </p>
          )}

          {error && (
            <div className="rounded-lg border border-red-500 p-4 text-sm text-red-500">
              {error}
            </div>
          )}

          {!loading &&
            !error &&
            files.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <Folder className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />

                  <h2 className="font-semibold">
                    No project files found
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    This project does not currently have
                    any files.
                  </p>
                </div>
              </div>
            )}

          {!loading &&
            !error &&
            selectedFile && (
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-start gap-4">
                  <FileText className="mt-1 h-8 w-8 text-muted-foreground" />
                    
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedFile.Name}
                      {selectedFile.Extension}
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Selected project file
                    </p>
                  </div>
                </div>
                <div>
                <FloatingDockDemo></FloatingDockDemo>
                </div>
                <div className="mt-6 space-y-3 text-sm">
                  <div>
                    <span className="font-semibold">
                      Project ID:
                    </span>{" "}
                    {selectedFile.project_id ?? "N/A"}
                  </div>

                  <div>
                    <span className="font-semibold">
                      File name:
                    </span>{" "}
                    {selectedFile.Name || "N/A"}
                  </div>

                  <div>
                    <span className="font-semibold">
                      Extension:
                    </span>{" "}
                    {selectedFile.Extension || "N/A"}
                  </div>

                  <div>
                    <span className="font-semibold">
                      Folder path:
                    </span>{" "}
                    {selectedFile.folderPath || "N/A"}
                  </div>

                  <div>
                    <span className="font-semibold">
                      Date created:
                    </span>{" "}
                    {selectedFile.datecreated ?? "N/A"}
                  </div>

                  <div>
                    <span className="font-semibold">
                      Date modified:
                    </span>{" "}
                    {selectedFile.datemodified ?? "N/A"}
                  </div>

                  <div>
                    <span className="font-semibold">
                      Date accessed:
                    </span>{" "}
                    {selectedFile.dateaccessed ?? "N/A"}
                  </div>
                </div>
              </div>
            )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}