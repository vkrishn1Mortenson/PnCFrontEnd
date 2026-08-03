"use client";
import { AsciiArt } from "@/components/ui/ascii-art";

export default function AsciiArtBrailleDemo() {
  return (
    <AsciiArt
      src="https://assets.aceternity.com/avatars/manu.webp"
      resolution={80}
      charset="braille"
      color="#06b6d4"
      inverted
      animated={false}
      className="mx-auto aspect-square w-full max-w-lg bg-neutral-950"
    />
  );
}
