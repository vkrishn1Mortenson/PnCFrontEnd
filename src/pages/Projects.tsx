"use client";

import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

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
  const [components, setComponents] = useState<ComponentRecord[]>([]);
  const [selectedView, setSelectedView] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<string[]>([]);

  useEffect(() => {
    fetch("http://localhost:5000/components")
      .then((res) => res.json())
      .then((data) => {
        console.log("COMPONENT DATA:", data.components);
        console.log("COMPONENT COUNT:", data.components?.length);

        // Save the full objects array to components state
        const rawComponents = data.components || [];
        setComponents(rawComponents);

        // Extract the display_name from each component into the scores state
        const extractedNames = rawComponents.map((item: any) => item.display_name || "");
        setScores(extractedNames);
      })
      .catch((err) => {
        console.error("Failed to load component relationships:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (components.length > 0) {
      localStorage.setItem("symbols", JSON.stringify(components));
    }
  }, [components]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl">
        Loading component relationships...
      </div>
    );
  }

  const storedSymbols = JSON.parse(localStorage.getItem("symbols") ?? "[]");

  console.log("STORED SYMBOLS VAR:", storedSymbols);
  console.log("RENDERING COMPONENTS:", components.length);
  console.log(`Components from Projects.tsx fetch call are ${scores}.`);

 return (
  <div className="min-h-screen px-8 py-8">
    <div className="mb-8">
      <h1 className="text-3xl font-bold">
        Component Relationships
      </h1>

      <p className="text-muted-foreground mt-2">
        Total Components: {components.length}
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      
      {components.map((component) => (
        <Card
          key={component.component_id}
          className="h-fit hover:shadow-lg transition-shadow"
        >
          <CardHeader>
            <CardTitle>
              {component.display_name || "Unnamed Component"}
            </CardTitle>

            <CardDescription>
              {component.component_type || "Unknown Type"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div>
                <span className="font-semibold">Tag:</span>{" "}
                {component.component_tag || "N/A"}
              </div>

              <div>
                <span className="font-semibold">Class:</span>{" "}
                {component.component_class || "N/A"}
              </div>

              <div>
                <span className="font-semibold">Subtype:</span>{" "}
                {component.component_subtype || "N/A"}
              </div>

              <div>
                <span className="font-semibold">Component ID:</span>{" "}
                {component.component_id}
              </div>

              <div>
                <span className="font-semibold">Children:</span>{" "}
                {component.children.length}
              </div>
            </div>
          
            <Select
              value={selectedView[component.component_id] || ""}
              onValueChange={(value) =>
                setSelectedView((prev) => ({
                  ...prev,
                  [component.component_id]: value ?? "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="View Relationships" />
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
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-3">
                  Parent Component
                </h3>

                {component.parent_component ? (
                  <div className="space-y-1 text-sm">
                    <div>
                      <strong>Name:</strong>{" "}
                      {component.parent_component.display_name}
                    </div>

                    <div>
                      <strong>Tag:</strong>{" "}
                      {component.parent_component.component_tag}
                    </div>

                    <div>
                      <strong>Type:</strong>{" "}
                      {component.parent_component.component_type}
                    </div>

                    <div>
                      <strong>ID:</strong>{" "}
                      {component.parent_component.component_id}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No parent component.
                  </div>
                )}
              </div>
            )}

            {selectedView[component.component_id] === "children" && (
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-3">
                  Child Components
                </h3>

                {component.children.length > 0 ? (
                  <div className="space-y-2">
                    {component.children.map((child) => (
                      <div
                        key={child.component_id}
                        className="rounded-md border p-3"
                      >
                        <div className="font-medium">
                          {child.display_name}
                        </div>

                        <div className="text-sm text-muted-foreground">
                          Tag: {child.component_tag}
                        </div>

                        <div className="text-sm text-muted-foreground">
                          Type: {child.component_type}
                        </div>

                        <div className="text-sm text-muted-foreground">
                          ID: {child.component_id}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No child components found.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>

    <FloatingDockDemo />
  </div>
  );
}
