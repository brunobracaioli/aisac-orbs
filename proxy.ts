import { NextResponse, type NextRequest } from "next/server";

import { env } from "./app/_lib/env";
import { buildContentSecurityPolicy } from "./app/_lib/security-headers";
import { randomId } from "./core";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(randomId()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, env.server.NODE_ENV);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|favicon.ico).*)"],
};
