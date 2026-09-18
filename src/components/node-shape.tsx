import type { CSSProperties } from "react";
import type { NodeShape } from "@/lib/id/course-map";

// Shared shape rendering for the Map tab's flowchart nodes and the
// Settings page's shape picker: a pure style helper plus a small preview
// swatch built on it. Sizing/fill/border stay the caller's job (className/
// style), so the same shape works at icon size or full flowchart-node size.

export function shapeClipStyle(shape: NodeShape): CSSProperties {
  switch (shape) {
    case "circle":
      // A box-filling ellipse/"stadium" rather than a true 1:1 circle —
      // this is what circular flowchart nodes actually look like once
      // they're sized to fit a text label.
      return { borderRadius: 9999 };
    case "square":
      return { borderRadius: 4 };
    case "rounded-rectangle":
      return { borderRadius: 14 };
    case "diamond":
      return { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" };
    case "hexagon":
      return {
        clipPath:
          "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
      };
    default:
      return {};
  }
}

export function ShapeSwatch({
  shape,
  className = "",
}: {
  shape: NodeShape;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 border-2 border-current ${className}`}
      style={shapeClipStyle(shape)}
    />
  );
}
