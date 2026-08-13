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
  filepath: string | null;
  parent_component: RelationshipComponent | null;
  children: RelationshipComponent[];
}

interface SymbolRecord {
  Name: string;
  fileName: string;
  folderPath: string;
  contentUrl: string;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000";
const normalizeSymbolKey = (value: string | null | undefined): string => {
  if (!value) return "";

  const fileName = value
    .split("/")
    .pop()
    ?.trim()
    .toLowerCase() ?? "";

  return fileName
    .replace(/\s+\./g, ".")
    .replace(/\s+/g, " ")
    .replace(/_/g, " ")
    .trim();
};

const withoutExtension = (value: string): string => {
  return value.replace(/\.[^/.]+$/, "").trim();
};
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
  // Map of normalized symbol name -> image URL.
  const [symbolMap, setSymbolMap] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!selectedProject?.projectId) {
      setLoading(false);
      return;
    }
    const projectId = encodeURIComponent(
      selectedProject.projectId
    );
    fetch(
      `${API_BASE}/components?project_id=${projectId}`
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
        // console.log("FILEPATH SAMPLE:", data.components?.map(c => c.filepath));
        // console.log(
        //   "COMPONENT DATA:",
        //   data.components
        // );
        // console.log(
        //   "COMPONENT COUNT:",
        //   data.components?.length
        // );
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
  fetch(`${API_BASE}/symbols`)
    .then(async (res) => {
      if (!res.ok) {
        const responseText = await res.text();
        throw new Error(`Request failed: ${res.status} ${responseText}`);
      }
      return res.json();
    })
    .then((data) => {
      const symbols: SymbolRecord[] = data.symbols || [];
      const map: Record<string, string> = {};

      symbols.forEach((symbol) => {
        const url = `${API_BASE}${symbol.contentUrl}`;

        const fileNameKey = normalizeSymbolKey(symbol.fileName);
        const nameKey = normalizeSymbolKey(symbol.Name);
        const fileNameNoExt = withoutExtension(fileNameKey);
        const nameNoExt = withoutExtension(nameKey);

        if (fileNameKey) map[fileNameKey] = url;
        if (nameKey) map[nameKey] = url;
        if (fileNameNoExt) map[fileNameNoExt] = url;
        if (nameNoExt) map[nameNoExt] = url;
      });

      // console.log("SYMBOL MAP KEYS:", Object.keys(map));
      setSymbolMap(map);
    })
    .catch((err) => {
      console.error("Failed to load symbol library:", err);
    });
}, []);

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
  // console.log(
  //   "STORED SYMBOLS VAR:",
  //   storedSymbols
  // );
  // console.log(
  //   "RENDERING COMPONENTS:",
  //   components.length
  // );
  // console.log(
  //   `Components from Projects.tsx fetch call are ${scores}.`
  // );

  // Resolve a component.filepath value to an image URL from the map.
  const resolveSymbolUrl = (filepath: string | null): string | null => {
  if (!filepath) return null;

  const normalized = normalizeSymbolKey(filepath);
  const noExt = withoutExtension(normalized);

  const candidates = [
    normalized,
    noExt,
    `${normalized}.png`,
    `${noExt}.png`,
    normalized.replace(/ /g, ""),
    noExt.replace(/ /g, ""),
    `${noExt.replace(/ /g, "")}.png`,
  ];

  for (const candidate of candidates) {
    if (symbolMap[candidate]) {
      return symbolMap[candidate];
    }
  }

  

  return null;
};
  //console.log(`symbolMap: ${JSON.stringify(symbolMap)}`);
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
      {components.map((component) => {
        const symbolUrl = resolveSymbolUrl(
          component.filepath
        );
      //   console.log("COMPONENT FILEPATH CHECK", {
      //   displayName: component.display_name,
      //   filepath: component.filepath,
      //   resolvedUrl: symbolUrl,
      // });
        return (
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
              {symbolUrl ? (
                <img
                  src={symbolUrl}
                  alt={
                    component.display_name ||
                    "Component symbol"
                  }
                  className="h-24 w-24 object-contain border rounded-md bg-white p-1"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No symbol image.
                </p>
              )}
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
        );
      })}
    </div>
  );
}
