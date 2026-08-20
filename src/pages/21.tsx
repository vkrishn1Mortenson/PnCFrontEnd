import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const API_BASE = import.meta.env.VITE_API_BASE ?? "bruh";

interface SymbolMatch {
  symbolId?: string;
  top: number;
  left: number;
  right: number;
  bottom: number;
  confidence?: number;
  attributes?: { text?: string; values?: string[] }[];
}

interface OverlayData {
  fileName?: string;
  pageNumber?: number;
  pageWidth?: number;
  pageHeight?: number;
  matches?: SymbolMatch[];
}

interface PdfWithOverlayProps {
  pdfPath: string;
  jsonPath: string;
}

const FALLBACK_COORDINATE_WIDTH = 612;
const FALLBACK_COORDINATE_HEIGHT = 792;

function contentUrl(folderPath: string): string {
  return `${API_BASE}/files/content?path=${encodeURIComponent(folderPath)}`;
}

function labelForMatch(match: SymbolMatch): string {
  return match.attributes?.[0]?.text ?? match.symbolId ?? "Unlabeled";
}

export default function PdfWithOverlay({
  pdfPath,
  jsonPath,
}: PdfWithOverlayProps) {
  const [boxes, setBoxes] = useState<SymbolMatch[]>([]);

  const [coordinateSize, setCoordinateSize] = useState<{
    w: number;
    h: number;
  }>({
    w: FALLBACK_COORDINATE_WIDTH,
    h: FALLBACK_COORDINATE_HEIGHT,
  });

  const [renderSize, setRenderSize] = useState<{
    w: number;
    h: number;
  } | null>(null);

  // Index of the box currently highlighted via sidebar hover (or box hover).
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!jsonPath) {
      setBoxes([]);
      return;
    }

    const run = async () => {
      try {
        const res = await fetch(contentUrl(jsonPath));

        if (!res.ok) {
          throw new Error(
            `Overlay request failed: ${res.status} ${res.statusText}`
          );
        }

        const data: OverlayData = await res.json();

        const items = data.matches ?? [];
        setBoxes(items);

        const coordWidth = data.pageWidth ?? FALLBACK_COORDINATE_WIDTH;
        const coordHeight = data.pageHeight ?? FALLBACK_COORDINATE_HEIGHT;

        setCoordinateSize({ w: coordWidth, h: coordHeight });

        console.log("Overlay diagnostics:", {
          jsonPath,
          boxCount: items.length,
          usedPageDimsFromJson:
            data.pageWidth != null && data.pageHeight != null,
          coordWidth,
          coordHeight,
          firstBox: items[0],
        });
      } catch (err) {
        console.error("Failed to load overlay JSON:", err);
        setBoxes([]);
      }
    };

    run();
  }, [jsonPath]);

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
    <div className="flex gap-4">
      {/* PDF + overlay */}
      <div ref={containerRef} className="min-w-0 flex-1">
        <Document file={fileUrl} loading="Loading PDF...">
          <div className="relative inline-block">
            <Page
              pageNumber={1}
              width={width}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onRenderSuccess={() => {
                const canvas =
                  containerRef.current?.querySelector("canvas");

                if (canvas) {
                  setRenderSize({
                    w: canvas.clientWidth,
                    h: canvas.clientHeight,
                  });
                }
              }}
            />

            {renderSize && (
              <svg
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: renderSize.w,
                  height: renderSize.h,
                  pointerEvents: "none",
                }}
                viewBox={`0 0 ${coordinateSize.w} ${coordinateSize.h}`}
                preserveAspectRatio="none"
              >
                {boxes.map((b, i) => {
                  const isActive = activeIndex === i;
                  const label = labelForMatch(b);

                  return (
                    <g key={i}>
                      <rect
                        x={b.left}
                        y={b.top}
                        width={b.right - b.left}
                        height={b.bottom - b.top}
                        fill={
                          isActive
                            ? "rgba(255, 214, 0, 0.35)"
                            : "rgba(0, 200, 255, 0.15)"
                        }
                        stroke={
                          isActive
                            ? "rgb(255, 196, 0)"
                            : "rgb(0, 200, 255)"
                        }
                        strokeWidth={isActive ? 3 : 1.5}
                        // let the box itself be hoverable too
                        style={{ pointerEvents: "auto" }}
                        onMouseEnter={() => setActiveIndex(i)}
                        onMouseLeave={() => setActiveIndex(null)}
                      />

                      {label && (
                        <text
                          x={b.left}
                          y={Math.max(b.top - 2, 10)}
                          fontSize={10}
                          fill={
                            isActive
                              ? "rgb(180, 130, 0)"
                              : "rgb(0, 200, 255)"
                          }
                        >
                          {label}
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

      {/* Component sidebar */}
      <aside className="w-64 shrink-0 space-y-1 overflow-y-auto rounded-lg border p-2">
        <p className="px-2 py-1 text-sm font-semibold text-muted-foreground">
          Found components ({boxes.length})
        </p>

        {boxes.map((b, i) => {
          const isActive = activeIndex === i;
          const label = labelForMatch(b);
          const confidence =
            b.confidence != null
              ? `${Math.round(b.confidence * 100)}%`
              : null;

          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                isActive
                  ? "bg-yellow-100 text-yellow-900"
                  : "hover:bg-accent/50"
              }`}
            >
              <span className="font-medium">{label}</span>
              {confidence && (
                <span className="text-xs text-muted-foreground">
                  {confidence}
                </span>
              )}
            </button>
          );
        })}
      </aside>
    </div>
  );
}