import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaxTrack — Australian Tax & EOFY Calculator",
    short_name: "TaxTrack",
    description:
      "A private Australian end-of-financial-year organiser. Records stay in this browser.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#06131c",
    theme_color: "#070c18",
    lang: "en-AU",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
