const CONTENT_SECURITY_POLICY_BASE = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
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

// Next's built-in not-found document contains stable inline style attributes.
// Hashes plus unsafe-hashes preserve the nonce-only policy for application code
// while allowing that framework-owned 404 document to render without inline CSS.
const NEXT_NOT_FOUND_STYLE_HASHES = [
  "'sha256-B3Jk7Rws8l6DgOhoy0oMP4k8gk16joGygBpDXz05ZXo='",
  "'sha256-Z5XTK23DFuEMs0PwnyZDO9SWxemQ5HxcpVaBNuUJyWY='",
  "'sha256-62bzXi2UhdWpYgtGCqraCZs6PtBsZ0N+iYsYwCmJyFM='",
  "'sha256-jKE6QZqne5OsrfemNvuLSNoud++NsCOiSlGuIsQns5o='",
  "'sha256-tdnkoSkLUgRhOgw6H8vgY/Cqyq1n8ju33p/Pple8Dyg='",
];

export const STATIC_SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "microphone=(self), camera=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
} as const;

export function buildContentSecurityPolicy(
  nonce: string,
  nodeEnv: "development" | "test" | "production",
): string {
  const scriptDevelopmentDirective = nodeEnv === "development" ? " 'unsafe-eval'" : "";
  const styleDevelopmentDirective = nodeEnv === "development" ? " 'unsafe-inline'" : "";
  const directives = [...CONTENT_SECURITY_POLICY_BASE];

  directives[1] = `${directives[1]} 'nonce-${nonce}' 'strict-dynamic'${scriptDevelopmentDirective}`;
  directives[2] = `${directives[2]} 'nonce-${nonce}'${styleDevelopmentDirective} 'unsafe-hashes' ${NEXT_NOT_FOUND_STYLE_HASHES.join(" ")}`;

  return directives.join("; ");
}
