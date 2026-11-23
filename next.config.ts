import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@react-pdf/renderer", "pdfjs-dist"],
  images: { qualities: [75, 92] },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
