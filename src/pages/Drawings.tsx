import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { FileText, FileJson, Folder } from "lucide-react";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";
import PdfWithOverlay from "@/pages/21";
import {MagneticButtonDemo2} from "@/components/ui/MagneticButtonDemo2";
const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://localhost:5000";

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

function buildContentUrl(folderPath: string): string {
  return `${API_BASE}/files/content?path=${encodeURIComponent(folderPath)}`;
}

function normalizeFileName(name: string): string {
  return name.trim().toLowerCase();
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

    const projectId = encodeURIComponent(selectedProject.projectId);

    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_BASE}/files?project_id=${projectId}`
        );

        if (!response.ok) {
          const responseText = await response.text();

          throw new Error(
            `Request failed: ${response.status} ${responseText}`
          );
        }

        const data = await response.json();
        const loadedFiles: FilesRecord[] = data.files ?? [];

        setFiles(loadedFiles);

        console.log("Loaded project files:", loadedFiles);
      } catch (err) {
        console.error("Failed to load project files:", err);

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

  const visibleFiles = useMemo(() => {
    return files.filter((file) => {
      const extension = (file.Extension || "").toLowerCase();

      return [".pdf", ".json"].includes(extension);
    });
  }, [files]);

  /*
   * Match the selected PDF to a JSON file using the exact same
   * normalized Name value.
   *
   * Example:
   * PDF:
   *   Name = "6-symbols-results-revised"
   *
   * JSON:
   *   Name = "6-symbols-results-revised"
   *
   * The file extensions and folder locations may differ.
   */
  const overlayJson = useMemo(() => {
    if (!selectedFile) {
      return null;
    }

    const selectedExtension = (
      selectedFile.Extension || ""
    ).toLowerCase();

    if (selectedExtension !== ".pdf") {
      return null;
    }

    const selectedBaseName = normalizeFileName(selectedFile.Name);

    const matchingJson =
      files.find((file) => {
        const extension = (
          file.Extension || ""
        ).toLowerCase();

        const jsonBaseName = normalizeFileName(file.Name);

        return (
          extension === ".json" &&
          file.folderPath.includes("/CV_Output/") &&
          jsonBaseName === selectedBaseName
        );
      }) ?? null;

    return matchingJson;
  }, [files, selectedFile]);

  useEffect(() => {
    if (!selectedFile) {
      return;
    }

    console.log("Selected PDF and overlay match:", {
      selectedFile: {
        name: selectedFile.Name,
        extension: selectedFile.Extension,
        folderPath: selectedFile.folderPath,
      },
      overlayJson: overlayJson
        ? {
            name: overlayJson.Name,
            extension: overlayJson.Extension,
            folderPath: overlayJson.folderPath,
          }
        : null,
      namesMatch: overlayJson
        ? normalizeFileName(selectedFile.Name) ===
          normalizeFileName(overlayJson.Name)
        : false,
    });
  }, [selectedFile, overlayJson]);

  useEffect(() => {
    if (visibleFiles.length === 0) {
      setSelectedFile(null);
      return;
    }

    setSelectedFile((currentFile) => {
      if (currentFile) {
        const currentFileStillExists = visibleFiles.some(
          (file) => file.folderPath === currentFile.folderPath
        );

        if (currentFileStillExists) {
          return currentFile;
        }
      }

      const firstPdf = visibleFiles.find(
        (file) =>
          (file.Extension || "").toLowerCase() === ".pdf"
      );

      return firstPdf ?? visibleFiles[0];
    });
  }, [visibleFiles]);

  if (!selectedProject?.projectId) {
    return <Navigate to="/" replace />;
  }

  const selectedExtension = (
    selectedFile?.Extension || ""
  ).toLowerCase();

  const isPdf = selectedExtension === ".pdf";

  const fileUrl = selectedFile
    ? buildContentUrl(selectedFile.folderPath)
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* HEADER */}
      <header className="w-full border-b px-6 py-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Drawings</h1>

          <p className="text-sm text-muted-foreground">
            Project:{" "}
            {selectedProject.projectName ??
              selectedProject.projectCode ??
              selectedProject.projectId}
          </p>

          <p className="text-sm text-muted-foreground">
            Files: {visibleFiles.length}
          </p>
        </div>
      </header>
      <MagneticButtonDemo2 />
      <main className="flex flex-1 gap-4 p-6">
        {/* LEFT: FILE LIST */}
        <aside className="w-72 shrink-0 space-y-2 overflow-y-auto">
          {loading && (
            <p className="text-sm text-muted-foreground">
              Loading project files...
            </p>
          )}

          {error && (
            <div className="rounded-lg border border-blue-500 p-4 text-sm text-blue-500">
              {error}
            </div>
          )}

          {!loading && !error && visibleFiles.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center">
              <Folder className="h-8 w-8 text-muted-foreground" />

              <p className="text-sm text-muted-foreground">
                No files found for this project.
              </p>
            </div>
          )}

          {visibleFiles.map((file) => {
            const isActive =
              selectedFile?.folderPath === file.folderPath;

            const extension = (
              file.Extension || ""
            ).toLowerCase();

            const Icon =
              extension === ".json" ? FileJson : FileText;

            return (
              <button
                key={file.folderPath}
                type="button"
                onClick={() => setSelectedFile(file)}
                className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                  isActive
                    ? "border-primary bg-accent"
                    : "hover:bg-accent/50"
                }`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                <span className="break-all">
                  {file.Name}
                  {file.Extension}
                </span>
              </button>
            );
          })}
        </aside>

        {/* RIGHT: VIEWER */}
        <section className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          {selectedFile && fileUrl ? (
            <>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />

                  <span className="truncate font-semibold">
                    {selectedFile.Name}
                    {selectedFile.Extension}
                  </span>
                </div>

                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm text-primary underline"
                >
                  Open in new tab
                </a>
              </div>

              {isPdf ? (
                overlayJson ? (
                  <PdfWithOverlay
                    pdfPath={selectedFile.folderPath}
                    jsonPath={overlayJson.folderPath}
                  />
                ) : (
                  <div className="space-y-2 p-6">
                    <p className="text-sm font-medium text-red-500">
                      No matching CV JSON was found.
                    </p>

                    <p className="text-sm text-muted-foreground">
                      Expected a JSON file named{" "}
                      <span className="font-mono">
                        {selectedFile.Name}.json
                      </span>{" "}
                      inside the CV_Output folder.
                    </p>

                    <p className="text-sm text-muted-foreground">
                      The PDF can still be opened without the overlay.
                    </p>
                  </div>
                )
              ) : (
                <div className="p-6 text-sm text-muted-foreground">
                  {selectedFile.Name}
                  {selectedFile.Extension} has no inline preview.{" "}
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Open the raw file
                  </a>
                  .
                </div>
              )}
            </>
          ) : (
            !loading && (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                Select a file to view it here.
              </div>
            )
          )}
        </section>
      </main>

      <FloatingDockDemo />
    </div>
  );
}