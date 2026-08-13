import * as React from "react";
import { ReactSketchCanvas } from "react-sketch-canvas";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";

const styles = {
  border: "0.0625rem solid #9c9c9c",
  borderRadius: "0.25rem",
};

const Canvas = () => {
  return (
    <div className="w-full h-full p-4">
      <ReactSketchCanvas
        style={styles}
        width="100%"
        height="500px"
        strokeWidth={4}
        strokeColor="black"
        canvasColor="white"
      />
      <FloatingDockDemo></FloatingDockDemo>
    </div>
  );
};

export default Canvas;