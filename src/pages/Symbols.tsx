import React from "react";

interface ComponentRecord {
  component_id: string;
  parent_component_id: string | null;
  component_tag: string;
  display_name: string;
  component_type: string;
  component_subtype: string;
  component_class: string;
  parent_component: unknown | null;
  children: unknown[];
}

export default function Symbol() {
  const [components, setComponents] = React.useState<ComponentRecord[]>([]);

  React.useEffect(() => {
    const raw = localStorage.getItem("symbols");

    if (raw) {
      try {
        const savedComponents: ComponentRecord[] = JSON.parse(raw);
        setComponents(savedComponents);
      } catch (error) {
        console.error("Failed to parse stored components:", error);
      }
    }
  }, []);

  return (
    <div>
      <h2>Symbols</h2>

      {components.length > 0 ? (
        components.map((component) => (
          <div key={component.component_id}>
            <h3>{component.display_name || "Unnamed Component"}</h3>
            <p>Tag: {component.component_tag || "N/A"}</p>
            <p>Type: {component.component_type || "Unknown Type"}</p>
          </div>
        ))
      ) : (
        <p>No component data found.</p>
      )}
    </div>
  );
}