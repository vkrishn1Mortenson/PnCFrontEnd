import * as React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import {FloatingDockDemo} from "@/components/ui/FloatingDock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  CardBody,
  CardContainer,
  CardItem,
} from "@/components/ui/3d-card";

type ComponentRecord = {
  component_id: string;
  project_id: string;
  parent_component_id: string;
  source_component_template_id: string;
  component_tag: string;
  display_name: string;
  component_class: string;
  component_type: string;
  component_subtype: string;
  relationship_role: string;
  sequence_no: string;
  status: string;
  created_at: string;
  updated_at: string;
  attributes: string;
  filepath: string;
  symbol_geom: string;
};

interface ComponentEditorState {
  componentId?: string;
  component_id?: string;

  projectId?: string;
  project_id?: string;

  parentComponentId?: string;
  parent_component_id?: string;

  sourceComponentTemplateId?: string;
  source_component_template_id?: string;

  componentTag?: string;
  component_tag?: string;

  displayName?: string;
  display_name?: string;

  componentClass?: string;
  component_class?: string;

  componentType?: string;
  component_type?: string;

  componentSubtype?: string;
  component_subtype?: string;

  relationshipRole?: string;
  relationship_role?: string;

  sequenceNo?: string | number;
  sequence_no?: string | number;

  status?: string;

  createdAt?: string;
  created_at?: string;

  updatedAt?: string;
  updated_at?: string;

  attributes?: string | null;
  filepath?: string | null;

  symbolGeom?: string | null;
  symbol_geom?: string | null;

  symbolUrl?: string | null;
}

type EditableField = {
  label: string;
  dbField: keyof ComponentRecord;
  readOnly?: boolean;
};

const editableFields: EditableField[] = [
  {
    label: "Component ID",
    dbField: "component_id",
    readOnly: true,
  },
  {
    label: "Project ID",
    dbField: "project_id",
  },
  {
    label: "Parent Component ID",
    dbField: "parent_component_id",
  },
  {
    label: "Source Component Template ID",
    dbField: "source_component_template_id",
  },
  {
    label: "Component Tag",
    dbField: "component_tag",
  },
  {
    label: "Display Name",
    dbField: "display_name",
  },
  {
    label: "Component Class",
    dbField: "component_class",
  },
  {
    label: "Component Type",
    dbField: "component_type",
  },
  {
    label: "Component Subtype",
    dbField: "component_subtype",
  },
  {
    label: "Relationship Role",
    dbField: "relationship_role",
  },
  {
    label: "Sequence Number",
    dbField: "sequence_no",
  },
  {
    label: "Status",
    dbField: "status",
  },
  {
    label: "Created At",
    dbField: "created_at",
    readOnly: true,
  },
  {
    label: "Updated At",
    dbField: "updated_at",
    readOnly: true,
  },
  {
    label: "Attributes",
    dbField: "attributes",
  },
  {
    label: "Filepath",
    dbField: "filepath",
  },
  {
    label: "Symbol Geometry",
    dbField: "symbol_geom",
  },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function normalizeComponentState(
  state: ComponentEditorState | null,
  decodedComponentId: string
): ComponentRecord {
  return {
    component_id:
      state?.component_id ??
      state?.componentId ??
      decodedComponentId ??
      "",

    project_id:
      state?.project_id ??
      state?.projectId ??
      "",

    parent_component_id:
      state?.parent_component_id ??
      state?.parentComponentId ??
      "",

    source_component_template_id:
      state?.source_component_template_id ??
      state?.sourceComponentTemplateId ??
      "",

    component_tag:
      state?.component_tag ??
      state?.componentTag ??
      "",

    display_name:
      state?.display_name ??
      state?.displayName ??
      "",

    component_class:
      state?.component_class ??
      state?.componentClass ??
      "",

    component_type:
      state?.component_type ??
      state?.componentType ??
      "",

    component_subtype:
      state?.component_subtype ??
      state?.componentSubtype ??
      "",

    relationship_role:
      state?.relationship_role ??
      state?.relationshipRole ??
      "",

    sequence_no:
      String(
        state?.sequence_no ??
          state?.sequenceNo ??
          ""
      ),

    status:
      state?.status ??
      "",

    created_at:
      state?.created_at ??
      state?.createdAt ??
      "",

    updated_at:
      state?.updated_at ??
      state?.updatedAt ??
      "",

    attributes:
      state?.attributes ??
      "",

    filepath:
      state?.filepath ??
      "",

    symbol_geom:
      state?.symbol_geom ??
      state?.symbolGeom ??
      "",
  };
}

export default function ComponentEditor() {
  const { componentId } = useParams();
  const location = useLocation();

  const state = location.state as ComponentEditorState | null;

  if (!componentId) {
    return <Navigate to="/" replace />;
  }

  const decodedComponentId = decodeURIComponent(componentId);

  const resolvedSymbolUrl =
    typeof state?.symbolUrl === "string" && state.symbolUrl.length > 0
      ? state.symbolUrl
      : null;

  const [formValues, setFormValues] = React.useState<ComponentRecord>(() =>
    normalizeComponentState(state, decodedComponentId)
  );

  const [savingField, setSavingField] = React.useState<string | null>(null);
  const [lastSavedField, setLastSavedField] = React.useState<string | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);

  const handleChange = (
    field: keyof ComponentRecord,
    value: string
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveField = async (field: EditableField) => {
    if (field.readOnly) {
      return;
    }

    try {
      setError(null);
      setLastSavedField(null);
      setSavingField(field.dbField);

      const value = formValues[field.dbField] ?? "";

      const response = await fetch(`${API_BASE}/components/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          component_id: decodedComponentId,
          field: field.dbField,
          value,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Update failed");
      }

      setLastSavedField(field.dbField);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingField(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950 px-6 py-8 text-white">
      {/* Dot background */}
      <div
        className="pointer-events-none absolute inset-0 [background-size:20px_20px] [background-image:radial-gradient(#404040_1px,transparent_1px)]"
      />
      <div className="pointer-events-none absolute inset-0 bg-neutral-950 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">
            Component Editor
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            {formValues.display_name || "Unnamed Component"}
          </h1>

          <p className="text-sm text-neutral-400">
            Component ID:{" "}
            <span className="font-mono text-neutral-300">
              {decodedComponentId}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="shrink-0">
            <FloatingDockDemo></FloatingDockDemo>
          </div>

          <div className="flex-1 space-y-8">
            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {lastSavedField && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Saved {lastSavedField}
              </div>
            )}

            <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
              <CardContainer className="inter-var">
                <CardBody className="group/card relative h-auto w-full rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl">
                  <CardItem
                    translateZ="60"
                    className="text-xl font-semibold text-white"
                  >
                    Component Symbol
                  </CardItem>

                  <CardItem
                    as="p"
                    translateZ="40"
                    className="mt-2 text-sm text-neutral-400"
                  >
                    Visual reference and key component metadata.
                  </CardItem>

                  <CardItem translateZ="100" className="mt-6 w-full">
                    <div className="flex h-72 w-full items-center justify-center rounded-xl border border-white/10 bg-white p-4">
                      {resolvedSymbolUrl ? (
                        <img
                          src={resolvedSymbolUrl}
                          alt="Symbol"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-sm text-neutral-500">
                          No symbol available
                        </div>
                      )}
                    </div>
                  </CardItem>

                  <CardItem translateZ="50" className="mt-6 w-full">
                    <div className="space-y-3 rounded-xl bg-neutral-800 px-4 py-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-neutral-500">
                          Display Name
                        </p>
                        <p className="mt-1 break-all text-sm text-neutral-200">
                          {formValues.display_name || "None"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-neutral-500">
                          Component Tag
                        </p>
                        <p className="mt-1 break-all font-mono text-sm text-neutral-200">
                          {formValues.component_tag || "None"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-neutral-500">
                          Filepath
                        </p>
                        <p className="mt-1 break-all font-mono text-sm text-neutral-200">
                          {formValues.filepath || "None"}
                        </p>
                      </div>
                    </div>
                  </CardItem>
                </CardBody>
              </CardContainer>

              <Card className="border-white/10 bg-neutral-900 text-white">
                <CardHeader>
                  <CardTitle>Component Attributes</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Current values are shown inside each field. Edit a value
                    and press Enter or click Save.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  {editableFields.map((field) => {
                    const value = formValues[field.dbField] ?? "";
                    const isSaving = savingField === field.dbField;

                    return (
                      <div
                        key={field.dbField}
                        className="grid gap-3 rounded-xl border border-white/10 bg-neutral-950 p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <label className="text-sm font-medium text-neutral-200">
                              {field.label}
                            </label>
                            <p className="font-mono text-xs text-neutral-500">
                              {field.dbField}
                            </p>
                          </div>

                          {!field.readOnly && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={isSaving}
                              onClick={() => saveField(field)}
                            >
                              {isSaving ? "Saving" : "Save"}
                            </Button>
                          )}

                          {field.readOnly && (
                            <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-500">
                              Read-only
                            </span>
                          )}
                        </div>

                        <Input
                          value={value}
                          readOnly={field.readOnly}
                          onChange={(event) =>
                            handleChange(field.dbField, event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !field.readOnly) {
                              event.preventDefault();
                              saveField(field);
                            }
                          }}
                          className={
                            field.readOnly
                              ? "border-white/10 bg-neutral-900 text-neutral-500"
                              : "border-white/10 bg-neutral-900 text-white placeholder:text-neutral-600"
                          }
                          placeholder={`Enter ${field.label}`}
                        />

                        <div className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2">
                          <p className="text-xs uppercase tracking-wide text-neutral-500">
                            Current field value
                          </p>
                          <p className="mt-1 break-all font-mono text-sm text-neutral-300">
                            {value === "" ? "NULL / Empty" : value}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
