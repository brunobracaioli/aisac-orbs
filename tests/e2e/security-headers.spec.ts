import { expect, test } from "@playwright/test";

import { installConsoleGuard } from "../support/e2e/consoleGuard";

declare global {
  interface Window {
    readonly __orbCspViolations?: string[];
  }
}

const STATIC_HEADERS = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "microphone=(self), camera=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
  "x-dns-prefetch-control": "off",
} as const;

const CSP_NONCE = /'nonce-([^']+)'/;
const CSP_STYLE_HASHES = [
  "'sha256-B3Jk7Rws8l6DgOhoy0oMP4k8gk16joGygBpDXz05ZXo='",
  "'sha256-Z5XTK23DFuEMs0PwnyZDO9SWxemQ5HxcpVaBNuUJyWY='",
  "'sha256-62bzXi2UhdWpYgtGCqraCZs6PtBsZ0N+iYsYwCmJyFM='",
  "'sha256-jKE6QZqne5OsrfemNvuLSNoud++NsCOiSlGuIsQns5o='",
  "'sha256-tdnkoSkLUgRhOgw6H8vgY/Cqyq1n8ju33p/Pple8Dyg='",
];

function normalizeCsp(csp: string, nonce: string): string[] {
  return csp
    .replaceAll(`'nonce-${nonce}'`, "'nonce-<nonce>'")
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive.length > 0);
}

test("security headers use an exact production policy on HTML and 404 responses", async ({
  page,
}) => {
  const guard = installConsoleGuard(page, { allowExpectedNavigation404: true });
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.defineProperty(window, "__orbCspViolations", {
      configurable: true,
      get: () => violations,
    });
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
    });
  });
  const nonceValues: string[] = [];

  for (const [route, expectedStatus] of [
    ["/", 200],
    ["/smoke/points?debug=1", 200],
    ["/does-not-exist", 404],
    ["/_next/image?url=%2Fmissing.png&w=64&q=75", 404],
  ] as const) {
    const response = await page.goto(route);
    expect(response).toBeTruthy();
    expect(response?.status()).toBe(expectedStatus);
    const headers = response?.headers() ?? {};
    for (const [name, value] of Object.entries(STATIC_HEADERS)) {
      expect(headers[name]).toBe(value);
    }

    const csp = headers["content-security-policy"] ?? "";
    const nonce = CSP_NONCE.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    const expected = [
      "default-src 'self'",
      "script-src 'self' 'nonce-<nonce>' 'strict-dynamic'",
      `style-src 'self' 'nonce-<nonce>' 'unsafe-hashes' ${CSP_STYLE_HASHES.join(" ")}`,
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ];
    expect(normalizeCsp(csp, nonce ?? "")).toEqual(expected);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("'unsafe-inline'");
    nonceValues.push(nonce ?? "");
    expect(await page.evaluate(() => window.__orbCspViolations ?? [])).toEqual([]);
  }

  expect(new Set(nonceValues).size).toBe(nonceValues.length);
  guard.assertClean();
});
