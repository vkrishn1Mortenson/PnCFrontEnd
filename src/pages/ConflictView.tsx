import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://localhost:5000";

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

export interface DrawingSource {
  name: string;
  pdfPath: string;
  jsonPath: string;
}

interface ConflictViewProps {
  left: DrawingSource;
  right: DrawingSource;
}

const FALLBACK_COORDINATE_WIDTH = 612;
const FALLBACK_COORDINATE_HEIGHT = 792;

type BoxStatus = "matched" | "missing";

interface DiffBox extends SymbolMatch {
  label: string;
  status: BoxStatus;
}

interface Side {
  fileUrl: string;
  boxes: DiffBox[];
  coordinateSize: { w: number; h: number };
}

function contentUrl(folderPath: string): string {
  return `${API_BASE}/files/content?path=${encodeURIComponent(folderPath)}`;
}

function labelForMatch(match: SymbolMatch): string {
  return (
    match.attributes?.[0]?.text ??
    match.symbolId ??
    "Unlabeled"
  );
}

async function loadOverlay(jsonPath: string): Promise<OverlayData> {
  const res = await fetch(contentUrl(jsonPath));
  if (!res.ok) {
    throw new Error(
      `Overlay request failed: ${res.status} ${res.statusText}`
    );
  }
  return (await res.json()) as OverlayData;
}

/* ------------------------------------------------------------------ */
/* Presentational panel: one PDF + its diff-colored overlay           */
/* ------------------------------------------------------------------ */

interface DiffPdfPanelProps {
  title: string;
  side: Side | null;
  activeLabel: string | null;
  setActiveLabel: (label: string | null) => void;
}

function DiffPdfPanel({
  title,
  side,
  activeLabel,
  setActiveLabel,
}: DiffPdfPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [renderSize, setRenderSize] = useState<{
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colors = (status: BoxStatus, isActive: boolean) => {
    if (status === "matched") {
      return {
        fill: isActive
          ? "rgba(34, 197, 94, 0.35)"
          : "rgba(34, 197, 94, 0.15)",
        stroke: "rgb(22, 163, 74)",
        text: "rgb(22, 163, 74)",
      };
    }
    return {
      fill: isActive
        ? "rgba(239, 68, 68, 0.40)"
        : "rgba(239, 68, 68, 0.18)",
      stroke: "rgb(220, 38, 38)",
      text: "rgb(220, 38, 38)",
    };
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="truncate font-semibold">{title}</span>
      </div>
      <div ref={containerRef} className="min-w-0 flex-1 overflow-auto p-2">
        {side ? (
          <Document file={side.fileUrl} loading="Loading PDF...">
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
                  viewBox={`0 0 ${side.coordinateSize.w} ${side.coordinateSize.h}`}
                  preserveAspectRatio="none"
                >
                  {side.boxes.map((b, i) => {
                    const isActive = activeLabel === b.label;
                    const c = colors(b.status, isActive);
                    return (
                      <g key={`${b.label}-${i}`}>
                        <rect
                          x={b.left}
                          y={b.top}
                          width={b.right - b.left}
                          height={b.bottom - b.top}
                          fill={c.fill}
                          stroke={c.stroke}
                          strokeWidth={isActive ? 3 : 1.5}
                          style={{ pointerEvents: "auto" }}
                          onMouseEnter={() => setActiveLabel(b.label)}
                          onMouseLeave={() => setActiveLabel(null)}
                        />
                        <text
                          x={b.left}
                          y={Math.max(b.top - 2, 10)}
                          fontSize={10}
                          fill={c.text}
                        >
                          {b.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </Document>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">
            Loading overlay...
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main conflict view: loads both overlays, computes diff, renders    */
/* ------------------------------------------------------------------ */

export default function ConflictView({ left, right }: ConflictViewProps) {
  const [leftSide, setLeftSide] = useState<Side | null>(null);
  const [rightSide, setRightSide] = useState<Side | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        setLeftSide(null);
        setRightSide(null);

        const [leftData, rightData] = await Promise.all([
          loadOverlay(left.jsonPath),
          loadOverlay(right.jsonPath),
        ]);
        if (cancelled) return;

        const leftMatches = leftData.matches ?? [];
        const rightMatches = rightData.matches ?? [];

        const leftLabels = new Set(leftMatches.map(labelForMatch));
        const rightLabels = new Set(rightMatches.map(labelForMatch));

        const buildBoxes = (
          matches: SymbolMatch[],
          otherLabels: Set<string>
        ): DiffBox[] =>
          matches.map((m) => {
            const label = labelForMatch(m);
            return {
              ...m,
              label,
              status: otherLabels.has(label) ? "matched" : "missing",
            };
          });

        setLeftSide({
          fileUrl: contentUrl(left.pdfPath),
          boxes: buildBoxes(leftMatches, rightLabels),
          coordinateSize: {
            w: leftData.pageWidth ?? FALLBACK_COORDINATE_WIDTH,
            h: leftData.pageHeight ?? FALLBACK_COORDINATE_HEIGHT,
          },
        });
        setRightSide({
          fileUrl: contentUrl(right.pdfPath),
          boxes: buildBoxes(rightMatches, leftLabels),
          coordinateSize: {
            w: rightData.pageWidth ?? FALLBACK_COORDINATE_WIDTH,
            h: rightData.pageHeight ?? FALLBACK_COORDINATE_HEIGHT,
          },
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to build conflict view:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load overlays for comparison"
        );
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [left.jsonPath, right.jsonPath, left.pdfPath, right.pdfPath]);

  const diff = useMemo(() => {
    const leftBoxes = leftSide?.boxes ?? [];
    const rightBoxes = rightSide?.boxes ?? [];

    const onlyLeft = leftBoxes
      .filter((b) => b.status === "missing")
      .map((b) => b.label);
    const onlyRight = rightBoxes
      .filter((b) => b.status === "missing")
      .map((b) => b.label);
    const matched = leftBoxes
      .filter((b) => b.status === "matched")
      .map((b) => b.label);

    return {
      onlyLeft: Array.from(new Set(onlyLeft)).sort(),
      onlyRight: Array.from(new Set(onlyRight)).sort(),
      matched: Array.from(new Set(matched)).sort(),
    };
  }, [leftSide, rightSide]);

  const totalDiffs = diff.onlyLeft.length + diff.onlyRight.length;

  return (
    <div className="flex flex-1 gap-4 p-4">
      {/* Side-by-side PDFs */}
      <div className="flex flex-1 gap-4 min-w-0">
        <DiffPdfPanel
          title={left.name}
          side={leftSide}
          activeLabel={activeLabel}
          setActiveLabel={setActiveLabel}
        />
        <DiffPdfPanel
          title={right.name}
          side={rightSide}
          activeLabel={activeLabel}
          setActiveLabel={setActiveLabel}
        />
      </div>

      {/* Differences panel */}
      <aside className="w-72 shrink-0 space-y-4 overflow-y-auto rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold">Comparison summary</p>
          {error ? (
            <p className="mt-1 text-sm text-red-500">{error}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {totalDiffs} difference{totalDiffs === 1 ? "" : "s"} ·{" "}
              {diff.matched.length} matched
            </p>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm border border-green-600 bg-green-500/30" />
            Same
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm border border-red-600 bg-red-500/30" />
            Missing
          </span>
        </div>

        {/* Missing from right */}
        <div>
          <p className="text-xs font-semibold uppercase text-red-500">
            Missing in {right.name} ({diff.onlyLeft.length})
          </p>
          <div className="mt-1 space-y-1">
            {diff.onlyLeft.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              diff.onlyLeft.map((label) => (
                <button
                  key={`l-${label}`}
                  type="button"
                  onMouseEnter={() => setActiveLabel(label)}
                  onMouseLeave={() => setActiveLabel(null)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm transition-colors ${
                    activeLabel === label
                      ? "bg-red-100 text-red-900"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    only in {left.name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Missing from left */}
        <div>
          <p className="text-xs font-semibold uppercase text-red-500">
            Missing in {left.name} ({diff.onlyRight.length})
          </p>
          <div className="mt-1 space-y-1">
            {diff.onlyRight.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              diff.onlyRight.map((label) => (
                <button
                  key={`r-${label}`}
                  type="button"
                  onMouseEnter={() => setActiveLabel(label)}
                  onMouseLeave={() => setActiveLabel(null)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm transition-colors ${
                    activeLabel === label
                      ? "bg-red-100 text-red-900"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    only in {right.name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Matched */}
        <div>
          <p className="text-xs font-semibold uppercase text-green-600">
            Matched ({diff.matched.length})
          </p>
          <div className="mt-1 space-y-1">
            {diff.matched.map((label) => (
              <button
                key={`m-${label}`}
                type="button"
                onMouseEnter={() => setActiveLabel(label)}
                onMouseLeave={() => setActiveLabel(null)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm transition-colors ${
                  activeLabel === label
                    ? "bg-green-100 text-green-900"
                    : "hover:bg-accent/50"
                }`}
              >
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
