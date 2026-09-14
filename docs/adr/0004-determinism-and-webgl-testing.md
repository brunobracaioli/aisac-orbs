# ADR-0004: Injected time and randomness with production browser checks

Status: accepted
Date: 2026-09-14
Decision basis: maintainer approval of implementation plan 1.1.0 and W0 §8.

## Context

CI has no guaranteed physical GPU. Timing sleeps, global randomness and pixel snapshots cannot reliably prove semantic correctness, governance or real-device rendering performance.

## Decision

Inject `Clock`, `Scheduler`, `Prng` and `FrameTimeSource` at the owning boundaries. Use Mulberry32 with the specified golden vector and label forks derived from the initial seed. Unit and property tests control time and replay seeds; semantic tests do not wait for wall-clock delays.

Browser checks run against a production Next.js build with a scrubbed application environment. Chromium SwiftShader proves that rendering advances; a second Chromium project disables WebGL and proves the accessible fallback. Tests inspect read-only debug snapshots exposed only by the explicit debug opt-in, collect browser/CSP errors and wait for observable conditions. Pixel comparisons are optional diagnostics.

Production pages using CSP nonces are rendered per request so the bootstrap scripts and response policy share a nonce. The implementation must prove this in browser tests, including 404 responses. See the [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy).

## Consequences

SwiftShader results establish functional rendering and measurement behavior. Physical-device FPS, latency targets and human recognition of formations need their separately recorded acceptance evidence. CI artifacts retain test reports, traces and timing information; no test tag or synthetic measurement is presented as human or device approval.
