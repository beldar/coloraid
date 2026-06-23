import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Next also injects <link rel="manifest">.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coloraid",
    short_name: "Coloraid",
    description:
      "Read a photo's colours and reproduce them with your own watercolour paints — built for colourblind painters.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#16140f",
    theme_color: "#16140f",
    categories: ["art", "productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
