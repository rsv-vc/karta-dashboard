import { ImageResponse } from "next/og";
import { LOGO_PATHS, LOGO_STROKE, LOGO_VIEWBOX } from "@/components/shared/logo-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon: the orange mark on the brand ink (iOS rounds the corners itself).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#25241F",
        }}
      >
        <svg width={76} height={113} viewBox={LOGO_VIEWBOX} fill="none" stroke="#F05A28" strokeWidth={LOGO_STROKE}>
          {LOGO_PATHS.map((p) => (
            <rect key={p.transform} {...p} />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
