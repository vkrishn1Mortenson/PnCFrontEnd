import * as React from "react";
import { ReactSketchCanvas } from "react-sketch-canvas";
import type { ReactSketchCanvasRef } from "react-sketch-canvas";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";

type Point = {
  x: number;
  y: number;
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GeometryShape = {
  kind: "geometry";
  points: Point[];
  isClosed: boolean;
};

type TextShape = {
  kind: "text";
  text: string;
  position: Point;
  fontSize: number;
};

type SymbolShape = GeometryShape | TextShape;

// Output element schema consumed downstream (matches symbols.json).
type GeometryElement = {
  kind: "geometry";
  points: Point[];
  isClosed: boolean;
};

type TextElement = {
  kind: "text";
  position: Point;
  bounds: Bounds;
  text: string;
};

type SymbolElement = GeometryElement | TextElement;

type ModelNode = {
  id: string;
  kind: "geometry" | "text";
  bounds: Bounds;
  center: Point;
  childIds: string[];
  points: Point[];
  text?: string;
  pattern?: string;
};

type Tool = "marker" | "eraser" | "line" | "rectangle" | "ellipse" | "text";

const CANVAS_SIZE = 512;
const DEFAULT_FONT_SIZE = 28;
const ELLIPSE_SEGMENTS = 64;

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

const getShapeDistance = (point: Point, shape: SymbolShape) => {
  if (shape.kind === "text") {
    return distance(point, shape.position);
  }
  const { points, isClosed } = shape;
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) return distance(point, points[0]);
  let closest = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i++) {
    closest = Math.min(
      closest,
      pointToSegmentDistance(point, points[i - 1], points[i])
    );
  }
  if (isClosed) {
    closest = Math.min(
      closest,
      pointToSegmentDistance(point, points[points.length - 1], points[0])
    );
  }
  return closest;
};

const boundsFromPoints = (points: Point[]): Bounds => {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const centerOfBounds = (bounds: Bounds): Point => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

const measureContext =
  typeof document !== "undefined"
    ? document.createElement("canvas").getContext("2d")
    : null;

const measureTextWidth = (text: string, fontSize: number) => {
  if (measureContext) {
    measureContext.font = `${fontSize}px Arial, sans-serif`;
    return measureContext.measureText(text).width;
  }
  return text.length * fontSize * 0.6;
};

// Bounds top-left, box, and center for a placed text shape. The stored point is
// the baseline anchor used while drawing; export reports the box center.
const textMetrics = (shape: TextShape) => {
  const width = measureTextWidth(shape.text, shape.fontSize);
  const height = shape.fontSize;
  const bounds: Bounds = {
    x: shape.position.x,
    y: shape.position.y - height,
    width,
    height,
  };
  return { bounds, center: centerOfBounds(bounds), width, height };
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPattern = (text: string) => `/^${escapeRegExp(text)}$/`;

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

const uploadSymbol = async (blob: Blob, fileName: string) => {
  const body = new FormData();
  body.append("file", blob, fileName);
  await fetch("http://localhost:5000/symbols/upload", {
    method: "POST",
    body,
  });
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

const rectangleToShape = (start: Point, end: Point): GeometryShape => {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  return {
    kind: "geometry",
    isClosed: true,
    points: [
      roundPoint({ x: left, y: top }),
      roundPoint({ x: right, y: top }),
      roundPoint({ x: right, y: bottom }),
      roundPoint({ x: left, y: bottom }),
    ],
  };
};

const ellipseToShape = (start: Point, end: Point): GeometryShape => {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const rx = (right - left) / 2;
  const ry = (bottom - top) / 2;
  const points: Point[] = [];
  for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
    const angle = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
    points.push(
      roundPoint({
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      })
    );
  }
  return { kind: "geometry", isClosed: true, points };
};

const lineToShape = (start: Point, end: Point): GeometryShape => ({
  kind: "geometry",
  isClosed: false,
  points: [roundPoint(start), roundPoint(end)],
});

const sketchPathsToShapes = (
  paths: any[],
  renderedWidth: number,
  renderedHeight: number
): GeometryShape[] => {
  const shapes: GeometryShape[] = [];
  const scaleX = CANVAS_SIZE / renderedWidth;
  const scaleY = CANVAS_SIZE / renderedHeight;
  paths.forEach((path) => {
    if (!path.drawMode || !Array.isArray(path.paths)) return;
    const points: Point[] = [];
    path.paths.forEach((raw: Point) => {
      const scaled = roundPoint({ x: raw.x * scaleX, y: raw.y * scaleY });
      const previous = points[points.length - 1];
      if (previous && distance(previous, scaled) < 1) return;
      points.push(scaled);
    });
    if (points.length >= 2) {
      shapes.push({ kind: "geometry", isClosed: false, points });
    }
  });
  return shapes;
};

const pointsToAttr = (points: Point[]) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

const shapesToSvgElements = (shapes: SymbolShape[]) =>
  shapes
    .map((shape) => {
      if (shape.kind === "geometry") {
        const attr = pointsToAttr(shape.points);
        if (shape.isClosed) {
          return `<polygon points="${attr}" fill="none" stroke="black" stroke-width="3" stroke-linejoin="round" />`;
        }
        return `<polyline points="${attr}" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
      }
      return `<text x="${shape.position.x}" y="${shape.position.y}" fill="black" font-size="${
        shape.fontSize ?? DEFAULT_FONT_SIZE
      }" font-family="Arial, sans-serif">${escapeXml(shape.text)}</text>`;
    })
    .join("");

const shapesToElements = (shapes: SymbolShape[]): SymbolElement[] =>
  shapes.map((shape) => {
    if (shape.kind === "geometry") {
      return {
        kind: "geometry",
        points: shape.points.map(roundPoint),
        isClosed: shape.isClosed,
      };
    }
    const { bounds, center } = textMetrics(shape);
    return {
      kind: "text",
      position: roundPoint(center),
      bounds,
      text: shape.text,
    };
  });

const buildModel = (shapes: SymbolShape[]) => {
  const nodes: [string, ModelNode][] = shapes.map((shape, index) => {
    const id = `geo-${index}`;
    const childIds = index < shapes.length - 1 ? [`geo-${index + 1}`] : [];
    if (shape.kind === "geometry") {
      const points = shape.points.map(roundPoint);
      const bounds = boundsFromPoints(points);
      return [
        id,
        {
          id,
          kind: "geometry",
          bounds,
          center: centerOfBounds(bounds),
          childIds,
          points,
        },
      ];
    }
    const { bounds, center } = textMetrics(shape);
    return [
      id,
      {
        id,
        kind: "text",
        bounds,
        center: roundPoint(center),
        childIds,
        points: [],
        text: shape.text,
        pattern: toPattern(shape.text),
      },
    ];
  });

  const graphNodes: Record<string, { id: string; childIds: string[] }> = {};
  nodes.forEach(([id, node]) => {
    graphNodes[id] = { id, childIds: node.childIds };
  });
  const order = nodes.map(([id]) => id);
  const rootId = order[0] ?? null;

  return {
    graph: { nodes: graphNodes, rootId, order },
    rootId,
    nodes,
  };
};

const SymbolPreview = ({ shapes }: { shapes: SymbolShape[] }) => {
  return (
    <svg
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
    >
      {shapes.map((shape, index) => {
        if (shape.kind === "geometry") {
          const attr = pointsToAttr(shape.points);
          if (shape.isClosed) {
            return (
              <polygon
                key={index}
                points={attr}
                fill="none"
                stroke="black"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            );
          }
          return (
            <polyline
              key={index}
              points={attr}
              fill="none"
              stroke="black"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }

        return (
          <text
            key={index}
            x={shape.position.x}
            y={shape.position.y}
            fill="black"
            fontSize={shape.fontSize ?? DEFAULT_FONT_SIZE}
            fontFamily="Arial, sans-serif"
          >
            {shape.text}
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
  const [shapes, setShapes] = React.useState<SymbolShape[]>([]);
  const [dragStart, setDragStart] = React.useState<Point | null>(null);
  const [dragPreview, setDragPreview] = React.useState<SymbolShape[]>([]);
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

  const buildShape = (start: Point, end: Point): SymbolShape[] => {
    if (tool === "line") {
      return [lineToShape(start, end)];
    }
    if (tool === "rectangle") {
      return [rectangleToShape(start, end)];
    }
    if (tool === "ellipse") {
      return [ellipseToShape(start, end)];
    }
    return [];
  };

  const eraseGeometryAtPoint = (point: Point) => {
    setShapes((previous) => {
      if (previous.length === 0) return previous;
      let closestIndex = -1;
      let closestDistance = Number.POSITIVE_INFINITY;
      previous.forEach((shape, index) => {
        const shapeDistance = getShapeDistance(point, shape);
        if (shapeDistance < closestDistance) {
          closestDistance = shapeDistance;
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
      setShapes((previous) => [
        ...previous,
        {
          kind: "text",
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
    setDragPreview(buildShape(dragStart, currentPoint));
  };

  const handleOverlayPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingAreaRef.current || !dragStart) return;
    if (tool !== "line" && tool !== "rectangle" && tool !== "ellipse") return;

    const endPoint = getPointerPoint(event, drawingAreaRef.current);
    const nextShapes = buildShape(dragStart, endPoint);

    setShapes((previous) => [...previous, ...nextShapes]);
    setDragStart(null);
    setDragPreview([]);
  };

  const clearAll = () => {
    canvasRef.current?.clearCanvas();
    setShapes([]);
    setDragStart(null);
    setDragPreview([]);
  };

  const undo = () => {
    if (shapes.length > 0) {
      setShapes((previous) => previous.slice(0, -1));
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
    const sketchShapes = sketchPathsToShapes(
      sketchPaths,
      rect.width,
      rect.height
    );
    const finalShapes: SymbolShape[] = [...shapes, ...sketchShapes];

    const symbolObject = {
      name: symbolName.trim() || id,
      model: buildModel(finalShapes),
      elements: shapesToElements(finalShapes),
    };

    // Top-level array matches the symbols.json collection format.
    const symbolJson = [symbolObject];

    const jsonBlob = new Blob([JSON.stringify(symbolJson, null, 2)], {
      type: "application/json",
    });
    downloadBlob(jsonBlob, `${id}.json`);
    await uploadSymbol(jsonBlob, `${id}.json`);

    const sketchPngDataUrl = await canvasRef.current.exportImage("png");
    const sketchImage = await loadImage(sketchPngDataUrl);

    const shapeSvgMarkup = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
        ${shapesToSvgElements(shapes)}
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

    outputCanvas.toBlob(async (pngBlob) => {
      if (!pngBlob) return;
      downloadBlob(pngBlob, `${id}.png`);
      await uploadSymbol(pngBlob, `${id}.png`);
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
                Each shape is saved as one geometry element with a points array.
                Rectangles and ellipses are closed; text is a text element.
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

              <SymbolPreview shapes={[...shapes, ...dragPreview]} />

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
