import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
];

const loginTestDistDir = process.env.APP_LOGIN_TEST_DIST_DIR;
if (loginTestDistDir && !/^\.next\/login-performance-[a-z0-9-]+$/.test(loginTestDistDir)) {
  throw new Error(
    "APP_LOGIN_TEST_DIST_DIR must be a dedicated .next/login-performance-* directory",
  );
}

const nextConfig: NextConfig = {
  ...(loginTestDistDir ? { distDir: loginTestDistDir } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  // Local brand images only, served at the default quality.
  images: { qualities: [75] },
  // The import's upload goes through a server action: the file limit is 5 MB, and the action's body limit
  // leaves room for the other form fields (BR41.2). A test keeps this in step with IMPORT_LIMITS.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
