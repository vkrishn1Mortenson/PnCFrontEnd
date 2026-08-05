import { useState } from "react";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";
import {
  CardBody,
  CardContainer,
  CardItem,
} from "@/components/ui/3d-card";
import { useNavigate } from "react-router-dom";
import pic3 from "@/assets/pic3.jpg";

interface Project {
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  project_abbreviation: string | null;
  generation_type: string | null;
  location: string | null;
  iso: string | null;
  base_temperature_f: number | null;
  elevation_ft: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ActiveProjectsResponse {
  count: number;
  projects: Project[];
  hasNextPage: boolean;
  endCursor: string | null;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  async function loadProjects() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://127.0.0.1:5000/");

      if (!response.ok) {
        const responseText = await response.text();

        throw new Error(
          `Request failed: ${response.status} ${responseText}`
        );
      }

      const data: ActiveProjectsResponse = await response.json();

      setProjects(data.projects ?? []);
      setHasLoaded(true);
    } catch (requestError: unknown) {
      setHasLoaded(true);

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load active projects"
      );
    } finally {
      setLoading(false);
    }
  }

  function openProject(project: Project) {
    navigate("/projects", {
      state: {
        projectId: project.project_id,
        projectCode: project.project_code,
        projectName: project.project_name,
      },
    });
  }

  return (
    <div
      style={{ backgroundImage: `url(${pic3})` }}
      className="bg-cover bg-center bg-no-repeat min-h-screen w-full flex items-center justify-center p-8"
    >
      <CardContainer className="inter-var">
        <CardBody className="group/card relative h-auto w-auto rounded-xl border border-black/[0.1] bg-gray-50 p-6 sm:w-[30rem] dark:border-white/[0.2] dark:bg-black dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1]">
          <CardItem
            translateZ="50"
            className="text-xl font-bold text-neutral-600 dark:text-white"
          >
            Currently Active Projects
          </CardItem>

          <CardItem
            as="p"
            translateZ="60"
            className="mt-2 max-w-sm text-sm text-neutral-500 dark:text-neutral-300"
          >
            Load active projects and click Details to view more information.
          </CardItem>

          <CardItem
            as="div"
            translateZ="60"
            className="mt-6 w-full"
          >
            <button
              type="button"
              onClick={() => void loadProjects()}
              disabled={loading}
              className="mb-4 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Loading..." : "Load Active Projects"}
            </button>

            {loading && (
              <p className="text-gray-500">
                Loading projects...
              </p>
            )}

            {error && (
              <p className="break-words text-red-500">
                {error}
              </p>
            )}

            {hasLoaded &&
              !loading &&
              !error &&
              projects.length === 0 && (
                <p className="text-gray-500">
                  No active projects
                </p>
              )}

            <div className="space-y-4">
              {projects.map((project) => {
                const projectKey =
                  project.project_id ??
                  project.project_code ??
                  project.project_name ??
                  "unknown-project";

                const isSelected =
                  selectedProjectId === projectKey;

                return (
                  <div
                    key={projectKey}
                    className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <h2 className="text-lg font-semibold text-green-500">
                      {project.project_name ?? "Unnamed project"}
                    </h2>

                    <p className="text-sm text-gray-500">
                      Code: {project.project_code ?? "N/A"}
                    </p>

                    <p className="text-sm text-gray-500">
                      Location: {project.location ?? "N/A"}
                    </p>

                    <p className="text-sm text-gray-500">
                      Type: {project.generation_type ?? "N/A"}
                    </p>

                    <p className="text-sm text-gray-500">
                      ISO: {project.iso ?? "N/A"}
                    </p>

                    <button
                      type="button"
                      className="mt-4 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-black"
                      onClick={() =>
                        setSelectedProjectId(
                          isSelected ? null : projectKey
                        )
                      }
                    >
                      {isSelected ? "Hide Details" : "Details"}
                    </button>

                    {isSelected && (
                      <div className="mt-4 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                        <p>
                          Project ID:{" "}
                          {project.project_id ?? "N/A"}
                        </p>

                        <p>
                          Abbreviation:{" "}
                          {project.project_abbreviation ?? "N/A"}
                        </p>

                        <p>
                          ISO: {project.iso ?? "N/A"}
                        </p>

                        <p>
                          Status: {project.status ?? "N/A"}
                        </p>

                        <p>
                          Base temperature:{" "}
                          {project.base_temperature_f !== null
                            ? `${project.base_temperature_f} °F`
                            : "N/A"}
                        </p>

                        <p>
                          Elevation:{" "}
                          {project.elevation_ft !== null
                            ? `${project.elevation_ft} ft`
                            : "N/A"}
                        </p>

                        <button
                          type="button"
                          onClick={() => openProject(project)}
                          className="mt-4 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-black"
                        >
                          View Components
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardItem>
        </CardBody>
      </CardContainer>

      <FloatingDockDemo />
    </div>
  );
}