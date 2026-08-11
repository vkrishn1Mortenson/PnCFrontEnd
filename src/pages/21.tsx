import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker must match react-pdf's bundled pdf.js version.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000";

interface RawMatch {
  symbolId?: string;
  top: number;
  left: number;
  right: number;
  bottom?: number; // intentionally NOT used for drawing
  confidence?: number;
  attributes?: { text?: string; values?: string[] }[];
}

interface SymbolResults {
  fileName?: string;
  pageNumber?: number;
  matches: RawMatch[];
}

interface DrawBox {
  x: number;
  y: number;
  size: number;
  symbolId: string;
  label: string;
  values: string[];
  confidence?: number;
}

interface PdfWithOverlayProps {
  pdfPath: string;
  jsonPath: string | null;
}

function contentUrl(folderPath: string): string {
  return `${API_BASE}/files/content?path=${encodeURIComponent(folderPath)}`;
}

// Square box from top/left/right only (side = top-edge width). Origin top-left.
function toDrawBox(m: RawMatch): DrawBox {
  const size = Math.abs(m.right - m.left);
  const attr = m.attributes?.[0];
  return {
    x: m.left,
    y: m.top,
    size,
    symbolId: m.symbolId ?? "",
    label: attr?.text ?? m.symbolId ?? "",
    values: attr?.values ?? [],
    confidence: m.confidence,
  };
}

export default function PdfWithOverlay({
  pdfPath,
  jsonPath,
}: PdfWithOverlayProps) {
  const [boxes, setBoxes] = useState<DrawBox[]>([]);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(
    null
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  // Fetch + parse the CV JSON
  useEffect(() => {
    if (!jsonPath) {
      setBoxes([]);
      return;
    }
    const run = async () => {
      try {
        const res = await fetch(contentUrl(jsonPath));
        const data: SymbolResults = await res.json();
        const matches = Array.isArray(data.matches) ? data.matches : [];
        setBoxes(matches.map(toDrawBox));
      } catch (err) {
        console.error("Failed to load overlay JSON:", err);
        setBoxes([]);
      }
    };
    run();
  }, [jsonPath]);

  // Responsive width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fileUrl = useMemo(() => contentUrl(pdfPath), [pdfPath]);

  return (
    <div className="relative flex w-full gap-4">
      {/* PDF + overlay */}
      <div ref={containerRef} className="min-w-0 flex-1">
        <Document file={fileUrl} loading="Loading PDF...">
          <div className="relative inline-block">
            <Page
              pageNumber={1}
              width={width}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={(page) => {
                const vp = page.getViewport({ scale: 1 });
                setPageSize({ w: vp.width, h: vp.height });
              }}
            />

            {pageSize && boxes.length > 0 && (
              <svg
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
                viewBox={`0 0 ${pageSize.w} ${pageSize.h}`}
                preserveAspectRatio="none"
              >
                {boxes.map((b, i) => {
                  const active = i === activeIndex;
                  return (
                    <g key={i}>
                      <rect
                        x={b.x}
                        y={b.y}
                        width={b.size}
                        height={b.size}
                        fill={
                          active
                            ? "rgba(255, 170, 0, 0.25)"
                            : "rgba(0, 200, 255, 0.15)"
                        }
                        stroke={
                          active ? "rgb(255, 170, 0)" : "rgb(0, 200, 255)"
                        }
                        strokeWidth={active ? 2.5 : 1.5}
                      />
                      {b.label && (
                        <text
                          x={b.x}
                          y={b.y - 2}
                          fontSize={10}
                          fill={
                            active ? "rgb(255, 170, 0)" : "rgb(0, 200, 255)"
                          }
                        >
                          {b.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </Document>
      </div>

      {/* Floating components panel */}
      {boxes.length > 0 && panelOpen && (
        <aside className="sticky top-4 h-fit max-h-[80vh] w-72 shrink-0 overflow-y-auto rounded-xl border bg-card p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Found components ({boxes.length})
            </h3>
            <button
              onClick={() => setPanelOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Hide
            </button>
          </div>

          <ul className="space-y-2">
            {boxes.map((b, i) => (
              <li
                key={i}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                className={`cursor-default rounded-lg border p-2 text-xs transition-colors ${
                  i === activeIndex
                    ? "border-amber-500 bg-amber-500/10"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {b.label || b.symbolId || "Unnamed"}
                  </span>
                  {b.confidence != null && (
                    <span className="text-muted-foreground">
                      {Math.round(b.confidence * 100)}%
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5 text-muted-foreground">
                  <div>Symbol: {b.symbolId || "N/A"}</div>
                  {b.values.length > 0 && (
                    <div>Values: {b.values.join(", ")}</div>
                  )}
                  <div>
                    Pos: {Math.round(b.x)}, {Math.round(b.y)} · Size:{" "}
                    {Math.round(b.size)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/* Re-open tab when hidden */}
      {boxes.length > 0 && !panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="sticky top-4 h-fit rounded-lg border bg-card px-3 py-2 text-xs font-medium shadow-md"
        >
          Show components ({boxes.length})
        </button>
      )}
    </div>
  );
}
