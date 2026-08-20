"use client";
import React from "react";
import { Link } from "react-router-dom"; // 1. Import Link from React Router
import { MagneticButton } from "@/components/ui/magnetic-button-copy";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";
export function MagneticButtonDemo2() {
  const handleClick = () => {
    console.log("clicked");
  };

  return (
    <div className="flex items-right gap-4">
      <MagneticButton>
        {/* 2. Change <button> to <Link> and use "to" instead of "href" */}
        <Link
          to="/SymbolCreation"
          onClick={handleClick} // Keeps your console log if needed
          className="inline-block cursor-pointer rounded-lg bg-linear-to-b from-red-500 to-red-700 px-4 py-2 font-medium text-white ring-1 ring-white/20 ring-offset-1 ring-offset-red-500 transition-transform duration-150 ring-inset active:scale-98"
        >
          Conflict Detection
        </Link>
      </MagneticButton>
    </div>
  );
}
