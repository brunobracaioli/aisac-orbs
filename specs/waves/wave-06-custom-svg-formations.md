# Wave 6 — Custom SVG formations at runtime

| Field                     | Value                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**                | proposed                                                                                                                                                                                                                                                                                                                                                                             |
| **Milestones (SPEC §27)** | V0.8 SVG → particle formations                                                                                                                                                                                                                                                                                                                                                       |
| **Depends on**            | Wave 3 (`formations/svg/*` inert sampler `svgToFormation`, `FormationRegistry`, `FormationManager.registerFormation`, `definitionFromPoints`, `FormationError`), Wave 4 (`OrbEngine` public API + api snapshot, playground panels), Wave 0 (`core/limits` `LIMITS.svg*`, `core/prng`, `fnv1a32`, CSP `worker-src 'self' blob:` / `connect-src 'self'`)                               |
| **Spec version**          | SPEC.md 0.2.0 (0.1.0 + amendments A-13, A-15, A-17, A-18; user decision U-3) — see `specs/SPEC-amendments-proposal.md`                                                                                                                                                                                                                                                               |
| **Gate**                  | G6 — `registerFormation` accepts every `FormationSource` kind; malicious and oversized SVG is rejected with a typed `FormationError` while the render loop keeps advancing (no main-thread stall > 50 ms on the reference machine); seeded fuzz suites green; E2E pastes an SVG logo in the playground and the orb morphs to it; limits and error codes documented in reference docs |
| **Estimated size**        | M — the master plan estimated S; the sampler, registry and public API exist, but the Worker host, URL policy, cache, fuzz harness, playground form and docs are each a bounded but real deliverable                                                                                                                                                                                  |

## 1. Objective

After Wave 3 the engine turns only _bundled, trusted_ SVG (`assets/formations/*.svg`) into formations. This wave makes `OrbEngine.registerFormation(name, source)` accept, at runtime, raw coordinates, generator functions, inline SVG text and same-origin/allow-listed SVG URLs, each SVG source tagged `trusted` or `untrusted`. Untrusted input never runs on the main thread: the identical Wave 3 inert tokenizer executes inside a dedicated Web Worker with no network capability, under the A-18 resource limits and a 2 s timeout, and every failure surfaces as a `FormationError` with a stable lowercase code. A stakeholder can open `/playground`, paste, upload or link any SVG (including the hostile fixtures), watch the orb morph to it or read the exact rejection code, and follow `docs/how-to/custom-svg-formation.md` to do the same from their own app.

## 2. Scope

### 2.1 In scope

- `FormationSource` union handling for `Float32Array`, generator, `{ svg, trust }` and `{ url, trust }` (§4.1) with a source × trust handling matrix.
- `FormationError` code set extended (never renamed) from Wave 3; `registerFormation` rejects only with `FormationError`.
- Worker-hosted parsing: protocol, timeouts, queue limit, crash recovery, network disabled inside the worker (§4.2).
- A-18 limits (`LIMITS.svg*`, `SVG_LIMITS`) enforced on the main thread (bytes), in the parser (elements, commands, depth, points) and by the host (timeout) — ORB-SVG-006.
- URL policy for `{ url }` sources: same-origin or exact-origin allow-list, `credentials: 'omit'`, `redirect: 'error'`, content-type check, streamed byte cap, fetch timeout.
- Bounded content-hash parse cache per engine instance.
- Fuzz testing (fast-check) of the parser, the worker message handler and the URL policy, with a committed regression corpus.
- Playground custom-formation form (paste / file / URL) and `__orbDebug` additions; a11y label for custom formations.
- Docs: how-to, reference (matrix, limits, codes, worker protocol, URL rule), explanation, threat-model update.

### 2.2 Out of scope (deferred)

- Untrusted upload on the public demo page `/` (U-3: playground only) → Wave 8 decides whether the demo ever exposes it.
- Server-side fetching or proxying of formation URLs → never in V1 (SSRF surface; client-side fetch only).
- Mesh/GLB sampling, formation SDK, npm packaging of the sampler → post-V1 (SPEC §27 future candidates).
- `data:` / `blob:` URL sources → not accepted in V1 (callers pass the text as `{ svg }`); open question §11.
- Visual quality of contour-vs-fill sampling for logos (ORB-SVG-003) → Wave 3 sampler / Wave 8 polish; this wave only threads `depth`, `noise`, `fill`, `sampleCount` through.

## 3. Requirements owned by this wave

Every ID listed here is owned by this wave and must be fully satisfied and verified before the gate closes. These are planned obligations; no test evidence is implied. Shared declaration owners and integration rules are in `specs/SHARED-CONTRACTS.md`.

| ID           | Level                    | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Slice         | Verification              |
| ------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------- |
| ORB-FORM-003 | MUST                     | "Custom SVG formations MUST be supported." (§11) — runtime SVG text/file/URL becomes a registered formation the engine can morph to                                                                                                                                                                                                                                                                                                                                                                                       | 4.1, 4.2, 4.3 | unit + e2e                |
| ORB-SVG-002  | MUST                     | "Untrusted SVG MUST be sanitized or parsed as inert geometry." (§13) — untrusted sources are parsed only by the Wave 3 inert tokenizer, only inside a Worker, and yield a `Float32Array` and nothing else                                                                                                                                                                                                                                                                                                                 | 4.2           | unit + fuzz + e2e         |
| ORB-SVG-006  | MUST (new, amendments)   | "Untrusted SVG input MUST be rejected with a typed `FormationError` when it exceeds 2 MiB, 5 000 elements, 200 000 path commands, or 200 000 sampled points; DOCTYPE, entity declarations, `<script>`, `<foreignObject>`, `<use href>`, `<style>`, `on*` attributes and external references MUST be rejected or ignored without evaluation; parsing MUST run in a Web Worker with a 2 s timeout and MUST NOT fetch network resources unless the source is `{ url, trust }` and same-origin or explicitly allowed." (A-18) | 4.2           | unit + fuzz + e2e + perf  |
| ORB-API-002  | SHOULD (new, amendments) | "Custom formations SHOULD be registered with `registerFormation(name: string, source: FormationSource): Promise<FormationId>` …; untrusted sources MUST go through the Worker sampler; failures MUST reject with a typed `FormationError` and MUST NOT affect the running renderer." (§22)                                                                                                                                                                                                                                | 4.1           | unit + e2e + api snapshot |

Requirements touched but owned elsewhere: ORB-SVG-001, ORB-SVG-003, ORB-SVG-004, ORB-SVG-005, ORB-FORM-004, ORB-FORM-005, ORB-FORM-007, ORB-FORM-011, ORB-SEC-005 (Wave 3 — same sampler, same fixtures; this wave adds the runtime, Worker and URL paths); ORB-API-001 (Wave 4 — api snapshot gains the additions in §4.1); ORB-RENDER-005 (Wave 2 — the render loop is independent of parsing); ORB-A11Y-001 (Wave 1 — custom-formation label in the status region); ORB-PLAY-002 (Wave 4 — the form never touches governance); ORB-SEC-004 (Wave 1 — codes and warnings rendered as text); ORB-SEC-006 (Wave 7 — public demo exposes no upload); ORB-ARCH-001 (Wave 0 — worker imports only `core` + `formations/svg`).

## 4. Vertical slices

### 4.1 Public `registerFormation` and the source resolver — bounded context `formations` (domain) + `engine` (application)

**Objective.** One entry point turns any `FormationSource` into a Wave 3 `FormationDefinition` or a `FormationError`, deterministically, without aliasing caller memory or running caller code on the render path.

**Contracts.**

```ts
// core/limits.ts — keys ADDED to the Wave 0 `LIMITS` object (existing keys unchanged; A-18 values)
export const LIMITS = {
  /* Wave 0: …, svgBytesMax: 2_097_152, svgElementsMax: 5_000, svgPathCommandsMax: 200_000, svgSampledPointsMax: 200_000, svgParseTimeoutMs: 2_000, particlesHardMax: 200_000 */
  svgDepthMax: 64, // Wave 3 SvgLimits.maxDepth default, now a named constant
  svgSampleCountDefault: 32_768, // default `sampleCount`; must be ≤ svgSampledPointsMax
  svgWarningsMax: 256, // raw SvgWarning entries carried over the worker channel
  svgWorkerQueueMax: 8,
  svgWorkerStartTimeoutMs: 5_000,
  svgWorkerKillGraceMs: 500,
  svgFetchTimeoutMs: 5_000, // fetch byte cap is svgBytesMax
  svgCacheEntriesMax: 16,
  svgCacheBytesMax: 33_554_432,
  formationPointsMax: 200_000, // Float32Array / generator sources: length / 3 ≤ this
  generatorProbeCount: 64,
} as const;
```

```ts
// formations/svg/svgToFormation.ts — Wave 3 file; ADDED: a named default limits object and an optional abort hook
export const SVG_LIMITS: Required<SvgLimits> = {
  maxBytes: LIMITS.svgBytesMax,
  maxElements: LIMITS.svgElementsMax,
  maxPathCommands: LIMITS.svgPathCommandsMax,
  maxDepth: LIMITS.svgDepthMax,
  maxSampledPoints: LIMITS.svgSampledPointsMax,
};
// SvgSampleOptions gains `shouldAbort?: () => boolean` — polled every 100 elements, 1 000 path commands and 1 000 samples;
// `true` → Result error { code: 'LIMIT_EXCEEDED', detail: 'deadline' } (mapped to 'parse_timeout' by the host).
```

```ts
// formations/domain/Formation.ts — Wave 3 class; this wave ADDS codes and an optional structured third argument
export type FormationErrorCode =
  | 'invalid_shape' | 'non_finite' | 'count_mismatch' | 'unknown_formation' | 'duplicate_id' | 'invalid_id' | 'asset_rejected'  // Wave 3
  | 'unsupported_source'                                       // reserved in W4 for sources fulfilled here
  | 'invalid_source'                                            // none of the four kinds, or trust/depth/noise/fill/sampleCount invalid
  | 'svg_rejected'                                              // parser outcome; details.svgCode ∈ SvgParseError['code']
  | 'parse_timeout'                                             // A-18: cooperative deadline or hard kill at svgParseTimeoutMs
  | 'worker_unavailable' | 'worker_crashed' | 'queue_full'      // worker host
  | 'url_not_allowed' | 'fetch_failed' | 'unsupported_content_type'   // url sources
  | 'disposed';                                                 // engine disposed while the registration was pending
export type FormationErrorDetails = Readonly<Partial<{
  svgCode: SvgParseError['code']; limit: keyof SvgLimits | 'deadline' | 'queue' | 'fetchBytes' | 'formationPoints';
  actual: number; max: number; line: number; column: number; status: number; origin: string; from: 'worker' | 'inline' | 'fetch' | 'probe';
}>>;                                                            // numbers/enums/origin only — never SVG text, never a full URL, never a caller message
export class FormationError extends Error {
  constructor(readonly code: FormationErrorCode, detail?: string /* static English text */, readonly details?: FormationErrorDetails);
}
export function isFormationError(e: unknown): e is FormationError;
```

```ts
// formations/index.ts — the SHARED_CONTRACTS union; optional fields ADDED to both SVG members, nothing renamed
export type SvgTrust = "trusted" | "untrusted";
export interface SvgSourceOptions {
  depth?: number;
  noise?: number;
  sampleCount?: number;
  fill?: SvgSampleOptions["fill"];
}
// depth, noise ∈ [0, 1] (defaults 0.15 / 0.02 from Wave 3); sampleCount ∈ [1, LIMITS.svgSampledPointsMax] (default LIMITS.svgSampleCountDefault); fill.ratio ∈ [0, 0.8]
export interface SvgStringSource extends SvgSourceOptions {
  svg: string;
  trust: SvgTrust;
}
export interface SvgUrlSource extends SvgSourceOptions {
  url: string;
  trust: SvgTrust;
}
export type FormationSource =
  Float32Array | FormationDefinition["points"] | SvgStringSource | SvgUrlSource;
export type FormationSourceKind = "points" | "generator" | "svg" | "url";
export function classifySource(source: unknown): FormationSourceKind | null; // pure; null → 'invalid_source'
export interface SvgWarningSummary {
  code: SvgWarning["code"];
  name: string;
  count: number;
} // Wave 3 SvgWarning aggregated by (code, name)
export interface FormationInfo {
  id: FormationId;
  kind: FormationSourceKind | "builtin";
  trust: SvgTrust | null;
  pointCount: number;
  sha256: string | null;
  warnings: readonly SvgWarningSummary[];
  parseMs: number | null;
  registeredAt: number;
}
```

```ts
// engine/formation-sources/FormationSourceResolver.ts (application; Node-testable, everything injected)
export interface FormationSourceResolverDeps {
  parser: SvgParserPort | null; // §4.2; null → every svg/url source rejects 'worker_unavailable' (untrusted) or uses createInlineSvgParser (trusted)
  fetchFn: typeof fetch | null;
  origin: string | null;
  allowedOrigins: readonly string[];
  digest: ((bytes: Uint8Array) => Promise<string>) | null; // crypto.subtle SHA-256 hex; null in insecure contexts → cache disabled, sha256 null in info/logs
  cache: FormationCache;
  prng: Prng;
  clock: Clock;
  scheduler: Scheduler;
  logger: Logger;
}
export interface ResolvedSource {
  definition: FormationDefinition;
  info: Omit<FormationInfo, "id" | "registeredAt">;
}
export interface FormationSourceResolver {
  resolve(
    id: FormationId,
    source: FormationSource,
  ): Promise<Result<ResolvedSource, FormationError>>;
  dispose(): void;
}
export function createFormationSourceResolver(
  deps: FormationSourceResolverDeps,
): FormationSourceResolver;

// engine/formation-sources/FormationCache.ts — bounded LRU per engine instance; copies in and out (never aliases)
export interface FormationCacheKey {
  sha256: string;
  n: number;
  depth: number;
  noise: number;
  fill: string /* 'none' | 'even-odd:<ratio>' */;
  forbidden: "reject" | "drop";
}
export interface CachedParse {
  points: Float32Array;
  warnings: readonly SvgWarningSummary[];
}
export interface FormationCache {
  get(key: FormationCacheKey): CachedParse | null;
  set(key: FormationCacheKey, value: CachedParse): void;
  clear(): void;
  readonly size: number;
  readonly bytes: number;
}
export function createFormationCache(limits: {
  maxEntries: number;
  maxBytes: number;
}): FormationCache;
```

```ts
// engine/OrbEngine.ts — SHARED_CONTRACTS signature kept; one optional argument, two methods and two options ADDED (api snapshot updated; ORB-API-001 touched)
registerFormation(name: string, source: FormationSource, opts?: { override?: boolean }): Promise<FormationId>;   // rejects ONLY with FormationError
getFormationInfo(id: string): FormationInfo | null;          // null for unknown id; built-ins report kind 'builtin'
listFormations(): readonly FormationId[];                    // registry ids, built-ins first, then custom in registration order
// OrbEngineOptions gains: allowedFormationOrigins?: readonly string[] (default []; exact origins, no wildcards)
//                         svgParser?: SvgParserPort (tests/Node; default: worker parser when isWorkerAvailable(), else inline parser)
```

**Behavior.** `registerFormation(name, source, opts)` runs, in order: (1) `parseFormationId(name)` → `'invalid_id'`; built-in id (`BUILT_IN_FORMATIONS`, A-13) or already registered → `'duplicate_id'` unless `opts.override === true` (Wave 3 registry rule; override logged `orb.formation.registered { override: true }`); a name reserved by an in-flight registration → `'duplicate_id'` regardless of `override`; (2) synchronous reservation of the id (before any `await`); (3) `classifySource` → `'invalid_source'` if the value is none of the four kinds, `trust` is not one of the two literals, or `depth`/`noise`/`sampleCount`/`fill.ratio` are present but not finite numbers inside their ranges (never silently clamped); (4) per-kind resolution per the matrix; (5) success → `FormationManager.registerFormation(id, definition, { override })` (Wave 3), `FormationInfo` stored, `orb.formation.registered` logged, promise resolves with the branded `FormationId`; failure → reservation released, `orb.formation.rejected` logged, promise rejects with the `FormationError`. SVG points arrive already normalized and extruded by `svgToFormation` (ORB-FORM-004); `Float32Array` sources are normalized by `definitionFromPoints`. Resampling to the live particle count happens at resolve/morph time in the Wave 3 manager with `prng.fork(id)` (ORB-FORM-005, A-17). The SVG sampler's own prng seed is content-derived: `seed = fnv1a32(`${sha256}:${n}:${depth}:${noise}:${fill}`)` (or of the text when `digest` is null), so identical content and options parse byte-identically regardless of name, engine seed or thread (see §11 for the A-17 note).

**FormationSource handling matrix (source kind × trust → path).**

| Kind                               | Trust       | Runs on                                                               | Forbidden SVG content                                                                | Steps                                                                                                                                                                                                                                                                       | Codes possible                                                                                                                                           |
| ---------------------------------- | ----------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Float32Array`                     | n/a         | main thread, synchronous                                              | n/a                                                                                  | `length % 3 === 0`, `3 ≤ length ≤ 3·formationPointsMax`, all finite → copy → `definitionFromPoints` (normalize) → register                                                                                                                                                  | `invalid_shape` (incl. `details.limit 'formationPoints'`), `non_finite`                                                                                  |
| generator `(n, prng) => Formation` | n/a         | main thread: probe at registration; wrapped at every resolve          | n/a                                                                                  | probe with `n = generatorProbeCount`, `prng.fork('probe:' + id)`; `assertFormation(out, n)`; wrapper re-validates each call — on failure logs `orb.formation.generator_failed` once per id and returns the probe result resampled to `n` (never throws into the frame loop) | `invalid_shape`, `non_finite`, `count_mismatch` (all `details.from 'probe'`)                                                                             |
| `{ svg }`                          | `trusted`   | Worker when available, else inline on the calling thread              | `forbidden: 'reject'` → `svg_rejected` (`FORBIDDEN_ELEMENT` / `FORBIDDEN_ATTRIBUTE`) | encode → byte pre-check → digest → cache lookup → parse with `SVG_LIMITS` → re-validate result → cache store → `definitionFromPoints` (`is2D = depth === 0`) → register                                                                                                     | `svg_rejected`, `parse_timeout`, `queue_full`, `worker_crashed`, `disposed`                                                                              |
| `{ svg }`                          | `untrusted` | Worker **required**; no inline fallback                               | `forbidden: 'drop'` → geometry + `warnings`                                          | as above; `parser.kind !== 'worker'` → `worker_unavailable` before any parsing                                                                                                                                                                                              | same + `worker_unavailable`                                                                                                                              |
| `{ url }`                          | `trusted`   | main-thread `fetch` (async, injected), then the trusted `{ svg }` row | as trusted svg                                                                       | `decideFormationUrl` → `fetchSvgSource` → svg path                                                                                                                                                                                                                          | `url_not_allowed`, `fetch_failed`, `unsupported_content_type`, `svg_rejected` (`LIMIT_EXCEEDED`, `details.limit 'fetchBytes'`), then the trusted svg set |
| `{ url }`                          | `untrusted` | main-thread `fetch`, then the untrusted `{ svg }` row                 | as untrusted svg                                                                     | same                                                                                                                                                                                                                                                                        | same + `worker_unavailable`                                                                                                                              |

Trust changes exactly three things: the parser's `forbidden` mode (`'reject'` vs `'drop'`, ADR-0010), whether an inline fallback is permitted, and the `trust` field in info/logs. It never changes the element allow-list, the limits, or the URL rule (same for both trust levels, §4.2).

**Edge cases.**

- Same name registered twice concurrently → the second call rejects `'duplicate_id'` synchronously (reservation precedes any `await`).
- Registration fails after reservation (e.g. `parse_timeout`) → the name is released; a retry with the same name succeeds.
- Caller mutates the `Float32Array` after the promise resolves → the registered formation is unchanged (copied on ingest).
- `Float32Array` of length 0 or `length % 3 !== 0` → `'invalid_shape'`; any `NaN`/`±Infinity` → `'non_finite'`; `length / 3 > formationPointsMax` → `'invalid_shape'` with `details { limit: 'formationPoints', actual, max }`.
- Generator returns the wrong length at probe → `'count_mismatch'`; at resolve time → substitution + one log, never a throw.
- `sampleCount` omitted → `LIMITS.svgSampleCountDefault`; `sampleCount > svgSampledPointsMax`, `depth: 2`, `noise: -1`, `fill: { mode: 'even-odd', ratio: 0.9 }` → `'invalid_source'` with `details { limit, actual, max }`.
- `depth: 0` → every `z === 0` and `is2D: true` on the definition.
- `registerFormation` after `dispose()` → immediate `'disposed'`; pending registrations settle `'disposed'` when `dispose()` runs; the worker is terminated.
- Same SVG text and options under two names → second registration is a cache hit (`orb.formation.cache_hit`), no worker round-trip, byte-identical points; different `depth`/`noise`/`sampleCount`/`fill` → cache miss.
- Any non-`FormationError` thrown inside the resolver (bug) → wrapped as `FormationError('worker_crashed' | 'unsupported_source'                                       // reserved in W4 for sources fulfilled here
| 'invalid_source')` with the original as `cause`; the public promise rejects with a `FormationError` only.
- `getFormationInfo('sphere')` → `{ kind: 'builtin', trust: null, sha256: null, parseMs: null, warnings: [], pointCount: <current N> }`; `getFormationInfo('nope')` → `null` (no throw).
- `override: true` on a built-in id → registered, logged; the a11y label (§4.3) still reports the built-in id, so a replaced `gate` visual cannot claim approval semantics (ORB-SEC-003).

**Acceptance criteria.**

- Given a benign inline SVG with `trust: 'untrusted'` and a `FakeWorker` parser, When `registerFormation('my-logo', source)` is awaited, Then it resolves with `FormationId 'my-logo'`, `getFormationInfo('my-logo')` reports `kind 'svg'`, `trust 'untrusted'`, `pointCount === sampleCount`, `listFormations()` ends with `'my-logo'`, and `morphTo('my-logo')` completes with `MorphOutcome 'completed'` — ORB-FORM-003, ORB-API-002 — `tests/unit/engine/registerFormation.test.ts`.
- Given a `Float32Array` of 300 finite floats, When registered, Then the definition's points lie within the unit sphere (`isWithinUnitSphere`) and mutating the caller's array afterwards changes nothing — ORB-API-002, ORB-FORM-004 — `tests/unit/engine/formation-sources/FormationSourceResolver.test.ts`.
- Given each invalid input (name `'Sphere'`, name `'sphere'`, `trust: 'yes'`, `depth: 2`, `sampleCount: 300000`, `length % 3 !== 0`, `NaN`), When registered, Then the promise rejects with `FormationError` codes `'invalid_id'`, `'duplicate_id'`, `'invalid_source'`, `'invalid_source'`, `'invalid_source'`, `'invalid_shape'`, `'non_finite'` respectively, and nothing is registered — ORB-API-002 — same file.
- Given two concurrent registrations of `'dup'` started in the same tick, When both settle, Then exactly one resolves and the other rejects `'duplicate_id'` — ORB-API-002 — same file.
- Given a generator that returns `NaN` on its third call, When the manager resolves it three times, Then no call throws, every result is finite and `orb.formation.generator_failed` is logged exactly once — ORB-API-002, ORB-RENDER-005 — same file.
- Given the same SVG registered as `'a'` then `'b'`, When both resolve, Then `Buffer.compare(a, b) === 0`, the parser was invoked once and `cache.size === 1`; Given 17 distinct SVGs, Then `cache.size === 16` and the first key is evicted — ORB-FORM-005, ORB-API-002 — `tests/unit/engine/formation-sources/FormationCache.test.ts`.
- Given an engine with two pending registrations, When `dispose()` runs, Then both reject `'disposed'` and `terminate()` was called once — ORB-API-002 — `tests/unit/engine/registerFormation.test.ts`.

**Observability.** `orb.formation.registered { id, kind, trust, sha256, pointCount, parseMs, warningCount, cacheHit, override }`; `orb.formation.rejected { id, kind, trust, code, details }`; `orb.formation.cache_hit { sha256 }`; `orb.formation.generator_failed { id, code }`. `correlationId` attached when an operation is active. Never logs SVG text, URLs beyond `origin`, or caller-provided strings.

### 4.2 Untrusted path: Worker host, limits, URL policy, fuzz — bounded context `formations/svg` (worker entry, pure handler) + `engine/formation-sources` (infrastructure)

**Objective.** Untrusted SVG is parsed off the main thread by the exact Wave 3 tokenizer, bounded by `SVG_LIMITS` and a host-enforced timeout, with no network capability inside the worker; every outcome is a typed `Result`.

**Contracts.**

```ts
// formations/svg/worker/protocol.ts (pure types + hand-written guards; no zod in the worker bundle)
export const SVG_WORKER_PROTOCOL_VERSION = 1 as const;
export interface SvgParseOptions {
  n: number;
  depth: number;
  noise: number;
  fill?: SvgSampleOptions["fill"];
  forbidden: "reject" | "drop";
  seed: number;
  limits: SvgLimits;
  deadlineMs: number; /* = LIMITS.svgParseTimeoutMs */
}
export interface SvgParseStats {
  bytes: number;
  elements: number;
  pathCommands: number;
  sampledPoints: number;
  parseMs: number;
}
export type SvgWorkerRequest = {
  v: 1;
  kind: "parse";
  jobId: string;
  bytes: Uint8Array;
  options: SvgParseOptions;
}; // bytes.buffer is transferred, not cloned
export type SvgWorkerResponse =
  | { v: 1; kind: "ready"; networkDisabled: true }
  | {
      v: 1;
      kind: "result";
      jobId: string;
      points: Float32Array;
      warnings: SvgWarning[];
      stats: SvgParseStats;
    } // points.buffer transferred; warnings.length ≤ LIMITS.svgWarningsMax
  | {
      v: 1;
      kind: "error";
      jobId: string;
      error: { code: SvgParseError["code"]; detail?: string; line: number; column: number };
    }
  | { v: 1; kind: "crashed"; jobId: string }; // handler caught a throw (bug); never carries a message
export function isSvgWorkerRequest(x: unknown): x is SvgWorkerRequest;
export function isSvgWorkerResponse(x: unknown): x is SvgWorkerResponse;

// formations/svg/worker/handler.ts (pure; unit-tested in Node with the real svgToFormation)
export function handleSvgWorkerMessage(
  data: unknown,
  post: (msg: SvgWorkerResponse, transfer?: ArrayBuffer[]) => void,
  deps: { now: () => number },
): void;
// unknown/invalid message → ignored (no response, no throw). 'parse' → TextDecoder (fatal: true; invalid UTF-8 → error MALFORMED_XML)
// → svgToFormation(text, { n, prng: createPrng(seed), depth, noise, fill, forbidden, limits, shouldAbort: () => now() - start > deadlineMs })
// → 'result' (Float64 → Float32 copy, transferred) or 'error' (SvgParseError verbatim); any throw → 'crashed'.

// formations/svg/worker/svg.worker.ts — DedicatedWorkerGlobalScope entry; imports ONLY core/** and formations/svg/**
// disableNetwork(self) — replaces fetch, XMLHttpRequest, WebSocket, EventSource, importScripts, navigator.sendBeacon with throwing stubs
// self.postMessage({ v: 1, kind: 'ready', networkDisabled: true }); self.onmessage = (e) => handleSvgWorkerMessage(e.data, post, { now: performance.now })
```

```ts
// engine/ports/SvgParserPort.ts (pure interface)
export interface SvgParseJob {
  bytes: Uint8Array;
  options: SvgParseOptions;
}
export interface SvgParseSuccess {
  points: Float32Array;
  warnings: readonly SvgWarning[];
  stats: SvgParseStats;
}
export interface SvgParserPort {
  readonly kind: "worker" | "inline";
  parse(job: SvgParseJob): Promise<Result<SvgParseSuccess, FormationError>>;
  dispose(): void;
}

// engine/formation-sources/WorkerSvgParser.ts — the ONLY module in the repository that references `Worker`
export interface WorkerLike {
  postMessage(msg: unknown, transfer?: ArrayBuffer[]): void;
  terminate(): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onmessageerror: ((e: unknown) => void) | null;
}
export interface WorkerSvgParserOptions {
  createWorker: () => WorkerLike;
  scheduler: Scheduler;
  clock: Clock;
  logger: Logger;
  maxPending: number;
  startTimeoutMs: number;
  killGraceMs: number;
}
export function createWorkerSvgParser(opts: WorkerSvgParserOptions): SvgParserPort;
export function isWorkerAvailable(): boolean; // typeof Worker === 'function'
export function defaultCreateWorker(): WorkerLike; // new Worker(new URL('../../formations/svg/worker/svg.worker.ts', import.meta.url), { type: 'module', name: 'orb-svg-parser' })
// engine/formation-sources/InlineSvgParser.ts — runs handleSvgWorkerMessage on the calling thread; kind 'inline'; trusted sources only
export function createInlineSvgParser(deps: { clock: Clock }): SvgParserPort;

// engine/formation-sources/urlPolicy.ts (pure)
export type UrlDecision =
  | { ok: true; url: URL; mode: "same-origin" | "cors" }
  | { ok: false; error: FormationError /* 'url_not_allowed' */ };
export function decideFormationUrl(
  input: string,
  ctx: { origin: string | null; allowedOrigins: readonly string[] },
): UrlDecision;
// engine/formation-sources/fetchSvgSource.ts (fetch injected; abort via Scheduler)
export function fetchSvgSource(
  target: { url: URL; mode: "same-origin" | "cors" },
  deps: { fetchFn: typeof fetch; scheduler: Scheduler; maxBytes: number; timeoutMs: number },
): Promise<Result<Uint8Array, FormationError>>;
```

**Behavior — Worker protocol and lifecycle.** One worker per `OrbEngine`, created lazily on the first job (`orb.svg.worker_spawned`); the host waits for `ready` for at most `svgWorkerStartTimeoutMs`, else terminates and rejects `'worker_unavailable'`. Jobs are FIFO; a queue already holding `svgWorkerQueueMax` jobs rejects new ones with `'queue_full'` immediately. Each job gets `jobId` from `createIdFactory(prng, 'svg')`, `options.deadlineMs = LIMITS.svgParseTimeoutMs` (cooperative, inside the worker) and a hard host timer of `svgParseTimeoutMs + svgWorkerKillGraceMs` (injected `Scheduler`): on expiry the host calls `terminate()`, rejects the active job `'parse_timeout'`, logs `orb.svg.worker_timeout`, and the next job spawns a fresh worker. `'error'` with `LIMIT_EXCEEDED` + `detail 'deadline'` → `'parse_timeout'` (cooperative path, no respawn). `onerror`/`onmessageerror`/`'crashed'` → active job rejects `'worker_crashed'`, worker terminated, `orb.svg.worker_crashed`, queued jobs continue on a new worker. `dispose()` → `terminate()`, every pending job rejects `'disposed'`, `orb.svg.worker_terminated { reason: 'dispose' }`. Responses are data: validated with `isSvgWorkerResponse`, unknown `jobId` ignored and logged at `warn`, and `points` re-validated on the host (`Float32Array`, `length === 3·n`, all finite, within the unit sphere + 1e-5) → otherwise `'invalid_shape'` / `'non_finite'` with `details.from 'worker'`. Timeouts and limits, all from `core/limits`:

| Limit (A-18)          | Constant                  | Value                      | Enforced by                                        | Code on breach                                                                    |
| --------------------- | ------------------------- | -------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| input bytes           | `svgBytesMax`             | 2 097 152                  | main thread before clone/post; fetch stream        | `svg_rejected` (`LIMIT_EXCEEDED`, `limit 'maxBytes'` / `'fetchBytes'`)            |
| elements              | `svgElementsMax`          | 5 000                      | tokenizer (incremental)                            | `svg_rejected` (`LIMIT_EXCEEDED`, `limit 'maxElements'`)                          |
| path commands         | `svgPathCommandsMax`      | 200 000                    | flatten (incremental)                              | `svg_rejected` (`LIMIT_EXCEEDED`, `limit 'maxPathCommands'`)                      |
| nesting depth         | `svgDepthMax`             | 64                         | tokenizer                                          | `svg_rejected` (`LIMIT_EXCEEDED`, `limit 'maxDepth'`)                             |
| sampled points        | `svgSampledPointsMax`     | 200 000                    | resolver (`sampleCount`) and sampler               | `invalid_source` before parse; `svg_rejected` (`limit 'maxSampledPoints'`) inside |
| DOCTYPE / ENTITY / PI | —                         | rejected before tokenizing | Wave 3 pre-scan (O(bytes), no expansion)           | `svg_rejected` (`DOCTYPE_NOT_ALLOWED` / `ENTITY_NOT_ALLOWED`)                     |
| parse time            | `svgParseTimeoutMs`       | 2 000                      | cooperative `shouldAbort` + host hard kill at +500 | `parse_timeout`                                                                   |
| worker start          | `svgWorkerStartTimeoutMs` | 5 000                      | host                                               | `worker_unavailable`                                                              |
| queue depth           | `svgWorkerQueueMax`       | 8                          | host                                               | `queue_full`                                                                      |
| fetch time            | `svgFetchTimeoutMs`       | 5 000                      | `AbortController` via `Scheduler`                  | `fetch_failed`                                                                    |
| warnings              | `svgWarningsMax`          | 256                        | handler truncates; host aggregates                 | — (info only)                                                                     |

Limits are checked incrementally, so an input violating a limit costs at most `limit + one unit` of work. Trusted and untrusted, inline and worker share these values; only `forbidden` differs.

**Behavior — same-origin/allow-list rule for `url` sources.** `decideFormationUrl` resolves `new URL(input, origin ?? undefined)` (failure → `'url_not_allowed'`); protocol must be `http:` or `https:` (`data:`, `blob:`, `file:`, `javascript:` → `'url_not_allowed'`); `username`/`password` present → `'url_not_allowed'`; allowed iff `url.origin === origin` (mode `'same-origin'`) or `allowedOrigins.includes(url.origin)` (exact scheme+host+port string, no wildcards, no path prefixes; mode `'cors'`); `origin === null` (Node/SSR) → relative inputs are `'url_not_allowed'` and only allow-listed absolute origins pass. The rule is identical for both trust levels. `fetchSvgSource` calls `fetchFn(url, { mode, credentials: 'omit', redirect: 'error', headers: { Accept: 'image/svg+xml' }, signal })` with the abort scheduled at `svgFetchTimeoutMs`; network error, abort or non-2xx → `'fetch_failed' { status }`; `Content-Type` not starting with `image/svg+xml` → `'unsupported_content_type'`; `Content-Length > maxBytes` → `svg_rejected` (`limit 'fetchBytes'`) before reading; the body is read as a stream and cancelled the moment cumulative bytes exceed `maxBytes`. The bytes then follow the `{ svg, trust }` row. The worker has no network (`disableNetwork`); the Wave 0 CSP (`connect-src 'self'`, `worker-src 'self' blob:`) is the second layer — a host that allow-lists a CDN origin must also extend its own `connect-src`, which the how-to states explicitly; the reference app never does.

**Fuzz strategy (fast-check).** Arbitraries in `tests/support/arbitraries/svg.ts`: `arbSvgDocument()` (random tree of allow-listed, ignored and forbidden elements, random attributes incl. `on*`, `href`, `xlink:href`, `style`, random `transform`/`viewBox`, `d` strings from a `M L H V C S Q T A Z` grammar with numbers from `{ finite, ±0, ±1e308, NaN, Infinity, hex-like, exponent junk }`); `arbHostileInsert()` (random insertion of `<script>`, `<!DOCTYPE …>`, `<!ENTITY …>`, `&lol9;`, `<foreignObject>`, `<use href="https://…">`, `<image href>`, `javascript:` URLs, `<style>@import`, CDATA, PIs, BOM, NUL, invalid UTF-8); `arbMutatedFixture()` (byte flips, truncation, duplication, splices of the Wave 3 benign fixtures); `arbPathD()`. Properties, run against `handleSvgWorkerMessage` in-process with reduced limits `{ maxBytes: 65_536 }` and `deadlineMs: 500` for speed: **P1** `parse()` never throws or rejects — only `Result`; **P2** `ok` ⇒ `points` finite, `length === 3·n`, within the unit sphere (+1e-5); `!ok` ⇒ `error.code ∈ FormationErrorCode`; **P3** canary `globalThis.__pwned` stays `undefined`; spies on `fetch`, `XMLHttpRequest`, `Image`, `EventSource`, `eval`, `Function`, `document` never called; **P4** same input + options twice ⇒ byte-identical output or the same code; **P5** `stats.elements ≤ maxElements`, `stats.pathCommands ≤ maxPathCommands + 1`, wall time ≤ `deadlineMs + 100` (bounded work); **P6** `arbHostileInsert` ⇒ `DOCTYPE_NOT_ALLOWED`/`ENTITY_NOT_ALLOWED` for DTD inserts, else geometry whose `warnings` name the dropped element class (`'drop'` mode) or `FORBIDDEN_*` (`'reject'` mode). Two more suites: `handleSvgWorkerMessage(fc.anything())` never throws and posts at most one message per call; `decideFormationUrl(fc.oneof(fc.webUrl(), fc.string()))` never throws and `ok ⇒ url.origin ∈ {origin} ∪ allowedOrigins`. Runs: `numRuns` 200 in CI, 50 locally, seed printed on failure and replayable via `FC_SEED`; nightly `FUZZ_RUNS=5000`. Every minimised counter-example that revealed a bug is committed to `tests/fixtures/svg/fuzz-corpus/<seed>-<n>.svg` and replayed by `fuzz-corpus.test.ts` on every run.

**Edge cases.**

- Worker script fails to load (bundler, CSP) → no `ready` within `svgWorkerStartTimeoutMs` → `'worker_unavailable'`; trusted sources fall back inline, untrusted never do.
- 2 MiB benign SVG → parses within budget; the main thread only encodes, digests (native async), posts and re-validates (frame gap ≤ 50 ms, `__orbDebug.perf.maxFrameGapMs`). 2 MiB + 1 byte → rejected on the main thread in O(n) with no worker spawn.
- Exactly 5 000 elements → accepted; 5 001 → rejected. Same boundary tests for commands (200 000 / 200 001), depth (64 / 65), sampled points (200 000 / 200 001).
- `<svg>` containing only `<script>` → `'drop'` mode: `NO_GEOMETRY` with a `DROPPED_FORBIDDEN` warning; `'reject'` mode: `FORBIDDEN_ELEMENT`. Nothing evaluated either way.
- Degenerate arcs that busy-loop the flattener → cooperative `'parse_timeout'` at 2 s, hard kill at 2.5 s if wedged; frames keep advancing throughout.
- Nine untrusted registrations in one tick → eight queued, the ninth rejects `'queue_full'` immediately.
- Worker posts a result for an unknown `jobId`, a malformed message, or `points` of the wrong length → ignored / `'invalid_shape'` with `details.from 'worker'`; no other promise affected.
- `https://user:pw@app.test/x.svg` → `'url_not_allowed'`; 301/302 → `redirect: 'error'` makes `fetch` reject → `'fetch_failed'`; `text/html` or `application/octet-stream` → `'unsupported_content_type'`; `image/svg+xml; charset=utf-8` → accepted.
- `crypto.subtle` missing (insecure `http://` LAN dev) → `digest` null: cache disabled, `sha256: null` in info and logs, seed derived from the text via `fnv1a32`; registration still works.
- Engine disposed mid-fetch → `AbortController.abort()` → `'disposed'` (not `'fetch_failed'`).

**Acceptance criteria.**

- Given every fixture under `tests/fixtures/svg/malicious/`, When parsed through `createWorkerSvgParser` with a `FakeWorker` running the real handler in `'drop'` mode, Then each result is `ok` geometry with warnings naming the dropped elements or `svg_rejected` with `DOCTYPE_NOT_ALLOWED`/`ENTITY_NOT_ALLOWED`, `globalThis.__pwned` is `undefined` and the network spies were never called — ORB-SVG-002, ORB-SEC-005, ORB-FORM-007 — `tests/unit/formations-svg/worker-parser.test.ts`.
- Given the generated limit fixtures (2 MiB + 1, 5 001 elements, 200 001 commands, depth 65, DOCTYPE, ENTITY, `sampleCount` 200 001), When registered as `untrusted`, Then each rejects with the code and `details.limit` in the limits table and the oversized one never reaches `postMessage` — ORB-SVG-006 — `tests/unit/formations-svg/limits.test.ts`.
- Given a `FakeWorker` that never answers and a fake `Scheduler`, When a job runs, Then after `svgParseTimeoutMs + svgWorkerKillGraceMs` it rejects `'parse_timeout'`, `terminate()` was called once, and the next job spawns a new worker and succeeds — ORB-SVG-006 — `tests/unit/formations-svg/WorkerSvgParser.test.ts`.
- Given a `FakeWorker` that fires `onerror` mid-job, When observed, Then the job rejects `'worker_crashed'` and the queued jobs complete on a fresh worker; Given nine jobs in one tick, Then the ninth rejects `'queue_full'` — ORB-SVG-006 — same file.
- Given `svgParser` of kind `'inline'` (no Worker), When an `untrusted` svg is registered, Then `'worker_unavailable'` and the parser was never invoked; When a `trusted` svg is registered, Then it resolves — ORB-SVG-002 — same file.
- Given `origin 'https://app.test'` and `allowedOrigins ['https://cdn.test']`, When deciding `'/formations/x.svg'`, `'https://cdn.test/x.svg'`, `'https://evil.test/x.svg'`, `'data:image/svg+xml,…'`, `'https://u:p@app.test/x.svg'`, `'https://cdn.test:8443/x.svg'`, Then decisions are allow(same-origin), allow(cors), `'url_not_allowed'` ×4 — ORB-SVG-006, ORB-FORM-007 — `tests/unit/engine/formation-sources/url-policy.test.ts`.
- Given a fake `fetch` streaming 3 MiB, When fetched, Then the reader is cancelled after `maxBytes` and the result is `svg_rejected` with `limit 'fetchBytes'`; Given a 302, Then `'fetch_failed'`; Given `text/html`, Then `'unsupported_content_type'`; Given no response before `svgFetchTimeoutMs`, Then `'fetch_failed'` — ORB-SVG-006, ORB-FORM-007 — `tests/unit/engine/formation-sources/fetchSvgSource.test.ts`.
- Given the fuzz suites P1–P6 with `numRuns 200`, When run in CI, Then they pass and the corpus replays green — ORB-SVG-002, ORB-SVG-006, ORB-FORM-005 — `tests/unit/formations-svg/svg.fuzz.property.test.ts`.
- Given `svg.worker.ts`, `handler.ts` and `disableNetwork.ts`, When dependency-cruiser and ESLint `no-restricted-globals` run, Then they import only `core/**` and `formations/svg/**` and reference none of `fetch`, `XMLHttpRequest`, `importScripts`, `document`, `eval`, `Function`; and `Worker` appears only in `WorkerSvgParser.ts` — ORB-FORM-007, ORB-ARCH-001 — `tests/unit/architecture/svg-worker-isolation.test.ts`.
- Given `/playground?preset=ci&seed=1&adaptive=0&debug=1`, When the 200 001-command fixture is registered via the debug bridge, Then the alert region shows `svg_rejected` and `maxPathCommands`, `__orbDebug.frames` advanced by ≥ 5 during the call, no `pageerror`, and `page.on('request')` recorded no non-origin request — ORB-SVG-006, ORB-RENDER-005 — `tests/e2e/svg-limits.spec.ts`.

**Observability.** `orb.svg.worker_spawned { workerId }`, `orb.svg.worker_ready { networkDisabled }`, `orb.svg.worker_timeout { jobId, budgetMs }`, `orb.svg.worker_crashed { jobId }`, `orb.svg.worker_terminated { reason: 'dispose' | 'timeout' | 'crash' }`, `orb.svg.parse_completed { jobId, bytes, elements, pathCommands, sampledPoints, parseMs, warningCount }`, `orb.svg.parse_rejected { jobId, code, svgCode, limit }`, `orb.formation.url_blocked { origin, reason }`. Debug snapshot: `__orbDebug.svgWorker = { state: 'none' | 'starting' | 'idle' | 'busy' | 'terminated', queued, completed, failed, lastParseMs }`.

### 4.3 Playground custom-formation form and docs — bounded context `components/playground` + `docs`

**Objective.** A contributor exercises every path of §4.1/§4.2 from the browser without writing code; a host developer reproduces it from the how-to.

**Contracts.**

```tsx
// components/playground/CustomFormationForm.tsx — mounted inside the Wave 3 FormationPanel
export interface CustomFormationFormProps {
  engine: Pick<OrbEngine, "registerFormation" | "getFormationInfo" | "listFormations" | "morphTo">;
  allowedOrigins: readonly string[];
  onRegistered?: (id: FormationId) => void;
}
// local state: mode 'paste' | 'file' | 'url'; name; svgText; url; depth; noise; sampleCount; morphAfterRegister (default true); pending; result: FormationInfo | null;
//              error: { code: FormationErrorCode; limit?: string; svgCode?: string } | null
// every source built here is trust: 'untrusted' and never passes override (U-3, ORB-PLAY-002)

// app/playground/page.tsx — debug bridge additions (only with ?debug=1; never on `/`)
// __orbDebug.formation.custom: ReadonlyArray<{ id: string; kind: FormationSourceKind; pointCount: number; sha256: string | null }>
// __orbDebug.registerFormation(name: string, source: FormationSource): Promise<string>   // calls the same engine method with trust forced to 'untrusted'
// NEXT_PUBLIC_ORB_FORMATION_ORIGINS (comma-separated exact origins, default empty) → OrbEngineOptions.allowedFormationOrigins
```

**Behavior.** Name input validated live with `parseFormationId` (submit disabled while invalid or while `listFormations()` already contains the id). Paste mode: `<textarea>`; file mode: `<input type="file" accept=".svg,image/svg+xml">` read with `File.text()` (never `URL.createObjectURL`, never an `<img>`); URL mode: text input whose helper text states the same-origin rule and lists `allowedOrigins`. Submit → `engine.registerFormation(name, { svg | url, trust: 'untrusted', depth, noise, sampleCount })`; while pending the submit control is disabled and a `role="status"` region reads "Parsing…"; on success the result region lists `pointCount`, `parseMs`, `sha256` (first 12 hex) and warnings as `code × count (name)`, the Wave 3 formation selector re-reads `listFormations()`, and if `morphAfterRegister` the form calls `engine.morphTo(id)` (manual provenance; governance untouched). On rejection the `role="alert"` region shows the code, `details.limit`/`details.svgCode` when present and a static message from a `Record<FormationErrorCode, string>` — text nodes only, no echo of the input. The Wave 1 `StateAnnouncer` status region appends "(custom formation: `<id>`)" whenever the active visual formation is not a built-in id, `<id>` being the validated `[a-z0-9-]` name (a custom shape resembling `gate` cannot imply approval). The public demo `/` renders no upload/paste control and no `registerFormation` bridge (U-3).

**Edge cases.**

- File larger than `svgBytesMax` → rejected client-side (`File.size`) with the same `maxBytes` text before reading; also rejected by the engine if bypassed.
- Non-SVG file (`.png`) → `File.text()` still runs; engine returns `svg_rejected` (`MALFORMED_XML`); no image element is ever created.
- Registering while a previous registration is pending → allowed up to the queue limit; `queue_full` displayed like any other code.
- Reduced motion on → registration works; the post-register morph is instant (A-15, ORB-A11Y-007); text still announced.
- Name already used → submit disabled with inline hint; the form keeps the SVG text so only the name changes.

**Acceptance criteria.**

- Given `/playground?preset=ci&seed=1&adaptive=0&debug=1`, When `tests/fixtures/svg/logos/aisac-logo.svg` is pasted with name `my-logo` and submitted, Then `__orbDebug.snapshot.visual.formation === 'my-logo'`, `__orbDebug.morph.progress` reaches `1`, the status region contains "custom formation: my-logo", and the selector lists `my-logo` — ORB-FORM-003, ORB-API-002 — `tests/e2e/svg-upload.spec.ts`.
- Given the same page, When `malicious/script.svg` is uploaded via `setInputFiles`, Then no dialog opens, no navigation happens, `page.on('request')` recorded no non-origin request, `window.__pwned` is `undefined`, the result region lists a `DROPPED_FORBIDDEN × 1 (script)` warning and the orb morphs to the remaining geometry — ORB-SVG-002, ORB-SEC-005 — same file.
- Given the form with a fake engine rejecting `FormationError('svg_rejected', …, { svgCode: 'LIMIT_EXCEEDED', limit: 'maxElements' })`, When submitted, Then the alert's `textContent` contains `svg_rejected` and `maxElements`, its `innerHTML` contains no element, and the submit button is re-enabled — ORB-SEC-004, ORB-SVG-006 — `tests/unit/components/playground/CustomFormationForm.test.tsx`.
- Given `/`, When the DOM is inspected, Then there is no `input[type=file]`, no custom-formation textarea, and `window.__orbDebug?.registerFormation` is `undefined` even with `?debug=1` — U-3, ORB-SEC-006 (touched) — `tests/e2e/demo-no-upload.spec.ts`.
- Given `docs/reference/formation-sources.md`, When checked by a unit test importing `FormationErrorCode` members and `LIMITS`, Then every code and every `svg*`/`formationPointsMax` value appears in the file — ORB-SVG-006, ORB-API-002 — `tests/unit/docs/formation-sources-doc.test.ts`.

**Observability.** No new engine events; the form logs nothing (browser console stays clean — asserted by the shared E2E `pageerror`/console fixture).

## 5. Parallel tracks

| Track                     | Slices                                                                                                                                     | Needs                                         | Meets at                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------- |
| A — resolver (pure, Node) | 4.1 resolver, `FormationError` codes, cache, `classifySource`, generator wrapper                                                           | Wave 3 registry + `svgToFormation` signatures | `OrbEngine.registerFormation` wiring                 |
| B — worker + policy       | 4.2 protocol, handler, `svg.worker.ts`, `WorkerSvgParser` + `FakeWorker`, `urlPolicy`, `fetchSvgSource`, fuzz suites, bundling spike (§11) | Wave 0 CSP; Wave 3 `shouldAbort` addition     | `SvgParserPort` consumed by A                        |
| C — UI + docs             | 4.3 form against a fake engine, debug bridge, a11y suffix, how-to/reference/explanation/threat docs                                        | A's `FormationErrorCode` list frozen          | `tests/e2e/svg-upload.spec.ts`, `svg-limits.spec.ts` |

A and B merge independently behind `SvgParserPort`; C merges once A's codes are frozen; integration is the engine wiring plus the two E2E specs.

## 6. Threat model delta (STRIDE)

Only surfaces introduced or changed by this wave. Mitigations land in this wave; written to `docs/security/threats/svg-import.md` (extends the Wave 3 file).

| Surface                                                                      | S   | T   | R   | I   | D   | E   | Mitigation                                                                                                                                                                                                                                                 | Req IDs                                             |
| ---------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Untrusted SVG text via `registerFormation` (host API, playground paste/file) | –   | x   | –   | x   | x   | x   | Wave 3 allow-list tokenizer only, executed in a Worker with no network; output is a `Float32Array` only; `SVG_LIMITS` + cooperative deadline + hard kill; DOCTYPE/entities rejected before expansion; warnings are codes and element names, never raw text | ORB-SVG-002, ORB-SVG-006, ORB-SEC-005, ORB-FORM-007 |
| `url` sources (SSRF, exfiltration, redirect abuse, credential leak)          | –   | x   | –   | x   | x   | –   | Client-side fetch only; same-origin or exact-origin allow-list; `credentials: 'omit'`, `redirect: 'error'`, `http(s)` only, no userinfo; content-type check; streamed byte cap; timeout; CSP `connect-src 'self'` second layer; only `origin` in logs      | ORB-SVG-006, ORB-FORM-007                           |
| Worker ↔ main-thread channel                                                 | x   | x   | –   | –   | x   | –   | Protocol version + shape guards on both sides; unknown `jobId` ignored; worker output re-validated (finite, length, unit sphere); one worker per engine; FIFO with `queue_full`; terminate on timeout/crash                                                | ORB-SVG-006                                         |
| Worker script capability (module worker inherits page CSP)                   | –   | x   | –   | x   | –   | x   | `disableNetwork(self)` + `ready.networkDisabled`; ESLint `no-restricted-globals` and dependency-cruiser confine imports to `core` + `formations/svg`; CSP `worker-src 'self' blob:`                                                                        | ORB-FORM-007, ORB-ARCH-001                          |
| Playground form (error, warning, name rendering)                             | x   | x   | –   | –   | –   | –   | Text nodes only (React escaping; `dangerouslySetInnerHTML` lint-banned); static messages; id charset validated; custom formations labelled in the a11y region so a shape resembling `gate` cannot imply approval                                           | ORB-SEC-004, ORB-A11Y-001, ORB-SEC-003              |
| Parse cache                                                                  | –   | x   | –   | –   | x   | –   | Key = sha256 + options; disabled without `crypto.subtle`; bounded by entries and bytes (LRU); per engine; freed on dispose; copies in/out                                                                                                                  | ORB-SVG-006                                         |
| Registration audit trail                                                     | –   | –   | x   | –   | –   | –   | `orb.formation.registered/rejected` with sha256, kind, trust, counts, override flag, correlationId when present; no content                                                                                                                                | ORB-FORM-007                                        |
| Generator functions (host code on the resolve path)                          | –   | x   | –   | –   | x   | –   | Probe at registration; per-call validation with substitution instead of throw; rate-limited log                                                                                                                                                            | ORB-API-002, ORB-RENDER-005                         |
| `override: true` on a built-in id                                            | x   | –   | x   | –   | –   | –   | Explicit opt-in only; logged; a11y text still names the built-in id; playground never sets it                                                                                                                                                              | ORB-SEC-003, ORB-PLAY-002                           |

## 7. Tests

| Test (name references requirement IDs)                                                                                                                          | Type                                                         | Req IDs                                             | File                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------- |
| `${req('ORB-API-002','ORB-FORM-003')} registerFormation resolves every FormationSource kind; getFormationInfo/listFormations/morphTo agree`                     | unit                                                         | ORB-API-002, ORB-FORM-003                           | `tests/unit/engine/registerFormation.test.ts`                          |
| `${req('ORB-API-002')} dispose settles pending registrations with disposed and terminates the worker`                                                           | unit                                                         | ORB-API-002                                         | `tests/unit/engine/registerFormation.test.ts`                          |
| `${req('ORB-API-002')} rejects invalid_id / duplicate_id / invalid_source / invalid_shape / non_finite with FormationError only`                                | unit                                                         | ORB-API-002                                         | `tests/unit/engine/formation-sources/FormationSourceResolver.test.ts`  |
| `${req('ORB-API-002','ORB-FORM-004')} Float32Array source is copied and normalized`                                                                             | unit                                                         | ORB-API-002, ORB-FORM-004                           | `tests/unit/engine/formation-sources/FormationSourceResolver.test.ts`  |
| `${req('ORB-API-002')} concurrent duplicate names: exactly one wins`                                                                                            | unit                                                         | ORB-API-002                                         | `tests/unit/engine/formation-sources/FormationSourceResolver.test.ts`  |
| `${req('ORB-API-002','ORB-RENDER-005')} generator wrapper substitutes and logs once, never throws`                                                              | unit                                                         | ORB-API-002, ORB-RENDER-005                         | `tests/unit/engine/formation-sources/FormationSourceResolver.test.ts`  |
| `${req('ORB-FORM-005','ORB-API-002')} cache: same content → byte-identical, parser called once; LRU bounds; disabled without digest`                            | unit                                                         | ORB-FORM-005, ORB-API-002                           | `tests/unit/engine/formation-sources/FormationCache.test.ts`           |
| `${req('ORB-SVG-002','ORB-SEC-005','ORB-FORM-007')} malicious fixtures through the worker parser yield inert geometry or DOCTYPE/ENTITY rejection`              | unit                                                         | ORB-SVG-002, ORB-SEC-005, ORB-FORM-007              | `tests/unit/formations-svg/worker-parser.test.ts`                      |
| `${req('ORB-SVG-006')} limit boundaries: bytes, elements, commands, depth, sampled points, DOCTYPE, ENTITY`                                                     | unit                                                         | ORB-SVG-006                                         | `tests/unit/formations-svg/limits.test.ts`                             |
| `${req('ORB-SVG-006')} worker timeout → parse_timeout, terminate, respawn`                                                                                      | unit (fake Scheduler, FakeWorker)                            | ORB-SVG-006                                         | `tests/unit/formations-svg/WorkerSvgParser.test.ts`                    |
| `${req('ORB-SVG-006')} worker crash → worker_crashed, queue continues; queue_full at the 9th job`                                                               | unit                                                         | ORB-SVG-006                                         | `tests/unit/formations-svg/WorkerSvgParser.test.ts`                    |
| `${req('ORB-SVG-002')} untrusted requires the worker; trusted falls back inline`                                                                                | unit                                                         | ORB-SVG-002                                         | `tests/unit/formations-svg/WorkerSvgParser.test.ts`                    |
| `${req('ORB-SVG-006')} handler: malformed message ignored, invalid UTF-8 → MALFORMED_XML, wrong-length result → invalid_shape on host`                          | unit                                                         | ORB-SVG-006                                         | `tests/unit/formations-svg/worker-handler.test.ts`                     |
| `${req('ORB-SVG-006','ORB-FORM-007')} url policy: same-origin, allow-list, schemes, userinfo, port mismatch, null origin`                                       | unit                                                         | ORB-SVG-006, ORB-FORM-007                           | `tests/unit/engine/formation-sources/url-policy.test.ts`               |
| `${req('ORB-SVG-006','ORB-FORM-007')} fetchSvgSource: byte-cap cancel, redirect error, content-type, timeout, dispose abort`                                    | unit (fake fetch)                                            | ORB-SVG-006, ORB-FORM-007                           | `tests/unit/engine/formation-sources/fetchSvgSource.test.ts`           |
| `${req('ORB-SVG-002','ORB-SVG-006','ORB-FORM-005')} fuzz P1–P6 over generated, hostile and mutated SVG`                                                         | unit (fast-check, 200 runs CI)                               | ORB-SVG-002, ORB-SVG-006, ORB-FORM-005              | `tests/unit/formations-svg/svg.fuzz.property.test.ts`                  |
| `${req('ORB-SVG-006')} fuzz: handleSvgWorkerMessage(anything) never throws, posts ≤ 1 message`                                                                  | unit (fast-check)                                            | ORB-SVG-006                                         | `tests/unit/formations-svg/worker-handler.fuzz.property.test.ts`       |
| `${req('ORB-FORM-007')} fuzz: decideFormationUrl never throws; ok ⇒ origin membership`                                                                          | unit (fast-check)                                            | ORB-FORM-007                                        | `tests/unit/engine/formation-sources/url-policy.fuzz.property.test.ts` |
| `${req('ORB-SVG-002')} fuzz corpus replay`                                                                                                                      | unit                                                         | ORB-SVG-002                                         | `tests/unit/formations-svg/fuzz-corpus.test.ts`                        |
| `${req('ORB-FORM-007','ORB-ARCH-001')} svg.worker.ts imports only core + formations/svg; Worker referenced only in WorkerSvgParser`                             | arch                                                         | ORB-FORM-007, ORB-ARCH-001                          | `tests/unit/architecture/svg-worker-isolation.test.ts`                 |
| `${req('ORB-SEC-004','ORB-SVG-006')} CustomFormationForm renders codes as text, validates id, disables while pending, never sets override`                      | unit (jsdom, Testing Library)                                | ORB-SEC-004, ORB-SVG-006                            | `tests/unit/components/playground/CustomFormationForm.test.tsx`        |
| `${req('ORB-SVG-006','ORB-API-002')} reference doc lists every FormationErrorCode and every limit`                                                              | unit                                                         | ORB-SVG-006, ORB-API-002                            | `tests/unit/docs/formation-sources-doc.test.ts`                        |
| `${req('ORB-API-001')} api snapshot includes registerFormation opts, getFormationInfo, listFormations, allowedFormationOrigins, svgParser, FormationError`      | unit (snapshot)                                              | ORB-API-001 (touched)                               | `tests/unit/engine/api-surface.test.ts`                                |
| paste logo → morph; upload malicious → inert `{ tag: ['@ORB-FORM-003','@ORB-API-002','@ORB-SVG-002','@ORB-SEC-005'] }`                                          | e2e                                                          | ORB-FORM-003, ORB-API-002, ORB-SVG-002, ORB-SEC-005 | `tests/e2e/svg-upload.spec.ts`                                         |
| oversized/hostile fixtures → typed error, frames keep advancing, no non-origin request `{ tag: ['@ORB-SVG-006','@ORB-RENDER-005'] }`                            | e2e                                                          | ORB-SVG-006, ORB-RENDER-005                         | `tests/e2e/svg-limits.spec.ts`                                         |
| public demo exposes no upload or bridge `{ tag: ['@ORB-SEC-006'] }`                                                                                             | e2e                                                          | U-3, ORB-SEC-006 (touched)                          | `tests/e2e/demo-no-upload.spec.ts`                                     |
| main-thread stall ≤ 50 ms while parsing the 2 MiB and 200 001-command inputs (`__orbDebug.perf.maxFrameGapMs`, `longtask` observer) `{ tag: ['@ORB-SVG-006'] }` | perf (Playwright `perf` project, reference machine, nightly) | ORB-SVG-006                                         | `tests/e2e/perf/svg-parse-stall.perf.spec.ts`                          |

CI: every unit/arch/fuzz suite runs in the Vitest stage (`numRuns` 200, `FC_SEED` printed on failure); E2E under SwiftShader with `?preset=ci&seed=1&adaptive=0`; the stall threshold is asserted only in the `perf` project on the reference machine (recorded in `docs/reference/perf-matrix.md`) — PR CI asserts "frames advanced ≥ 5 during the call" because SwiftShader frame times are not representative. Determinism: injected `Clock`/`Scheduler` everywhere (no real timers in unit tests); `FakeWorker` runs the real handler synchronously or with scheduled delays; over-limit fixtures are generated at test time by `tests/support/svgFixtures.ts` (not committed); the parse seed is content-derived and the resample seed is `prng.fork(id)`.

## 8. ADRs to record

- No new ADR (per the wave assignment). This wave implements **ADR-0010 — SVG inert parsing (hand-written allow-list tokenizer)** at runtime and appends to its _Consequences_: runtime untrusted input executes in a dedicated Worker under `SVG_LIMITS` with a host-enforced timeout; `url` sources are same-origin or exact-origin allow-listed, fetched client-side only; trust selects `forbidden` `'reject'` (trusted) vs `'drop'` (untrusted) and nothing else. Should the maintainer want a separate record ("Worker isolation and URL policy for runtime formation sources" — context: main-thread stalls and SSRF; options: inline parsing with limits, Worker with limits, server-side proxy; recommendation: Worker + client-only fetch), it is raised in §11 rather than numbered here.

## 9. Deliverables

- `core/limits.ts` — added `LIMITS` keys (`svgDepthMax`, `svgSampleCountDefault`, `svgWarningsMax`, `svgWorker*`, `svgFetchTimeoutMs`, `svgCache*`, `formationPointsMax`, `generatorProbeCount`).
- `formations/domain/Formation.ts` — `FormationErrorCode` extended, `FormationErrorDetails`, third constructor argument, `isFormationError`.
- `formations/svg/svgToFormation.ts` — `SVG_LIMITS`, `SvgSampleOptions.shouldAbort`.
- `formations/svg/worker/protocol.ts`, `handler.ts`, `svg.worker.ts`, `disableNetwork.ts`.
- `formations/index.ts` — `SvgTrust`, `SvgSourceOptions`, `SvgStringSource`, `SvgUrlSource`, `FormationSourceKind`, `classifySource`, `SvgWarningSummary`, `FormationInfo`.
- `engine/ports/SvgParserPort.ts`; `engine/formation-sources/{FormationSourceResolver,FormationCache,WorkerSvgParser,InlineSvgParser,urlPolicy,fetchSvgSource,generatorWrapper}.ts`.
- `engine/OrbEngine.ts` — `registerFormation` wiring (+ `opts.override`), `getFormationInfo`, `listFormations`, `allowedFormationOrigins`/`svgParser` options, worker disposal in `dispose()`; `engine/index.ts` exports `FormationError`, `isFormationError`, `FormationErrorCode`, source types; api snapshot updated.
- `components/playground/CustomFormationForm.tsx` (+ `useRegisterFormation.ts`), `components/playground/FormationPanel.tsx` (mounts the form), `components/a11y/StateAnnouncer.tsx` (custom-formation suffix).
- `app/playground/page.tsx` — debug bridge additions (`__orbDebug.formation.custom`, `__orbDebug.registerFormation`, `__orbDebug.svgWorker`), `NEXT_PUBLIC_ORB_FORMATION_ORIGINS`.
- `.eslintrc` — `no-restricted-globals` for `formations/svg/worker/**`; `Worker` allowed only in `WorkerSvgParser.ts`. `.dependency-cruiser.cjs` — rule `svg-worker-isolation`.
- `tests/support/fakes/FakeWorker.ts`, `tests/support/arbitraries/svg.ts`, `tests/support/svgFixtures.ts`, `tests/fixtures/svg/logos/aisac-logo.svg` (CC0, provenance in `tests/fixtures/svg/LICENSE.md`), `tests/fixtures/svg/fuzz-corpus/`.
- Tests listed in §7.
- `docs/how-to/custom-svg-formation.md`, `docs/reference/formation-sources.md` (matrix, limits table, error codes, worker protocol, URL rule, browser support), `docs/explanation/svg-import.md` (why Worker + client-only fetch + content-derived seed), `docs/security/threats/svg-import.md` (updated with §6), `docs/reference/playground-controls.md` (section), `CHANGELOG.md` entry, `specs/TRACEABILITY.md` rows for the four owned IDs.

## 10. Exit criteria (Gate G6)

1. `pnpm req:coverage` reports ORB-FORM-003, ORB-SVG-002, ORB-SVG-006 and ORB-API-002 each covered by ≥ 1 unit/integration test, and ORB-FORM-003, ORB-SVG-002, ORB-SVG-006 by ≥ 1 E2E test (`svg-upload.spec.ts`, `svg-limits.spec.ts`); no uncovered MUST.
2. `worker-parser.test.ts` and `limits.test.ts` green: every `tests/fixtures/svg/malicious/` fixture and every generated over-limit input yields only a `Float32Array` or a `FormationError` with the code and `details.limit` from the §4.2 table.
3. `tests/e2e/perf/svg-parse-stall.perf.spec.ts` on the reference machine: max frame gap ≤ 50 ms and no `longtask` > 50 ms inside the parse window for the 2 MiB and 200 001-command inputs; value recorded in `docs/reference/perf-matrix.md`. PR CI `svg-limits.spec.ts` green (frames advance during the call).
4. Fuzz suites (`svg.fuzz.property`, `worker-handler.fuzz.property`, `url-policy.fuzz.property`) green in CI with `numRuns 200`; nightly `FUZZ_RUNS=5000` green for the last 3 runs before gate review; `fuzz-corpus.test.ts` green.
5. `tests/e2e/svg-upload.spec.ts` green: pasting `aisac-logo.svg` morphs the orb to `my-logo` with the a11y label; uploading `malicious/script.svg` records zero non-origin requests, zero dialogs, `__pwned === undefined`.
6. `tests/e2e/demo-no-upload.spec.ts` green (U-3).
7. `svg-worker-isolation.test.ts` green; dependency-cruiser and ESLint pass with the new rules; `Worker` referenced in exactly one module.
8. `formation-sources-doc.test.ts` green; `docs/how-to/custom-svg-formation.md` walked through by a second contributor on a fresh clone (PR sign-off recorded).
9. `api-surface.test.ts` snapshot updated and reviewed; `OrbEngine.SPEC_VERSION` still `0.2.0`; no `any` without justification in the diff; `pnpm audit` clean; no new dependency in the worker bundle.
10. `docs/security/threats/svg-import.md` updated with §6 and reviewed; ADR-0010 consequences note merged.

## 11. Risks, spikes and open questions

- **Risk: module Worker bundling under Next.js/Turbopack** (`new Worker(new URL(…, import.meta.url), { type: 'module' })`) may need config or a separate entry. → 1-day spike on day 1 of Track B; fallback: classic worker built by a small esbuild step into `public/workers/` (still `worker-src 'self'`); decision recorded in `docs/explanation/svg-import.md` and the ADR-0010 note. Owner: maintainer.
- **Risk: the 50 ms stall gate is noisy in CI.** → threshold only in the `perf` project on the reference machine; PR CI asserts progress, not timing. Owner: this spec.
- **Risk: `shouldAbort` polling changes Wave 3 sampler hot loops.** → additive optional hook polled at coarse intervals; Wave 3 golden tests must stay byte-identical (the hook never alters output). Owner: Wave 3 owner reviews the PR.
- **Risk: `crypto.subtle` unavailable in insecure contexts** (plain `http://` LAN). → cache disabled, `sha256: null`, `fnv1a32` seed; documented in the how-to's browser-support table. Owner: docs.
- **Risk: browsers without module workers** → `isWorkerAvailable()` false → untrusted registration refused with `worker_unavailable`, trusted works inline; documented. Owner: docs.
- **Spike: logo sampling quality** (sparse contours on thin line art) is a Wave 3 sampler concern; this wave only threads options. If `aisac-logo.svg` looks sparse in the E2E screenshot, raise for Wave 8 polish.
- **Open question (spec-amendment):** A-17 says the sampling seed is `prng.fork(formationId)`; this wave applies that to the N-resample (Wave 3 manager) but uses a content-derived seed for the SVG sampler's interior/noise jitter so that identical content is byte-identical across names and engines (enables the cache). Confirm the amendment text distinguishes the two stages.
- Traceability reconciled: ORB-SVG-006 is MUST in the proposal, this wave and the planning matrix.
- **Open question (maintainer):** expose `opts.override` on the public `registerFormation` (as specified here, mirroring the Wave 3 registry) or keep the public surface at two parameters until the Wave 8 API freeze.
- **Open question (maintainer):** accept `data:image/svg+xml` URLs as a convenience? Currently `url_not_allowed` (callers pass the text as `{ svg }`).
- **Open question (maintainer):** a separate ADR for Worker isolation + URL policy instead of a consequences note on ADR-0010.
- **Open question (Wave 3/4 owners):** if `FormationPanel` already reads registry ids through a public method, reuse it and drop `listFormations()` from this wave's additions rather than duplicating.
- **Open question (Wave 3 owner):** answer to Wave 3's question — in `'drop'` mode the playground surfaces dropped forbidden elements as `DROPPED_FORBIDDEN × count (name)` in the result region (§4.3); confirm this is sufficient user-visible feedback.

## 12. Playground and demo controls introduced

Playground (`/playground`, inside the Formation panel, untrusted only):

- **Custom formation** section with mode tabs _Paste_ / _File_ / _URL_; name input (live `parseFormationId` validation, duplicate hint), depth slider `[0, 1]`, noise slider `[0, 1]`, sample count input (`1 … 200 000`, default 32 768), "Morph after register" checkbox (default on), **Register** button (disabled while invalid or pending).
- Result region (`role="status"`): point count, parse time, sha256 prefix (or "no hash: insecure context"), warnings by `code × count (name)`.
- Error region (`role="alert"`): `FormationErrorCode` + `details.limit` / `details.svgCode` when present + static message.
- Registered custom formations appear in the existing formation selector (via `listFormations()`) and in `__orbDebug.formation.custom`; `__orbDebug.svgWorker` exposes worker state; `__orbDebug.registerFormation` drives registrations in E2E (`?debug=1` only).
- Status region (Wave 1 `StateAnnouncer`) shows "(custom formation: `<id>`)" while a non-built-in formation is active.
- `NEXT_PUBLIC_ORB_FORMATION_ORIGINS` (exact origins, comma-separated) feeds `allowedFormationOrigins`; the reference deployment leaves it empty.

Demo (`/`): none — no upload, no paste, no bridge (U-3).
