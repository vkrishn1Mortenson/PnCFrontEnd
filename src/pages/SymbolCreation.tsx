import * as React from "react";
import { ReactSketchCanvas } from "react-sketch-canvas";
import type { ReactSketchCanvasRef } from "react-sketch-canvas";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";

type Point = {
  x: number;
  y: number;
};

type SymbolOperation =
  | {
      operation: "line";
      origin: Point;
      destination: Point;
    }
  | {
      operation: "curve";
      origin: Point;
      destination: Point;
      controlOrigin: Point;
      controlDestination: Point;
    }
  | {
      operation: "text";
      text: string;
      position: Point;
      fontSize: number;
    };

type Tool = "marker" | "eraser" | "line" | "rectangle" | "ellipse" | "text";

const CANVAS_SIZE = 512;
const DEFAULT_FONT_SIZE = 28;
const CURVE_KAPPA = 0.5522847498;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const roundPoint = (point: Point): Point => ({
  x: Number(point.x.toFixed(3)),
  y: Number(point.y.toFixed(3)),
});

const distance = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const pointToSegmentDistance = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) return distance(point, start);

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
        (dx * dx + dy * dy)
    )
  );

  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return distance(point, projection);
};

const getOperationDistance = (point: Point, operation: SymbolOperation) => {
  if (operation.operation === "line") {
    return pointToSegmentDistance(point, operation.origin, operation.destination);
  }

  if (operation.operation === "curve") {
    return Math.min(
      pointToSegmentDistance(point, operation.origin, operation.destination),
      distance(point, operation.origin),
      distance(point, operation.destination),
      distance(point, operation.controlOrigin),
      distance(point, operation.controlDestination)
    );
  }

  return distance(point, operation.position);
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const getPointerPoint = (
  event: React.PointerEvent<HTMLDivElement>,
  element: HTMLDivElement
): Point => {
  const rect = element.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE,
    y: ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE,
  };
};

const rectangleToOperations = (start: Point, end: Point): SymbolOperation[] => {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);

  const p1 = roundPoint({ x: left, y: top });
  const p2 = roundPoint({ x: right, y: top });
  const p3 = roundPoint({ x: right, y: bottom });
  const p4 = roundPoint({ x: left, y: bottom });

  return [
    { operation: "line", origin: p1, destination: p2 },
    { operation: "line", origin: p2, destination: p3 },
    { operation: "line", origin: p3, destination: p4 },
    { operation: "line", origin: p4, destination: p1 },
  ];
};

const ellipseToOperations = (start: Point, end: Point): SymbolOperation[] => {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);

  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const rx = (right - left) / 2;
  const ry = (bottom - top) / 2;

  const kx = rx * CURVE_KAPPA;
  const ky = ry * CURVE_KAPPA;

  const topPoint = roundPoint({ x: cx, y: top });
  const rightPoint = roundPoint({ x: right, y: cy });
  const bottomPoint = roundPoint({ x: cx, y: bottom });
  const leftPoint = roundPoint({ x: left, y: cy });

  return [
    {
      operation: "curve",
      origin: topPoint,
      destination: rightPoint,
      controlOrigin: roundPoint({ x: cx + kx, y: top }),
      controlDestination: roundPoint({ x: right, y: cy - ky }),
    },
    {
      operation: "curve",
      origin: rightPoint,
      destination: bottomPoint,
      controlOrigin: roundPoint({ x: right, y: cy + ky }),
      controlDestination: roundPoint({ x: cx + kx, y: bottom }),
    },
    {
      operation: "curve",
      origin: bottomPoint,
      destination: leftPoint,
      controlOrigin: roundPoint({ x: cx - kx, y: bottom }),
      controlDestination: roundPoint({ x: left, y: cy + ky }),
    },
    {
      operation: "curve",
      origin: leftPoint,
      destination: topPoint,
      controlOrigin: roundPoint({ x: left, y: cy - ky }),
      controlDestination: roundPoint({ x: cx - kx, y: top }),
    },
  ];
};

const sketchPathsToOperations = (
  paths: any[],
  renderedWidth: number,
  renderedHeight: number
): SymbolOperation[] => {
  const operations: SymbolOperation[] = [];

  const scaleX = CANVAS_SIZE / renderedWidth;
  const scaleY = CANVAS_SIZE / renderedHeight;

  paths.forEach((path) => {
    if (!path.drawMode || !Array.isArray(path.paths)) return;

    for (let i = 1; i < path.paths.length; i++) {
      const origin = path.paths[i - 1];
      const destination = path.paths[i];

      if (!origin || !destination) continue;
      if (distance(origin, destination) < 1) continue;

      operations.push({
        operation: "line",
        origin: roundPoint({
          x: origin.x * scaleX,
          y: origin.y * scaleY,
        }),
        destination: roundPoint({
          x: destination.x * scaleX,
          y: destination.y * scaleY,
        }),
      });
    }
  });

  return operations;
};

const operationsToSvgElements = (operations: SymbolOperation[]) =>
  operations
    .map((operation) => {
      if (operation.operation === "line") {
        return `<line x1="${operation.origin.x}" y1="${operation.origin.y}" x2="${operation.destination.x}" y2="${operation.destination.y}" stroke="black" stroke-width="3" stroke-linecap="round" />`;
      }

      if (operation.operation === "curve") {
        return `<path d="M ${operation.origin.x} ${operation.origin.y} C ${operation.controlOrigin.x} ${operation.controlOrigin.y}, ${operation.controlDestination.x} ${operation.controlDestination.y}, ${operation.destination.x} ${operation.destination.y}" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" />`;
      }

      return `<text x="${operation.position.x}" y="${operation.position.y}" fill="black" font-size="${
        operation.fontSize ?? DEFAULT_FONT_SIZE
      }" font-family="Arial, sans-serif">${escapeXml(operation.text)}</text>`;
    })
    .join("");

const SymbolPreview = ({ operations }: { operations: SymbolOperation[] }) => {
  return (
    <svg
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
    >
      {operations.map((operation, index) => {
        if (operation.operation === "line") {
          return (
            <line
              key={index}
              x1={operation.origin.x}
              y1={operation.origin.y}
              x2={operation.destination.x}
              y2={operation.destination.y}
              stroke="black"
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        }

        if (operation.operation === "curve") {
          return (
            <path
              key={index}
              d={`M ${operation.origin.x} ${operation.origin.y} C ${operation.controlOrigin.x} ${operation.controlOrigin.y}, ${operation.controlDestination.x} ${operation.controlDestination.y}, ${operation.destination.x} ${operation.destination.y}`}
              fill="none"
              stroke="black"
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        }

        return (
          <text
            key={index}
            x={operation.position.x}
            y={operation.position.y}
            fill="black"
            fontSize={operation.fontSize ?? DEFAULT_FONT_SIZE}
            fontFamily="Arial, sans-serif"
          >
            {operation.text}
          </text>
        );
      })}
    </svg>
  );
};

const SymbolCreation = () => {
  const canvasRef = React.useRef<ReactSketchCanvasRef>(null);
  const drawingAreaRef = React.useRef<HTMLDivElement>(null);

  const [symbolName, setSymbolName] = React.useState("");
  const [symbolText, setSymbolText] = React.useState("");
  const [tool, setTool] = React.useState<Tool>("marker");
  const [strokeWidth, setStrokeWidth] = React.useState(3);
  const [fontSize, setFontSize] = React.useState(DEFAULT_FONT_SIZE);
  const [operations, setOperations] = React.useState<SymbolOperation[]>([]);
  const [dragStart, setDragStart] = React.useState<Point | null>(null);
  const [dragPreview, setDragPreview] = React.useState<SymbolOperation[]>([]);
  const [pendingText, setPendingText] = React.useState<{
    point: Point;
    value: string;
    scale: number;
  } | null>(null);
  const pendingInputRef = React.useRef<HTMLInputElement>(null);
  const pendingTextRef = React.useRef(pendingText);
  const committingRef = React.useRef(false);

  const isOverlayTool =
    tool === "line" ||
    tool === "rectangle" ||
    tool === "ellipse" ||
    tool === "text";

  React.useEffect(() => {
    if (!canvasRef.current) return;

    canvasRef.current.eraseMode(tool === "eraser");
  }, [tool]);

  const buildShapeOperations = (start: Point, end: Point): SymbolOperation[] => {
    if (tool === "line") {
      return [
        {
          operation: "line",
          origin: roundPoint(start),
          destination: roundPoint(end),
        },
      ];
    }

    if (tool === "rectangle") {
      return rectangleToOperations(start, end);
    }

    if (tool === "ellipse") {
      return ellipseToOperations(start, end);
    }

    return [];
  };

  const eraseGeometryAtPoint = (point: Point) => {
    setOperations((previous) => {
      if (previous.length === 0) return previous;

      let closestIndex = -1;
      let closestDistance = Number.POSITIVE_INFINITY;

      previous.forEach((operation, index) => {
        const operationDistance = getOperationDistance(point, operation);

        if (operationDistance < closestDistance) {
          closestDistance = operationDistance;
          closestIndex = index;
        }
      });

      if (closestIndex === -1 || closestDistance > 18) return previous;

      return previous.filter((_, index) => index !== closestIndex);
    });
  };

  const handleDrawingAreaPointerDownCapture = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!drawingAreaRef.current) return;

    if (tool !== "eraser") return;

    const point = getPointerPoint(event, drawingAreaRef.current);
    eraseGeometryAtPoint(point);
  };

  // Keep a ref copy so commit logic never reads a stale closure and never
  // nests one state setter inside another (which StrictMode drops).
  React.useEffect(() => {
    pendingTextRef.current = pendingText;
  }, [pendingText]);

  const commitPendingText = () => {
    if (committingRef.current) return;
    const current = pendingTextRef.current;
    if (!current) return;

    committingRef.current = true;
    const value = current.value.trim();

    if (value) {
      setOperations((previous) => [
        ...previous,
        {
          operation: "text",
          text: value,
          position: current.point,
          fontSize,
        },
      ]);
    }

    setPendingText(null);
    // Release the guard after this event so Enter + the resulting blur
    // cannot commit the same text twice.
    window.setTimeout(() => {
      committingRef.current = false;
    }, 0);
  };

  const cancelPendingText = () => setPendingText(null);

  // Focus on the next frame so the placing click cannot blur the input
  // before it mounts, which previously discarded the editor instantly.
  React.useEffect(() => {
    if (!pendingText) return;
    const id = requestAnimationFrame(() => pendingInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [pendingText]);

  const handleOverlayPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!drawingAreaRef.current) return;

    const point = getPointerPoint(event, drawingAreaRef.current);

    if (tool === "text") {
      // Place an inline editor exactly where the user clicked instead of
      // opening a blocking dialog. Commit happens on Enter / blur.
      commitPendingText();
      const rect = drawingAreaRef.current.getBoundingClientRect();
      setPendingText({
        point: roundPoint(point),
        value: symbolText,
        scale: rect.width / CANVAS_SIZE,
      });
      return;
    }

    if (tool !== "line" && tool !== "rectangle" && tool !== "ellipse") return;

    setDragStart(point);
    setDragPreview([]);
  };

  const handleOverlayPointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!drawingAreaRef.current || !dragStart) return;
    if (tool !== "line" && tool !== "rectangle" && tool !== "ellipse") return;

    const currentPoint = getPointerPoint(event, drawingAreaRef.current);
    setDragPreview(buildShapeOperations(dragStart, currentPoint));
  };

  const handleOverlayPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingAreaRef.current || !dragStart) return;
    if (tool !== "line" && tool !== "rectangle" && tool !== "ellipse") return;

    const endPoint = getPointerPoint(event, drawingAreaRef.current);
    const nextOperations = buildShapeOperations(dragStart, endPoint);

    setOperations((previous) => [...previous, ...nextOperations]);
    setDragStart(null);
    setDragPreview([]);
  };

  const clearAll = () => {
    canvasRef.current?.clearCanvas();
    setOperations([]);
    setDragStart(null);
    setDragPreview([]);
  };

  const undo = () => {
    if (operations.length > 0) {
      setOperations((previous) => previous.slice(0, -1));
      return;
    }

    canvasRef.current?.undo();
  };

  const saveSymbol = async () => {
    const id = slugify(symbolName) || `symbol-${Date.now()}`;

    const drawingElement = drawingAreaRef.current;
    if (!drawingElement || !canvasRef.current) return;

    const rect = drawingElement.getBoundingClientRect();

    const sketchPaths = await canvasRef.current.exportPaths();
    const sketchOperations = sketchPathsToOperations(
      sketchPaths,
      rect.width,
      rect.height
    );

    const finalOperations = [...operations, ...sketchOperations];

    const symbolJson = {
      collectionName: "symbols",
      symbols: [
        {
          id,
          name: symbolName.trim() || id,
          operations: finalOperations,
        },
      ],
    };

    const jsonBlob = new Blob([JSON.stringify(symbolJson, null, 2)], {
      type: "application/json",
    });

    downloadBlob(jsonBlob, `${id}.json`);

    const sketchPngDataUrl = await canvasRef.current.exportImage("png");
    const sketchImage = await loadImage(sketchPngDataUrl);

    const shapeSvgMarkup = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
        ${operationsToSvgElements(operations)}
      </svg>
    `;

    const shapeSvgBlob = new Blob([shapeSvgMarkup], {
      type: "image/svg+xml;charset=utf-8",
    });

    const shapeSvgUrl = URL.createObjectURL(shapeSvgBlob);
    const shapeImage = await loadImage(shapeSvgUrl);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = CANVAS_SIZE;
    outputCanvas.height = CANVAS_SIZE;

    const context = outputCanvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "white";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    context.drawImage(sketchImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.drawImage(shapeImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    outputCanvas.toBlob((pngBlob) => {
      if (!pngBlob) return;

      downloadBlob(pngBlob, `${id}.png`);
      URL.revokeObjectURL(shapeSvgUrl);
    }, "image/png");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <FloatingDockDemo />

      <main className="mx-auto flex w-full max-w-7xl gap-6 px-6 py-8">
        <section className="w-80 shrink-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Symbol Library
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              Create Symbol
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Draw a reusable symbol template and export both PNG and geometry
              JSON.
            </p>
          </div>

          <label className="mb-2 block text-sm font-medium text-slate-300">
            Symbol name
          </label>
          <input
            value={symbolName}
            onChange={(event) => setSymbolName(event.target.value)}
            placeholder="Example: Custom Breaker"
            className="mb-5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-cyan-500/40 placeholder:text-slate-500 focus:ring-2"
          />

          <label className="mb-2 block text-sm font-medium text-slate-300">
            Text tool label
          </label>
          <input
            value={symbolText}
            onChange={(event) => setSymbolText(event.target.value)}
            placeholder="Example: A-##"
            className="mb-5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-cyan-500/40 placeholder:text-slate-500 focus:ring-2"
          />

          <div className="mb-5">
            <p className="mb-3 text-sm font-medium text-slate-300">Tools</p>

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  "marker",
                  "eraser",
                  "line",
                  "rectangle",
                  "ellipse",
                  "text",
                ] as Tool[]
              ).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTool(item)}
                  className={`rounded-xl border px-3 py-2 text-sm capitalize transition ${
                    tool === item
                      ? "border-cyan-400 bg-cyan-400 text-slate-950"
                      : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">
                Stroke width
              </label>
              <span className="text-sm text-slate-400">{strokeWidth}px</span>
            </div>

            <input
              type="range"
              min="1"
              max="12"
              value={strokeWidth}
              onChange={(event) => setStrokeWidth(Number(event.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">
                Text size
              </label>
              <span className="text-sm text-slate-400">{fontSize}px</span>
            </div>

            <input
              type="range"
              min="8"
              max="96"
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={undo}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Undo
            </button>

            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-rose-800 bg-rose-950/50 px-3 py-2 text-sm text-rose-200 hover:border-rose-500"
            >
              Clear
            </button>
          </div>

          <button
            type="button"
            onClick={saveSymbol}
            className="mt-5 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Save PNG + Geometry JSON
          </button>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
            <p>Exports:</p>
            <p className="mt-1 text-slate-300">1. symbol-name.png</p>
            <p className="text-slate-300">2. symbol-name.json</p>
          </div>
        </section>

        <section className="flex flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Drawing Canvas
              </h2>
              <p className="text-sm text-slate-400">
                Marker strokes are saved as line operations. Ellipses are saved
                as curve operations. Text is saved as a text operation.
              </p>
            </div>

            <div className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-300">
              Active:{" "}
              <span className="font-semibold text-cyan-300">{tool}</span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center rounded-2xl bg-slate-950 p-6">
            <div
              ref={drawingAreaRef}
              onPointerDownCapture={handleDrawingAreaPointerDownCapture}
              className="relative aspect-square w-full max-w-[640px] overflow-hidden rounded-2xl border border-slate-700 bg-white shadow-2xl"
            >
              <div className="absolute inset-0 z-0">
                <ReactSketchCanvas
                  ref={canvasRef}
                  width="100%"
                  height="100%"
                  strokeWidth={strokeWidth}
                  eraserWidth={24}
                  strokeColor="black"
                  canvasColor="transparent"
                  className={isOverlayTool ? "pointer-events-none" : ""}
                />
              </div>

              <SymbolPreview operations={[...operations, ...dragPreview]} />

              {isOverlayTool && (
                <div
                  onPointerDown={handleOverlayPointerDown}
                  onPointerMove={handleOverlayPointerMove}
                  onPointerUp={handleOverlayPointerUp}
                  onPointerLeave={handleOverlayPointerUp}
                  className="absolute inset-0 z-20 cursor-crosshair"
                />
              )}

              {pendingText && (
                <input
                  ref={pendingInputRef}
                  autoFocus
                  onPointerDown={(event) => event.stopPropagation()}
                  value={pendingText.value}
                  onChange={(event) =>
                    setPendingText((current) =>
                      current
                        ? { ...current, value: event.target.value }
                        : current
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitPendingText();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      cancelPendingText();
                    }
                  }}
                  onBlur={commitPendingText}
                  placeholder="Type text, Enter to place"
                  style={{
                    position: "absolute",
                    left: `${(pendingText.point.x / CANVAS_SIZE) * 100}%`,
                    top: `${(pendingText.point.y / CANVAS_SIZE) * 100}%`,
                    transform: "translateY(-0.85em)",
                    fontSize: `${fontSize * pendingText.scale}px`,
                    fontFamily: "Arial, sans-serif",
                    lineHeight: 1,
                    color: "black",
                    background: "rgba(255,255,255,0.9)",
                    border: "1px dashed #06b6d4",
                    outline: "none",
                    padding: "0 2px",
                    minWidth: "40px",
                  }}
                  className="z-30"
                />
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default SymbolCreation;