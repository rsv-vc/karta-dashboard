import { ImageResponse } from "next/og";
import { LOGO_PATHS, LOGO_STROKE, LOGO_VIEWBOX } from "@/components/shared/logo-mark";

export const alt = "Karta Lead Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link preview (Slack, WhatsApp, email): the orange mark and the product name on brand ink.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 120px",
          background: "#25241F",
          color: "#F5F3EE",
          fontFamily: "sans-serif",
        }}
      >
        <svg width={170} height={252} viewBox={LOGO_VIEWBOX} fill="none" stroke="#F05A28" strokeWidth={LOGO_STROKE}>
          {LOGO_PATHS.map((p) => (
            <rect key={p.transform} {...p} />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>Karta</div>
          <div style={{ fontSize: 40, color: "#A8A497" }}>Lead Tracker for the sales team</div>
        </div>
      </div>
    ),
    size,
  );
}
