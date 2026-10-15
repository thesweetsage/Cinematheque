import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Off: with it, pages built on demand (new titles, new programmes) are sent as a placeholder shell and filled in
  // afterwards, and that second stream was being cut off (React error #412). A one-person app gains nothing from it.
  partialPrefetching: false,
  experimental: {
    // Every click asks the server for the page: a page kept in the browser for 5 minutes showed staff cards you'd hidden,
    // a wishlist without what you'd just added, and programmes you'd deleted. On a home network the request is quick.
    staleTimes: { dynamic: 0, static: 0 },
  },
  turbopack: {
    rules: {
      // Tailwind only processes the global stylesheet; component *.module.css files keep their scoped class names.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
