"use client";

import { useEffect, useState } from "react";
import {MagneticButtonDemo} from "@/components/ui/MagneticButtonDemo"
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
import { Badge } from "@/components/ui/badge";

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";
import LoadingScreen from "@/pages/LoadingScreen";
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  <div className="flex items-start justify-between">
    
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

    <MagneticButtonDemo />

  </div>
</header>

    <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
      {components.map((component) => {
        const symbolUrl = resolveSymbolUrl(component.filepath);

        return (
          <Card
            key={component.component_id}
            className="overflow-hidden border bg-card shadow-sm transition hover:shadow-md"
          >
            <CardHeader className="gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="truncate text-base">
                    {component.display_name || "Unnamed Component"}
                  </CardTitle>

                  <CardDescription className="truncate">
                    {component.component_type || "Unknown Type"}
                  </CardDescription>
                </div>

                <CardAction>
                  <Badge variant="secondary">
                    {component.component_class || "N/A"}
                  </Badge>
                </CardAction>
              </div>

              <div className="flex gap-4">
  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border bg-white p-2">
    {symbolUrl ? (
      <img
        src={symbolUrl}
        alt={component.display_name || "Unnamed Component"}
        className="h-full w-full object-contain"
      />
    ) : (
      <span className="text-center text-xs text-muted-foreground">
        No symbol
      </span>
    )}
  </div>

  <div className="min-w-0 flex-1 space-y-2 text-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">Tag</span>
      <span className="truncate font-medium">
        {component.component_tag || "N/A"}
      </span>
    </div>

    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">Subtype</span>
      <span className="truncate font-medium">
        {component.component_subtype || "N/A"}
      </span>
    </div>

    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">Children</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2"
        disabled
      >
        {component.children.length}
      </Button>
    </div>
  </div>
</div>

              <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
                <p className="text-muted-foreground">
                  Component ID
                </p>
                <p className="break-all font-mono">
                  {component.component_id}
                </p>
              </div>
            </CardHeader>

            <CardFooter className="flex flex-col items-stretch gap-4 border-t pt-4">
              <Select
                value={selectedView[component.component_id] ?? ""}
                onValueChange={(value) =>
                  setSelectedView((previous) => ({
                    ...previous,
                    [component.component_id]: value ?? "",
                  }))
                }
              >
                <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
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

              {selectedView[component.component_id] === "parent" && (
                <div className="rounded-lg border bg-background p-3 text-sm">
                  <h4 className="mb-2 font-medium">
                    Parent Component
                  </h4>

                  {component.parent_component ? (
                    <div className="space-y-1">
                      <p>
                        <span className="text-muted-foreground">
                          Name:{" "}
                        </span>
                        {component.parent_component.display_name}
                      </p>

                      <p>
                        <span className="text-muted-foreground">
                          Tag:{" "}
                        </span>
                        {component.parent_component.component_tag}
                      </p>

                      <p>
                        <span className="text-muted-foreground">
                          Type:{" "}
                        </span>
                        {component.parent_component.component_type}
                      </p>

                      <p className="break-all">
                        <span className="text-muted-foreground">
                          ID:{" "}
                        </span>
                        {component.parent_component.component_id}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No parent component.
                    </p>
                  )}
                </div>
              )}

              {selectedView[component.component_id] === "children" && (
                <div className="rounded-lg border bg-background p-3 text-sm">
                  <h4 className="mb-2 font-medium">
                    Child Components
                  </h4>

                  {component.children.length > 0 ? (
                    <div className="space-y-3">
                      {component.children.map((child) => (
                        <div
                          key={child.component_id}
                          className="rounded-md border bg-muted/30 p-3"
                        >
                          <p className="font-medium">
                            {child.display_name || "Unnamed Child"}
                          </p>

                          <p>
                            <span className="text-muted-foreground">
                              Tag:{" "}
                            </span>
                            {child.component_tag || "N/A"}
                          </p>

                          <p>
                            <span className="text-muted-foreground">
                              Type:{" "}
                            </span>
                            {child.component_type || "N/A"}
                          </p>

                          <p className="break-all">
                            <span className="text-muted-foreground">
                              ID:{" "}
                            </span>
                            {child.component_id}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No child components found.
                    </p>
                  )}
                </div>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  </div>
)};
