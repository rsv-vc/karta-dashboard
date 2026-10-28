import type { ComponentProps } from "react";

/**
 * Brand geometry: two stadiums (pills) sharing their left cap centre at (0, 0),
 * one rising to (185, -185) and one falling to (185, 185). Shared by the
 * component below and the generated app icons so the mark is drawn one way.
 */
export const LOGO_VIEWBOX = "-98 -283 381 566";
export const LOGO_PATHS = [
  { transform: "translate(92.5 -92.5) rotate(-45)" },
  { transform: "translate(92.5 92.5) rotate(45)" },
].map((p) => ({ ...p, x: -208.8, y: -78, width: 417.6, height: 156, rx: 78 }));
export const LOGO_STROKE = 40;

/** The Karta mark, drawn in currentColor. Decorative unless given a title. */
export function LogoMark({ title, ...props }: ComponentProps<"svg"> & { title?: string }) {
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      fill="none"
      stroke="currentColor"
      strokeWidth={LOGO_STROKE}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {LOGO_PATHS.map((p) => (
        <rect key={p.transform} {...p} />
      ))}
    </svg>
  );
}
