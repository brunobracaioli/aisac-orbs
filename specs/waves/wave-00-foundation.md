# Wave 0 — Foundation, CI and spec amendments

| Field                     | Value                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                | in-progress (local implementation; PR and hosted gate evidence pending)                                                                                                             |
| **Milestones (SPEC §27)** | V0.0 (pre-renderer; unblocks V0.1 … V1.0)                                                                                                                                           |
| **Depends on**            | none (first wave)                                                                                                                                                                   |
| **Spec version**          | SPEC.md 0.1.0 → **0.2.0** (this wave applies `specs/SPEC-amendments-proposal.md`, decisions A-01 … A-18, user defaults U-1 … U-5)                                                   |
| **Gate**                  | G0 — a fresh clone is green on every blocking CI stage, including a SwiftShader WebGL smoke test; boundaries and requirement coverage are machine-checked; SPEC.md 0.2.0 is merged  |
| **Estimated size**        | M — no product behaviour, but every later wave inherits the toolchain, the boundary rules and the traceability contract; getting them wrong is the most expensive mistake available |

## 1. Objective

At the end of Wave 0 a contributor can clone the repository, run `pnpm install && pnpm ci:local`, and validate the repeatable local checks; GitHub Actions additionally verifies the hosted security jobs and gate evidence. The complete G0 checks are: lint, type-check, architecture boundaries (SPEC §5 encoded in `.dependency-cruiser.cjs`), unit tests with coverage, a production build, a bundle secret scan, a Playwright smoke test that renders 2 000 `THREE.Points` under SwiftShader, requirement-ID coverage against `SPEC.md`, SAST, SCA, secret and license scanning. `SPEC.md` is at 0.2.0 with a stable ID on every normative statement and every blocking ambiguity decided. `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, ADR-0001 … ADR-0004 and the Diátaxis skeleton exist. No orb is rendered yet beyond the smoke page.

## 2. Scope

### 2.1 In scope

- Next.js App Router scaffold, TypeScript strict, ESLint/Prettier, Vitest (+ fast-check), Playwright, Tailwind, pnpm, `.nvmrc`, path alias `@/`.
- `core/` kernel: `Clock`, `Scheduler`, `Prng` (mulberry32), `Logger` (JSON lines), `Result`, easing, ids, limits — fully unit-tested.
- `.dependency-cruiser.cjs` encoding the SHARED_CONTRACTS import rules; executed in CI and inside Vitest (`req('ORB-ARCH-001','ORB-ARCH-002')`).
- WebGL-in-CI spike: `app/smoke/points/page.tsx` + `tests/e2e/smoke.webgl.spec.ts` under SwiftShader and under `--disable-webgl`; CI timing budget recorded.
- Requirement traceability tooling: `tests/support/req.ts`, `scripts/req-coverage.ts`, `specs/requirement-ids.lock`, `specs/requirement-ids.ts`, `specs/requirements.overrides.yaml`.
- Security & observability baseline: security headers with CSP nonce, structured logger, gitleaks pre-commit + CI, CodeQL, `pnpm audit`, Dependabot, license allow-list, bundle secret scan with canary.
- Open-source hygiene files and the spec amendment PR (SPEC.md 0.1.0 → 0.2.0).

### 2.2 Out of scope (deferred)

- Any semantic runtime (events, state machine, governance) → Wave 1.
- Real particle renderer, quality presets, `OrbEngine` → Wave 2 (the smoke page is deleted when `engine/render/ParticleSystem.impl.ts` lands).
- Formations, morphing, SVG sampler → Wave 3 / Wave 6.
- Demo page, playground, public API → Wave 4 / Wave 5.
- Server gateway, OpenAI adapter, `app/api/**`, env vars beyond the canary → Wave 7.
- Release, SBOM, perf matrix on real devices → Wave 8.

## 3. Requirements owned by this wave

Every ID listed here is owned by this wave and must be fully satisfied and verified before the gate closes. These are planned obligations; no test evidence is implied. Shared declaration owners and integration rules are in `specs/SHARED-CONTRACTS.md`.

| ID           | Level    | Summary                                                           | Slice | Verification                                                                                                  |
| ------------ | -------- | ----------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| ORB-ARCH-001 | MUST NOT | "Orb Engine MUST NOT import an AI provider SDK." (SPEC §5)        | 4.3   | arch (dependency-cruiser in CI + Vitest)                                                                      |
| ORB-ARCH-002 | MUST     | "Provider-specific behavior MUST live behind adapters." (SPEC §5) | 4.3   | arch (provider SDKs importable only from `adapters/*/server/**`; that folder importable only by `app/api/**`) |

Process rules owned by this wave without a requirement ID (SPEC §28, informative per WAVE_ASSIGNMENT): rule 3 (stable ID before merge → `requirement-ids.lock` + PR template), rule 5 (tests reference IDs → `req()` helper + `req-coverage`), rule 7 (deviations documented → PR template + `requirements.overrides.yaml`).

Requirements touched but owned elsewhere: ORB-SEC-001 (Wave 7 — bundle secret scan, gitleaks, env schema), ORB-SEC-004 (Wave 1 — `react/no-danger`, `innerHTML` lint ban), ORB-FORM-007 (Wave 3 — CODEOWNERS on `assets/formations/`), ORB-FORM-011 (Wave 3 — `Math.random` lint ban, `Prng`), ORB-DEMO-004 (Wave 1 — timer ban in `engine/**`, `events/**`), ORB-RENDER-001 / ORB-RENDER-006 (Wave 2 — WebGL smoke and `--disable-webgl` fallback path), ORB-ARCH-005 (Wave 1 — `engine-no-ui` rule keeps React/DOM out of the engine), ORB-A11Y-002 (Wave 1 — `frame-ancestors 'none'` against clickjacking of approval controls), ORB-AUDIO-001 (Wave 5 — `Permissions-Policy: microphone=(self)`), ORB-API-003 (Wave 8 — extraction boundary enforced from day one).

## 4. Vertical slices

### 4.1 Scaffold & toolchain — bounded context `repo root / presentation shell`

**Objective.** A Next.js App Router project that builds and starts with a scrubbed environment, with strict TypeScript, ESLint rules that make the SPEC's "never" clauses lint errors, and test runners wired to the CI conventions of SHARED_CONTRACTS.

**Contracts.**

```jsonc
// package.json (excerpt — names are normative, versions are pinned exactly in the PR)
{
  "name": "aisac-orbs",
  "private": true,
  "license": "Apache-2.0",
  "specVersion": "0.2.0",
  "packageManager": "pnpm@10.x",
  "engines": { "node": ">=22 <23" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . && prettier --check .",
    "typecheck": "tsc --noEmit",
    "arch": "depcruise --config .dependency-cruiser.cjs --output-type err-long .",
    "test": "vitest run --coverage --reporter=default --reporter=json --outputFile=reports/vitest.json",
    "test:e2e": "playwright test --project=chromium-swiftshader --project=chromium-nowebgl",
    "spec:ids": "tsx scripts/req-coverage.ts --emit-types --write-lock",
    "req:coverage": "tsx scripts/req-coverage.ts",
    "scan:bundle": "tsx scripts/bundle-secret-scan.ts",
    "scan:licenses": "tsx scripts/license-check.ts",
    "scan:secrets": "gitleaks detect --redact",
    "ci:local": "pnpm lint && pnpm typecheck && pnpm arch && pnpm test && pnpm build && pnpm scan:bundle && pnpm test:e2e && pnpm req:coverage && pnpm scan:licenses && pnpm audit --audit-level=high && pnpm scan:secrets",
  },
}
```

```jsonc
// tsconfig.json (excerpt)
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "paths": { "@/*": ["./*"] },
  },
}
```

```ini
# .npmrc
minimum-release-age=10080   # 7 days, in minutes (pnpm >= 10.16)
ignore-scripts=true          # Playwright browsers are installed by an explicit CI step
engine-strict=true
save-exact=true
```

```ts
// app/_lib/env.ts — the ONLY module allowed to read process.env (ESLint no-restricted-syntax elsewhere; this module imports `server-only` and its server values are never imported into a Client Component)
import { z } from "zod";
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ORB_SMOKE_ROUTES: z.enum(["0", "1"]).default("0"), // exposes /smoke/* (CI and dev only)
  ORB_BUNDLE_CANARY: z.string().min(16).optional(), // set by CI to prove the bundle scan; never read by app code
});
const clientSchema = z.object({
  NEXT_PUBLIC_ORB_SEED: z.coerce.number().int().nonnegative().default(1),
});
export const env = {
  server: serverSchema.parse(process.env),
  client: clientSchema.parse(pickPublic(process.env)),
} as const;
// pickPublic copies only NEXT_PUBLIC_* keys; a NEXT_PUBLIC_* name matching /KEY|SECRET|TOKEN/ throws at build time.
```

ESLint rules (flat config, `eslint.config.mjs`), all `error`:

| Rule                                                                                                                      | Scope                                                                                                       | Reason                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `no-restricted-properties` `Math.random`                                                                                  | `engine/**`, `formations/**`, `audio/**`, `pointer/**`, `adapters/**`, `events/**`                          | ORB-FORM-011 determinism; use `Prng`                          |
| `no-restricted-properties` `Date.now`, `performance.now`                                                                  | everywhere except `core/clock.ts`, `app/**`, `components/**`, `scripts/**`, `tests/**`                      | injected `Clock`                                              |
| `no-restricted-globals` `setTimeout`, `setInterval`, `requestAnimationFrame`                                              | `engine/**` (rAF allowed in `engine/render/**`), `events/**`, `adapters/**` (except `adapters/*/server/**`) | ORB-DEMO-004: timers only via `Scheduler` / `FrameTimeSource` |
| `no-restricted-syntax` `process.env`                                                                                      | everywhere except `app/_lib/env.ts`, `app/api/**`, `*.config.*`, `scripts/**`                               | ORB-SEC-001                                                   |
| `no-restricted-syntax` `eval`, `new Function`, `innerHTML`/`outerHTML` assignment, `insertAdjacentHTML`, `document.write` | repo-wide                                                                                                   | ORB-SEC-004                                                   |
| `react/no-danger`                                                                                                         | repo-wide                                                                                                   | ORB-SEC-004                                                   |
| `no-console`                                                                                                              | everywhere except `core/logger.ts`, `scripts/**`, `tests/**`                                                | structured logs only                                          |
| `@typescript-eslint/no-explicit-any`, `consistent-type-imports`, `no-floating-promises`                                   | repo-wide                                                                                                   | strict typing                                                 |
| `eslint-plugin-security` recommended                                                                                      | repo-wide                                                                                                   | SAST at lint time                                             |

Vitest: `coverage.provider = 'v8'`, thresholds `core/**` ≥ 90 % lines / 85 % branches now, the same per-folder threshold added for `engine/**`, `events/**`, `formations/**`, `adapters/**`, `audio/**` when each folder appears, global ≥ 80 %; fast-check `numRuns` 200 in CI / 50 locally, seed from `FC_SEED` and printed on failure; `reports/vitest.json` always written.

Playwright: projects `chromium-swiftshader` (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`), `chromium-nowebgl` (`--disable-webgl --disable-3d-apis`), `perf` (nightly, Wave 2+); `webServer: { command: 'pnpm build && pnpm start', env: { NODE_ENV: 'production', ORB_SMOKE_ROUTES: '1', NEXT_PUBLIC_ORB_SEED: '1' } }` (scrubbed env — nothing inherited); `workers: 2`, `retries: 1`, `expect.timeout 15 s`, test 60 s, webServer 120 s; `trace: 'on-first-retry'`, `video: 'retain-on-failure'`; reporter JSON → `reports/playwright.json`; a shared fixture installs `page.on('pageerror')` and a console collector that fails the test on any `error` line not in the allow-list (`THREE.WebGLRenderer:` info lines).

**Behavior.** `pnpm ci:local` runs the locally reproducible stages in CI order, including license, dependency and secret scans. Hosted CodeQL, branch protection and recorded CI/device evidence remain additional G0 gates; local success alone never closes G0. `next build` succeeds with an empty environment. `app/page.tsx` renders a static placeholder (`role="status"` text "AISAC Orbs — Wave 0 scaffold"), replaced in Wave 4.

**Edge cases.**

- `ignore-scripts=true` breaks `playwright install` implicitly → CI and CONTRIBUTING run `pnpm exec playwright install --with-deps chromium` explicitly.
- Node ≠ 22 → `engine-strict` fails `pnpm install` with a clear message.
- A `NEXT_PUBLIC_*` variable whose name matches `/KEY|SECRET|TOKEN/i` → `env.ts` throws at build; the bundle scan (4.6) also fails.
- Missing lockfile or drift → `pnpm install --frozen-lockfile` fails in CI.

**Acceptance criteria.**

- Given a fresh clone with no `.env` files, When `pnpm install --frozen-lockfile && pnpm ci:local` runs, Then every stage exits 0 — proves the scaffold; `tests/unit/repo/hygiene.test.ts` + CI run.
- Given a fixture file in `engine/` calling `Math.random()`, When ESLint runs programmatically, Then it reports `no-restricted-properties` — ORB-FORM-011 (touched); `tests/unit/repo/eslint-rules.test.ts`.
- Given a fixture component using `dangerouslySetInnerHTML`, When ESLint runs, Then `react/no-danger` errors — ORB-SEC-004 (touched); same file.
- Given a fixture in `components/` reading `process.env.X`, When ESLint runs, Then `no-restricted-syntax` errors — ORB-SEC-001 (touched); same file.
- Given a fixture in `events/` calling `setTimeout`, When ESLint runs, Then `no-restricted-globals` errors — ORB-DEMO-004 (touched); same file.

**Observability.** None at runtime. CI uploads `reports/*.json` as artifacts on every run.

### 4.2 Core kernel — bounded context `core/` (pure leaf)

**Objective.** The injectable primitives every later wave depends on, with no imports and 100 % deterministic behaviour.

**Contracts.** (SHARED_CONTRACTS names verbatim; additions marked.)

```ts
// core/clock.ts
export interface Clock {
  now(): number;
} // ms; injected everywhere; never Date.now() inside engine/adapters
export const systemClock: Clock; // the only Date.now() call site outside app/components
// core/scheduler.ts
export interface Scheduler {
  schedule(fn: () => void, delayMs: number): () => void;
} // returns cancel
export const systemScheduler: Scheduler; // setTimeout/clearTimeout wrapper; the only timer call site in kernel code
// core/prng.ts
export interface Prng {
  next(): number;
  int(maxExclusive: number): number;
  fork(label: string): Prng;
}
export function createPrng(seed: number): Prng; // mulberry32; seed coerced to uint32
export function fnv1a32(input: string): number; // addition: used by fork() and by formation registries
// core/result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok: <T>(value: T) => Result<T, never>;
export const err: <E>(error: E) => Result<never, E>;
// core/logger.ts
export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}
export type LogSink = (line: string) => void;
export function createLogger(opts: {
  sink?: LogSink;
  clock: Clock;
  level?: "debug" | "info" | "warn" | "error";
  fields?: Record<string, unknown>;
}): Logger;
// core/easing.ts (addition)
export type EasingId =
  "linear" | "easeInOutCubic" | "easeOutCubic" | "easeInOutSine" | "smoothstep";
export const EASINGS: Readonly<Record<EasingId, (t: number) => number>>; // GLSL twin arrives in Wave 3 (parity test there)
export const EASING_INDEX: Readonly<Record<EasingId, 0 | 1 | 2 | 3 | 4>>; // linear=0, easeInOutCubic=1, easeOutCubic=2, easeInOutSine=3, smoothstep=4
export function ease(id: EasingId, t: number): number; // dispatches to EASINGS
// core/ids.ts (addition)
export const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;
export function isId(value: unknown): value is string;
export function createIdFactory(prng: Prng, prefix: string): () => string; // deterministic ids for mock/tests: `${prefix}-${8 hex}`
export function randomId(): string; // crypto.randomUUID(); allowed only here and in app/api/**
// core/limits.ts (addition — named constants; SHARED_CONTRACTS and A-18 values)
export const LIMITS = {
  metadataStringMax: 120,
  logStringMax: 120,
  eventDedupeWindow: 512,
  particlesMin: 100,
  particlesHardMax: 200_000,
  svgBytesMax: 2_097_152,
  svgElementsMax: 5_000,
  svgPathCommandsMax: 200_000,
  svgSampledPointsMax: 200_000,
  svgParseTimeoutMs: 2_000,
} as const;
// core/index.ts re-exports everything above.
```

**Behavior.**

- `createPrng(seed)`: mulberry32; `next()` ∈ [0, 1); `int(n)` = `Math.floor(next() * n)`; `fork(label)` = `createPrng(fnv1a32(`${rootSeed}:${label}`))` where `rootSeed` is the parent's _initial_ seed, so a fork is independent of how many values the parent has consumed (A-17: `prng.fork(formationId)` is stable). Golden vector: seed 42 → first three uint32 outputs `2581720956, 1925393290, 3661312704` (floats `0.60110375…, 0.44829055…, 0.85246579…`); `fnv1a32('42:sphere') = 3217160774`.
- Logger: one JSON object per line `{ ts, level, event, correlationId?, ...fields }`; `child(fields)` merges fields (child wins); string fields longer than `LIMITS.logStringMax` are truncated to 120 chars + `…`; keys matching `/token|secret|key|password|authorization|cookie|email|phone/i` are replaced by `"[redacted]"`; `Error` values serialise as `{ name, message }` (no stack in production level); event names must match `/^orb(?:\.[a-z][a-z0-9_]*){2,}$/` — a mismatch logs `orb.logger.bad_event` and drops the line.
- Easing: every function clamps `t` to [0, 1], `f(0) = 0`, `f(1) = 1`, non-decreasing.
- `systemScheduler.schedule` returns an idempotent cancel; calling cancel after fire is a no-op.

**Edge cases.**

- `int(0)` or non-integer/negative `maxExclusive` → `RangeError`.
- `createPrng(NaN)` → seed coerced to 0 (documented; the caller should validate `?seed=`).
- Logger sink throws → swallowed; a counter `droppedLines` is exposed for tests; never rethrows into engine code.
- `fork('')` is valid and distinct from the parent.

**Acceptance criteria.**

- Given seed 42, When three values are drawn, Then they equal the golden vector byte-for-byte, and the same holds after `fork` regardless of parent consumption — ORB-FORM-011 (touched); `tests/unit/core/prng.test.ts` (+ fast-check: `next()` ∈ [0,1), `int(n)` ∈ [0,n)).
- Given a logger with a memory sink and a `child({ correlationId: 'c1' })`, When `info('orb.test.event', { token: 'abc', label: 'x'.repeat(300) })` is called, Then the line parses as JSON, carries `correlationId: 'c1'`, `token: '[redacted]'`, and a 121-char label — `tests/unit/core/logger.test.ts`.
- Given every `EasingId`, When evaluated on 1 000 fast-check samples, Then boundary and monotonicity properties hold — `tests/unit/core/easing.test.ts`.
- Given `FakeScheduler`/`FakeClock`, When `advance(ms)` is called, Then callbacks fire in delay order and cancelled ones never fire — `tests/unit/core/clock-scheduler.test.ts`.

**Observability.** `core/logger.ts` is the observability primitive; it emits `orb.logger.bad_event` for malformed event names.

### 4.3 Architecture guard — bounded context `repo root` (ORB-ARCH-001, ORB-ARCH-002)

**Objective.** SPEC §5 boundaries and the SHARED_CONTRACTS import rules exist as executable rules that fail CI and fail a Vitest test tagged with the owned IDs.

**Contracts.** `.dependency-cruiser.cjs` (CommonJS, `tsConfig: { fileName: 'tsconfig.json' }`, `tsPreCompilationDeps: true` so type-only edges are visible and can be exempted with `dependencyTypesNot: ['type-only']`). Rule list (severity `error` unless stated):

| Rule name                                | From                                                                                                  | To (forbidden unless stated)                                                                                                                                                                                                                                                                                                                       | Req IDs / source                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `no-circular`                            | any                                                                                                   | cycles                                                                                                                                                                                                                                                                                                                                             | house rule                              |
| `core-is-leaf`                           | `^core/`                                                                                              | anything outside `^core/` incl. `node_modules`                                                                                                                                                                                                                                                                                                     | SHARED_CONTRACTS "core imports nothing" |
| `pure-domains-import-only-core`          | `^(events\|formations\|pointer/domain\|audio/domain\|engine/(state\|visual-policy\|morph\|quality))/` | everything except `^core/`, the same folder, type-only edges to `^events/`, `^formations/domain/`, `^engine/ports/`, and npm `zod` (events only)                                                                                                                                                                                                   | SHARED_CONTRACTS                        |
| `render-owns-three`                      | anything except `^engine/render/` (and `^app/smoke/` until Wave 2, see sunset)                        | npm `three`, `^shaders/`                                                                                                                                                                                                                                                                                                                           | ADR-0003                                |
| `engine-no-ui`                           | `^engine/`                                                                                            | npm `react`, `react-dom`, `next`, `next/.*`, `zustand`, `@react-three/.*`                                                                                                                                                                                                                                                                          | ORB-ARCH-005 spirit, ADR-0001           |
| `engine-no-adapters`                     | `^engine/`                                                                                            | `^adapters/` except type-only `^adapters/AgentAdapter\.ts$`                                                                                                                                                                                                                                                                                        | ORB-ARCH-002                            |
| `no-provider-sdk-outside-adapter-server` | anything except `^adapters/[^/]+/server/`                                                             | npm `^(openai\|@anthropic-ai/.*\|@google/generative-ai\|@google/genai\|ai\|@ai-sdk/.*\|langchain\|@langchain/.*\|@mistralai/.*\|cohere-ai\|groq-sdk\|ollama)$`                                                                                                                                                                                     | **ORB-ARCH-001, ORB-ARCH-002**          |
| `adapter-server-only-from-api`           | anything except `^app/api/` and the folder itself                                                     | `^adapters/[^/]+/server/`                                                                                                                                                                                                                                                                                                                          | **ORB-ARCH-002**, ORB-SEC-001           |
| `presentation-uses-public-surfaces`      | `^(app\|components)/`                                                                                 | `^(engine\|adapters\|formations)/(?!index\.ts$).+`, `^(core\|events\|shaders\|pointer\|audio)/` — allowed: `engine/index.ts`, `adapters/index.ts`, `formations/index.ts`, `components/**` from `app/**`, `app/api/**` → `adapters/*/server/**` and `core/index.ts`; temporary `app/smoke/**` → `core/index.ts` for the seeded smoke, removed in W2 | SHARED_CONTRACTS, ORB-API-003           |
| `src-never-imports-tests`                | anything outside `^tests/`                                                                            | `^tests/`                                                                                                                                                                                                                                                                                                                                          | house rule                              |
| `no-orphans` (warn)                      | orphan modules                                                                                        | —                                                                                                                                                                                                                                                                                                                                                  | hygiene                                 |

In prose: `core` is a leaf; the pure domains (`events`, `formations`, `pointer/domain`, `audio/domain`, `engine/state`, `engine/visual-policy`, `engine/morph`, `engine/quality`) see only `core` and their own context types; `engine/render` is the only owner of `three` and `shaders`; nothing in `engine` may see React, Next, Zustand, adapters' server code or a provider SDK; provider SDKs live exclusively under `adapters/<name>/server/**`, which only `app/api/**` may import; presentation code (`app`, `components`) reaches the engine, adapters and formations exclusively through their `index.ts`. `engine/index.ts` is therefore the future `@aisac/orbs` surface (ADR-0003).

```ts
// tests/unit/arch/boundaries.test.ts (excerpt)
import { cruise } from 'dependency-cruiser';
it(`${req('ORB-ARCH-001', 'ORB-ARCH-002')} repository has zero dependency-cruiser violations`, async () => { /* cruise(['app','components','core','events','engine','formations','shaders','pointer','audio','adapters','scripts'], { ruleSet }) → summary.error === 0 */ });
it(`${req('ORB-ARCH-001')} fixture engine module importing 'openai' is reported by no-provider-sdk-outside-adapter-server`, ...);
it(`${req('ORB-ARCH-002')} fixture component importing adapters/openai/server is reported by adapter-server-only-from-api`, ...);
it('smoke-page three exception is removed once engine/render/ParticleSystem.impl.ts exists', ...);   // sunset guard
```

**Behavior.** CI stage `architecture` runs `pnpm arch`; the Vitest test runs the same rule set programmatically on the repo and on `tests/fixtures/arch/violations/**` (a second cruise with `baseDir` pointed at the fixture tree, expecting exactly the named rule to fire — a seeded gap that proves the guard is alive). The sunset guard fails once `engine/render/ParticleSystem.impl.ts` exists while the `app/smoke` exception is still in the rule file.

**Edge cases.**

- Type-only import of a provider SDK type from engine (`import type { X } from 'openai'`) → still an error (rule has no `dependencyTypesNot` exemption); provider types are re-shaped in `adapters/openai/normalize.ts`.
- Dynamic `import('openai')` → detected (dependency-cruiser follows dynamic imports).
- A new provider package not in the regex → rule `engine-no-adapters` + code review via CODEOWNERS on `adapters/`; the regex is extended in the same PR (open question Q-2).
- `pnpm arch` and the Vitest test disagree → CI fails either way; both use the same `.dependency-cruiser.cjs`.

**Acceptance criteria.**

- Given the repository at G0, When `pnpm arch` runs, Then it reports 0 errors — ORB-ARCH-001, ORB-ARCH-002; CI stage `architecture` + `tests/unit/arch/boundaries.test.ts`.
- Given `tests/fixtures/arch/violations/engine/bad.ts` containing `import OpenAI from 'openai'`, When cruised in isolation, Then rule `no-provider-sdk-outside-adapter-server` fires exactly once — ORB-ARCH-001; same file.
- Given `tests/fixtures/arch/violations/components/bad.tsx` importing `adapters/openai/server/sseTransport`, When cruised, Then `adapter-server-only-from-api` and `presentation-uses-public-surfaces` fire — ORB-ARCH-002; same file.

**Observability.** None at runtime; CI prints `err-long` output; the Vitest test attaches the violation list to the failure message.

### 4.4 WebGL-in-CI spike — bounded context `presentation shell` (touches ORB-RENDER-001, ORB-RENDER-006)

**Objective.** Prove, before any engine code exists, that a Next.js page rendering `THREE.Points` under a nonce-based CSP executes in headless Chromium with SwiftShader on GitHub Actions, that the no-WebGL path is observable, and how long it costs.

**Contracts.**

```ts
// app/smoke/points/page.tsx — server component; returns notFound() unless env.server.ORB_SMOKE_ROUTES === '1'
// app/smoke/points/SmokePoints.tsx — 'use client'; imports 'three' directly (temporary dependency-cruiser exception, deleted in Wave 2)
export interface OrbDebugSmoke {
  readonly kind: "smoke";
  frames: number;
  contextCreated: boolean;
  glErrors: number;
  rendererInfo: string;
  fallback: boolean;
  particleCount: 2000;
}
declare global {
  interface Window {
    __orbDebug?: OrbDebugSmoke;
  }
} // attached only when searchParams.debug === '1'
```

Page: 2 000 points (`BufferGeometry` with a seeded `Prng` — never `Math.random`), `ShaderMaterial` with a trivial vertex/fragment pair (`uTime` uniform), `requestAnimationFrame` loop incrementing `frames`, `renderer.getContext().getError()` sampled every frame into `glErrors`. If `WebGLRenderingContext`/`WebGL2RenderingContext` is unavailable or `new WebGLRenderer()` throws, the component renders `<section role="status" data-testid="fallback">WebGL unavailable — text state remains available</section>` and sets `fallback = true` (placeholder for ORB-RENDER-006; the real fallback belongs to Wave 2).

**Behavior.** `tests/e2e/smoke.webgl.spec.ts` project `chromium-swiftshader`: navigate to `/smoke/points?debug=1`, `expect.poll(() => __orbDebug.frames).toBeGreaterThan(0)`, `contextCreated === true`, `glErrors === 0`, no console errors, no CSP violation reports. Project `chromium-nowebgl`: `fallback === true`, `data-testid="fallback"` visible, no `pageerror`. Stage duration is written to `docs/reference/ci-budget.md` (table: stage, p50, p95 over the first 10 CI runs, budget).

**Edge cases.**

- SwiftShader not selected (flag drift in Chromium) → `rendererInfo` still recorded; the test asserts frames, not the renderer string, and logs the string for diagnosis.
- `ORB_SMOKE_ROUTES` unset in production → 404; the route never ships in the public demo.
- CSP blocks the inline bootstrap script → `frames` stays 0 and the CSP-violation collector fails the test with the blocked directive.

**Acceptance criteria.**

- Given the production build with `ORB_SMOKE_ROUTES=1`, When `/smoke/points?debug=1` loads under SwiftShader, Then `frames > 0`, `contextCreated`, `glErrors === 0` within 15 s — ORB-RENDER-001 (touched); `tests/e2e/smoke.webgl.spec.ts` `@ORB-RENDER-001`.
- Given `--disable-webgl`, When the same page loads, Then the fallback region is visible and no uncaught error occurs — ORB-RENDER-006 (touched); same file `@ORB-RENDER-006`.
- Given 10 CI runs, When durations are collected, Then `docs/reference/ci-budget.md` records the smoke stage p95 and the PR pipeline wall clock ≤ 15 min — review.

**Observability.** `window.__orbDebug` read-only snapshot (debug builds / `?debug=1` only). No server logs.

### 4.5 Requirement traceability tooling — bounded context `specs / scripts` (SPEC §28 rules 3, 5, 7)

**Objective.** Every normative ID in `SPEC.md` is machine-readable; tests declare which IDs they prove; CI fails on an uncovered MUST unless a time-boxed, reviewed waiver exists; the ID set is locked so silent removals or weakening are impossible.

**Contracts.**

```ts
// specs/requirement-ids.ts — GENERATED by `pnpm spec:ids`; committed; CI fails if regenerating changes it
export type ReqId = 'ORB-ARCH-001' | 'ORB-ARCH-002' | /* … every ID in SPEC.md + adopted overrides … */;
export type Tag = `@${ReqId}`;
// tests/support/req.ts
export function req(...ids: [ReqId, ...ReqId[]]): string;      // returns '[ORB-ARCH-001,ORB-ARCH-002]'; unknown ID fails tsc
export function tags(...ids: [ReqId, ...ReqId[]]): Tag[];      // Playwright: test('…', { tag: tags('ORB-A11Y-002') }, …)
```

```text
# specs/requirement-ids.lock — generated; one line per ID, sorted; `<id> <effective-level> <sha256[0:8] of normalised text>`; declared level is retained in the reports
spec-version: 0.2.0
ORB-A11Y-001 must 9c0e4f21
ORB-ARCH-001 must 3b7a1d0e
…
```

```yaml
# specs/requirements.overrides.yaml (zod-validated; every entry needs reason + issue)
provisional: # IDs for unnumbered clauses until SPEC adopts them (status: provisional|adopted)
  - { id: ORB-XXX-000, section: "§n", level: must, text: "…", status: provisional, issue: "#n" }
manual: # MUSTs verifiable only by hand/benchmark (analyze_tests §4)
  - {
      id: ORB-PERF-001,
      verification: manual,
      evidence: docs/reference/perf-matrix.md,
      reviewedAt: 2026-09-14,
      issue: "#n",
    }
waivers: # time-boxed; expired waiver = CI error
  - {
      idPattern: "^ORB-(?!ARCH-00[12]$).*",
      reason: "Wave 0: no implementation yet; each gate narrows this pattern",
      issue: "#1",
      waivedUntil: 2026-10-31,
    }
```

`scripts/req-coverage.ts` CLI: `--reports-only` (skip running tests; read `reports/vitest.json` + `reports/playwright.json`), `--emit-types`, `--write-lock`, `--check` (verify generated artifacts without writing), `--emit-traceability`, `--check-lock` (default on in CI), `--gate <wave-slug>` (enforced ownership scope: current and completed waves cannot be waived; future waves require explicit unexpired waivers), `--json reports/req-coverage.json --md reports/req-coverage.md`. Exit codes: 0 ok, 1 policy failure, 2 configuration/parse error.

**Behavior.**

1. Parse `SPEC.md` with `^- \*\*(ORB-[A-Z0-9]+-\d{3})\*\* — (.+)$`; declared level from the first normative keyword (`MUST NOT`/`MUST` → `must`, `SHOULD` → `should`, `MAY` → `may`, none → `informative`); effective gate level is `must` when the requirement contains any MUST/MUST NOT clause, even if its declared level is SHOULD or MAY; section from the nearest `## n.` heading (Appendix tables in 0.2.0 use the same bullet form, one bullet per ID).
2. Merge `provisional` overrides (an override whose ID already exists in SPEC is an error).
3. Extract IDs from test reports: Vitest `fullName` via `/\bORB-[A-Z0-9]+-\d{3}\b/g`; Playwright `tags`. Only `passed` tests count; `skipped`/`todo`/`failed` never cover (a `.skip` cannot hide a gap).
4. Errors (exit 1): (a) an effective `must` with zero passing tests and no valid `manual`/`waiver` entry; (b) an ID referenced by a test that exists neither in SPEC nor overrides; (c) an expired waiver or a `manual` entry older than 90 days without `reviewedAt` refresh; (d) a waiver matches an ID owned by the current or a completed wave, or a required E2E has no passing evidence; (e) `--check-lock`: an ID present in the lock but missing from SPEC, or whose effective level in SPEC is lower than in the lock (must → should/may, should → may), unless the PR carries the `spec-change` label (`GITHUB_PR_LABELS` env) **and** `CHANGELOG.md` `### Spec` under `[Unreleased]` names the ID — SPEC §28 rule 6 "not silently".
5. Warnings (exit 0, listed in the summary): `should` with zero tests and no embedded MUST clause; non-blocking recommendations without tests; a user-observable MUST missing its required E2E (GOV, A11Y, RENDER-006, DEMO, SEC-005/006, plus each wave's explicit list) is an error under step 4, not a warning; `should` coverage ratio below the threshold (`--should-threshold`, 0 now, 70 % at V1.0).
6. Output `reports/req-coverage.{json,md}` (table per SPEC section: `ID | Level | Status | #unit | #e2e | tests`; totals per level) and `$GITHUB_STEP_SUMMARY`; PR feedback uses the job summary and artifacts; an optional comment requires a separately scoped workflow permission.

**Edge cases.**

- Two bullets with the same ID in SPEC → exit 2 ("duplicate ID").
- Test title with an ID but the test failed → counted as `failing`, not covered; the report shows it separately.
- Waiver pattern matching zero IDs → warning "dead waiver".
- Lock hash differs but effective level unchanged (text edited) → info only; the lock is regenerated by `pnpm spec:ids` in the same PR.
- `reports/playwright.json` missing in a reporting-only local run → E2E columns show `n/a`; a gate run or CI must fail if required E2E reports are absent. `--check`, `--emit-types`, `--write-lock` and `--emit-traceability` are metadata-only modes and do not need runtime reports.

**Acceptance criteria.**

- Given a fixture SPEC with one MUST and a Vitest report with no passing test for it, When the script runs, Then exit 1 with the ID listed under `uncovered` — `tests/unit/scripts/req-coverage.test.ts`.
- Given the same fixture plus a waiver expiring yesterday, When the script runs, Then exit 1 with "expired waiver" — same file.
- Given a report referencing `ORB-NOPE-999`, When the script runs, Then exit 1 (unknown ID) — same file.
- Given a lock line `ORB-X-001 must …` and a SPEC where it became SHOULD without the `spec-change` label, When `--check-lock` runs, Then exit 1 — same file.
- Given a `.skip` test carrying an ID, When the script runs, Then the ID is not covered — same file.
- Given a SHOULD/MAY-led requirement containing a MUST clause, When that clause lacks coverage or is silently removed, Then the gate or lock check fails — same file.
- Given a waiver matching the current or a completed wave, or missing required E2E reports, When a gate runs, Then exit 1; aliases do not credit untagged IDs — same file.
- Given `pnpm spec:ids` on the committed SPEC.md 0.2.0, When run twice, Then `specs/requirement-ids.ts` and the lock are byte-identical (CI `git diff --exit-code`) — CI stage `req-coverage`.

**Observability.** Script output only; `reports/req-coverage.json` is the audit artifact for SPEC §28 rule 5.

**Implementation clarification (plan 1.2.0).** `--baseline-lock <path>` compares removals and effective-level downgrades against a lock obtained from the trusted PR base revision, even when the current worktree lock has been regenerated. CI supplies that file from Git rather than trusting a PR-authored baseline. `--check-lock` validates before any write. Metadata `--check` modes do not mutate generated files or reports. CI invokes `--reports-only` after the full test stages; the ordinary coverage CLI can run its test producers when reports-only is absent. Unknown flags, missing option values, unknown gates and missing/duplicate requirement owners fail configuration validation.

### 4.6 Security & observability baseline — bounded context `presentation shell / CI`

**Objective.** Every HTTP response carries the house security headers; secrets cannot reach git or the client bundle; SAST/SCA/license/secret scanning run on every PR; production logs are structured.

**Contracts.** Headers are set in `proxy.ts` (Next.js 16 naming; `middleware.ts` if the pinned version is 15) for the CSP with a per-request nonce, and in `next.config.ts` `headers()` for the static ones, applied to `/(.*)` including `/api/*` and 404 responses:

| Header                       | Value (production)                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security`  | `max-age=63072000; includeSubDomains; preload`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Content-Security-Policy`    | `default-src 'self'; script-src 'self' 'nonce-<nonce>' 'strict-dynamic'; style-src 'self' 'nonce-<nonce>'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` (development only adds `'unsafe-eval'` to `script-src` and `'unsafe-inline'` to `style-src`; never in `NODE_ENV=production`) |
| `X-Content-Type-Options`     | `nosniff`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `X-Frame-Options`            | `DENY`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Permissions-Policy`         | `microphone=(self), camera=(), geolocation=(), payment=(), usb=()`                                                                                                                                                                                                                                                                                                                                                                                                   |
| `Cross-Origin-Opener-Policy` | `same-origin`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `X-DNS-Prefetch-Control`     | `off`                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Supply-chain and scanning files: `.gitleaks.toml` (default rules + allow-list for `sk-canary-` test fixtures), `lefthook.yml` (pre-commit: `gitleaks protect --staged`, `eslint --fix` on staged, `prettier`), `.github/workflows/ci.yml`, `.github/workflows/codeql.yml` (`javascript-typescript`), `.github/workflows/nightly.yml` (perf probe placeholder, `pnpm audit`), `.github/workflows/weekly.yml` (gitleaks full history, cross-browser smoke), `.github/dependabot.yml` (npm + github-actions, weekly, grouped minor/patch), `scripts/bundle-secret-scan.ts`, `scripts/license-check.ts` (allow-list: `MIT`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `0BSD`, `CC0-1.0`, `Unlicense`, `MPL-2.0` (review), `Python-2.0`; anything else or `UNKNOWN` fails). All Actions pinned to commit SHAs; workflow `permissions: { contents: read }` by default; `pull_request` for PR validation (never `pull_request_target`), plus `push` on `main` and `workflow_dispatch` for the trusted baseline and recorded CI runs; `concurrency: cancel-in-progress`.

`scripts/bundle-secret-scan.ts`: after `next build`, scans browser-delivered `.next/static/**/*.{js,css,map}`; client-reference manifests are used for reachability analysis, while server-only page bundles are not treated as browser artifacts for the canary value (`ORB_BUNDLE_CANARY`, injected by CI as `sk-canary-<16 hex>`), non-empty secret values selected by explicit secret-name rules or an allow-list (never arbitrary values such as PATH, NODE_ENV or a one-character flag), and patterns `sk-[A-Za-z0-9-]{20,}`, `sk-proj-`, `sk-ant-`, `AIza[0-9A-Za-z_-]{35}`; any hit → exit 1 with file + offset (value never printed).

**Reviewed package approvals (plan 1.2.0).** In addition to the general allow-list, the checker accepts only the exact package/version/license/license-file hash approvals in `specs/dependency-license-approvals.json`, with attribution and preserved license text required. Initial approvals are `caniuse-lite@1.0.30001810` (`CC-BY-4.0`) and `minimatch@10.2.6` (`BlueOak-1.0.0`), reviewed in [dependency-licenses.md](../../docs/reference/dependency-licenses.md). A changed tuple or missing evidence fails; this does not add either license to the general allow-list. Tests cover exact acceptance, changed version/hash and unrelated-package rejection.

**Implementation clarification (plan 1.2.0).** The E2E job consumes the same production-build artifact that passed the bundle scan; it does not silently rebuild different output. The generated non-secret canary is forwarded to the scan job. PR base requirement locks come from the base commit, with a baseline-SPEC bootstrap for the initial repository that has no lock yet. Diagnostic artifacts include the JSON reports and retained browser traces/videos. Main-branch and explicit dispatch runs provide the hosted evidence required by G0.

**Behavior.** CI stage list (analyze_tests §3.1; stages 1–4 and 9–11 run in parallel, 5 → 6 → 7 → 8 sequential; PRs cannot merge on a red blocking stage):

| #   | Stage              | Command / tool                                                                                                                                   | Blocking |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 0   | setup              | Node 22, `pnpm install --frozen-lockfile`, cache pnpm + Playwright browsers + `.next/cache`; `pnpm exec playwright install --with-deps chromium` | yes      |
| 1   | lint + format      | `eslint .` (rules of 4.1), `prettier --check`                                                                                                    | yes      |
| 2   | typecheck          | `tsc --noEmit`; `pnpm spec:ids --check` (generated union unchanged)                                                                              | yes      |
| 3   | architecture       | `pnpm arch` (also inside Vitest)                                                                                                                 | yes      |
| 4   | unit + integration | `vitest run --coverage --reporter=json`; thresholds of 4.1; fast-check `numRuns` 200                                                             | yes      |
| 5   | build              | `next build` with `ORB_BUNDLE_CANARY` injected and an otherwise empty env                                                                        | yes      |
| 6   | bundle-secret-scan | `tsx scripts/bundle-secret-scan.ts`                                                                                                              | yes      |
| 7   | e2e                | `playwright test` (swiftshader + nowebgl projects) against `next start`, scrubbed env, `NEXT_PUBLIC_ORB_SEED=1`, artifacts uploaded              | yes      |
| 8   | req-coverage       | `tsx scripts/req-coverage.ts --reports-only --check-lock`                                                                                        | yes      |
| 9   | SAST               | CodeQL `javascript-typescript` (fail on high); `eslint-plugin-security` runs in stage 1                                                          | yes      |
| 10  | SCA + license      | `pnpm audit --audit-level=high`; `tsx scripts/license-check.ts`; Dependabot PRs                                                                  | yes      |
| 11  | secrets            | `gitleaks detect --redact` on the PR range; full history weekly                                                                                  | yes      |
| 12  | perf-probe         | `playwright test --project=perf` (nightly and on label `perf-impact`; placeholder until Wave 2)                                                  | no       |
| 13  | cross-browser      | Playwright `webkit`, `firefox` smoke (weekly)                                                                                                    | no       |

Budget (recorded in `docs/reference/ci-budget.md` after 10 runs): PR wall clock ≤ 15 min; e2e ≤ 4 min; CodeQL ≤ 8 min in parallel.

**Edge cases.**

- Next injects a nonce-less inline `<style>` (e.g. `next/font`) → fall back to `style-src 'self' 'unsafe-hashes' 'sha256-…'` with the listed hashes, never `'unsafe-inline'`; documented in `docs/explanation/security-headers.md`.
- Fork PRs have no secrets → the canary is generated inside the job (`openssl rand -hex 16`), not a repository secret, so stage 6 runs on forks too.
- `pnpm audit` flags a dev-only transitive with no fix → time-boxed entry in `.pnpm-audit-ignore.json`-equivalent (`pnpm audit --ignore`), issue link required, reviewed monthly.
- `minimum-release-age` blocks a security patch younger than 7 days → explicit `pnpm add <pkg>@<ver> --config.minimum-release-age=0` in a PR labelled `security`, noted in CHANGELOG.

**Acceptance criteria.**

- Given the production server, When `/`, `/smoke/points?debug=1` and `/does-not-exist` are requested, Then every response carries all headers in the table with the exact values (nonce non-empty, unique per request) and the page's scripts execute with zero CSP violation reports — `tests/e2e/security-headers.spec.ts`.
- Given a fixture bundle containing `sk-canary-deadbeef…`, When the scan runs, Then exit 1 naming the file; given a clean bundle, exit 0; given `NEXT_PUBLIC_API_KEY` in env, exit 1 — ORB-SEC-001 (touched); `tests/unit/scripts/bundle-secret-scan.test.ts`.
- Given a fixture dependency with license `GPL-3.0`, When `license-check` runs, Then exit 1 — `tests/unit/scripts/license-check.test.ts`.
- Given a staged file containing an OpenAI-shaped key, When `git commit` runs with hooks installed, Then gitleaks blocks it — manual check recorded in CONTRIBUTING (hook install is verified by `lefthook run pre-commit` in CI stage 11).

**Observability.** Logger (4.2) is the only sink for server logs; `orb.security.csp_violation` is reserved for a future `report-to` endpoint (not in V1). CI artifacts: `reports/*.json`, Playwright traces, CodeQL SARIF.

### 4.7 Open-source hygiene — bounded context `repo root / docs`

**Objective.** The repository is safe and unambiguous to contribute to on day one: license, conduct, contribution rules that encode SPEC §28, security disclosure, templates, ownership and changelog.

**Contracts.** Files (all at the paths shown):

| File                                                                                                                                            | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LICENSE`                                                                                                                                       | Apache License 2.0 verbatim; `NOTICE` with project name and copyright line                                                                                                                                                                                                                                                                                                                                                                                                       |
| `CONTRIBUTING.md`                                                                                                                               | setup (`pnpm`, Node 22, `pnpm lefthook install`, Playwright install), branch/commit conventions (Conventional Commits, `feat/…`), **spec-driven PR checklist** (below), DCO sign-off (`git commit -s`, U-4 default; CLA is an open decision), how to add a requirement ID (`pnpm spec:ids`), how to add an ADR (`docs/adr/0000-template.md`), test conventions (`req()`, seeds, no `sleep`)                                                                                      |
| `SECURITY.md`                                                                                                                                   | supported versions, private disclosure channel (GitHub private vulnerability reporting), 90-day coordinated disclosure, what is in scope (SVG parser, gateway, headers), what is not (demo mock data)                                                                                                                                                                                                                                                                            |
| `CODE_OF_CONDUCT.md`                                                                                                                            | Contributor Covenant 2.1 with the maintainer contact                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `.github/PULL_REQUEST_TEMPLATE.md`                                                                                                              | checklist: requirement IDs touched · SPEC.md updated if normative behaviour changed (§28 r4) · new normative behaviour has a stable ID and `pnpm spec:ids` was run (r3) · tests reference IDs (r5) · no requirement weakened, or weakening is explicit with `spec-change` label + CHANGELOG `### Spec` (r6) · intentional deviations listed (r7) · ADR added/updated if architectural · threat model updated if attack surface changed · no secrets in diff · commits signed off |
| `.github/ISSUE_TEMPLATE/{bug_report,feature_request,spec_change}.yml` + `config.yml`                                                            | `spec_change` requires: affected IDs, proposed level, rationale, migration                                                                                                                                                                                                                                                                                                                                                                                                       |
| `.github/CODEOWNERS`                                                                                                                            | `SPEC.md`, `specs/`, `.dependency-cruiser.cjs`, `eslint.config.mjs`, `.github/`, `adapters/`, `app/api/`, `assets/formations/`, `LICENSE`, `SECURITY.md` → maintainer                                                                                                                                                                                                                                                                                                            |
| `CHANGELOG.md`                                                                                                                                  | keep-a-changelog; `## [Unreleased]` with `### Added / Changed / Security / Spec`                                                                                                                                                                                                                                                                                                                                                                                                 |
| `docs/{tutorials,how-to,reference,explanation}/README.md`, `docs/adr/0000-template.md`, `docs/adr/README.md`, `docs/security/threats/README.md` | Diátaxis skeleton; ADR template in Nygard format with `Status: proposed \| accepted \| superseded`                                                                                                                                                                                                                                                                                                                                                                               |
| `docs/adr/0001-…0004-*.md`                                                                                                                      | see §8                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `README.md`                                                                                                                                     | not rewritten in Wave 0; only the "Getting started" commands and a link to `SPEC.md` 0.2.0 and `specs/` are verified by the hygiene test                                                                                                                                                                                                                                                                                                                                         |

**Behavior.** `tests/unit/repo/hygiene.test.ts` asserts presence and key contents; CODEOWNERS is enforced by branch protection (`main`: PR required, CI green, 1 review, no force-push) — configured by the maintainer and recorded in `docs/reference/branch-protection.md`.

**Edge cases.**

- README claims a command that does not exist in `package.json` → hygiene test fails (README commands are cross-checked against `scripts`).
- CHANGELOG lacks `[Unreleased]` → hygiene test fails (req-coverage relies on it for §28 rule 6).

**Acceptance criteria.**

- Given the repository, When the hygiene test runs, Then `LICENSE` contains "Apache License" and "Version 2.0", `package.json.specVersion` equals the `**Version:**` header of `SPEC.md`, README references `SPEC.md`, the PR template contains every §28 checklist line, and every file in the table exists — SPEC §26 bullet 16; `tests/unit/repo/hygiene.test.ts`.

**Observability.** None.

### 4.8 Spec amendment PR — bounded context `specs`

**Objective.** `SPEC.md` moves from 0.1.0 to 0.2.0 by applying `specs/SPEC-amendments-proposal.md` in a single reviewed PR labelled `spec-change`, so that every later wave implements text with a stable ID and no ambiguity is decided ad hoc in code.

**Contracts.** The PR (title `docs(spec): amend SPEC.md to 0.2.0 (requirement IDs, Appendix A, provenance)`) contains exactly:

1. `SPEC.md` header `**Version:** 0.2.0`; `**Status:** Draft` unchanged; a `## 30. Changelog` entry "0.2.0 — amendments per specs/SPEC-amendments-proposal.md".
2. New IDs with canonical numbering from WAVE_ASSIGNMENT, each as a bullet `- **ORB-XXX-NNN** — …` in its section: ORB-STATE-006/007/008, ORB-VISUAL-001/002, ORB-RENDER-007/008, ORB-PERF-006, ORB-FORM-008/009/010/011, ORB-SVG-005/006, ORB-EVENT-006/007/008/009, ORB-GOV-007/008/009/010, ORB-TOOLVIS-001/002/003, ORB-ADAPTER-007, ORB-AUDIO-005, ORB-POINTER-001/002/003/004, ORB-DEMO-006, ORB-PLAY-001/002, ORB-API-001/002/003/004, ORB-A11Y-006/007, ORB-SEC-008 (41 IDs; the proposal file is authoritative for their text).
3. Appendix A — the normative 9 × 14 transition table (A-01), provenance `source` field and authoritative-event definition (A-02), dwell/persistence (A-03), single active operation + FIFO queue (A-04), arrival-order processing (A-05), denial → idle (A-06), MODEL_COMPLETED → idle (A-07), hybrid barge-in (A-08), ERROR during waiting_approval (A-09), approvalStatus on the operation (A-10), `setState` = manual provenance (A-11), approval channel (A-12), FormationId registry with `gate` and `generic-tool` (A-13), server scope (A-14, U-1 default), reduced-motion definition (A-15), particle-count change (A-16), sampling seed (A-17), SVG limits (A-18).
4. Duplicate IDs kept as aliases with a one-line cross-reference (STATE-004≈GOV-003, SEC-001≈ADAPTER-003, GOV-005≈SEC-003, RENDER-004≈FORM-006, EVENT-003≈ADAPTER-004); tests reference the primary.
5. No existing requirement text weakened: the `--check-lock` diff of the PR shows only additions (levels of the 73 pre-existing IDs unchanged); the reviewer confirms in the PR.
6. `pnpm spec:ids` output committed: `specs/requirement-ids.lock` (`spec-version: 0.2.0`, 114 IDs = 73 + 41) and `specs/requirement-ids.ts`; `package.json.specVersion = "0.2.0"`; `CHANGELOG.md` `### Spec` entry; `specs/requirements.overrides.yaml` with the Wave 0 waiver pattern and an empty `provisional` list (every unnumbered clause either received an ID or is declared informative in the proposal).
7. Open decisions U-1 … U-5 recorded in `specs/SPEC-amendments-proposal.md` with their assumed defaults; the SPEC text marks U-2 (transport) and U-3 (SVG upload location) as "default, pending".

**Behavior.** The PR merges before any test referencing a new ID (`req('ORB-FORM-011')` fails `tsc` until the union contains it). Merge order inside Wave 0: 4.1 (scaffold uses the current 0.1.0 specVersion and only existing-ID tests) → 4.5 (tooling built against 0.1.0 IDs) → 4.8 (review/adopt 0.2.0) → regenerate → remaining tests. The package excerpt and complete `ci:local` gate describe G0, not a requirement that slice 4.1 already contain later slices. No new-ID test or 0.2.0 package claim lands before 4.8.

**Edge cases.**

- The proposal and WAVE_ASSIGNMENT numbering disagree → WAVE_ASSIGNMENT wins (curated list); the proposal is corrected in the same PR.
- An amendment would lower a level → not allowed in this PR (SPEC §28 rule 6); open a `spec_change` issue instead.

**Acceptance criteria.**

- Given the merged PR, When `pnpm spec:ids && git diff --exit-code specs/` runs, Then no diff — CI stage 2.
- Given the lock from 0.1.0 and SPEC.md 0.2.0, When `req-coverage --check-lock` runs, Then 0 removed IDs and 0 level downgrades — `tests/unit/scripts/req-coverage.test.ts` (fixture pair 0.1.0/0.2.0) + CI.
- Given `SPEC.md` 0.2.0, When parsed, Then every ID in WAVE_ASSIGNMENT's owned lists (waves 0–8) exists exactly once — `tests/unit/specs/wave-ownership.test.ts` (reads `specs/waves/*.md` §3 tables; each ID owned by exactly one wave).

**Observability.** None.

## 5. Parallel tracks

- Track A (day 1): 4.1 scaffold. Everything else branches from it.
- Track B (after 4.1, concurrent): 4.2 core kernel · 4.3 architecture guard · 4.6 headers + scanning · 4.7 hygiene files.
- Track C (after 4.1 + CSP of 4.6): 4.4 WebGL smoke — needs the nonce middleware to prove CSP + Three coexist.
- Track D (after 4.1): 4.5 tooling built against SPEC 0.1.0; 4.8 amendment PR written in parallel by the spec editor; 4.5 regenerates after 4.8 merges.
- Integration point: `.github/workflows/ci.yml` — the last PR of the wave turns every stage blocking and records the budget.

## 6. Threat model delta (STRIDE)

| Surface                                 | S   | T   | R   | I   | D   | E   | Mitigation                                                                                                                                                                                                       | Req IDs                               |
| --------------------------------------- | --- | --- | --- | --- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Supply chain (npm deps, postinstall)    | –   | ✓   | –   | ✓   | ✓   | ✓   | committed lockfile + `--frozen-lockfile`; `minimum-release-age` 7 d; `ignore-scripts`; exact pins for `three`, `@react-three/fiber`, `next`; Dependabot; `pnpm audit` high; license allow-list                   | ORB-FORM-007 (h1, h6)                 |
| CI workflows (`GITHUB_TOKEN`, fork PRs) | ✓   | ✓   | ✓   | ✓   | –   | ✓   | Actions pinned to SHAs; `permissions: contents: read`; `pull_request` only; CODEOWNERS on `.github/`; branch protection; canary generated in-job (no secrets to forks)                                           | h5                                    |
| Secrets in git / bundle                 | –   | –   | –   | ✓   | –   | –   | gitleaks pre-commit + CI + weekly history; `.env*` gitignored, `.env.example` only; env schema server/client split, server-only guard and a client-safe public-config projection; bundle canary scan after build | ORB-SEC-001 (touched; h3, c1)         |
| HTTP responses (all routes)             | –   | ✓   | –   | ✓   | –   | ✓   | headers of 4.6: nonce CSP with `strict-dynamic`, `frame-ancestors 'none'` (approval-control clickjacking, c5), `Permissions-Policy: microphone=(self)` (f4), HSTS, nosniff                                       | ORB-A11Y-002, ORB-AUDIO-001 (touched) |
| Insecure code patterns merged           | –   | ✓   | –   | ✓   | –   | ✓   | ESLint bans (`innerHTML`, `eval`, `new Function`, `react/no-danger`), `eslint-plugin-security`, CodeQL; GLSL are static imports only                                                                             | ORB-SEC-004 (touched; h4)             |
| Smoke page + `__orbDebug`               | –   | –   | –   | ✓   | ✓   | –   | route 404 unless `ORB_SMOKE_ROUTES=1`; debug snapshot read-only and only with `?debug=1`; fixed 2 000 particles (no user-controlled count)                                                                       | ORB-RENDER-006 (touched; g1)          |
| Structured logger                       | –   | –   | ✓   | ✓   | –   | –   | key redaction, 120-char truncation, no provider payloads, correlationId propagation; `no-console` elsewhere                                                                                                      | house rule (§ Observability)          |
| Requirement coverage claims             | –   | ✓   | ✓   | –   | –   | –   | a test can claim an ID it does not prove: mitigated by review (PR template "tests reference IDs" + CODEOWNERS on `specs/`), lock file, and the per-wave gate review; not machine-provable                        | SPEC §28 r5                           |

Threat notes land in `docs/security/threats/ci-and-supply-chain.md` (this wave); later surfaces get their own file in their wave.

## 7. Tests

| Test (name references requirement IDs)                                                                                                                  | Type                              | Req IDs                    | File                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------- | ----------------------------------------------- |
| `req('ORB-ARCH-001','ORB-ARCH-002') repository has zero dependency-cruiser violations`                                                                  | arch                              | ORB-ARCH-001, ORB-ARCH-002 | `tests/unit/arch/boundaries.test.ts`            |
| `req('ORB-ARCH-001') fixture engine module importing 'openai' is reported`                                                                              | arch                              | ORB-ARCH-001               | `tests/unit/arch/boundaries.test.ts`            |
| `req('ORB-ARCH-002') fixture component importing adapters/openai/server is reported`                                                                    | arch                              | ORB-ARCH-002               | `tests/unit/arch/boundaries.test.ts`            |
| `smoke-page three exception is removed once ParticleSystem.impl.ts exists` (sunset guard)                                                               | arch                              | —                          | `tests/unit/arch/boundaries.test.ts`            |
| `req('ORB-FORM-011') mulberry32 golden vector and state-independent fork`                                                                               | unit + property                   | ORB-FORM-011               | `tests/unit/core/prng.test.ts`                  |
| `logger emits JSON lines, redacts secret-like keys, truncates to 120 chars, propagates correlationId`                                                   | unit                              | —                          | `tests/unit/core/logger.test.ts`                |
| `every EasingId maps 0→0, 1→1, is monotone and clamps`                                                                                                  | property                          | —                          | `tests/unit/core/easing.test.ts`                |
| `FakeScheduler fires in delay order; cancel is idempotent; FakeClock advances`                                                                          | unit                              | —                          | `tests/unit/core/clock-scheduler.test.ts`       |
| `Result helpers, isId, createIdFactory determinism, LIMITS frozen`                                                                                      | unit                              | —                          | `tests/unit/core/result-ids-limits.test.ts`     |
| `req('ORB-FORM-011') Math.random in engine/ is a lint error`                                                                                            | unit (ESLint API)                 | ORB-FORM-011               | `tests/unit/repo/eslint-rules.test.ts`          |
| `req('ORB-SEC-004') dangerouslySetInnerHTML and innerHTML assignment are lint errors`                                                                   | unit                              | ORB-SEC-004                | `tests/unit/repo/eslint-rules.test.ts`          |
| `req('ORB-SEC-001') process.env outside app/_lib/env.ts is a lint error`                                                                                | unit                              | ORB-SEC-001                | `tests/unit/repo/eslint-rules.test.ts`          |
| `req('ORB-DEMO-004') setTimeout in engine/ and events/ is a lint error`                                                                                 | unit                              | ORB-DEMO-004               | `tests/unit/repo/eslint-rules.test.ts`          |
| `req-coverage: uncovered MUST → 1; skipped test never covers; unknown ID → 1; expired waiver → 1; level downgrade without label → 1; emit-types stable` | unit                              | —                          | `tests/unit/scripts/req-coverage.test.ts`       |
| `req('ORB-SEC-001') bundle scan fails on canary / NEXT_PUBLIC_*KEY, passes on clean bundle`                                                             | unit                              | ORB-SEC-001                | `tests/unit/scripts/bundle-secret-scan.test.ts` |
| `license-check fails on GPL-3.0 fixture, passes on allow-listed set`                                                                                    | unit                              | —                          | `tests/unit/scripts/license-check.test.ts`      |
| `hygiene: LICENSE Apache-2.0, specVersion === SPEC header, README links SPEC, PR template has §28 checklist, files present`                             | unit                              | —                          | `tests/unit/repo/hygiene.test.ts`               |
| `every ID in SPEC.md 0.2.0 is owned by exactly one wave file`                                                                                           | unit                              | —                          | `tests/unit/specs/wave-ownership.test.ts`       |
| `@ORB-RENDER-001 smoke page renders 2 000 points under SwiftShader: frames > 0, no GL errors, no console errors`                                        | e2e                               | ORB-RENDER-001             | `tests/e2e/smoke.webgl.spec.ts`                 |
| `@ORB-RENDER-006 smoke page shows fallback region under --disable-webgl without uncaught errors`                                                        | e2e                               | ORB-RENDER-006             | `tests/e2e/smoke.webgl.spec.ts`                 |
| `security headers present with exact values on /, /smoke/points, 404; unique nonce; zero CSP violations`                                                | e2e                               | —                          | `tests/e2e/security-headers.spec.ts`            |
| `req('ORB-ARCH-001','ORB-ARCH-002') pnpm arch exits 0`                                                                                                  | CI stage                          | ORB-ARCH-001, ORB-ARCH-002 | `.github/workflows/ci.yml` (stage 3)            |
| gitleaks blocks an OpenAI-shaped key at pre-commit                                                                                                      | manual (recorded in CONTRIBUTING) | —                          | `docs/reference/manual-verification.md`         |
| CI budget: 10 runs, p95 per stage, PR wall clock ≤ 15 min                                                                                               | benchmark                         | —                          | `docs/reference/ci-budget.md`                   |

Determinism: all randomness through `Prng` (`FC_SEED` printed on failure); fake timers via `FakeClock`/`FakeScheduler` from `tests/support/fakes/`; E2E against the production build with a scrubbed env, `NEXT_PUBLIC_ORB_SEED=1`, fixed 2 000 particles, `expect.poll` only (no `waitForTimeout`), one browser context per test; retries 1 with `flaky` status reported, quarantine after 2 occurrences/week (`test.fixme` + issue + date).

## 8. ADRs to record

- ADR-0001 — Framework-agnostic `OrbEngine` class with a thin React host: context — SPEC §22 imperative API vs §6 R3F; options — R3F-first, engine class + `useOrbEngine`/`<OrbCanvas>` host, hybrid; recommendation — engine class owns renderer/scene/rAF, React host is thin, R3F optional (`<primitive>`), satisfies ORB-RENDER-005 and extraction (ORB-API-003).
- ADR-0002 — Hand-rolled pure reducer + Zustand bridge only in `components/store`: context — §6 "Zustand or equivalent" vs deterministic, extractable state (ORB-STATE-001); options — XState, Redux, React context, pure `transition()` table + Zustand `useSyncExternalStore` bridge; recommendation — pure reducer with property tests; Zustand never inside `engine/`.
- ADR-0003 — Package boundary now, extraction later: context — SPEC §25 single layout vs future `@aisac/orbs` (U-5 default single package); options — pnpm workspace monorepo from day 1, single package with enforced boundary, no boundary; recommendation — single package, `engine/index.ts` sole surface, dependency-cruiser rules of 4.3, extraction at V1.0 is a folder move (Wave 8 rehearsal).
- ADR-0004 — Determinism & WebGL testing: context — CI has no GPU, timers and `Math.random` make tests flaky; options — real timers + pixel snapshots, injected `Clock`/`Scheduler`/`Prng` + SwiftShader smoke + `__orbDebug` semantic hooks; recommendation — the latter; pixel snapshots optional and non-blocking, never gates.

## 9. Deliverables

- Root: `package.json`, `pnpm-lock.yaml`, `.npmrc`, `.nvmrc` (`22`), `tsconfig.json`, `next.config.ts`, `proxy.ts` (CSP nonce), `eslint.config.mjs`, `.prettierrc`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `.dependency-cruiser.cjs`, `.gitleaks.toml`, `lefthook.yml`, `.gitignore`, `.env.example`, `LICENSE`, `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `SPEC.md` (0.2.0).
- `app/layout.tsx`, `app/page.tsx` (placeholder), `app/_lib/env.ts`, `app/smoke/points/{page.tsx,SmokePoints.tsx}` (temporary; removed in Wave 2).
- `core/{clock,scheduler,prng,result,logger,easing,ids,limits,index}.ts`.
- `specs/requirement-ids.lock`, `specs/requirement-ids.ts`, `specs/requirements.overrides.yaml`, `specs/SPEC-amendments-proposal.md` (applied), `specs/waves/wave-00-foundation.md` (this file).
- `scripts/{req-coverage,bundle-secret-scan,license-check}.ts`.
- `tests/support/{req.ts,fakes/fakeClock.ts,fakes/fakeScheduler.ts,fakes/memorySink.ts,e2e/consoleGuard.ts}`, `tests/fixtures/arch/violations/**`, `tests/fixtures/spec/{spec-0.1.0.md,spec-0.2.0.md,reports/*.json}`, `tests/fixtures/bundle/**`, `tests/unit/{arch,core,repo,scripts,specs}/**`, `tests/e2e/{smoke.webgl,security-headers}.spec.ts`.
- `.github/{workflows/{ci,codeql,nightly,weekly}.yml,dependabot.yml,CODEOWNERS,PULL_REQUEST_TEMPLATE.md,ISSUE_TEMPLATE/*}`.
- `docs/adr/{README.md,0000-template.md,0001-engine-shape.md,0002-state-management.md,0003-package-boundary.md,0004-determinism-and-webgl-testing.md}`, `docs/{tutorials,how-to,reference,explanation}/README.md`, `docs/reference/{ci-budget,branch-protection,manual-verification}.md`, `docs/explanation/security-headers.md`, `docs/security/threats/ci-and-supply-chain.md`.

## 10. Exit criteria (Gate G0)

**Implementation evidence (2026-09-14):** all locally reproducible checks passed from a clean source snapshot, including 82 unit/property tests and four browser cases. The installed pre-commit hook was verified separately after correcting its synthetic fixture. See [wave-00-validation.md](../../docs/reference/wave-00-validation.md). Hosted checks, main integration, repository protections and timing evidence remain pending; G0 is open.

1. `pnpm install --frozen-lockfile && pnpm ci:local` exits 0 on a fresh clone with an empty environment (Node 22) — CI run link in the gate PR.
2. `.github/workflows/ci.yml` stages 0–11 are blocking and green on `main`; stage 7 includes the SwiftShader smoke test with `frames > 0` and the `--disable-webgl` fallback test — `tests/e2e/smoke.webgl.spec.ts`.
3. `pnpm arch` reports 0 violations and `tests/unit/arch/boundaries.test.ts` passes, including the seeded-fixture negative cases — ORB-ARCH-001, ORB-ARCH-002.
4. `pnpm req:coverage --reports-only --check-lock` exits 0 with the Wave 0 waiver pattern; `tests/unit/scripts/req-coverage.test.ts` proves it exits 1 on a seeded uncovered MUST, an unknown ID, an expired waiver and a silent level downgrade.
5. `SPEC.md` is 0.2.0 on `main`; `specs/requirement-ids.lock` has `spec-version: 0.2.0` and 114 IDs; `pnpm spec:ids` produces no diff; `package.json.specVersion === "0.2.0"` — `tests/unit/repo/hygiene.test.ts`.
6. `tests/unit/specs/wave-ownership.test.ts` passes: every ID owned by exactly one wave file.
7. Security headers E2E green with the exact values of 4.6; bundle secret scan fails on the injected canary in a deliberately broken fixture and passes on the real build — `tests/e2e/security-headers.spec.ts`, `tests/unit/scripts/bundle-secret-scan.test.ts`, CI stage 6.
8. `core/**` coverage ≥ 90 % lines / 85 % branches (Vitest threshold enforced).
9. `LICENSE` (Apache-2.0), `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, PR/issue templates, CODEOWNERS, CHANGELOG, Diátaxis skeleton present — hygiene test.
10. ADR-0001 … ADR-0004 merged with `Status: accepted`.
11. `docs/reference/ci-budget.md` records per-stage p50/p95 over ≥ 10 runs and the PR wall clock ≤ 15 min (or a documented plan to reach it before G2).
12. Branch protection on `main` documented in `docs/reference/branch-protection.md` and active (screenshot or `gh api` output in the gate PR).

## 11. Risks, spikes and open questions

- Risk: SwiftShader flags drift between Chromium versions (`--enable-unsafe-swiftshader` required from ~M132) → spike in 4.4 on the pinned Playwright Chromium; the test asserts frames, not renderer strings; owner: ADR-0004.
- Risk: nonce CSP vs Next.js inline styles/`next/font` → spike in 4.6 against the production build; fallback `'unsafe-hashes'`, never `'unsafe-inline'` for scripts; owner: `docs/explanation/security-headers.md`.
- Risk: `ignore-scripts=true` breaks a dependency relying on postinstall (`sharp`, Playwright) → explicit install steps; allow-list per package via `pnpm.onlyBuiltDependencies` if unavoidable; owner: ADR-0003 note.
- Risk: `minimum-release-age` delays urgent security patches → documented override path (4.6 edge case); owner: SECURITY.md.
- Risk: req-coverage waiver pattern becomes a permanent escape hatch → the pattern has `waivedUntil` and each gate's exit criteria require narrowing it; `dead waiver` is a warning and `expired` is an error; owner: gate reviews.
- Risk: the `app/smoke` `three`/`core` exceptions outlives Wave 2 → sunset guard test in 4.3; owner: Wave 2.
- Open question Q-1 (user): DCO vs CLA (U-4) — Wave 0 ships DCO; switching to CLA later requires a bot and a CONTRIBUTING change.
- Open question Q-2 (spec-amendment): should the provider-SDK package regex become a normative list under ORB-ARCH-001 (so adding a provider is a `spec-change`)? Default: keep it in `.dependency-cruiser.cjs` with CODEOWNERS review.
- Q-3 resolved in the proposed boundary: `app/api/** → core/index.ts` is permitted for server logging/IDs; `app/smoke/** → core/index.ts` is a temporary W0 exception with the same W2 sunset as its Three.js import.
- Open question Q-4 (spec-amendment): SPEC §28 rules 3/5/7 and §26 bullet 16 have no requirement IDs by WAVE_ASSIGNMENT decision; the tooling covers them by review only — confirm this is acceptable for the V1 traceability matrix, or assign IDs in a later amendment.
- Open question Q-5 (user, U-5): single package confirmed as default; revisit only if a second deployable (e.g. docs site) appears before V1.

## 12. Playground and demo controls introduced

None. Wave 0 introduces only the conventions the playground will use: `?debug=1` exposes the read-only `window.__orbDebug` snapshot, `NEXT_PUBLIC_ORB_SEED` / `?seed=` seed the `Prng`, and `/smoke/points` exists solely for CI (404 unless `ORB_SMOKE_ROUTES=1`; deleted in Wave 2).
