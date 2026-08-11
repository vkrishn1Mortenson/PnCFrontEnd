import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";



pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const API_BASE = import.meta.env.VITE_API_BASE ?? "bruh"

// ---- Shape of your CV JSON. Adjust field names to match 6-symbols-results.json ----
interface SymbolBox {
  label?: string;
  top: number;
  left: number;
  right: number;
  bottom: number;
  // page?: number;  // add if your JSON is multi-page
}

interface PdfWithOverlayProps {
  // path passed to /files/content, e.g. the folderPath of the PDF
  pdfPath: string;
  // path passed to /files/content, e.g. the folderPath of the symbols JSON
  jsonPath: string;
}

function contentUrl(folderPath: string): string {
  return `${API_BASE}/files/content?path=${encodeURIComponent(folderPath)}`;
}

export default function PdfWithOverlay({
  pdfPath,
  jsonPath,
}: PdfWithOverlayProps) {
  const [boxes, setBoxes] = useState<SymbolBox[]>([]);
  // Native PDF page size in points (origin top-left). This is the coordinate
  // space the SVG viewBox is mapped to.
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(
    null
  );
  // Rendered pixel size of the page canvas (what we scale the SVG to).
  const [renderSize, setRenderSize] = useState<{ w: number; h: number } | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  // Fetch the JSON boxes
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(contentUrl(jsonPath));
        const data = await res.json();
        // If your JSON nests results, unwrap here e.g. data.symbols
        const items: SymbolBox[] = Array.isArray(data)
          ? data
          : data.symbols ?? data.results ?? [];
        setBoxes(items);
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
    <div ref={containerRef} className="w-full">
      <Document file={fileUrl} loading="Loading PDF...">
        <div className="relative inline-block">
          <Page
            pageNumber={1}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            onLoadSuccess={(page) => {
              // Native size in PDF points at scale 1
              const vp = page.getViewport({ scale: 1 });
              setPageSize({ w: vp.width, h: vp.height });
            }}
            onRenderSuccess={() => {
              // Actual rendered canvas pixel size
              const canvas = containerRef.current?.querySelector("canvas");
              if (canvas) {
                setRenderSize({
                  w: canvas.clientWidth,
                  h: canvas.clientHeight,
                });
              }
            }}
          />

          {pageSize && renderSize && (
            <svg
              // Overlay sits exactly on top of the canvas
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: renderSize.w,
                height: renderSize.h,
                pointerEvents: "none",
              }}
              // viewBox in the JSON's coordinate space -> auto-scales to render size
              viewBox={`0 0 ${pageSize.w} ${pageSize.h}`}
              preserveAspectRatio="none"
            >
              {boxes.map((b, i) => (
                <g key={i}>
                  <rect
                    x={b.left}
                    y={b.top}
                    width={b.right - b.left}
                    height={b.bottom - b.top}
                    fill="rgba(0, 200, 255, 0.15)"
                    stroke="rgb(0, 200, 255)"
                    strokeWidth={1.5}
                  />
                  {b.label && (
                    <text
                      x={b.left}
                      y={b.top - 2}
                      fontSize={10}
                      fill="rgb(0, 200, 255)"
                    >
                      {b.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          )}
        </div>
      </Document>
    </div>
  );
}
