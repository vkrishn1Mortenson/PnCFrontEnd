"use client";
import React from "react";
import { Link } from "react-router-dom"; // 1. Import Link from React Router
import { MagneticButton } from "@/components/ui/magnetic-button";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";
export function MagneticButtonDemo() {
  const handleClick = () => {
    console.log("clicked");
  };

  return (
    <div className="flex justify-center py-4">
      <MagneticButton>
        {/* 2. Change <button> to <Link> and use "to" instead of "href" */}
        <Link
          to="/SymbolCreation"
          onClick={handleClick} // Keeps your console log if needed
          className="inline-block cursor-pointer rounded-lg bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2 font-medium text-white ring-1 ring-white/20 ring-offset-1 ring-offset-blue-500 transition-transform duration-150 ring-inset active:scale-98"
        >
          Make a symbol
        </Link>
      </MagneticButton>
    </div>
  );
}
