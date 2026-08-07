import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { FileText, Folder } from "lucide-react";

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

  const storedProject = localStorage.getItem("activeProject");

  const selectedProject: SelectedProject | null =
    (location.state as SelectedProject | null) ??
    (storedProject
      ? (JSON.parse(storedProject) as SelectedProject)
      : null);

  const [files, setFiles] = useState<FilesRecord[]>([]);
  const [selectedFile, setSelectedFile] =
    useState<FilesRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProject?.projectId) {
      setLoading(false);
      return;
    }

    const projectId = encodeURIComponent(
      selectedProject.projectId
    );

    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `http://localhost:5000/files?project_id=${projectId}`
        );

        if (!response.ok) {
          const responseText = await response.text();

          throw new Error(
            `Request failed: ${response.status} ${responseText}`
          );
        }

        const data = await response.json();

        const loadedFiles: FilesRecord[] =
          data.files ?? [];

        setFiles(loadedFiles);

        if (loadedFiles.length > 0) {
          setSelectedFile(loadedFiles[0]);
        } else {
          setSelectedFile(null);
        }
      } catch (err) {
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
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
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
        {/* HEADER */}
        <header className="w-full border-b px-6 py-5">
          {/* This fixes the squished-together text */}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">
              Component Relationships
            </h1>

            <p className="text-sm text-muted-foreground">
              Project:{" "}
              {selectedProject.projectName ??
                selectedProject.projectCode ??
                selectedProject.projectId}
            </p>

            <p className="text-sm text-muted-foreground">
              Total Components: {files.length}
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

          {!loading && !error && files.length === 0 && (
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

          {!loading && !error && selectedFile && (
            <div className="rounded-xl border bg-card p-6 shadow-sm">
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

              <div className="mt-6">
                <FloatingDockDemo />
              </div>

              <div className="mt-6 grid gap-3 text-sm">
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