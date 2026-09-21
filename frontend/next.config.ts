import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * React StrictMode double-invokes effects in development. Leaflet
   * initialises imperatively against a DOM node, so the second mount throws
   * "Map container is being reused by another instance" and cascades into
   * update-depth errors on every client-side navigation between map pages.
   * Production builds are unaffected (verified clean), but the dev console
   * noise makes real errors impossible to spot — so StrictMode is off here.
   */
  reactStrictMode: false,
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || "http://127.0.0.1:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
