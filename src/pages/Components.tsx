"use client";

import { useEffect, useState } from "react";
import {
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";
import LoadingScreen from "@/pages/LoadingScreen";
interface SelectedProject {
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
}

interface RelationshipComponent {
  component_id: string;
  display_name: string;
  component_tag: string;
  component_type: string;
}

interface ComponentRecord {
  component_id: string;
  parent_component_id: string | null;
  component_tag: string;
  display_name: string;
  component_type: string;
  component_subtype: string;
  component_class: string;
  parent_component: RelationshipComponent | null;
  children: RelationshipComponent[];
}

export default function Projects() {
  const location = useLocation();

  const storedProject = localStorage.getItem("activeProject");

  const selectedProject =
    (location.state as SelectedProject | null) ??
    (storedProject
    ? (JSON.parse(storedProject) as SelectedProject)
    : null);

  const [components, setComponents] = useState<ComponentRecord[]>(
    []
  );

  const [selectedView, setSelectedView] = useState<
    Record<string, string>
  >({});

  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedProject?.projectId) {
      setLoading(false);
      return;
    }

    const projectId = encodeURIComponent(
      selectedProject.projectId
    );

    fetch(
      `http://localhost:5000/components?project_id=${projectId}`
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
        console.log(
          "COMPONENT DATA:",
          data.components
        );

        console.log(
          "COMPONENT COUNT:",
          data.components?.length
        );

        const rawComponents: ComponentRecord[] =
          data.components || [];

        setComponents(rawComponents);

        const extractedNames = rawComponents.map(
          (item) => item.display_name || ""
        );

        setScores(extractedNames);
      })
      .catch((err) => {
        console.error(
          "Failed to load component relationships:",
          err
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedProject?.projectId]);

  useEffect(() => {
    if (components.length > 0) {
      localStorage.setItem(
        "symbols",
        JSON.stringify(components)
      );
    }
  }, [components]);

  if (!selectedProject?.projectId) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div>
        <LoadingScreen></LoadingScreen>
      </div>
    );
  }

  const storedSymbols = JSON.parse(
    localStorage.getItem("symbols") ?? "[]"
  );

  console.log(
    "STORED SYMBOLS VAR:",
    storedSymbols
  );

  console.log(
    "RENDERING COMPONENTS:",
    components.length
  );

  console.log(
    `Components from Projects.tsx fetch call are ${scores}.`
  );

  return (
    <div>
      <FloatingDockDemo />

      <header className="w-full border-b px-6 py-5">
  <div className="flex flex-col gap-2">
    <h1 className="text-lg font-semibold">
      Component Relationships
    </h1>

    <p className="text-sm text-muted-foreground">
      Project:{" "}
      {selectedProject.projectName ??
        selectedProject.projectCode ??
        selectedProject.projectId}
    </p>

    <p className="text-sm text-muted-foreground">
      Total Components: {components.length}
    </p>
  </div>
</header>
      {components.map((component) => (
        <Card key={component.component_id}>
          <CardHeader>
            <CardTitle>
              {component.display_name ||
                "Unnamed Component"}
            </CardTitle>

            <CardDescription>
              {component.component_type ||
                "Unknown Type"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p>
              Tag: {component.component_tag || "N/A"}
            </p>

            <p>
              Class:{" "}
              {component.component_class || "N/A"}
            </p>

            <p>
              Subtype:{" "}
              {component.component_subtype || "N/A"}
            </p>

            <p>
              Component ID: {component.component_id}
            </p>

            <p>
              Children: {component.children.length}
            </p>

            <Select
              value={
                selectedView[
                  component.component_id
                ] ?? ""
              }
              onValueChange={(value) =>
                setSelectedView((previous) => ({
                  ...previous,
                  [component.component_id]:
                    value ?? "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="parent">
                  Parent Component
                </SelectItem>

                <SelectItem value="children">
                  Child Components
                </SelectItem>
              </SelectContent>
            </Select>

            {selectedView[
              component.component_id
            ] === "parent" && (
              <div>
                <h4>Parent Component</h4>

                {component.parent_component ? (
                  <div>
                    <p>
                      Name:{" "}
                      {
                        component.parent_component
                          .display_name
                      }
                    </p>

                    <p>
                      Tag:{" "}
                      {
                        component.parent_component
                          .component_tag
                      }
                    </p>

                    <p>
                      Type:{" "}
                      {
                        component.parent_component
                          .component_type
                      }
                    </p>

                    <p>
                      ID:{" "}
                      {
                        component.parent_component
                          .component_id
                      }
                    </p>
                  </div>
                ) : (
                  <p>No parent component.</p>
                )}
              </div>
            )}

            {selectedView[
              component.component_id
            ] === "children" && (
              <div>
                <h4>Child Components</h4>

                {component.children.length > 0 ? (
                  component.children.map((child) => (
                    <div key={child.component_id}>
                      <p>{child.display_name}</p>
                      <p>
                        Tag: {child.component_tag}
                      </p>
                      <p>
                        Type: {child.component_type}
                      </p>
                      <p>ID: {child.component_id}</p>
                    </div>
                  ))
                ) : (
                  <p>No child components found.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}