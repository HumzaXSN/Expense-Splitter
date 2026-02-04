import type { NextConfig } from "next";
import withPWA from "next-pwa";
import runtimeCaching from "next-pwa/cache";
import fs from "node:fs";
import path from "node:path";

const baseConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  turbopack: {},
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.NEXT_PUBLIC_APP_VERSION ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.npm_package_version ??
      "0.0.0",
  },
};

const appDir = path.join(process.cwd(), "src", "app");

const isGroupSegment = (segment: string) => segment.startsWith("(") && segment.endsWith(")");
const isDynamicSegment = (segment: string) => segment.startsWith("[") && segment.endsWith("]");

const collectStaticRoutes = (dir: string, segments: string[] = []) => {
  const routes: string[] = [];
  if (!fs.existsSync(dir)) return routes;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const hasPage = entries.some((entry) => entry.isFile() && entry.name === "page.tsx");
  if (hasPage) {
    const pathSegments = segments.filter((segment) => !isGroupSegment(segment));
    const routePath = `/${pathSegments.join("/")}`.replace(/\/+/g, "/");
    routes.push(routePath === "/" ? "/" : routePath.replace(/\/$/, ""));
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_")) continue;
    if (isDynamicSegment(entry.name)) continue;
    routes.push(
      ...collectStaticRoutes(path.join(dir, entry.name), [...segments, entry.name])
    );
  }

  return routes;
};

const staticRoutes = collectStaticRoutes(appDir);
const additionalManifestEntries = staticRoutes.map((route) => ({
  url: route,
  revision: null,
}));

const customRuntimeCaching = [
  {
    urlPattern: ({ request }: { request: Request }) => request.destination === "document",
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "pages",
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  ...runtimeCaching.filter((entry) => entry.options?.cacheName !== "pages"),
];

const nextConfig = withPWA({
  dest: "public",
  register: false,
  skipWaiting: false,
  disable: process.env.NODE_ENV !== "production",
  runtimeCaching: customRuntimeCaching,
  additionalManifestEntries,
  fallbacks: {
    document: "/offline.html",
  },
})(baseConfig);

export default nextConfig;
