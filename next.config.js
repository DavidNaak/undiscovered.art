/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Keep dev/build artifacts separate to avoid intermittent manifest races
  // when a dev server and production build run near the same time.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next-build",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default config;
