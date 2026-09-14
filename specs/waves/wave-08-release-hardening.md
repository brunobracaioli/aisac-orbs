# Wave 8 — V1.0 release hardening

| Field                     | Value                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                | proposed                                                                                                                                                                                                                                                                                                            |
| **Milestones (SPEC §27)** | V1.0 Public release                                                                                                                                                                                                                                                                                                 |
| **Depends on**            | Waves 0–7 (gates G0–G7 closed on `main`); real devices from `docs/reference/device-list.md`; maintainer access to tag protection, GitHub Releases and the public demo host                                                                                                                                          |
| **Spec version**          | SPEC.md 0.2.0 = 0.1.0 + amendments A-02, A-11, A-13, A-14, A-15, A-16, A-17 (see `specs/SPEC-amendments-proposal.md`)                                                                                                                                                                                               |
| **Gate**                  | G8 = V1 — every SPEC §26 bullet has a linked passing test or recorded manual evidence; `pnpm req:coverage` shows 100 % of MUST and ≥ 70 % of SHOULD covered; the real-device perf matrix meets §10 targets or documents deviations with `spec_change` issues; `v1.0.0` is tagged, released and deployed (mock only) |
| **Estimated size**        | L — little new engine code, but real-device sessions, four new CI gates, a package build rehearsal, ~25 documents and release machinery that touches every bounded context                                                                                                                                          |

## 1. Objective

After this wave the repository is a releasable V1.0: the performance table in SPEC §10 is backed by recorded runs on at least two Android phones, one iPhone and two laptops; adaptive-quality thresholds are tuned against real frame-time traces and replayed deterministically in CI; the demo and playground pass axe on every page and state and render (or fall back gracefully) on WebKit and Firefox; a security review maps every item of the house checklist to evidence; `engine/` and its sibling roots build as a standalone `@aisac/orbs` package with zero app imports (ORB-API-003) without publishing anything; every §21 playground control exists, is labelled, keyboard-operable and observable through `window.__orbDebug` (ORB-PLAY-001); the Diátaxis tree is complete; `CHANGELOG.md` 1.0.0 states `Implements SPEC.md 0.2.0`, `OrbEngine.SPEC_VERSION` agrees, the annotated tag `v1.0.0` carries an SBOM and build provenance, and the public demo runs the mock adapter only. A stakeholder can open the GitHub release, read the §26 checklist with one link per bullet, click the demo, and follow `docs/tutorials/first-orb.md` on a fresh clone.

## 2. Scope

### 2.1 In scope

- Real-device performance matrix (`docs/reference/perf-matrix.md` + `docs/reference/perf-results/*.json`), `PerfProbeReport` schema, `scripts/perf-matrix.ts`, adaptive-threshold tuning from recorded traces, WebGL1 fallback E2E.
- Cross-browser smoke (WebKit, Firefox) promoted to a release gate; axe on all pages × all states; manual assistive-technology sign-off.
- Security review document, SBOM (CycloneDX) + build provenance, `pnpm audit` and license gate at release, threat-model index.
- Package-extraction rehearsal (`scripts/package-rehearsal.ts`, CI stage `package-rehearsal`) proving ORB-API-003.
- Playground completeness: `CONTROL_MANIFEST`, missing controls, `tests/e2e/playground.controls.spec.ts`, `docs/reference/playground-controls.md`.
- Diátaxis docs (tutorials / how-to / reference / explanation), README refresh (amendments §9 migration list), `CONTRIBUTING.md` final, issue templates final.
- Release: `scripts/release-check.ts`, `specs/acceptance-checklist.yaml`, `CHANGELOG.md` 1.0.0, `.github/workflows/release.yml`, annotated tag, GitHub release, public demo deployment (mock only) + post-deploy smoke.

### 2.2 Out of scope (deferred)

- Publishing `@aisac/orbs` to npm, pnpm-workspace split (U-5) → post-V1 (SPEC §27 future candidates); the rehearsal only proves the build.
- WebGPU renderer, mesh/GLB sampling, additional provider adapters → post-V1.
- Untrusted SVG upload on the public demo page `/` (U-3) → stays playground-only; the public deployment does not expose the playground (ADR-0018).
- Real tool execution (U-1) and Realtime transport (U-2) → unchanged from Wave 7.
- Automated pixel-perfect visual regression → optional, non-blocking (ADR-0004).

## 3. Requirements owned by this wave

Every ID listed here is owned by this wave and must be fully satisfied and verified before the gate closes. These are planned obligations; no test evidence is implied. Shared declaration owners and integration rules are in `specs/SHARED-CONTRACTS.md`.

| ID           | Level                          | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Slice | Verification                                                                                  |
| ------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| ORB-PERF-002 | SHOULD                         | "Mobile SHOULD target 30–60 FPS." — met when `mobile-default` on the mid-range Android and the iPhone, and `mobile-low` on the low-end Android, record median FPS ≥ 30 with `adaptive: false`; deviations documented with a `spec_change` issue, never by editing presets silently                                                                                                                                                                                          | 4.1   | perf-bench (manual, recorded) + unit (trace replay) + e2e (mobile emulation, owned by Wave 4) |
| ORB-PLAY-001 | SHOULD                         | "The playground SHOULD expose controls for: state (manual), formation, particle count, quality preset (+ adaptive on/off), turbulence, rotation, pulse, connection density, morph duration, pointer forces (radius, strength, mode), audio reactivity (mic toggle, synthetic source, gain), reduced-motion override, seed, mock lifecycle events (raw emit, governed sequences), tool visual registry, custom SVG upload, and a read-only `OrbSnapshot`/FPS/profile panel." | 4.3   | e2e (manifest-driven) + unit (doc ↔ manifest)                                                 |
| ORB-API-003  | SHOULD (contains MUST clauses) | "The engine SHOULD remain extractable as `@aisac/orbs`: `core/`, `events/`, `engine/`, `formations/`, `shaders/`, `pointer/`, `audio/` MUST NOT import `react`, `next`, `app/**`, `components/**`, `adapters/*/server/**` or any provider SDK; `engine/index.ts` MUST be the only public entry; the rule MUST be enforced in CI (`.dependency-cruiser.cjs`) and rehearsed by a package build before V1.0."                                                                  | 4.2   | arch (dependency-cruiser) + build rehearsal (CI stage) + unit (script)                        |

The SPEC §26 acceptance list carries no requirement IDs by design (WAVE_ASSIGNMENT: informative/meta, traced to detailed IDs); it is this wave's gate and is encoded in `specs/acceptance-checklist.yaml` (4.4). SPEC §28 rule 10 ("Releases SHOULD record the specification version they implement") is likewise informative and satisfied by 4.4.

Requirements touched but owned elsewhere: ORB-PERF-001, ORB-PERF-003, ORB-PERF-004, ORB-PERF-005, ORB-PERF-006, ORB-RENDER-006, ORB-A11Y-003 (Wave 2 — matrix rows, threshold values, WebGL1 fallback E2E); ORB-PLAY-002, ORB-API-001, ORB-API-004, ORB-DEMO-001, ORB-DEMO-006 (Wave 4 — completeness E2E re-asserts no bypass and `(manual)` labels; `SPEC_VERSION` consistency; public demo); ORB-A11Y-001, ORB-A11Y-002, ORB-A11Y-005, ORB-A11Y-006, ORB-DEMO-002, ORB-GOV-005 (Wave 1 — axe on all pages, AT sign-off, Simulated badge on the public deployment, playground never grants approval); ORB-POINTER-003, ORB-AUDIO-001, ORB-AUDIO-002 (Wave 5 — touch and microphone checks on real devices); ORB-SVG-003 (Wave 3 — recognisability sign-off refreshed at release); ORB-SEC-001, ORB-SEC-006, ORB-ADAPTER-003 (Wave 7 — bundle scan on the release build, mock-only deployment); ORB-ARCH-001, ORB-ARCH-002, ORB-FORM-007 (Wave 0 — boundary rules exercised by the rehearsal, supply-chain gates at release).

## 4. Vertical slices

### 4.1 Performance — bounded context `engine/quality` + `docs/reference`

**Objective.** Replace "should target" with recorded evidence: a schema-validated probe report per device × preset, a generated matrix with pass/fail against explicit floors, adaptive thresholds tuned from real traces and replayed in CI, and a CI-provable WebGL1 fallback.

**Contracts.**

```ts
// engine/quality/perfProbe.ts — pure aggregation, no DOM; the overlay in components/playground/PerfProbePanel.tsx calls it
export interface PerfProbeSample {
  dtMs: number;
  nowMs: number;
}
export interface PerfProbeReport {
  schemaVersion: 1;
  recordedAt: string; // ISO-8601 UTC
  commit: string; // 7-char sha of the build under test
  device: {
    model: string;
    os: string;
    browser: string;
    gpu: string | null;
    mobile: boolean;
    deviceMemoryGb: number | null;
    class: DeviceClass;
  };
  run: {
    preset: QualityPreset;
    adaptive: boolean;
    particleCount: number;
    connectionDensityCap: number;
    shaderTier: QualityProfile["shaderTier"];
    postProcessing: boolean;
    pixelRatio: number;
    seed: number;
    durationMs: number;
    warmupMs: number;
    reducedMotion: boolean;
  };
  frames: {
    count: number;
    medianFps: number;
    p95FrameMs: number;
    p99FrameMs: number;
    dropped: number;
    longestGapMs: number;
  };
  pointer: { samples: number; medianLatencyMs: number; p95LatencyMs: number } | null; // ORB-PERF-004 (Wave 5 probe)
  adaptive: {
    steps: ReadonlyArray<{
      atMs: number;
      from: QualityPreset;
      to: QualityPreset;
      reason: "degrade" | "upgrade";
    }>;
    oscillations: number;
  } | null;
  notes?: string; // ≤ 240 chars, free text (thermal, battery, "screen dimmed") — no PII
}
export type DeviceClass =
  "android-mid" | "android-low" | "iphone" | "laptop-integrated" | "laptop-discrete";
export function aggregateFrames(
  samples: readonly PerfProbeSample[],
  warmupMs: number,
): PerfProbeReport["frames"]; // dropped = dt > 2 × budget
export const PERF_TARGETS: Readonly<
  Record<
    QualityPreset,
    { minMedianFps: number; maxP95FrameMs: number; maxPointerLatencyMs: number } | null
  >
> = {
  "mobile-low": { minMedianFps: 30, maxP95FrameMs: 40, maxPointerLatencyMs: 50 },
  "mobile-default": { minMedianFps: 30, maxP95FrameMs: 40, maxPointerLatencyMs: 50 }, // ORB-PERF-002 (30–60)
  "desktop-default": { minMedianFps: 55, maxP95FrameMs: 20, maxPointerLatencyMs: 50 }, // ORB-PERF-001 target 60, floor 55 (ADR-0017)
  "desktop-high": { minMedianFps: 55, maxP95FrameMs: 20, maxPointerLatencyMs: 50 },
  "desktop-ultra": { minMedianFps: 30, maxP95FrameMs: 40, maxPointerLatencyMs: 50 }, // "50 000+ when supported"
  ci: null, // never judged (SwiftShader)
};

// scripts/perf-matrix.ts — validates docs/reference/perf-results/*.json, rewrites the table between <!-- perf-matrix:start/end --> markers
export const perfProbeReportSchema: ZodType<PerfProbeReport>; // strict; unknown keys rejected; notes ≤ 240
export const REQUIRED_MATRIX: ReadonlyArray<{ device: DeviceClass; preset: QualityPreset }> = [
  { device: "android-mid", preset: "mobile-default" },
  { device: "android-low", preset: "mobile-low" },
  { device: "iphone", preset: "mobile-default" },
  { device: "laptop-integrated", preset: "desktop-default" },
  { device: "laptop-discrete", preset: "desktop-high" },
]; // ≥ 2 Android, ≥ 1 iPhone, 2 laptops (WAVE_ASSIGNMENT 8.1)
export interface PerfMatrixRow {
  file: string;
  device: DeviceClass;
  model: string;
  preset: QualityPreset;
  particleCount: number;
  medianFps: number;
  p95FrameMs: number;
  pointerLatencyMs: number | null;
  verdict: "pass" | "fail" | "n/a";
  ageDays: number;
  stale: boolean;
  commit: string;
}
export interface PerfMatrixSummary {
  rows: PerfMatrixRow[];
  required: Array<{ device: DeviceClass; preset: QualityPreset; satisfiedBy: string | null }>;
  failures: number;
  stale: number;
  newestCommit: string | null;
}
export function buildMatrix(
  reports: readonly PerfProbeReport[],
  now: Date,
  opts: { staleAfterDays: number /* 90 */; freshWithinDays: number /* 30, release */ },
): PerfMatrixSummary; // pure
export function renderMarkdown(summary: PerfMatrixSummary): string;
```

Probe activation (Wave 2 convention, extended): `/?perfprobe=1&preset=<QualityPreset>&adaptive=0&seed=1[&trace=1]` runs 10 s warm-up + 50 s measurement, then shows the JSON report with a "Copy report" button; `trace=1` appends the raw `dtMs[]` for `tests/fixtures/perf/traces/`. `adaptive=1` runs are recorded but judged `n/a` for absolute targets (they prove ORB-PERF-003 behaviour instead). Tuning values live in the threshold constant Wave 2 introduced in `engine/quality/presets.ts`; this wave changes numbers only, never the shape (`QualityController`, `QUALITY_PRESETS` and `QualityProfile` stay as in SHARED_CONTRACTS).

**Device matrix template** (`docs/reference/perf-matrix.md`, generated; one row per JSON file):

| Device class      | Model / OS / browser                     | GPU (`WEBGL_debug_renderer_info` or `null`) | Preset                                                    | Particles | Median FPS | p95 frame ms | Pointer ms | Adaptive | Verdict | Commit   | Date           | Owner (GitHub handle) |
| ----------------- | ---------------------------------------- | ------------------------------------------- | --------------------------------------------------------- | --------: | ---------: | -----------: | ---------: | -------- | ------- | -------- | -------------- | --------------------- |
| android-mid       | _e.g._ Pixel 7 / Android 14 / Chrome 130 | Mali-G710                                   | mobile-default                                            |      5000 |       ≥ 30 |         ≤ 40 |       ≤ 50 | off      | pass    | `<sha7>` | `<yyyy-mm-dd>` | `@handle`             |
| android-low       | _≈ 2019 low-end_                         | …                                           | mobile-low                                                |      3000 |       ≥ 30 |         ≤ 40 |       ≤ 50 | off      | …       | …        | …              | …                     |
| iphone            | _recent iPhone / iOS / Safari_           | Apple GPU                                   | mobile-default                                            |      5000 |       ≥ 30 |         ≤ 40 |       ≤ 50 | off      | …       | …        | …              | …                     |
| laptop-integrated | _Windows / Chrome, Edge, Firefox_        | Intel Iris Xe                               | desktop-default                                           |     15000 |       ≥ 55 |         ≤ 20 |       ≤ 50 | off      | …       | …        | …              | …                     |
| laptop-discrete   | _macOS Apple-silicon or Linux dGPU_      | …                                           | desktop-high (+ desktop-ultra when `capabilities` permit) |     30000 |       ≥ 55 |         ≤ 20 |       ≤ 50 | off      | …       | …        | …              | …                     |

**Behavior.** `pnpm perf:matrix` validates every JSON file, computes `verdict` from `PERF_TARGETS` (a report never carries its own verdict), marks rows `stale` after 90 days, and rewrites the table; `pnpm perf:matrix --release` additionally fails when any `REQUIRED_MATRIX` pair has no non-stale `pass` row dated within 30 days, or when a `fail` row exists without a linked `spec_change` issue in `docs/reference/perf-matrix.md` "Deviations" section. Mobile runs follow `docs/how-to/record-perf-run.md`: device unplugged, ≥ 50 % battery, screen at default brightness, no other tabs, 5-minute cool-down between presets, plus the 5-item touch/thermal checklist (`docs/reference/manual-verification.md`). Threshold tuning: recorded traces (`tests/fixtures/perf/traces/<class>-<preset>.json`) are replayed through `QualityController` with the fake `Clock`; values are adjusted until every degrading trace converges in ≤ 3 s with the ORB-PERF-005 order (postProcessing → pixelRatio → connections → shaderTier → particleCount) and zero oscillations, and every healthy trace produces zero steps. WebGL1: Playwright project `chromium-webgl1` (`--disable-webgl2`) proves `capabilities.webgl2 === false && webgl1 === true`, `profile().shaderTier === 'basic'`, frames advance and the Wave 2 capability notice is visible.

**Edge cases.**

- `WEBGL_debug_renderer_info` unavailable (Firefox, Safari privacy) → `gpu: null`; row is valid.
- Report with `run.reducedMotion: true` or `preset: 'ci'` → `verdict: 'n/a'`, never counts for `REQUIRED_MATRIX`.
- Two reports for the same pair → newest commit wins; older rows stay listed (history).
- Report `commit` not an ancestor of `main` → rejected by `--release` (`unknown_commit`).
- Median ≥ floor but `p95FrameMs` above cap → `fail` (stutter is a failure even at good average FPS).
- A `fail` row for `android-low × mobile-low` → open `spec_change` issue proposing a lower `mobile-low` count or a documented "best effort" note in §10; SPEC text is not edited in the release PR (§28 rule 6).
- Thermal throttling mid-run (`longestGapMs > 250` or `notes` mention) → run repeated after cool-down; both files kept.

**Acceptance criteria.**

- Given the five `REQUIRED_MATRIX` pairs each with a fresh `pass` report, When `pnpm perf:matrix --release` runs, Then exit 0 and the table lists every row with `verdict: pass` — ORB-PERF-002, ORB-PERF-001 (touched) — `tests/unit/scripts/perf-matrix.test.ts` (fixture reports) + `docs/reference/perf-matrix.md` (manual evidence).
- Given a report with `medianFps: 31` and `p95FrameMs: 48` for `mobile-default`, When `buildMatrix` runs, Then `verdict === 'fail'` and `--release` exits 1 with `perf_target_missed_undocumented` unless "Deviations" links an issue — ORB-PERF-002 — `tests/unit/scripts/perf-matrix.test.ts`.
- Given `tests/fixtures/perf/traces/android-low-mobile-low.json` (sustained 45 ms frames), When replayed through `QualityController.observe` with the fake clock, Then the first `degrade` step is `postProcessing`, the ladder reaches a profile whose replayed p75 ≤ 33.3 ms within 3 000 ms, and `oscillations === 0` — ORB-PERF-003, ORB-PERF-005 (touched) — `tests/unit/quality/trace-replay.test.ts`.
- Given `/?preset=desktop-default&seed=1` under `chromium-webgl1`, When the page loads, Then `__orbDebug.capabilities` reports `{ webgl2: false, webgl1: true }`, `shaderTier === 'basic'`, `frames` advances by ≥ 30 within 5 s and no `pageerror` — ORB-RENDER-006 (touched) — `tests/e2e/webgl1.fallback.spec.ts`.
- Given a `PerfProbeReport` JSON with an extra key or `notes` of 300 chars, When validated, Then rejected with the zod path — schema hygiene — `tests/unit/scripts/perf-matrix.test.ts`.

**Observability.** Client (debug builds only): `orb.perfprobe.started { preset, particleCount, adaptive, seed }`, `orb.perfprobe.completed { medianFps, p95FrameMs, dropped }`; existing `orb.quality.degraded` / `orb.quality.upgraded` (Wave 2) gain `{ step, p75Ms, reason }` if absent. No serial numbers, no IPs; `device.model` is the marketing name typed by the tester.

### 4.2 Quality gates — bounded contexts `tests/e2e`, `.github`, `scripts`, `docs/security`

**Objective.** Make cross-browser, accessibility, supply-chain and package-boundary evidence machine-checked at release time, and prove ORB-API-003 with a real package build.

**Contracts.**

```ts
// scripts/package-rehearsal.ts — builds @aisac/orbs in a temp dir; never publishes (ADR-0016)
export const PACKAGE_ROOTS = [
  "core",
  "events",
  "engine",
  "formations",
  "shaders",
  "pointer",
  "audio",
] as const; // ORB-API-003
export const ALLOWED_EXTERNALS = ["three", "zod"] as const; // three → peerDependencies, zod → dependencies (events/schema.ts)
export const PACKAGE_ENTRY = "engine/index.ts"; // the only public entry
export type RehearsalViolation =
  | { rule: "forbidden-import"; file: string; specifier: string } // react, next, app/**, components/**, adapters/**, provider SDKs, node builtins
  | { rule: "outside-roots"; file: string; importedBy: string } // bundle input not under PACKAGE_ROOTS
  | { rule: "deep-entry"; file: string } // package consumer path other than PACKAGE_ENTRY
  | { rule: "types-failed"; diagnostics: string[] }
  | { rule: "publint" | "attw"; message: string }
  | { rule: "smoke-failed"; message: string };
export interface RehearsalResult {
  ok: boolean;
  outDir: string;
  bundleBytes: number;
  externals: string[];
  violations: RehearsalViolation[];
  smoke: { headless: boolean; stateAfterSetState: OrbState } | null;
  durationMs: number;
}
export async function rehearse(opts: {
  repoRoot: string;
  outDir: string;
  keep?: boolean;
  version: string;
}): Promise<RehearsalResult>;

// playwright.config.ts additions
// projects: 'chromium-webgl1' (--disable-webgl2), 'webkit' and 'firefox' (grep @cross-browser), 'public-demo' (baseURL from PLAYWRIGHT_BASE_URL, grep @public-demo)
```

**Package-extraction rehearsal steps** (`pnpm package:rehearse`, CI stage 14 `package-rehearsal`, blocking after `build`):

1. Create `<outDir>/src`; copy `PACKAGE_ROOTS` verbatim; rewrite the `@/` alias to relative paths; copy `assets/formations/*.formation.json` prebakes referenced by `formations/` (SVG sources are not copied — the trusted loader must resolve prebakes without `fetch`).
2. Write `package.json` `{ name: '@aisac/orbs', version, type: 'module', license: 'Apache-2.0', sideEffects: false, files: ['dist'], exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } }, peerDependencies: { three }, dependencies: { zod } }` with versions copied from the root manifest, and `tsconfig.json` `{ strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, lib: ['ES2022', 'DOM'], types: [], paths: {} }` (no `react`/`next` types reachable).
3. `tsc --emitDeclarationOnly` → any diagnostic becomes `types-failed`.
4. esbuild `src/engine/index.ts` → `dist/index.js` (ESM, `external: ALLOWED_EXTERNALS`, `loader: { '.glsl': 'text' }`, `metafile: true`); every `metafile.inputs` path must be under `src/` (`outside-roots`), every external import must be in `ALLOWED_EXTERNALS` (`forbidden-import`).
5. `pnpm pack` → run `publint` and `@arethetypeswrong/cli` on the tarball; findings are violations.
6. Smoke in Node + jsdom: `import('@aisac/orbs')` from the tarball, `new OrbEngine({ container, clock, scheduler, logger })` (no WebGL → `capabilities.webgl2 === false`, headless), `setState('thinking')` → `subscribe` snapshot `state === 'thinking'` and `provenance === 'manual'`, `emit({ type: 'USER_SPEAKING', … })` accepted, `dispose()`; any throw is `smoke-failed`.
7. Delete `outDir` unless `--keep`; print `RehearsalResult` as JSON. `npm publish`/`pnpm publish` are never invoked; `NPM_TOKEN` is not present in the job env.

**Behavior.** Cross-browser: `tests/e2e/cross-browser.smoke.spec.ts` (`@cross-browser`) runs weekly (Wave 0) and, from this wave, on `workflow_dispatch`, on `release/*` branches and in `release.yml` where it blocks; it accepts "renders" (`__orbDebug.frames` advances) or "graceful fallback" (fallback region visible) but always requires: no `pageerror`, status region updates through `idle → listening → thinking`, `Run AI Sequence` reaches `success`, Approve reachable by `Tab` + `Enter`. Accessibility: `tests/e2e/a11y.all-pages.spec.ts` runs axe (`wcag2a`, `wcag2aa`, `wcag21aa`) on `/`, `/playground`, `/text-orb` in each of the 9 states (driven by `?sequencer=manual` + `__orbDebug.sequencer.step()`), under `prefers-reduced-motion: reduce`, and on the no-WebGL fallback; violations must be 0 (an allow-list requires a comment with rule id, reason and issue). Supply chain at release: `pnpm audit --audit-level=high` (exceptions only in `.pnpm-audit-exceptions.json` with expiry ≤ 30 days), `scripts/license-check.ts`, `scripts/bundle-secret-scan.ts` on the release build, `cdxgen -t js -o sbom.cdx.json` (CycloneDX 1.5), `actions/attest-build-provenance` (pinned SHA) over `sbom.cdx.json` and `aisac-orbs-<version>-build.tar.gz` (`.next/` standalone output). Security review: `docs/security/release-review-1.0.0.md` maps each item of the house checklist to evidence.

| House checklist item (`~/.claude/rules/security.md`) | Evidence at V1.0                                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| No secrets in diff / history                         | gitleaks PR + weekly history job green; `.env.example` names only                                                       |
| auth → authz → validation ordering                   | `tests/integration/gateway/auth.test.ts` (Wave 7)                                                                       |
| Input validated with typed schemas                   | `orbEventSchema`, gateway zod bodies, `perfProbeReportSchema`, SVG limits (Waves 1/6/7/8)                               |
| No SQL concatenation                                 | n/a — no database in V1 (recorded)                                                                                      |
| No `dangerouslySetInnerHTML` / `innerHTML`           | ESLint `react/no-danger` + Semgrep rule; `tests/unit/components/**` text-node assertions                                |
| Security headers on every response                   | `tests/e2e/security-headers.spec.ts` against the public URL (`@public-demo`)                                            |
| Rate limit on public endpoints                       | `tests/integration/gateway/rateLimit.route.test.ts`; public demo has gateway disabled (503 `gateway_disabled`)          |
| Logs without PII                                     | `tests/unit/core/logger.test.ts` (Wave 0) + grep review of `orb.*` event fields in this document                        |
| Threat model updated                                 | `docs/security/threats/README.md` index lists every threat file with row status; this wave adds `release-and-deploy.md` |
| Dependencies audited                                 | `pnpm audit` + license-check + SBOM attached to the release                                                             |

**Edge cases.**

- WebKit on Linux CI has no usable WebGL → the fallback branch is taken; the spec still asserts the a11y flow. A real-Safari row lives in `manual-verification.md`.
- `cdxgen` cannot resolve a workspace-less optional dependency → SBOM generated with `--fail-on-error` off but the release check verifies the component count ≥ the lockfile's direct dependency count.
- A planted `import 'react'` in `engine/` → dependency-cruiser fails first (stage 3); the rehearsal test proves the second barrier independently (fixture tree).
- `shaders/*.glsl` imported through the typed loader → rehearsal passes only with the text loader; a `.glsl` import from outside `shaders/` or `engine/render` is `forbidden-import`.
- `audio/infrastructure/MicrophoneSource.ts` references `navigator.mediaDevices` → allowed (`lib: DOM`), but any `window.__orbDebug` write inside package roots is `forbidden-import` (debug bridge belongs to `app/`).

**Acceptance criteria.**

- Given the repository at the release commit, When `pnpm package:rehearse` runs, Then `ok === true`, `externals` equals `['three', 'zod']`, `violations` is empty, `smoke.stateAfterSetState === 'thinking'` and `bundleBytes` is recorded in the PR — ORB-API-003, ORB-ARCH-001 (touched) — CI stage 14 + `tests/unit/scripts/package-rehearsal.test.ts`.
- Given `tests/fixtures/rehearsal/violations/react-import/` (copy of `engine/` with `import { useState } from 'react'`), When `rehearse` runs against it, Then `violations` contains `{ rule: 'forbidden-import', specifier: 'react' }` and `ok === false` — ORB-API-003 — `tests/unit/scripts/package-rehearsal.test.ts`.
- Given `components/orb/OrbCanvas.tsx` importing `engine/state/transitions.ts` directly, When `pnpm arch` runs, Then rule `no-deep-package-imports` fires — ORB-API-003 — `tests/unit/arch/boundaries.test.ts` (fixture added this wave).
- Given projects `webkit` and `firefox`, When `cross-browser.smoke.spec.ts` runs, Then both pass with the status sequence recorded in the report — ORB-RENDER-006 (touched), ORB-A11Y-001 (touched) — `tests/e2e/cross-browser.smoke.spec.ts`.
- Given every page × state × motion combination, When axe runs, Then 0 violations — ORB-A11Y-001, ORB-A11Y-002, ORB-A11Y-005 (touched) — `tests/e2e/a11y.all-pages.spec.ts`.
- Given the release workflow, When it completes, Then the release has `sbom.cdx.json`, a provenance attestation verifiable with `gh attestation verify`, and `pnpm audit` / license-check / bundle-secret-scan jobs are green — ORB-FORM-007, ORB-SEC-001 (touched) — `.github/workflows/release.yml` run link in the release PR.

**Observability.** CI job summaries (`$GITHUB_STEP_SUMMARY`): rehearsal JSON, axe violation table, SBOM component count, attestation URL. No runtime events.

### 4.3 Docs and playground completeness — bounded contexts `docs`, `components/playground`, `app/playground`

**Objective.** Every §21 control exists, is discoverable from one manifest, documented from that same manifest and exercised by one E2E test; the Diátaxis tree is complete and link-checked; README and CONTRIBUTING reflect SPEC 0.2.0.

**Contracts.**

```ts
// components/playground/controlManifest.ts — single source for the panels, the E2E test and docs/reference/playground-controls.md
export type ControlKind = "range" | "number" | "select" | "toggle" | "button" | "text" | "file";
export interface PlaygroundControl {
  id: string; // kebab-case, stable; used as data-testid
  section:
    | "state"
    | "formation"
    | "quality"
    | "motion"
    | "pointer"
    | "audio"
    | "events"
    | "registry"
    | "custom-svg"
    | "inspector";
  label: string; // visible <label> text (a11y)
  kind: ControlKind;
  spec: "SPEC §21" | "ORB-PLAY-001"; // §21 sentence item vs amendment extra
  introducedIn: "W2" | "W3" | "W4" | "W5" | "W6" | "W8";
  reads: (dbg: OrbDebug) => unknown; // value observed after `act`
  act: "increase" | "decrease" | "toggle" | "select-next" | "click" | "type" | "upload";
}
export const CONTROL_MANIFEST: ReadonlyArray<PlaygroundControl>; // exhaustive over the table below; a control not in the manifest fails the doc test

// app/playground/page.tsx debug bridge additions (read-only, ?debug=1 only)
// window.__orbDebug.controls: string[] (manifest ids rendered) · __orbDebug.reset(): void (dispose + recreate with the same seed) · __orbDebug.snapshotJson(): string
```

**ORB-PLAY-001 control list checked against SPEC §21** (12 sentence items + amendment extras; all rendered in `/playground`):

| #   | SPEC §21 item / amendment extra              | Control(s) (`id`)                                                                                                                                                                                                                              | Panel                 | Wave    | Observed via `__orbDebug`                                          |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------- | ------------------------------------------------------------------ |
| 1   | state                                        | `state-set-<OrbState>` buttons (9), labelled "… (manual)" per A-11                                                                                                                                                                             | `StatePanel`          | W4      | `snapshot.state`, `snapshot.provenance === 'manual'`               |
| 2   | formation                                    | `formation-select` (built-ins + custom ids)                                                                                                                                                                                                    | `FormationPanel`      | W3      | `snapshot.visual.formation`, `morph.toId`                          |
| 3   | particle count                               | `particle-count` number, clamped `[MIN_PARTICLES, hardMax]`, reallocates with instant placement (A-16)                                                                                                                                         | `QualityPanel`        | W2      | `profile().particleCount`                                          |
| 4   | quality                                      | `quality-preset` select · `quality-adaptive` toggle (amendment "+ adaptive on/off")                                                                                                                                                            | `QualityPanel`        | W2      | `profile().preset`, `adaptive`                                     |
| 5   | turbulence                                   | `motion-turbulence` range 0–1                                                                                                                                                                                                                  | `MotionPanel`         | W2      | `uniforms.uTurbulence`                                             |
| 6   | rotation                                     | `motion-rotation` range 0–2 rad/s                                                                                                                                                                                                              | `MotionPanel`         | W2      | `uniforms.uRotationSpeed`                                          |
| 7   | pulse                                        | `motion-pulse` range 0–1                                                                                                                                                                                                                       | `MotionPanel`         | W2      | `uniforms.uPulseStrength`                                          |
| 8   | connection density                           | `formation-connection-density` range 0–1                                                                                                                                                                                                       | `FormationPanel`      | W3      | `formation.connectionDensity.effective`                            |
| 9   | morph duration                               | `formation-morph-duration` range 0–5000 ms · `formation-easing` · `formation-interrupt`                                                                                                                                                        | `FormationPanel`      | W3      | `morph.lastBake`, `morph.interrupts`                               |
| 10  | pointer forces                               | `pointer-radius`, `pointer-strength`, `pointer-mode` (repel/attract/wave), `pointer-enabled`                                                                                                                                                   | `PointerPanel`        | W5      | `uniforms.uPointerRadius/uPointerStrength/uPointerMode`            |
| 11  | audio reactivity                             | `audio-mic` toggle (permission status text), `audio-synthetic` toggle, `audio-gain` range                                                                                                                                                      | `AudioPanel`          | W5      | `uniforms.uAudioUser`, `uAudioAssistant`                           |
| 12  | mock lifecycle events                        | `events-raw-type` select (14 types) + `events-raw-tool` text + `events-raw-correlation` text + `events-raw-emit` button (always `source: 'mock'`) · `events-sequence-<approve\|deny\|fail\|speech>` buttons (governed sequences, **added W8**) | `MockEventsPanel`     | W4 + W8 | `snapshot.activeOperation`, `snapshot.lastOutcome`, `bus.rejected` |
| +   | reduced-motion override                      | `motion-reduced` select `auto \| on \| off` (A-15)                                                                                                                                                                                             | `MotionPanel`         | W2      | `uniforms.uMotionScale`                                            |
| +   | seed                                         | `seed-value` number + `seed-apply` (navigates `?seed=`) (A-17)                                                                                                                                                                                 | `FormationPanel`      | W3      | `seed`                                                             |
| +   | tool visual registry                         | `registry-tool` text + `registry-formation` select + `registry-add` (visual-only; unknown → `generic-tool`, A-13)                                                                                                                              | `RegistryPanel`       | W4      | `toolVisuals`                                                      |
| +   | custom SVG upload                            | `custom-svg-text`, `custom-svg-file`, `custom-svg-url`, `custom-svg-trust`, `custom-svg-submit`                                                                                                                                                | `CustomFormationForm` | W6      | `formations.custom`                                                |
| +   | read-only snapshot / FPS / profile           | `inspector-snapshot` (live JSON), `inspector-fps`, `inspector-profile`, `inspector-copy` (**added W8**), `engine-reset` (**added W8**)                                                                                                         | `InspectorPanel`      | W2 + W8 | `snapshot`, `frames`, `profile()`                                  |
| –   | gateway status (Wave 7, not required by §21) | read-only                                                                                                                                                                                                                                      | `GatewayPanel`        | W7      | —                                                                  |

**Behavior.** `tests/e2e/playground.controls.spec.ts` loads `/playground?preset=ci&seed=1&adaptive=0&debug=1`, reads `CONTROL_MANIFEST` (imported in the spec), and for every entry asserts: `getByLabel(label)` resolves to `[data-testid=id]`; the control is reachable by keyboard and operable with `Space`/`Enter`/arrows; after `act`, `reads(dbg)` differs from the value before (buttons: differs or emits the expected `orb.*` debug log); `__orbDebug.controls` equals the manifest ids. After the loop it asserts ORB-PLAY-002 (touched): `snapshot.provenance === 'manual'` following a state button, every accepted raw event has `source === 'mock'`, `lastOutcome` is `null` or `source !== 'adapter'`, and `page.on('request')` recorded no call to `/api/agent/*`. Governed-sequence buttons reuse the Wave 1 mock scripts through `MockAdapter` (`requireApproval: true`), so the Approve/Deny controls of the a11y panel are the only path to `APPROVAL_*` (A-12). `docs/reference/playground-controls.md` is generated (`pnpm docs:playground`) from the manifest between markers; `tests/unit/docs/playground-controls-doc.test.ts` fails when the file and the manifest diverge.

**Docs deliverable list per Diátaxis folder** (every file linked from its folder `README.md`; `tests/unit/docs/links.test.ts` checks relative links and the index):

| Folder              | File                                                                                                                               | Content (one line)                                                                                                                                                               | New / final |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `docs/tutorials/`   | `first-orb.md`                                                                                                                     | fresh clone → `pnpm dev` → Run AI Sequence → approve via keyboard → `?perfprobe=1` → embed a second orb in a page (≤ 20 min, every command cross-checked against `package.json`) | new         |
| `docs/how-to/`      | `custom-formation.md`                                                                                                              | procedural formation via `registerFormation(name, Float32Array \| generator)` + `registerToolVisual`                                                                             | new         |
| `docs/how-to/`      | `custom-svg-formation.md`                                                                                                          | Wave 6, reviewed                                                                                                                                                                 | final       |
| `docs/how-to/`      | `connect-openai.md`                                                                                                                | Wave 7, reviewed                                                                                                                                                                 | final       |
| `docs/how-to/`      | `connect-your-agent.md`                                                                                                            | implement `AgentAdapter` for any provider: normalize, `source: 'adapter'`, correlation ids, `disconnect`, `respondToApproval`                                                    | new         |
| `docs/how-to/`      | `embed-in-your-app.md`                                                                                                             | vanilla + React host (`OrbCanvas` / `useOrbEngine`), SSR (`ssr:false`), CSP notes, resize/dispose                                                                                | new         |
| `docs/how-to/`      | `reduced-motion.md`                                                                                                                | A-15 behaviour, `reducedMotion` option, what text remains visible                                                                                                                | new         |
| `docs/how-to/`      | `record-perf-run.md`                                                                                                               | probe URL, device checklist, where to commit the JSON, `pnpm perf:matrix`                                                                                                        | new         |
| `docs/how-to/`      | `release.md`                                                                                                                       | the release checklist of 4.4 (maintainers)                                                                                                                                       | new         |
| `docs/reference/`   | `engine-api.md`                                                                                                                    | every `OrbEngine` member + `OrbEngineOptions` + `OrbSnapshot`; generated section from the api snapshot                                                                           | new         |
| `docs/reference/`   | `events.md`                                                                                                                        | `OrbEvent`, 14 types, `source`, metadata limits, `EmitResult` reasons, pointer to SPEC Appendix A                                                                                | new         |
| `docs/reference/`   | `formations.md`, `formation-sources.md`                                                                                            | Waves 3 / 6                                                                                                                                                                      | final       |
| `docs/reference/`   | `presets.md`                                                                                                                       | `QUALITY_PRESETS`, `PERF_TARGETS`, adaptive thresholds and degrade order                                                                                                         | new         |
| `docs/reference/`   | `env-vars.md`                                                                                                                      | every key of the server and client env schemas (Waves 0/7) with default and scope                                                                                                | new         |
| `docs/reference/`   | `openapi/agent-gateway.yaml`                                                                                                       | Wave 7                                                                                                                                                                           | final       |
| `docs/reference/`   | `playground-controls.md`, `perf-matrix.md`, `device-list.md`, `manual-verification.md`, `ci-budget.md`, `branch-protection.md`     | generated / signed / Wave 0                                                                                                                                                      | final       |
| `docs/explanation/` | `governance-states.md`                                                                                                             | why proposal, approval, execution and result are distinct states; denial ≠ failure                                                                                               | new         |
| `docs/explanation/` | `visual-is-not-truth.md`                                                                                                           | ORB-ARCH-004, ORB-MORPH-004, ORB-SEC-003, provenance badges, why `setState` is manual                                                                                            | new         |
| `docs/explanation/` | `provider-independence.md`                                                                                                         | ORB-ARCH-001/002, adapter boundary, what a provider may not redefine (§28 rule 8)                                                                                                | new         |
| `docs/explanation/` | `spec-driven-development.md`                                                                                                       | §28 workflow, requirement IDs, `req()`, req-coverage, `spec_change` issues                                                                                                       | new         |
| `docs/explanation/` | `morphing.md`, `svg-import.md`, `security-headers.md`                                                                              | Waves 3 / 6 / 0                                                                                                                                                                  | final       |
| `docs/adr/`         | `0015`–`0018`                                                                                                                      | §8                                                                                                                                                                               | new         |
| `docs/security/`    | `release-review-1.0.0.md`, `threats/release-and-deploy.md`, `threats/README.md` (index)                                            | 4.2 / §6                                                                                                                                                                         | new         |
| root                | `README.md` (13 migration edits from amendments §9), `CONTRIBUTING.md` (release process, `perf-impact` label, DCO), `CHANGELOG.md` | 4.4                                                                                                                                                                              | final       |

**Edge cases.**

- A panel renders a control absent from the manifest → `__orbDebug.controls` ≠ manifest → E2E fails (prevents undocumented knobs).
- `audio-mic` in CI has no permission → control still exists and is operable; `reads` observes the permission status text, not `uAudioUser`.
- `custom-svg-file` upload in E2E uses `tests/fixtures/svg/logos/aisac-logo.svg` (CC0); malicious fixtures stay in Wave 6's `svg-limits.spec.ts`.
- README command drift → `tests/unit/repo/hygiene.test.ts` (Wave 0) already cross-checks commands; this wave extends it to `docs/tutorials/first-orb.md`.
- `engine-reset` mid-morph → `dispose()` then recreate; `__orbDebug.frames` restarts from 0; snapshot returns to `idle` with `provenance: null`.

**Acceptance criteria.**

- Given `/playground?preset=ci&seed=1&adaptive=0&debug=1`, When the manifest loop runs, Then every control is labelled, keyboard-operable, changes its observed value, and `__orbDebug.controls` deep-equals the manifest ids — ORB-PLAY-001 — `tests/e2e/playground.controls.spec.ts`.
- Given the loop has driven every control, When the assertions run, Then no request to `/api/agent/*` occurred, every accepted raw event has `source: 'mock'`, and the state announced after `state-set-success` ends with "(manual)" — ORB-PLAY-002, ORB-API-004 (touched) — `tests/e2e/playground.controls.spec.ts`.
- Given `CONTROL_MANIFEST`, When `docs/reference/playground-controls.md` is compared, Then every `id`, `label` and `section` appears and no extra rows exist — ORB-PLAY-001 — `tests/unit/docs/playground-controls-doc.test.ts`.
- Given the api snapshot (`tests/unit/engine/api-surface.snapshot`, Wave 4), When `docs/reference/engine-api.md` is scanned, Then every exported member name appears in a heading — ORB-API-001 (touched) — `tests/unit/docs/engine-api-doc.test.ts`.
- Given the env schemas, When `docs/reference/env-vars.md` is scanned, Then every key appears with a scope (`server` / `client` / `ci`) — ORB-SEC-001 (touched) — `tests/unit/docs/env-vars-doc.test.ts`.
- Given `docs/**/*.md`, When links are resolved, Then every relative link exists and every file is reachable from its folder `README.md`; README contains "SPEC.md 0.2.0" and `OrbEngine.SPEC_VERSION` — docs hygiene — `tests/unit/docs/links.test.ts`, `tests/unit/docs/readme-migration.test.ts`.
- Given a second contributor on a fresh clone, When they follow `first-orb.md`, Then they reach the embedded second orb without consulting anything else — manual sign-off in the release PR.

**Observability.** None at runtime; `pnpm docs:playground` and doc tests print diffs.

### 4.4 Release — bounded contexts `repo`, `.github`, `scripts`

**Objective.** One pure function decides whether V1.0 may ship; one workflow ships it; the public demo is mock-only.

**Contracts.**

```ts
// scripts/release-check.ts — pure core, CLI wrapper reads files/reports (pnpm release:check)
export type AcceptanceEvidence =
  | {
      kind: "unit" | "integration" | "e2e" | "arch" | "ci-stage";
      path: string;
      minPassing?: number;
    }
  | { kind: "manual"; path: string; signedFor: "sha" | "date"; maxAgeDays: number };
export interface AcceptanceBullet {
  bullet: number /* 1–16, SPEC §26 order */;
  text: string;
  traces: ReqId[];
  owner: "W0" | "W1" | "W2" | "W3" | "W4" | "W5" | "W6" | "W7" | "W8";
  evidence: AcceptanceEvidence[];
}
export const acceptanceChecklistSchema: ZodType<{
  specVersion: string;
  bullets: AcceptanceBullet[];
}>; // specs/acceptance-checklist.yaml
export type ReleaseCheckCode =
  | "version_mismatch"
  | "spec_version_mismatch"
  | "changelog_missing_entry"
  | "changelog_missing_spec_line"
  | "must_uncovered"
  | "should_below_threshold"
  | "acceptance_bullet_unproven"
  | "evidence_path_missing"
  | "perf_matrix_stale"
  | "perf_matrix_incomplete"
  | "perf_target_missed_undocumented"
  | "manual_verification_unsigned"
  | "api_snapshot_dirty"
  | "audit_high"
  | "license_violation"
  | "tag_exists"
  | "dirty_worktree";
export interface ReleaseCheckInput {
  version: string;
  specVersion: string;
  sha: string;
  now: Date;
  files: {
    packageJson: { version: string; specVersion: string };
    specHeaderVersion: string;
    lockSpecVersion: string;
    engineSpecVersion: string /* OrbEngine.SPEC_VERSION */;
    changelog: string;
    manualVerification: string;
    apiSnapshotDirty: boolean;
    worktreeDirty: boolean;
    tagExists: boolean;
    tagTargetSha?: string;
  };
  reports: {
    reqCoverage: {
      must: { covered: number; total: number };
      should: { covered: number; total: number };
    };
    vitest: { passedFiles: Record<string, number> };
    playwright: { passedFiles: Record<string, number> };
    perfMatrix: PerfMatrixSummary;
    audit: { high: number; critical: number };
    licenses: { violations: string[] };
  };
  checklist: { specVersion: string; bullets: AcceptanceBullet[] };
}
export interface ReleaseCheckResult {
  ok: boolean;
  findings: Array<{ code: ReleaseCheckCode; detail: string }>;
  summary: {
    mustCoverage: number;
    shouldCoverage: number;
    bullets: Array<{ bullet: number; status: "proven" | "manual" | "unproven" }>;
  };
}
export function checkRelease(input: ReleaseCheckInput): ReleaseCheckResult;
```

```yaml
# .github/workflows/release.yml (shape; every action pinned to a commit SHA)
on: { push: { tags: ["v*.*.*"] } }
permissions: { contents: read }
jobs:
  verify:
    {
      needs: [],
      permissions: { contents: read },
      steps: [ci stages 0–11, package-rehearsal, cross-browser, release-check],
    }
  sbom: { needs: [verify], steps: [cdxgen → sbom.cdx.json, build tarball] }
  attest:
    {
      needs: [sbom],
      permissions: { id-token: write, attestations: write, contents: read },
      steps: [attest-build-provenance],
    }
  release:
    {
      needs: [attest],
      permissions: { contents: write },
      steps: [gh release create --verify-tag --notes-file .release-notes.md + assets],
    }
  deploy:
    {
      needs: [release],
      environment: public-demo,
      env: { ORB_ADAPTER: mock, ORB_PLAYGROUND: off, ORB_SMOKE_ROUTES: "0" },
      steps: [deploy, playwright --project=public-demo],
    }
```

**SPEC §26 acceptance checklist** (`specs/acceptance-checklist.yaml`; paths for waves whose files are not yet written follow WAVE_ASSIGNMENT exit criteria and the analysis conventions — the owning wave's §7 is authoritative and `release-check` fails on any missing path):

| § 26 bullet                                                          | Evidence type       | Test / artifact path                                                                                                      | Owning wave             |
| -------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1 GPU particle orb renders smoothly                                  | e2e + manual        | `tests/e2e/renderer.smoke.spec.ts`; `docs/reference/perf-matrix.md` rows `laptop-*` pass                                  | W2 (+ W8 matrix)        |
| 2 at least six required formations work                              | unit + e2e          | `tests/unit/formations/required-set.test.ts`; `tests/e2e/formations.cycle.spec.ts`                                        | W3                      |
| 3 morphing is interruption-safe                                      | property + e2e      | `tests/unit/engine/morph/interrupt.property.test.ts`; `tests/e2e/morph.interrupt.spec.ts`                                 | W3                      |
| 4 face formation works                                               | unit + manual       | `tests/unit/formations-svg/face-fixture.test.ts`; reviewer sign-off in `docs/reference/formations.md`                     | W3                      |
| 5 pointer interaction works                                          | e2e                 | `tests/e2e/pointer.spec.ts`; `tests/e2e/pointer.touch.spec.ts`                                                            | W5                      |
| 6 canonical state machine is implemented                             | unit + property     | `tests/unit/engine/state/transitions.matrix.test.ts` (126 cells); `tests/unit/engine/state/transitions.property.test.ts`  | W1                      |
| 7 normalized event bus drives state                                  | unit + integration  | `tests/unit/events/event-bus.test.ts`; `tests/integration/engine/emit.test.ts`                                            | W1 (+ W4)               |
| 8 governed tool demo distinguishes request/approval/execution/result | e2e + integration   | `tests/e2e/demo-governance.spec.ts`; `tests/integration/gateway/approvals.route.test.ts`                                  | W4 (+ W7)               |
| 9 audio affects particles                                            | unit + e2e          | `tests/unit/audio/extractFeatures.test.ts`; `tests/e2e/audio.fake-device.spec.ts`; `tests/e2e/audio.denied.spec.ts`       | W5                      |
| 10 playground works                                                  | e2e                 | `tests/e2e/playground.controls.spec.ts` (+ per-wave `playground.*.spec.ts`)                                               | W8 (ORB-PLAY-001)       |
| 11 demo mode works without credentials                               | e2e                 | `tests/e2e/demo-default-mock.spec.ts`; `tests/e2e/public-demo.smoke.spec.ts` (deployed URL)                               | W4 / W7 (+ W8 deploy)   |
| 12 mobile quality preset works                                       | unit + e2e + manual | `tests/unit/quality/presets.test.ts`; `tests/e2e/mobile-preset.spec.ts`; `perf-matrix.md` rows `android-*`, `iphone` pass | W2 / W4 (+ W8 matrix)   |
| 13 reduced-motion behavior exists                                    | e2e                 | `tests/e2e/reduced-motion.spec.ts`; `tests/e2e/a11y.all-pages.spec.ts` (reduced branch)                                   | W4 (+ W8)               |
| 14 provider secrets remain server-side                               | ci-stage + arch     | `scripts/bundle-secret-scan.ts` (stage 6 on the release build); `tests/architecture/gateway-boundaries.test.ts`           | W7                      |
| 15 unit/E2E tests cover critical state and governance behavior       | meta                | `reports/req-coverage.json`: 100 % of `ORB-STATE-*` / `ORB-GOV-*` MUST, each of ORB-GOV-001..004 by ≥ 1 unit and ≥ 1 e2e  | W1 / W4 (checked by W8) |
| 16 README, CONTRIBUTING, LICENSE, SPEC present                       | unit                | `tests/unit/repo/hygiene.test.ts`; `tests/unit/repo/release.test.ts`                                                      | W0 (+ W8)               |

**Release checklist** (`docs/how-to/release.md`, executed in order; each step names its proof):

1. Gates G0–G7 closed; `main` green on every blocking stage (CI link).
2. Perf matrix refreshed within 30 days: `pnpm perf:matrix --release` exit 0; deviations linked.
3. `docs/reference/manual-verification.md` signed for the release-candidate SHA (AT rows, real-Safari row, microphone rows, WebGL-disabled row).
4. `docs/security/release-review-1.0.0.md` completed; `docs/security/threats/README.md` index has no `open` row.
5. Docs review: `tests/unit/docs/*.test.ts` green; tutorial walk-through sign-off.
6. Release PR `chore(release): 1.0.0`: `package.json.version = "1.0.0"`, `specVersion = "0.2.0"`; `CHANGELOG.md` `## [1.0.0] - <date>` with sections `### Added / Changed / Security / Spec` and the line `Implements SPEC.md 0.2.0` under `### Spec`; a fresh `## [Unreleased]` above it; `OrbEngine.SPEC_VERSION === '0.2.0'` (unchanged since Wave 4).
7. `pnpm release:check` exit 0 with the summary posted in the PR (`mustCoverage: 1.0`, `shouldCoverage ≥ 0.7`, 16 bullets `proven`/`manual`).
8. Merge (squash); on `main`: `git tag -s -a v1.0.0 -m "AISAC Orbs 1.0.0 — implements SPEC.md 0.2.0"` (fall back to `-a` without `-s` only if no signing key; recorded); `git push origin v1.0.0` (tag protection: maintainers only, `docs/reference/branch-protection.md`).
9. `release.yml` green: GitHub release `v1.0.0` with notes (generated from Conventional Commits + the CHANGELOG section, first line "Implements SPEC.md 0.2.0") and assets `sbom.cdx.json`, `aisac-orbs-1.0.0-build.tar.gz`, `api-surface.snapshot`, `perf-matrix.md`, `req-coverage.md`; attestation verifiable via `gh attestation verify --repo <owner>/aisac-orbs`.
10. Public demo deployed from the tag with `ORB_ADAPTER=mock`, `ORB_PLAYGROUND=off`, no `OPENAI_*` / `ORB_GATEWAY_*` variables (ADR-0018); `playwright --project=public-demo` green against the URL; README "Live demo" link updated.
11. Announce; reopen `[Unreleased]`; close the V1 milestone.

**Release tag invariant.** Before tag creation, reject an existing version tag. In the tag-triggered verification job, require the triggering tag to resolve to the same candidate SHA; its existence alone is not a failure. Add both cases and a mismatched-SHA rejection to `release-check.test.ts`.

**Behavior.** `checkRelease` is pure and evaluated in this order: versions → changelog → coverage thresholds (MUST 100 %, SHOULD ≥ 70 %) → checklist (every bullet: all evidence paths exist; test evidence has ≥ `minPassing` (default 1) passing tests in the JSON reports; manual evidence carries `reviewedAt` ≤ `maxAgeDays` and, for `signedFor: 'sha'`, the current SHA) → perf matrix (`--release` semantics) → manual verification → api snapshot → audit/licenses → tag/worktree. All findings are collected (no early exit) and printed as a table. The public demo footer renders `Simulated · v1.0.0 · SPEC 0.2.0` from `package.json` and `OrbEngine.SPEC_VERSION` (text, no link injection). Issue templates (final): `bug_report.yml` requires app version, `OrbEngine.SPEC_VERSION`, browser/OS/GPU and an `__orbDebug` snapshot JSON; `spec_change.yml` requires affected IDs, current and proposed level, rationale and migration (§28 rules 3/4/6); `performance_report.yml` accepts a `PerfProbeReport` JSON for community device rows; `config.yml` sets `blank_issues_enabled: false` and links `SECURITY.md`.

**Edge cases.**

- `CHANGELOG.md` has `Implements SPEC.md 0.2.0` but `package.json.specVersion` is `0.1.0` → `spec_version_mismatch`.
- Before tag creation, an existing `v1.0.0` → `tag_exists`; in tag-triggered verification, the matching tag on the candidate SHA is required and allowed. A tag targeting another SHA fails; releases are never re-tagged.
- `release.yml` triggered by a tag not on `main` → `verify` job fails (`git merge-base --is-ancestor`).
- Manual evidence signed for a SHA that is not the release commit → `manual_verification_unsigned` (re-sign after the release PR's last content commit; the version-bump commit itself is exempt via `signedFor: 'sha'` matching `HEAD~1` or `HEAD`).
- Deploy job fails after the GitHub release exists → release stays, README link unchanged, follow-up `fix` deploy; the demo host never receives provider variables even in a hotfix.
- Playwright JSON report missing a file listed as evidence (test skipped) → `evidence_path_missing`, not `proven`.

**Acceptance criteria.**

- Given a consistent fixture set (versions, changelog with the spec line, coverage 100 %/72 %, all 16 bullets with passing evidence, fresh perf matrix, signed manual doc), When `checkRelease` runs, Then `ok === true` and all bullets are `proven` or `manual` — §26 gate, §28 rule 10 — `tests/unit/scripts/release-check.test.ts`.
- Given the same fixture with the `### Spec` line removed, When it runs, Then `findings` contains `changelog_missing_spec_line` and `ok === false` — §28 rule 10 — `tests/unit/scripts/release-check.test.ts`.
- Given `should.covered / should.total = 0.69`, When it runs, Then `should_below_threshold` — gate G8 — `tests/unit/scripts/release-check.test.ts`.
- Given the repository, When `tests/unit/repo/release.test.ts` runs, Then `OrbEngine.SPEC_VERSION === package.json.specVersion === SPEC.md header === specs/requirement-ids.lock spec-version`, `CHANGELOG.md` top released entry matches `package.json.version`, and `specs/acceptance-checklist.yaml` validates with 16 bullets whose `traces` are all in `specs/requirement-ids.lock` — ORB-API-001 (touched), §28 rule 10 — `tests/unit/repo/release.test.ts`.
- Given the deployed public URL, When `public-demo.smoke.spec.ts` runs, Then the Simulated badge is visible, `Run AI Sequence` reaches `success`, no request leaves the origin, `/api/agent/stream` answers 503 `gateway_disabled`, `/playground` answers 404, and every security header of Wave 0 is present — ORB-SEC-006, ORB-DEMO-001, ORB-DEMO-002 (touched) — `tests/e2e/public-demo.smoke.spec.ts`.
- Given the release workflow definition, When `tests/unit/repo/workflows.test.ts` parses it, Then every `uses:` is pinned to a 40-char SHA, top-level `permissions` is `contents: read`, only `attest` has `id-token: write`, only `release` has `contents: write`, and no job references `NPM_TOKEN` — supply chain — `tests/unit/repo/workflows.test.ts`.

**Observability.** `release-check` prints a findings table and writes `reports/release-check.json`; workflow step summaries link the attestation; the deploy job records the deployed commit and URL in the release notes body.

## 5. Parallel tracks

- Track A (hardware, 4.1): device sessions and trace recording need the release-candidate build only; run by the maintainer plus one contributor with an Android device; results are JSON files, mergeable independently.
- Track B (CI, 4.2): cross-browser promotion, axe-everywhere, rehearsal script, SBOM/attestation workflow — pure CI/scripts work, no device.
- Track C (docs + playground, 4.3): manifest, missing controls, doc tests and Diátaxis files; can start on day 1 from Wave 7's `main`.
- Track D (release, 4.4): `release-check` and `release.yml` are written early against fixtures; the release PR itself is last and serial.
- Integration point: `pnpm release:check` on the release-candidate branch — it consumes A's matrix, B's reports, C's doc tests; G8 closes when it exits 0 and the tag workflow is green.

## 6. Threat model delta (STRIDE)

Only surfaces introduced or changed by this wave. Mitigations land in this wave; written to `docs/security/threats/release-and-deploy.md` and indexed in `docs/security/threats/README.md`.

| Surface                                                       | S   | T   | R   | I   | D   | E   | Mitigation                                                                                                                                                                                                                                                                                                             | Req IDs                                       |
| ------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Release workflow (`release.yml`)                              | –   | ✓   | ✓   | ✓   | –   | ✓   | Tag protection (maintainers); `--verify-tag`; ancestor-of-`main` check; actions pinned to SHAs; least-privilege per job (`id-token`/`attestations` only in `attest`, `contents: write` only in `release`); no `pull_request_target`; `NPM_TOKEN` absent                                                                | ORB-SEC-001 (touched)                         |
| Release artifacts (SBOM, build tarball, notes)                | –   | ✓   | ✓   | –   | –   | –   | CycloneDX SBOM + `attest-build-provenance`; `gh attestation verify` documented; notes generated from commits (no free-text injection into HTML); assets checksummed                                                                                                                                                    | §28 rule 10                                   |
| Public demo deployment                                        | ✓   | ✓   | –   | ✓   | ✓   | –   | `ORB_ADAPTER=mock` (gateway 503), `ORB_PLAYGROUND=off` (no DoS knobs, no upload — U-3), no provider/gateway env on the host, Wave 0 headers verified post-deploy, footer text only, `robots` allows, no third-party scripts (CSP `default-src 'self'`)                                                                 | ORB-SEC-006, ORB-DEMO-002 (touched)           |
| Package rehearsal (temp build, tarball)                       | –   | ✓   | –   | –   | ✓   | ✓   | Runs in `os.tmpdir()`/`.rehearsal` with a fixed dependency set from the lockfile; never publishes; `ignore-scripts` inherited; output deleted; CI job has no registry credentials                                                                                                                                      | ORB-API-003, ORB-ARCH-001 (touched)           |
| Perf probe + perf-results JSON                                | –   | ✓   | ✓   | ✓   | –   | –   | Reports validated by strict zod schema (no extra keys, `notes` ≤ 240); verdict computed server-side by the script, never trusted from the file; fields limited to model/OS/browser/GPU strings and a GitHub handle (no serials, no IPs); community reports enter only through the issue template and maintainer review | ORB-PERF-002                                  |
| Playground completeness (new buttons: sequences, reset, copy) | –   | –   | –   | –   | ✓   | ✓   | Sequences go through `MockAdapter` (`source: 'mock'`), never `source: 'adapter'`; `engine-reset` rate-limited to one per second; copy button writes JSON text only; playground not served on the public URL                                                                                                            | ORB-PLAY-002 (touched), ORB-GOV-005 (touched) |
| Cross-browser CI jobs                                         | –   | ✓   | –   | –   | ✓   | –   | Browsers installed via pinned Playwright; `continue-on-error` removed only in `release.yml`; timeouts per project                                                                                                                                                                                                      | —                                             |
| Docs (external links, embedded commands)                      | –   | ✓   | –   | –   | –   | –   | Link check; commands cross-checked against `package.json`; no `curl \| sh` instructions; how-tos never show a real key (canary format `sk-canary-…`)                                                                                                                                                                   | ORB-SEC-001 (touched)                         |

## 7. Tests

| Test (name references requirement IDs)                                                                                                                                          | Type                                             | Req IDs                                                                                   | File                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `req('ORB-PERF-002','ORB-PERF-001') perf-matrix: verdicts from PERF_TARGETS, REQUIRED_MATRIX coverage, stale after 90 d, --release fails on stale/incomplete/undocumented fail` | unit                                             | ORB-PERF-002, ORB-PERF-001                                                                | `tests/unit/scripts/perf-matrix.test.ts`                                    |
| `req('ORB-PERF-002') perfProbeReportSchema rejects extra keys, long notes, ci/reduced-motion runs judged n/a`                                                                   | unit                                             | ORB-PERF-002                                                                              | `tests/unit/scripts/perf-matrix.test.ts`                                    |
| `req('ORB-PERF-003','ORB-PERF-005') recorded traces converge ≤ 3 s in degrade order with zero oscillation; healthy traces produce no step`                                      | unit (fixture replay, fake clock)                | ORB-PERF-003, ORB-PERF-005, ORB-PERF-002                                                  | `tests/unit/quality/trace-replay.test.ts`                                   |
| `req('ORB-PERF-002') aggregateFrames: median/p95/p99/dropped/longestGap over warm-up-trimmed samples`                                                                           | unit                                             | ORB-PERF-002                                                                              | `tests/unit/quality/perfProbe.test.ts`                                      |
| `@ORB-RENDER-006 webgl1 fallback: webgl2=false, webgl1=true, shaderTier basic, frames advance, notice visible`                                                                  | e2e (`chromium-webgl1`)                          | ORB-RENDER-006                                                                            | `tests/e2e/webgl1.fallback.spec.ts`                                         |
| `req('ORB-API-003') rehearsal builds @aisac/orbs with externals [three, zod], types emit, publint/attw clean, headless smoke`                                                   | unit (runs the script on the repo) + CI stage 14 | ORB-API-003, ORB-ARCH-001                                                                 | `tests/unit/scripts/package-rehearsal.test.ts`                              |
| `req('ORB-API-003') rehearsal fixture with react import → forbidden-import; outside-roots and deep-entry fixtures`                                                              | unit                                             | ORB-API-003                                                                               | `tests/unit/scripts/package-rehearsal.test.ts`                              |
| `req('ORB-API-003','ORB-ARCH-001') no-deep-package-imports and package-side rules fire on fixtures`                                                                             | arch                                             | ORB-API-003, ORB-ARCH-001, ORB-ARCH-002                                                   | `tests/unit/arch/boundaries.test.ts`                                        |
| `@cross-browser @ORB-RENDER-006 @ORB-A11Y-001 demo and playground render or fall back on webkit/firefox; sequence completes; keyboard approve`                                  | e2e (`webkit`, `firefox`)                        | ORB-RENDER-006, ORB-A11Y-001, ORB-A11Y-002                                                | `tests/e2e/cross-browser.smoke.spec.ts`                                     |
| `@ORB-A11Y-001 @ORB-A11Y-002 @ORB-A11Y-005 axe zero violations on /, /playground, /text-orb × 9 states × motion × fallback`                                                     | e2e                                              | ORB-A11Y-001, ORB-A11Y-002, ORB-A11Y-005, ORB-A11Y-003                                    | `tests/e2e/a11y.all-pages.spec.ts`                                          |
| `@ORB-PLAY-001 every manifest control is labelled, keyboard-operable and observable; __orbDebug.controls equals manifest`                                                       | e2e                                              | ORB-PLAY-001                                                                              | `tests/e2e/playground.controls.spec.ts`                                     |
| `@ORB-PLAY-002 @ORB-API-004 after driving all controls: no /api/agent calls, raw events source mock, "(manual)" announced`                                                      | e2e                                              | ORB-PLAY-002, ORB-API-004, ORB-GOV-005                                                    | `tests/e2e/playground.controls.spec.ts`                                     |
| `req('ORB-PLAY-001') playground-controls.md matches CONTROL_MANIFEST`                                                                                                           | unit                                             | ORB-PLAY-001                                                                              | `tests/unit/docs/playground-controls-doc.test.ts`                           |
| `req('ORB-API-001') engine-api.md documents every member of the api snapshot`                                                                                                   | unit                                             | ORB-API-001                                                                               | `tests/unit/docs/engine-api-doc.test.ts`                                    |
| `req('ORB-SEC-001') env-vars.md lists every env schema key with scope`                                                                                                          | unit                                             | ORB-SEC-001                                                                               | `tests/unit/docs/env-vars-doc.test.ts`                                      |
| `docs links resolve, every file indexed, README migration sentences present`                                                                                                    | unit                                             | —                                                                                         | `tests/unit/docs/links.test.ts`, `tests/unit/docs/readme-migration.test.ts` |
| `release-check: consistent fixture → ok; each ReleaseCheckCode reproduced by one mutated fixture`                                                                               | unit (table-driven, 17 codes)                    | — (gate G8, §28 rule 10)                                                                  | `tests/unit/scripts/release-check.test.ts`                                  |
| `req('ORB-API-001') SPEC_VERSION === specVersion === SPEC header === lock; CHANGELOG top entry === version; acceptance-checklist.yaml valid, 16 bullets, traces in lock`        | unit                                             | ORB-API-001                                                                               | `tests/unit/repo/release.test.ts`                                           |
| `release.yml: actions pinned, least-privilege per job, no NPM_TOKEN, tag trigger only`                                                                                          | unit (YAML parse)                                | —                                                                                         | `tests/unit/repo/workflows.test.ts`                                         |
| `@public-demo @ORB-SEC-006 @ORB-DEMO-001 deployed demo: Simulated badge, sequence to success, no cross-origin requests, gateway 503, playground 404, headers present`           | e2e (`public-demo`, post-deploy)                 | ORB-SEC-006, ORB-DEMO-001, ORB-DEMO-002                                                   | `tests/e2e/public-demo.smoke.spec.ts`                                       |
| Real-device matrix: 5 required pairs, targets per `PERF_TARGETS`                                                                                                                | perf-bench (manual, recorded JSON)               | ORB-PERF-002, ORB-PERF-001, ORB-PERF-004                                                  | `docs/reference/perf-results/*.json` → `docs/reference/perf-matrix.md`      |
| AT sign-off (NVDA+Firefox, VoiceOver+Safari iOS, TalkBack+Chrome), real Safari WebGL, microphone prompt/denial on 3 browsers, WebGL-disabled browser                            | manual                                           | ORB-A11Y-001, ORB-A11Y-002, ORB-AUDIO-001, ORB-AUDIO-002, ORB-RENDER-006, ORB-POINTER-003 | `docs/reference/manual-verification.md` (signed for the release SHA)        |
| Tutorial walk-through by a second contributor                                                                                                                                   | manual                                           | —                                                                                         | release PR sign-off                                                         |

CI: unit/arch tests in the Vitest stage (fixture traces, fake `Clock`; rehearsal test uses a temp dir and the committed lockfile; ≈ 60 s budget added to `docs/reference/ci-budget.md`); stage 14 `package-rehearsal` after `build` (blocking); `chromium-webgl1` joins the e2e stage; `a11y.all-pages` and `playground.controls` run under SwiftShader with `?preset=ci&seed=1&adaptive=0`; `webkit`/`firefox` stay weekly non-blocking on PRs and blocking in `release.yml`; `public-demo` runs only in the deploy job. Determinism: seeds fixed via `?seed=1`, sequencer manual, no real timers; perf on real devices is manual by construction and enters CI only as recorded traces.

## 8. ADRs to record

- ADR-0015 — Release process, versioning and provenance. Context: §28 rule 10 and the §26 gate need a repeatable, verifiable release. Options: manual tag + hand-written notes; `release-please` automation; tag-triggered workflow with a pure `release-check` and attestation. Recommendation: the third — annotated (signed when possible) tag `vX.Y.Z` on `main` only, `CHANGELOG.md` `### Spec` line `Implements SPEC.md <version>` mirrored by `package.json.specVersion` and `OrbEngine.SPEC_VERSION`, CycloneDX SBOM + build provenance attached; consequence: a release is blocked by stale perf evidence or unsigned manual verification by design.
- ADR-0016 — Package-extraction rehearsal without publishing (U-5). Context: ORB-API-003 requires proof that `engine/` extracts as `@aisac/orbs` while U-5 keeps a single package. Options: pnpm workspace split now; publish a `0.0.0-rehearsal` to a private registry; temp-dir build + tarball checks + headless smoke. Recommendation: temp-dir rehearsal as CI stage 14 with `ALLOWED_EXTERNALS = [three, zod]`; consequence: the real extraction becomes a folder move plus `package.json`, and `zod` stays the only runtime dependency of the package.
- ADR-0017 — Performance evidence policy. Context: CI has no GPU; §10 targets are SHOULD and hardware-dependent. Options: emulated FPS in CI as the gate; real-device manual matrix only; matrix as the absolute gate + CI as regression + recorded-trace replay for the controller. Recommendation: the third with explicit floors (`PERF_TARGETS`: desktop median ≥ 55 / p95 ≤ 20 ms, mobile median ≥ 30 / p95 ≤ 40 ms), 30-day freshness at release, 90-day staleness, deviations only via `spec_change` issues; consequence: a release needs one device session per required pair.
- ADR-0018 — Public demo posture (mock only, playground off). Context: ORB-SEC-006 and U-3; the playground exposes DoS knobs and untrusted SVG parsing. Options: deploy `/` and `/playground` publicly with edge rate limits; deploy `/` only; separate preview host for the playground. Recommendation: public URL serves `/` with `ORB_ADAPTER=mock`, `/playground` returns 404 (`ORB_PLAYGROUND=off`), no provider env; contributors run the playground locally; a maintainer may enable a separate preview deployment with `ORB_PLAYGROUND=on` and `custom-svg-*` controls disabled; consequence: §26 "playground works" is proven in CI and locally, not on the public host.

## 9. Deliverables

- `engine/quality/perfProbe.ts` (+ `PERF_TARGETS`, `DeviceClass`), tuned threshold values in `engine/quality/presets.ts`; `components/playground/PerfProbePanel.tsx` (copy/trace buttons), `components/playground/controlManifest.ts`, `components/playground/{MockEventsPanel,InspectorPanel}.tsx` additions, `app/playground/page.tsx` debug bridge (`controls`, `reset`, `snapshotJson`), `app/layout.tsx` footer (version · spec).
- `scripts/{perf-matrix,package-rehearsal,release-check,docs-playground}.ts`; `package.json` scripts `perf:matrix`, `package:rehearse`, `release:check`, `docs:playground`; `.pnpm-audit-exceptions.json` (empty).
- `playwright.config.ts` projects `chromium-webgl1`, `webkit`, `firefox` (grep `@cross-browser`), `public-demo`; `.github/workflows/{ci,weekly}.yml` updates (stage 14, webgl1 project); `.github/workflows/release.yml`; `.github/ISSUE_TEMPLATE/{bug_report,spec_change,performance_report}.yml`, `config.yml`; `.dependency-cruiser.cjs` rule `no-deep-package-imports`; deployment config for the public demo (IaC file of the chosen host, mock-only env).
- `specs/acceptance-checklist.yaml`; `specs/TRACEABILITY.md` rows for ORB-PERF-002, ORB-PLAY-001, ORB-API-003 and the §26 bullet → evidence section; `specs/requirements.overrides.yaml` entries for ORB-PERF-001/002/004 (`manual`, evidence `docs/reference/perf-matrix.md`, `reviewedAt`) and the AT/microphone/WebGL-disabled manual rows.
- `tests/unit/scripts/{perf-matrix,package-rehearsal,release-check}.test.ts`, `tests/unit/quality/{trace-replay,perfProbe}.test.ts`, `tests/unit/docs/{links,readme-migration,playground-controls-doc,engine-api-doc,env-vars-doc}.test.ts`, `tests/unit/repo/{release,workflows}.test.ts`, `tests/unit/arch/boundaries.test.ts` (fixtures), `tests/e2e/{webgl1.fallback,cross-browser.smoke,a11y.all-pages,playground.controls,public-demo.smoke}.spec.ts`, `tests/fixtures/perf/traces/*.json`, `tests/fixtures/rehearsal/violations/**`, `tests/fixtures/release/**`.
- Docs: every row of the 4.3 table; `docs/reference/perf-results/*.json`; `docs/adr/{0015-release-process-and-provenance,0016-package-extraction-rehearsal,0017-performance-evidence-policy,0018-public-demo-posture}.md`; `docs/security/release-review-1.0.0.md`, `docs/security/threats/{release-and-deploy.md,README.md}`.
- Root: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md` (`[1.0.0]`), `package.json` (`version`, `specVersion`).

## 10. Exit criteria (Gate G8)

1. `pnpm release:check` exits 0 on the release-candidate commit; `reports/release-check.json` shows 16/16 bullets `proven` or `manual`, `mustCoverage === 1.0`, `shouldCoverage ≥ 0.70` — `tests/unit/scripts/release-check.test.ts` green and the CLI output attached to the release PR.
2. `docs/reference/perf-matrix.md` has a non-stale `pass` row (≤ 30 days) for every `REQUIRED_MATRIX` pair; any `fail` row links a `spec_change` issue — `pnpm perf:matrix --release` exit 0 (ORB-PERF-002).
3. `tests/unit/quality/trace-replay.test.ts` green on every committed trace (≥ 1 per `DeviceClass`) with the tuned thresholds — ORB-PERF-003/005 touched.
4. CI stage 14 `package-rehearsal` green on `main`; `RehearsalResult.violations` empty, `externals === ['three','zod']`, smoke passed; fixture violations detected — ORB-API-003.
5. `tests/e2e/playground.controls.spec.ts` green; `docs/reference/playground-controls.md` in sync (`playground-controls-doc.test.ts`) — ORB-PLAY-001; ORB-PLAY-002 assertions green.
6. `a11y.all-pages.spec.ts` (0 violations) and `webgl1.fallback.spec.ts` green in the PR e2e stage; `cross-browser.smoke.spec.ts` green on `webkit` and `firefox` in `release.yml`.
7. `docs/reference/manual-verification.md` signed for the release SHA: AT rows (3 combinations), real Safari, microphone (3 browsers), WebGL-disabled; `docs/security/release-review-1.0.0.md` complete with every checklist row linked to evidence.
8. Doc tests green (`links`, `readme-migration`, `engine-api-doc`, `env-vars-doc`, `playground-controls-doc`); tutorial walk-through signed off by a second contributor; every Diátaxis row of 4.3 present.
9. `tests/unit/repo/release.test.ts` green: all SPEC version values equal the adopted SPEC header (initial target 0.2.0); an approved later spec-change updates the header, lock, package and engine together; `CHANGELOG.md` `[1.0.0]` contains `Implements SPEC.md 0.2.0`; `package.json.version === '1.0.0'`.
10. Annotated tag `v1.0.0` on `main`; `release.yml` green; GitHub release published with `sbom.cdx.json`, build tarball, api snapshot, perf matrix, req-coverage report; `gh attestation verify` succeeds — ADR-0015.
11. Public demo deployed from the tag; `public-demo.smoke.spec.ts` green against the URL (Simulated badge, gateway 503, playground 404, headers) — ORB-SEC-006; README links it.
12. `pnpm audit --audit-level=high` reports 0, `license-check` exit 0, `bundle-secret-scan` green on the release build; ADR-0015…0018 accepted; `specs/TRACEABILITY.md` shows no UNOWNED ID and every owned ID of this wave linked to its evidence.

## 11. Risks, spikes and open questions

- Risk: low-end Android (~2019) misses 30 FPS at `mobile-low` 3 000 → mitigation: 1-day spike on day 1 with the release-candidate build; if it fails after tuning (DPR 1, `shaderTier: 'basic'`, no connections), open a `spec_change` issue proposing a §10 note ("best effort below Android 10 / 2 GB") rather than editing the preset — owner: spec-amendment (maintainer).
- Risk: WebKit/Firefox in CI lack WebGL and only exercise the fallback path → real Safari/Firefox rows in `manual-verification.md`; spike (0.5 day) to test Playwright WebKit with `WEBKIT_FORCE_COMPLEX_TEXT`/software GL flags — owner: ADR-0017 note.
- Risk: `cdxgen`/attestation actions change interfaces → pin exact versions; `workflows.test.ts` guards pins; fallback to `@cyclonedx/cyclonedx-npm` on an `npm`-shaped lock export — owner: ADR-0015.
- Risk: package rehearsal breaks on `.glsl` imports or prebaked formation JSON resolution → spike (0.5 day) at the start of Track B; if prebakes need `fetch`, add a `FormationSource` of kind `Float32Array` export for bundled formations (no API change) — owner: ADR-0016.
- Risk: device availability (iPhone, two Android classes) → `performance_report.yml` lets contributors submit rows; maintainer verifies commit/UA before merging; BrowserStack-style services acceptable only for the `n/a`-free desktop rows — owner: maintainer.
- Risk: release-check becomes a brittle wall of fixtures → all inputs are plain data (`ReleaseCheckInput`), one fixture per code, no filesystem in the pure core — owner: 4.4.
- Spike: hosting choice for the public demo (IaC file, SSE/route-handler support irrelevant in mock mode, header support) — 0.5 day; record in ADR-0018 consequences.
- Open question (spec): should `PERF_TARGETS` floors (55 desktop / 30 mobile median, p95 caps) be written into SPEC §10 in a later revision so ORB-PERF-001/002 become benchmarkable without ADR-0017? Proposed as a `spec_change` issue, no ID invented here.
- Open question (spec): §26 bullets and §28 rule 10 have no IDs by design; if the maintainer wants `req()`-tagged tests for them, the next revision should assign IDs (candidates would be new `ORB-SDD-*` / acceptance IDs — not used in this wave).
- Open question (user): publish `@aisac/orbs` to npm at V1.0 or later (U-5)? This wave rehearses only; publishing needs an org scope, provenance via `npm publish --provenance`, and a semver policy for the engine independent of the app.
- Open question (user): expose the playground on a separate public preview URL (ADR-0018 option 3) — default is no.

## 12. Playground and demo controls introduced

- Playground (`/playground`): governed-sequence buttons in `MockEventsPanel` (`events-sequence-approve|deny|fail|speech`, routed through `MockAdapter` with `source: 'mock'`); `InspectorPanel` gains `inspector-copy` (copies the `__orbDebug` snapshot JSON) and `engine-reset` (dispose + recreate with the same seed, rate-limited); `PerfProbePanel` gains "Copy report" and `trace=1` raw-sample export; every control is registered in `CONTROL_MANIFEST` and listed in `docs/reference/playground-controls.md`. The playground is not served on the public demo (`ORB_PLAYGROUND=off`).
- Demo (`/`): footer "Simulated · v1.0.0 · SPEC 0.2.0" (text from `package.json` and `OrbEngine.SPEC_VERSION`) and a "Report a problem" link to the issue templates; `?perfprobe=1` overlay (Wave 2) extended with the mobile checklist prompt and the `DeviceClass` selector so recorded JSON validates against `perfProbeReportSchema`.
