import type { MetadataRoute } from "next";

// Lets the team "Add to Home Screen" on phones; opens straight into the dashboard.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Karta Lead Tracker",
    short_name: "Karta",
    description: "Lead tracking dashboard for the sales team",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fbfaf6",
    theme_color: "#25241f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
