import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy, config } from "../../proxy.ts";
import nextConfig from "../../next.config.ts";
it("propagates a fresh CSP nonce to response and request headers", async () => {
  const first = await proxy(new NextRequest("http://localhost/"));
  const second = await proxy(new NextRequest("http://localhost/"));
  const nonce = first.headers.get("x-middleware-request-x-nonce")!;
  expect(nonce).toBeTruthy();
  expect(first.headers.get("content-security-policy")).toContain("nonce-" + nonce);
  expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(
    first.headers.get("content-security-policy"),
  );
  expect(second.headers.get("content-security-policy")).not.toBe(
    first.headers.get("content-security-policy"),
  );
  expect(first.headers.get("content-security-policy")).toContain("object-src 'none'");
  expect(config.matcher[0]!.missing).toContainEqual({
    type: "header",
    key: "purpose",
    value: "prefetch",
  });
});
it("applies security headers to all routes and hides framework branding", async () => {
  expect(nextConfig.poweredByHeader).toBe(false);
  const entries = await nextConfig.headers!();
  expect(entries[0]!.source).toBe("/:path*");
  expect(entries[0]!.headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
  expect(entries[0]!.headers).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
});
