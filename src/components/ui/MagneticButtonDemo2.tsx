"use client";
import React from "react";
import { Link } from "react-router-dom"; // 1. Import Link from React Router
import { MagneticButton } from "@/components/ui/magnetic-button-copy";
import { FloatingDockDemo } from "@/components/ui/FloatingDock";
interface MagneticButtonDemo2Props {
  onClick?: () => void;
  active?: boolean;
}
export function MagneticButtonDemo2({
  onClick,
  active = false,
}: MagneticButtonDemo2Props) {
  return (

 
    <div className="flex items-right gap-4">
      <MagneticButton>
        <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md bg-red-600 px-4 py-2 font-semibold text-white transition-shadow ${
        active ? "ring-2 ring-red-300 ring-offset-2" : ""
      }`}
    >
      Conflict Detection
    </button>
      </MagneticButton>
    </div>
  );
}
