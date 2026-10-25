import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./src/identity/cookies.ts";
import {
  decideRefresh,
  refreshDepsFromEnvironment,
  type RefreshDecision,
} from "./src/identity/refresh.ts";

function createContentSecurityPolicy(nonce: string): string {
  // React's development debugging requires eval; production must keep it blocked.
  const isDevelopment = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function respond(request: NextRequest, decision: RefreshDecision) {
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  // The session cookies are renewed here (BR2.5, BR2.7): the page of this very request already sees the new
  // tokens, and the browser receives them with the response.
  if (decision.action === "renew") {
    request.cookies.set(ACCESS_COOKIE, decision.tokens.accessToken);
    request.cookies.set(REFRESH_COOKIE, decision.tokens.refreshToken);
    requestHeaders.set("cookie", request.cookies.toString());
  } else if (decision.action === "clear") {
    request.cookies.delete(ACCESS_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
    requestHeaders.set("cookie", request.cookies.toString());
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  if (decision.action === "renew") {
    response.cookies.set(ACCESS_COOKIE, decision.tokens.accessToken, decision.options);
    response.cookies.set(REFRESH_COOKIE, decision.tokens.refreshToken, decision.options);
  } else if (decision.action === "clear") {
    response.cookies.set(ACCESS_COOKIE, "", decision.options);
    response.cookies.set(REFRESH_COOKIE, "", decision.options);
  }
  return response;
}

export function proxy(request: NextRequest): NextResponse | Promise<NextResponse> {
  // Requests without a session cookie (signed-out visitors) take the synchronous path.
  if (!request.cookies.has(REFRESH_COOKIE)) return respond(request, { action: "none" });
  const deps = refreshDepsFromEnvironment(process.env);
  if (!deps) return respond(request, { action: "none" });
  return decideRefresh(request.cookies, deps).then((decision) => respond(request, decision));
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
