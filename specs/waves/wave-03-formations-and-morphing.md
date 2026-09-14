# Wave 3 — Formations, interruption-safe morphing, trusted SVG face

| Field                     | Value                                                                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                | proposed                                                                                                                                                                                                                                  |
| **Milestones (SPEC §27)** | V0.2 Formation generators + morphing; V0.8 SVG → particle formations (trusted-asset half — untrusted uploads are Wave 6)                                                                                                                  |
| **Depends on**            | Wave 0 (`core/`: `Prng`, `Clock`, `Logger`, `easing`, `limits`; CI + req-coverage tooling), Wave 2 (`RendererPort`, `ParticleSystem`, shaders v1, playground v0)                                                                          |
| **Spec version**          | SPEC.md 0.2.0 (0.1.0 + amendments; decisions A-13, A-15, A-16, A-17, A-18 apply — see `specs/SPEC-amendments-proposal.md`)                                                                                                                |
| **Gate**                  | G3 — all 12 built-in formations resolve deterministically at every preset, morphs are interruption-safe under property and E2E tests, and the face renders from `assets/formations/face.svg` through a parser that has no evaluation path |
| **Estimated size**        | XL — 10 procedural generators, an allow-list XML tokenizer + path flattener, a morph controller with CPU bake, shared-attribute connection lines, and the parity/property test harness                                                    |

## 1. Objective

At the end of this wave the renderer delivered by Wave 2 can be told `morphTo('face')` and will animate 3 000–50 000 particles from any formation to any other, survive a second `morphTo` at 40 % progress without a visible jump, resolve a typed completion promise that provably never reaches the state controller, and draw connection lines for `network`-like formations that follow the particles through the morph. Every built-in formation (six MUST, six SHOULD incl. `gate` and `generic-tool`) is a pure function of `(n, prng)`; the same engine seed produces byte-identical buffers on every run and JS engine. The `face` and `aisac` formations are produced from bundled SVG assets by a hand-written tokenizer that never builds a DOM, never evaluates anything, and fails closed on tampered assets. A stakeholder can open `/playground`, pick any formation, set duration/easing/connection density, press "Interrupt mid-morph" and watch `__orbDebug.morph.progress` stay continuous.

## 2. Scope

### 2.1 In scope

- `formations/domain`: `Formation`, `FormationId`, `normalizeFormation`, `resampleFormation`, `computeEdges`, `FormationDefinition`, `FormationRegistry`.
- `formations/generators`: `sphere`, `rings`, `neural`, `polyhedron`, `network`, `gate`, `generic-tool`, `explosion`, `collapse`, `error-distortion` (procedural); `face`, `aisac` (SVG-sourced from trusted bundled assets).
- `formations/svg`: inert tokenizer, allow-list, path/shape flattening, contour + even-odd interior sampling, depth/noise extrusion, trusted asset loader. Shared with Wave 6 (same code, different trust source).
- `engine/morph`: `MorphController` (from/to buffers, easing, per-particle stagger, CPU-bake interruption, `MorphHandle`, typed completion emitter).
- `engine/FormationManager.ts`: registry + resolve cache + morph orchestration + connection density → `ParticleBufferPort`.
- `engine/render/ConnectionLines.ts` + `shaders/chunks/{morph,easing,displacement}.glsl` + `shaders/connection.{vert,frag}.glsl` (ADR-0008 implementation).
- Playground `FormationPanel.tsx`; `window.__orbDebug.morph` and `.formation` read-only snapshots.
- ADR-0009 (morph interruption strategy) and ADR-0010 (SVG inert parsing).

### 2.2 Out of scope (deferred)

- `registerFormation` with `{ svg }` / `{ url }` sources, untrusted SVG, Web Worker parsing, `FormationError` result codes for uploads, ORB-SVG-006 limit verification → Wave 6 (the tokenizer already takes a `limits` argument).
- State-driven morphs (`OrbController` → `FormationManager.morphTo` on transition, per-state `morphDurationMs`, reduced-motion `durationMs = 0`) → Wave 4 (A-15).
- Pointer and audio terms of the displacement chunk → Wave 5 (the chunk ships with turbulence only and the uniform slots reserved).
- Build-time prebake of trusted assets to `*.formation.json` → Wave 8 if the perf matrix shows SVG sampling on the critical path.
- Tool-visual formation names (`radar`, `data-grid`, `code-network`) → resolve to `generic-tool` unless registered (A-13; registry owned by Wave 1).

## 3. Requirements owned by this wave

Every ID listed here is owned by this wave and must be fully satisfied and verified before the gate closes. These are planned obligations; no test evidence is implied. Shared declaration owners and integration rules are in `specs/SHARED-CONTRACTS.md`.

| ID            | Level                                                              | Summary                                                                                                    | Slice    | Verification                             |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| ORB-FORM-001  | MUST                                                               | Engine MUST support morphing between formations                                                            | 4.4, 4.5 | unit + integration + e2e                 |
| ORB-FORM-002  | MUST                                                               | Morph duration MUST be configurable                                                                        | 4.4      | unit                                     |
| ORB-FORM-004  | MUST                                                               | Imported coordinates MUST be normalized                                                                    | 4.1, 4.3 | unit (property)                          |
| ORB-FORM-005  | MUST                                                               | Point-count mismatch MUST use deterministic sampling/downsampling                                          | 4.1      | unit (property, byte-for-byte)           |
| ORB-FORM-006  | MUST                                                               | Morphing MUST preserve the running renderer                                                                | 4.5      | integration + e2e                        |
| ORB-FORM-007  | MUST NOT                                                           | Formation assets MUST NOT execute arbitrary code                                                           | 4.3      | unit (fixtures + canaries) + arch (lint) |
| ORB-FORM-008  | MUST (raised from §11 SHOULD by the 0.2.0 amendment, sign-off Q-5) | A `Formation` is a `Float32Array` of length N × 3, finite, inside the unit sphere                          | 4.1      | unit                                     |
| ORB-FORM-009  | MUST                                                               | V1 MUST include `sphere`, `rings`, `neural`, `polyhedron`, `network`, `face`                               | 4.2, 4.3 | unit + e2e                               |
| ORB-FORM-010  | SHOULD                                                             | V1 SHOULD include `aisac`, `explosion`, `collapse`, `error-distortion` (+ `gate`, `generic-tool` per A-13) | 4.2      | unit                                     |
| ORB-FORM-011  | MUST                                                               | Sampling is seeded and deterministic; seed = `prng.fork(formationId)` (A-17)                               | 4.1, 4.5 | unit (golden + property)                 |
| ORB-MORPH-001 | INFO (no normative keyword; verified as an invariant)              | Morph progress ranges 0.0–1.0                                                                              | 4.4      | unit                                     |
| ORB-MORPH-002 | MUST                                                               | Interrupting a morph MUST continue from the visually current state without snapping                        | 4.4      | unit (property) + e2e                    |
| ORB-MORPH-003 | MUST                                                               | Morph completion MUST be observable                                                                        | 4.4      | unit                                     |
| ORB-MORPH-004 | MUST NOT                                                           | Morph completion MUST NOT imply backend completion                                                         | 4.4      | unit (type-level + runtime) + arch       |
| ORB-SVG-001   | MUST                                                               | Trusted local SVG assets MUST be supported                                                                 | 4.3      | unit + e2e                               |
| ORB-SVG-003   | SHOULD                                                             | Logos, icons, faces and line art SHOULD be representable                                                   | 4.3      | unit + manual sign-off                   |
| ORB-SVG-004   | SHOULD                                                             | Configurable depth/noise SHOULD give 2D shapes spatial presence                                            | 4.3      | unit                                     |
| ORB-SVG-005   | SHOULD                                                             | The initial face formation uses the SVG pipeline                                                           | 4.3      | unit + e2e                               |
| ORB-SEC-005   | MUST NOT                                                           | Imported SVG MUST NOT execute scripts                                                                      | 4.3      | unit (fixtures + canaries) + e2e         |

Requirements touched but owned elsewhere: ORB-FORM-003, ORB-SVG-002, ORB-API-002 (Wave 6 — same tokenizer, runtime `registerFormation` sources); ORB-RENDER-004, ORB-RENDER-008, ORB-PERF-005 (Wave 2 — renderer identity across morphs, particle-count change, connections as a degrade axis); ORB-VISUAL-002, ORB-TOOLVIS-001 (Wave 1 — every formation named by the default map and the generic fallback exists here); ORB-ARCH-004, ORB-A11Y-007 (Wave 4 — completion is never evidence; `durationMs = 0` path).

## 4. Vertical slices

### 4.1 Formation domain — bounded context `formations`

**Objective.** Pure, dependency-free primitives every other slice builds on: the buffer contract, the id type, normalization, deterministic resampling, edge computation and the registry.

**Contracts.**

```ts
// formations/domain/Formation.ts
export type Formation = Float32Array;                       // length = N*3 as [x0,y0,z0,x1,…]; every |p| ≤ 1 (+1e-5 float32 slack)
export const FORMATION_STRIDE = 3;
export class FormationError extends Error { constructor(readonly code: 'invalid_shape' | 'non_finite' | 'count_mismatch' | 'unknown_formation' | 'duplicate_id' | 'invalid_id' | 'asset_rejected', detail?: string) }
export function assertFormation(points: Float32Array, n?: number): asserts points is Formation;   // length % 3 === 0, length ≥ 3, finite, n*3 when n given
export function isWithinUnitSphere(points: Formation, eps?: number /* 1e-5 */): boolean;

// formations/domain/FormationId.ts
export type FormationId = string & { readonly __brand: 'FormationId' };
export const FORMATION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export function parseFormationId(raw: string): Result<FormationId, FormationError>;    // 'invalid_id'
export const BUILT_IN_FORMATIONS = ['sphere','rings','neural','polyhedron','network','face','gate','generic-tool','aisac','explosion','collapse','error-distortion'] as const;
export type BuiltInFormationId = (typeof BUILT_IN_FORMATIONS)[number];
export const REQUIRED_FORMATIONS = ['sphere','rings','neural','polyhedron','network','face'] as const;   // ORB-FORM-009

// formations/domain/normalize.ts
export interface NormalizeOptions { center?: 'bbox' | 'centroid' }        // default 'bbox'
export function normalizeFormation(points: Float32Array, opts?: NormalizeOptions): Formation;   // ORB-FORM-004; never mutates input

// formations/domain/resample.ts
export const UPSAMPLE_JITTER = 0.01;                                        // unit-sphere units
export function resampleFormation(points: Formation, n: number, prng: Prng): Formation;         // ORB-FORM-005/011

// formations/domain/edges.ts
export interface EdgeOptions { k: number; maxDistance: number; maxEdges: number }  // defaults k=3, maxDistance=0.35, maxEdges=2*N
export function computeEdges(points: Formation, prng: Prng, opts?: Partial<EdgeOptions>): Uint32Array;   // pairs (a,b), a<b, unique, sorted by length asc

// formations/registry.ts
export interface FormationDefinition { id: FormationId; points(n: number, prng: Prng): Formation; edges?(n: number, prng: Prng): Uint32Array; is2D?: boolean }
export interface FormationRegistry {
  register(def: FormationDefinition, opts?: { override?: boolean }): Result<void, FormationError>;   // 'duplicate_id' unless override
  get(id: FormationId): FormationDefinition | undefined; has(id: FormationId): boolean; ids(): readonly FormationId[];
}
export function createBuiltInRegistry(assets: TrustedAssetLoader): FormationRegistry;   // all 12 BUILT_IN_FORMATIONS registered
export function definitionFromPoints(id: FormationId, raw: Float32Array, opts?: { edges?: 'auto' | Uint32Array }): FormationDefinition;  // normalize once, resample per n
```

**Behavior.**

_Normalization_ (`normalizeFormation`): (1) `assertFormation` (throws `'invalid_shape'` / `'non_finite'`); (2) axis-aligned bounding box in float64; centre `c = (min + max) / 2` (`'centroid'` = arithmetic mean, opt-in); (3) `rmax = max_i |p_i − c|`; (4) `s = rmax < 1e-9 ? 0 : 1 / rmax` — a degenerate cloud (all points coincide) collapses to the origin rather than dividing by zero; (5) `out_i = (p_i − c) · s` stored as float32. Post-conditions: bbox centre at origin ± 1e-6, `max |p| ∈ [1 − 1e-6, 1 + 1e-6]` unless degenerate, idempotent within 1e-6. Applied by the registry to `Float32Array` and SVG sources only; procedural generators emit coordinates inside the unit sphere by construction and are _asserted_, never rescaled (so `collapse` may legitimately occupy radius 0.3).

_Resampling_ (`resampleFormation`) — every random draw comes from the injected `Prng` (mulberry32 on `Uint32`, identical on every JS engine); integer arithmetic only for index selection; no `Math.random`, no `Math.sin` hashing, no transcendental calls:

```ts
const m = points.length / 3;
if (n === m) return new Float32Array(points); // always a fresh buffer, never the caller's reference
if (n < m) {
  // stratified downsample: bucket i = [floor(i*m/n), floor((i+1)*m/n))
  for (let i = 0; i < n; i++) {
    const lo = Math.floor((i * m) / n),
      hi = Math.floor(((i + 1) * m) / n);
    const src = lo + prng.int(hi - lo); // exactly one draw per output point → same (input, n, seed) ⇒ same bytes
    out.set(points.subarray(src * 3, src * 3 + 3), i * 3);
  }
} else {
  // upsample: exact copies first, then jittered repeats in index order
  out.set(points, 0);
  for (let i = m; i < n; i++) {
    const src = (i % m) * 3;
    for (let a = 0; a < 3; a++)
      out[i * 3 + a] = points[src + a] + (prng.next() * 2 - 1) * UPSAMPLE_JITTER;
    clampToUnitSphere(out, i);
  } // rescale the point if |p| > 1
}
```

Stratified selection preserves index order, which for SVG contours is arc-length order, so a 5 k sample of a 200 k contour still covers the whole outline; the bounding box of a downsample is within 5 % of the source (property test). `(i*m)/n` is exact in float64 for `i, m, n < 2^26`.

_Edges_ (`computeEdges`): spatial hash with cell size `maxDistance`; for each point in index order gather the 27 neighbouring cells, keep the `k` nearest within `maxDistance` with deterministic tie-break on index; emit `(min, max)`; dedupe via `a * N + b` in a `Set`; if the count exceeds `maxEdges`, stratified-subsample with the prng exactly as above; sort by edge length ascending (so lowering `connectionDensity` drops the longest edges first); return `Uint32Array` of pairs. O(N·k̄), computed once per `(id, N, seed)` — never per frame (ADR-0008).

_Registry_: ids validated with `FORMATION_ID_PATTERN` (A-13); built-in ids are reserved — `register` of a built-in id returns `'duplicate_id'` unless `override: true`; overriding logs `orb.formation.registered { override: true }`. `definitionFromPoints` normalizes once at registration and resamples per requested `n` with `prng` (already forked by id by the manager).

**Edge cases.**

- `points.length === 0` or `% 3 !== 0` → `FormationError('invalid_shape')`; any NaN/±Infinity → `'non_finite'` (checked before any arithmetic).
- `resampleFormation(points, 0, …)` → empty `Float32Array(0)`; `n` non-integer or negative → `'count_mismatch'`.
- Upsample where the jittered point leaves the unit sphere → scaled back to `|p| = 1`, never rejected.
- `computeEdges` on a formation with fewer than 2 points → empty `Uint32Array(0)`; `k = 0` → empty.
- `parseFormationId('Sphere')` (uppercase), `'-x'`, 65 chars → `'invalid_id'`.
- Two different `prng` seeds → different resample bytes for any `n ≠ m` (property test; equality would indicate a leaked global source).

**Acceptance criteria.**

- ORB-FORM-004 — Given any finite `Float32Array` of length `3·m`, `m ≥ 2`, non-degenerate; When normalized; Then bbox centre is at the origin ± 1e-6 and `max |p| = 1 ± 1e-6`, and normalizing the output again changes no coordinate by more than 1e-6 — `tests/unit/formations/normalize.property.test.ts`.
- ORB-FORM-005, ORB-FORM-011 — Given a formation and `n ∈ {1, 7, 3000, 5000, 15000, 50000}`; When resampled twice with `createPrng(seed).fork('x')`; Then `Buffer.compare` of the two outputs is 0, and a different seed yields a different buffer when `n ≠ m` — `tests/unit/formations/resample.property.test.ts`.
- ORB-FORM-008 — Given every `FormationDefinition` in the built-in registry and `n ∈ {2000, 3000, 5000, 15000, 50000}`; When `points(n, prng)` is called; Then the result has length `n·3`, is finite, and `isWithinUnitSphere` holds — `tests/unit/formations/required-set.test.ts`.
- ORB-FORM-011 — Given the built-in registry; When `computeEdges` runs twice for `network` at `n = 5000` with the same seed; Then edge arrays are byte-identical, `length/2 ≤ 2·n`, and every pair satisfies `a < b < n` — `tests/unit/formations/edges.test.ts`.

**Observability.** `orb.formation.registered { formationId, sourceKind: 'generator' | 'points' | 'svg-trusted', override, pointCount?, edgeCount? }`, `orb.formation.rejected { formationId?, code }`. No coordinates are ever logged.

### 4.2 Generators — bounded context `formations`

**Objective.** Ten procedural `FormationDefinition`s (the SVG-sourced `face` and `aisac` are in 4.3) with fixed named parameters, each a pure function of `(n, prng)`.

**Contracts.** One module per id under `formations/generators/<id>.ts` exporting `export const <camelId>: FormationDefinition` and `export const <CAMEL_ID>_PARAMS` (frozen constants); `formations/generators/index.ts` exports `BUILT_IN_DEFINITIONS(assets: TrustedAssetLoader): readonly FormationDefinition[]`. Golden fixtures: `tests/fixtures/formations/<id>.n1000.json` = `{ sample: number[192] /* first 64 points at n=1000, seed 1 */, edgeCount, edgesFnv1a }`.

**Behavior.** All generators iterate in index order, draw from `prng` only where noted, and produce `|p| ≤ 1` by construction. Transcendentals (`sin`, `cos`, `sqrt`, `cbrt`) are permitted in generators (not in `resample`/`edges`), hence golden tests compare positions with tolerance 1e-4 and edge indices exactly.

| id                 | Level         | Algorithm sketch                                                                                                                                                                  | Parameters (frozen)                                     | prng draws  | edges                                                        | is2D |
| ------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------- | ------------------------------------------------------------ | ---- |
| `sphere`           | MUST          | Fibonacci sphere: `y = 1 − 2(i+0.5)/n`, `r = sqrt(1−y²)`, `θ = i·2π(1−1/φ)`, `p = (r cos θ, y, r sin θ)`                                                                          | `radius 1`                                              | none        | —                                                            | no   |
| `rings`            | MUST          | particle `i` → ring `i mod R`; angle `2π·floor(i/R)/ceil(n/R)`; ring radii `[1, 0.72, 0.44]` tilted `[0°, 35°, 70°]` about x; tube jitter                                         | `R 3`, `radii`, `tilts`, `tube 0.02`                    | 3/pt        | —                                                            | no   |
| `neural`           | MUST          | `C = 24` cluster centres uniform in ball `r 0.75` (prng); point `i` → cluster `i mod C` + Irwin–Hall(3) offset `σ 0.12`; clamp to sphere                                          | `C 24`, `coreRadius 0.75`, `sigma 0.12`                 | 3·C + 9/pt  | `computeEdges(k 2, maxDistance 0.22)`                        | no   |
| `polyhedron`       | MUST          | icosahedron (golden-ratio vertices, radius 0.95): 60 % of points on its 30 edges (uniform `t`), 40 % on its 20 faces (barycentric via 2 draws)                                    | `edgeShare 0.6`, `radius 0.95`                          | 1–2/pt      | `computeEdges(k 3, maxDistance 0.18)`                        | no   |
| `network`          | MUST          | `H = clamp(round(√n / 2), 16, 256)` hubs uniform in ball `r 0.9`; 30 % of points at hubs (jitter 0.02), 70 % along segments between each hub and its 2 nearest hubs (uniform `t`) | `hubShare 0.3`, `hubLinks 2`, `jitter 0.02`             | 3·H + ≤3/pt | `computeEdges(k 3, maxDistance 0.12)` → lines along segments | no   |
| `gate`             | SHOULD (A-13) | two vertical pillars (cylinders `r 0.08`, `x = ±0.55`, `y ∈ [−0.8, 0.5]`) 35 % each, semi-torus arch (`R 0.55`, `r 0.08`) 30 %; point `i` → part by cumulative share              | `pillarX 0.55`, `pillarR 0.08`, `archR 0.55`            | 2/pt        | —                                                            | no   |
| `generic-tool`     | SHOULD (A-13) | gear: 70 % on ring `r = 0.8 + 0.15·sign(sin 8θ)` (8 teeth), 30 % on inner hexagon `r 0.35`; `z` uniform ±0.08                                                                     | `teeth 8`, `outer 0.8`, `toothDepth 0.15`, `depth 0.16` | 2/pt        | —                                                            | yes  |
| `explosion`        | SHOULD        | direction from Fibonacci sphere; 90 % at `r = 0.7 + 0.3·u`, 10 % "sparks" at `r = 0.3 + 0.7·u`                                                                                    | `shellMin 0.7`, `sparkShare 0.1`                        | 1/pt        | —                                                            | no   |
| `collapse`         | SHOULD        | 85 % uniform in ball `r 0.3` (`r = 0.3·cbrt(u)`, direction from 2 draws), 15 % on a thin ring `r 0.6` in the xy-plane                                                             | `coreR 0.3`, `ringR 0.6`, `ringShare 0.15`              | 3/pt        | —                                                            | no   |
| `error-distortion` | SHOULD        | Fibonacci sphere base; radial scale `1 − 0.25·u`; points with `abs(y) < 0.08` pushed `+0.3·sign(x)` along x (tear); 8 % scattered uniformly in the ball; clamp to sphere          | `tearBand 0.08`, `tearShift 0.3`, `scatterShare 0.08`   | 1–4/pt      | —                                                            | no   |

Part assignment by "share" always uses `floor(share · n)` cumulative boundaries so counts are exact and index-stable; the remainder goes to the last part.

**Edge cases.**

- `n < R` (e.g. `rings` with `n = 2`): rings with zero particles are simply empty; output still `n·3`.
- `n = 1`: every generator returns one finite point (Fibonacci with `n = 1` → `y = 0`).
- `n` above `maxParticles` is the manager's concern (`ParticleSystem` allocation); generators accept any `n ≥ 0`.
- `neural`/`network`/`polyhedron` at `n = 50 000`: `computeEdges` cap `2·n` bounds memory to 400 000 `Uint32` (1.6 MB).

**Acceptance criteria.**

- ORB-FORM-009 — Given the built-in registry; When `ids()` is read; Then it contains every id in `REQUIRED_FORMATIONS`, and each `points(15000, prng)` passes `assertFormation` and `isWithinUnitSphere` — `tests/unit/formations/required-set.test.ts`.
- ORB-FORM-010 — Given the registry; When the SHOULD set is resolved at `n = 5000`; Then all six resolve; `collapse` has `max |p| ≤ 0.6 + 1e-5`; `error-distortion` differs from `sphere` in ≥ 30 % of points by > 0.05 — `tests/unit/formations/should-set.test.ts`.
- ORB-FORM-011 — Given each generator at `n = 1000`, seed 1; When compared to `tests/fixtures/formations/<id>.n1000.json`; Then the first 64 points match within 1e-4 and `edgesFnv1a` matches exactly (`pnpm formations:golden --update` regenerates with a required PR note) — `tests/unit/formations/golden.test.ts`.

**Observability.** `orb.formation.resolved { formationId, n, cached, ms, edgeCount }` (from the manager cache, 4.5).

### 4.3 Inert SVG sampler (trusted assets) — bounded context `formations` (sub-slice `formations/svg`)

**Objective.** `SVG text → tokens (allow-list) → polylines (CTM applied) → arc-length contour sample (+ optional even-odd interior) → normalize → extrude → Formation`, with no DOM, no evaluation, no network, and the `face`/`aisac` formations produced from bundled assets.

**Contracts.**

```ts
// formations/svg/svgToFormation.ts
export interface SvgLimits {
  maxBytes: number;
  maxElements: number;
  maxPathCommands: number;
  maxDepth: number;
  maxSampledPoints: number;
}
// defaults from core/limits (A-18): 2 MiB, 5 000, 200 000, 64, 200 000 — applied here, verified as ORB-SVG-006 in Wave 6
export interface SvgSampleOptions {
  n: number;
  prng: Prng;
  depth?: number /* 0.15 */;
  noise?: number /* 0.02 */;
  fill?: { mode: "even-odd"; ratio: number /* 0–0.8 */ };
  forbidden?: "reject" | "drop" /* default 'reject' */;
  tolerance?: number /* 0.25 user units */;
  limits?: Partial<SvgLimits>;
}
export interface SvgParseError {
  code:
    | "DOCTYPE_NOT_ALLOWED"
    | "ENTITY_NOT_ALLOWED"
    | "FORBIDDEN_ELEMENT"
    | "FORBIDDEN_ATTRIBUTE"
    | "MALFORMED_XML"
    | "LIMIT_EXCEEDED"
    | "PATH_SYNTAX"
    | "NO_GEOMETRY";
  line: number;
  column: number;
  detail: string /* token/attribute NAME only — never source text */;
  limit?: keyof SvgLimits; /* set iff code === 'LIMIT_EXCEEDED' so Wave 6 can map to its per-limit FormationErrorCode */
}
export interface SvgWarning {
  code: "IGNORED_ELEMENT" | "IGNORED_ATTRIBUTE" | "DROPPED_FORBIDDEN" | "EMPTY_SHAPE";
  name: string;
  line: number;
}
export interface SvgSampleResult {
  formation: Formation;
  warnings: readonly SvgWarning[];
  stats: {
    elements: number;
    pathCommands: number;
    polylines: number;
    contourLength: number;
    contourPoints: number;
    fillPoints: number;
  };
}
export interface InertGeometry {
  polylines: readonly Polyline[];
  warnings: readonly SvgWarning[];
  stats: Pick<SvgSampleResult["stats"], "elements" | "pathCommands" | "polylines">;
}
export function parseInertSvg(
  svgText: string,
  opts: Pick<SvgSampleOptions, "forbidden" | "tolerance" | "limits">,
): Result<InertGeometry, SvgParseError>; // stages 1–4 (pre-scan, tokenize, classify, flatten); the Wave 6 Worker entry
export function svgToFormation(
  svgText: string,
  opts: SvgSampleOptions,
): Result<SvgSampleResult, SvgParseError>; // = parseInertSvg + sample + extrude + normalize (stages 5–6)

// formations/svg/tokenizer.ts  — hand-written, no DOMParser/innerHTML/eval anywhere under formations/** (ESLint no-restricted-globals + arch test)
export type SvgToken =
  | {
      kind: "start";
      name: string;
      attrs: ReadonlyMap<string, string>;
      selfClosing: boolean;
      line: number;
      column: number;
    }
  | { kind: "end"; name: string; line: number };
export function tokenize(
  text: string,
  limits: SvgLimits,
): Result<readonly SvgToken[], SvgParseError>;
// formations/svg/allowlist.ts
export const ALLOWED_ELEMENTS: ReadonlyMap<string, ReadonlySet<string>>; // element → attribute names read (table below)
export const IGNORED_ELEMENTS: ReadonlySet<string>;
export const FORBIDDEN_ELEMENTS: ReadonlySet<string>;
export const FORBIDDEN_ATTRIBUTES: ReadonlySet<string>;
export function classifyElement(name: string): "allowed" | "ignored" | "forbidden";
export function isForbiddenAttribute(name: string, value: string): boolean;
// formations/svg/flatten.ts
export type Mat2x3 = readonly [a: number, b: number, c: number, d: number, e: number, f: number];
export interface Polyline {
  pts: Float64Array /* x0,y0,… user units, CTM applied */;
  closed: boolean;
}
export function parseTransform(value: string): Result<Mat2x3, SvgParseError>; // matrix|translate|scale|rotate|skewX|skewY lists, composed left-to-right
export function flattenPath(
  d: string,
  ctm: Mat2x3,
  tolerance: number,
): Result<Polyline[], SvgParseError>; // M/L/H/V/C/S/Q/T/A/Z (+ relative); arc → cubic (SVG 1.1 F.6.5); adaptive subdivision
export function flattenShape(
  tok: Extract<SvgToken, { kind: "start" }>,
  ctm: Mat2x3,
): Result<Polyline[], SvgParseError>; // circle/ellipse (64 segments), rect (rx/ry), line, polyline, polygon
// formations/svg/sample.ts
export function sampleContours(polys: readonly Polyline[], count: number): Float64Array; // arc-length stratified, prng-free
export function sampleInterior(polys: readonly Polyline[], count: number, prng: Prng): Float64Array; // even-odd rejection sampling in bbox, ≤ 20·count attempts
// formations/svg/extrude.ts
export function extrude2D(xy: Float64Array, depth: number, noise: number, prng: Prng): Formation; // y flipped (SVG y-down → world y-up), normalized in 2D, z uniform in [−depth/2, depth/2], ±noise per axis, clamped to unit sphere
// formations/svg/trustedAssets.ts
export type TrustedAssetId = "face" | "aisac";
export interface TrustedAssetLoader {
  load(id: TrustedAssetId): string;
} // Next.js: `asset/source` webpack rule for assets/formations/*.svg; Node tests: fs
export const TRUSTED_ASSET_PRESETS: Readonly<
  Record<
    TrustedAssetId,
    Required<Pick<SvgSampleOptions, "depth" | "noise">> & { fill?: SvgSampleOptions["fill"] }
  >
>; // face: depth 0.12, noise 0.015, fill even-odd 0.15; aisac: depth 0.15, noise 0.02
export function trustedSvgFormation(
  id: TrustedAssetId,
  loader: TrustedAssetLoader,
): FormationDefinition; // is2D: true; a rejected trusted asset throws FormationError('asset_rejected') — a CI failure, never a runtime fallback
```

**Behavior.**

1. _Pre-scan_ (string level, before tokenizing): UTF-8 encoded byte length `> maxBytes` → `LIMIT_EXCEEDED`; case-insensitive presence of `<!DOCTYPE`, `<!ENTITY` or `<?xml-stylesheet` → `DOCTYPE_NOT_ALLOWED` / `ENTITY_NOT_ALLOWED` (no DTD is ever resolved; billion-laughs is rejected in O(bytes) before any expansion).
2. _Tokenize_: single pass; comments, CDATA, processing instructions and text nodes are skipped (text is never geometry); element names must match `^[A-Za-z][A-Za-z0-9-]*$` (namespaced `svg:path` accepted by stripping the prefix `svg`; any other prefix → ignored element); attribute values in `'` or `"`; only `&lt; &gt; &amp; &quot; &apos;` and `&#NN;`/`&#xHH;` are decoded, any other `&name;` → `ENTITY_NOT_ALLOWED`; unbalanced tags, depth > `maxDepth`, element count > `maxElements` → `MALFORMED_XML` / `LIMIT_EXCEEDED`.
3. _Classify_ every start tag with the allow-list. `forbidden: 'reject'` (default, trusted assets) fails the whole parse; `'drop'` (Wave 6 uploads) skips the subtree and records `DROPPED_FORBIDDEN`. Forbidden _attributes_ on an allowed element are fatal in both modes (a `<path onload>` is not geometry with a warning, it is an attack).
4. _Flatten_: CTM stack (`svg` root: `viewBox` → user units; `g`/shape `transform` composed); path commands counted against `maxPathCommands`; `fill-rule` and `fill="none"` recorded per polyline (interior sampling only considers closed polylines whose `fill` is not `none`).
5. _Sample_: `contourCount = n − fillCount` where `fillCount = fill ? floor(fill.ratio · n) : 0`; contour points allocated to polylines proportionally to arc length with largest-remainder rounding (exact total); position `(j + 0.5) / count_i` along each polyline — prng-free, so contour sampling is identical for any seed; interior sampling draws from `prng`, and if the attempt budget runs out the shortfall is filled from the contour so the count is always exactly `n`.
6. _Normalize + extrude_: y flipped, `normalizeFormation` in 2D, `z = (2u − 1)·depth/2`, then `±noise` per axis, clamp to unit sphere. `depth = 0` and `noise = 0` → every `z === 0` exactly and output is bit-stable across seeds.

Element allow-list (everything not listed is ignored with a warning or forbidden):

| Element                | Attributes read                                              | Everything else on it |
| ---------------------- | ------------------------------------------------------------ | --------------------- |
| `svg`                  | `viewBox`, `width`, `height`                                 | ignored               |
| `g`                    | `transform`                                                  | ignored               |
| `path`                 | `d`, `transform`, `fill-rule`, `fill`                        | ignored               |
| `circle`               | `cx`, `cy`, `r`, `transform`, `fill`                         | ignored               |
| `ellipse`              | `cx`, `cy`, `rx`, `ry`, `transform`, `fill`                  | ignored               |
| `rect`                 | `x`, `y`, `width`, `height`, `rx`, `ry`, `transform`, `fill` | ignored               |
| `line`                 | `x1`, `y1`, `x2`, `y2`, `transform`                          | ignored               |
| `polyline` / `polygon` | `points`, `transform`, `fill`                                | ignored               |

- Ignored elements (subtree skipped, `IGNORED_ELEMENT`): `defs`, `title`, `desc`, `metadata`, `clipPath`, `mask`, `marker`, `pattern`, `symbol`, `text`, `tspan`, `textPath`, `image`, `a`, `switch`, `filter`, `linearGradient`, `radialGradient`, `stop`, `view`, and any unknown name.
- Forbidden elements (`FORBIDDEN_ELEMENT`): `script`, `foreignObject`, `use`, `style`, `iframe`, `embed`, `object`, `audio`, `video`, `animate`, `animateTransform`, `animateMotion`, `set`, `discard`, `handler`, `listener`.
- Forbidden attributes (`FORBIDDEN_ATTRIBUTE`, any element): any name starting with `on` (case-insensitive), `href`, `xlink:href`, `style`, `filter`, `mask`, `clip-path`, `marker-start`, `marker-mid`, `marker-end`, `cursor`, `externalResourcesRequired`, `contentScriptType`, `contentStyleType`; any attribute value containing `url(`, `javascript:`, `data:` or `&{` (case-insensitive, after entity decoding).

Trusted assets: `assets/formations/face.svg` and `assets/formations/aisac.svg` are original line art (provenance and licence recorded in `assets/formations/LICENSE.md`, CC0 or Apache-2.0), `viewBox="0 0 512 512"`, ≤ 40 KB, ≤ 80 allowed elements, no forbidden or ignored elements (CI lint `pnpm svg:lint` runs the tokenizer in `'reject'` mode over `assets/formations/**` and fails on any warning). Samples are cached per `(id, n, seed)` by the manager (4.5); the face is sampled lazily on first request.

Malicious fixture corpus `tests/fixtures/svg/malicious/` (each file is a single-purpose probe; the expected outcome is listed):

| Fixture                                                                                                                 | Probe                                            | `'reject'`                                                     | `'drop'`                             |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------ |
| `script.svg`                                                                                                            | `<script>` sets `globalThis.__pwned`             | `FORBIDDEN_ELEMENT`                                            | dropped, geometry only               |
| `cdata-script.svg`                                                                                                      | `<script><![CDATA[…]]>`                          | `FORBIDDEN_ELEMENT`                                            | dropped                              |
| `onload.svg`, `onclick-path.svg`, `onbegin-mixed-case.svg`                                                              | `on*` handlers on `svg`/`path` (`ONLOAD`)        | `FORBIDDEN_ATTRIBUTE`                                          | `FORBIDDEN_ATTRIBUTE`                |
| `foreignobject.svg`                                                                                                     | `<foreignObject>` with HTML `<img onerror>`      | `FORBIDDEN_ELEMENT`                                            | dropped                              |
| `use-external.svg`, `use-local.svg`                                                                                     | `<use href="https://…">`, `<use href="#x">`      | `FORBIDDEN_ELEMENT`                                            | dropped                              |
| `image-external.svg`, `image-data-uri.svg`                                                                              | `<image href>` beacon                            | `FORBIDDEN_ATTRIBUTE`                                          | `FORBIDDEN_ATTRIBUTE`                |
| `xlink-javascript.svg`, `a-javascript.svg`                                                                              | `xlink:href="javascript:…"`                      | `FORBIDDEN_ATTRIBUTE`                                          | `FORBIDDEN_ATTRIBUTE`                |
| `style-element.svg`, `style-import.svg`, `style-attr-url.svg`                                                           | `<style>@import`, `style="…url(…)"`              | forbidden                                                      | forbidden (attr) / dropped (element) |
| `animate.svg`, `set-attribute.svg`                                                                                      | SMIL setting `href`/`onend`                      | `FORBIDDEN_ELEMENT`                                            | dropped                              |
| `billion-laughs.svg`, `external-dtd.svg`                                                                                | entity expansion, external DTD                   | `ENTITY_NOT_ALLOWED` / `DOCTYPE_NOT_ALLOWED` before tokenizing | same                                 |
| `xml-stylesheet-pi.svg`                                                                                                 | `<?xml-stylesheet href=…?>`                      | `DOCTYPE_NOT_ALLOWED`                                          | same                                 |
| `filter-mask-clip.svg`                                                                                                  | `filter=`, `mask=`, `clip-path=url(#)` on `path` | `FORBIDDEN_ATTRIBUTE`                                          | same                                 |
| `unicode-tag-spoof.svg`                                                                                                 | `<ſcript>`, `<scr​ipt>`                          | `MALFORMED_XML`                                                | same                                 |
| `attribute-injection.svg`                                                                                               | `d="M0 0" onload="…"` on one tag                 | `FORBIDDEN_ATTRIBUTE`                                          | same                                 |
| `unclosed-tags.svg`, `nested-svg-script.svg`                                                                            | truncated markup, `<svg><svg><script>`           | `MALFORMED_XML` / `FORBIDDEN_ELEMENT`                          | — / dropped                          |
| `deep-nesting.svg` (generated, 300 `<g>`), `too-many-elements.svg`, `too-many-commands.svg`, `huge-bytes.svg` (> 2 MiB) | limits                                           | `LIMIT_EXCEEDED`                                               | same                                 |

Benign corpus `tests/fixtures/svg/benign/`: `circle.svg`, `path-cubic.svg`, `path-arc.svg`, `path-relative.svg`, `polyline.svg`, `polygon-evenodd.svg` (donut), `rect-rounded.svg`, `nested-transforms.svg`, `viewbox-offset.svg`, `namespaced-prefix.svg`, plus the two trusted assets. Each has a `*.expected.json` with `{ polylines, contourLength, known: [{ index, xy }] }` for tolerance checks.

**Edge cases.**

- An SVG whose allowed elements produce zero polylines (only ignored content) → `NO_GEOMETRY`.
- A `path` with `d=""` → `EMPTY_SHAPE` warning, no error; a malformed `d` (`M 1 2 X`) → `PATH_SYNTAX` with line/column.
- `viewBox` missing → user units = geometry bbox (normalization makes the result identical anyway).
- `fill.ratio` requested but no closed fillable polylines → `fillPoints = 0`, all points on contours.
- `n = 0` → empty formation, no error; `n > maxSampledPoints` → `LIMIT_EXCEEDED`.
- Arc with zero radii → straight line per SVG spec; arc with out-of-range radii → radii scaled up per F.6.6.

**Acceptance criteria.**

- ORB-SEC-005, ORB-FORM-007 — Given each malicious fixture; When parsed in both modes under jsdom with spies on `fetch`, `XMLHttpRequest`, `Image`, `EventSource`, `document.createElement`, `Function`, `eval`; Then the outcome matches the table, `globalThis.__pwned` is `undefined`, no spy was called, `document.body.childElementCount` is unchanged, and the returned formation (if any) passes `assertFormation` — `tests/unit/formations-svg/malicious.test.ts`.
- ORB-FORM-007 — Given `formations/**` sources; When scanned by the architecture test; Then none contains `DOMParser`, `innerHTML`, `eval(`, `new Function`, `document.`, `window.`, `fetch(` and dependency-cruiser reports zero imports outside `core/` — `tests/architecture/formations-inert.test.ts`.
- ORB-SVG-001, ORB-SVG-005, ORB-SVG-003 — Given `assets/formations/face.svg` loaded through `TrustedAssetLoader`; When `trustedSvgFormation('face')` resolves at `n ∈ {5000, 15000}`; Then it passes `assertFormation`, `stats.contourPoints + stats.fillPoints === n`, warnings are empty, and the 2D projection's bbox aspect ratio matches the asset's within 2 % — `tests/unit/formations-svg/face-fixture.test.ts`; visual recognisability at 5 k and 15 k is signed off by a reviewer with screenshots attached in `docs/reference/formations.md` (manual).
- ORB-SVG-004 — Given `polygon-evenodd.svg`; When sampled with `depth 0` then `depth 0.3` (same seed); Then all `z === 0` in the first and `max z − min z ∈ [0.28, 0.30]` in the second, and `noise 0` makes the 2D coordinates identical between runs — `tests/unit/formations-svg/extrude.test.ts`.
- ORB-FORM-004 — Given `viewbox-offset.svg` (geometry far from the origin); When sampled; Then the bbox centre is at the origin ± 1e-6 and `max |p| = 1 ± 1e-6` — `tests/unit/formations-svg/benign.test.ts`.
- Allow-list snapshot — Given `ALLOWED_ELEMENTS`, `FORBIDDEN_ELEMENTS`, `FORBIDDEN_ATTRIBUTES`; When serialized; Then they equal `tests/fixtures/svg/allowlist.snapshot.json` (changing the allow-list requires updating the snapshot and `docs/security/threats/svg-import.md` in the same PR) — `tests/unit/formations-svg/allowlist.snapshot.test.ts`.

**Observability.** `orb.svg.parsed { assetId, elements, pathCommands, polylines, contourLength, contourPoints, fillPoints, warnings, ms }`, `orb.svg.rejected { assetId, code, line, column }` — `detail` is a token name, never markup; source text is never logged.

### 4.4 MorphController — bounded context `engine` (`engine/morph`)

**Objective.** A pure-TypeScript morph state machine with an injected `Clock`: from/to buffers, per-call duration and easing, per-particle stagger, CPU-baked interruption with zero displacement, and a typed completion channel that is structurally incapable of becoming an `OrbEvent`.

**Contracts.**

```ts
// core/easing.ts (Wave 0) — referenced here; GLSL twin in shaders/chunks/easing.glsl
// Import EasingId, EASINGS, EASING_INDEX and ease from core/easing.ts (W0); no local redefinition.
// EasingId = 'linear' | 'easeInOutCubic' | 'easeOutCubic' | 'easeInOutSine' | 'smoothstep'.
export const EASING_INDEX: Readonly<Record<EasingId, 0 | 1 | 2 | 3 | 4>>; // value of uMorphEasing
export function ease(id: EasingId, p: number): number; // p clamped to [0,1]; the TS/GLSL pair covers every kernel easing, including cosine for easeInOutSine; sampled parity tolerance is 1e-6

// engine/morph/MorphController.ts
export type MorphOutcome = "completed" | "interrupted" | "cancelled";
export interface MorphHandle {
  readonly promise: Promise<MorphOutcome>;
  cancel(): void;
}
export interface MorphCompletedEvent {
  outcome: MorphOutcome;
  targetId?: FormationId;
  durationMs: number;
  elapsedMs: number;
  progressAtEnd: number;
} // no `type`, no `timestamp`: not assignable to OrbEvent
export interface MorphFrame {
  active: boolean;
  progress: number /* raw p ∈ [0,1] */;
  from: Formation;
  to: Formation;
  dirty: boolean; /* buffers changed since last frame() */
}
export interface MorphControllerOptions {
  particleCount: number;
  clock: Clock;
  initial: Formation;
  phase?: Float32Array /* aPhase, N floats in [0,1) */;
  stagger?: number /* 0.15 */;
  defaultEasing?: EasingId /* 'smoothstep' */;
  logger?: Logger;
}
export interface MorphController {
  morphTo(
    target: Formation,
    opts: { durationMs: number; easing?: EasingId; targetId?: FormationId },
  ): MorphHandle;
  interrupt(nowMs: number): void; // CPU-bake current = mix(from, to, eased(localP)) into `from`; resolves the active handle 'interrupted'
  frame(nowMs: number): MorphFrame; // advances progress; completes when p reaches 1
  onComplete(cb: (e: MorphCompletedEvent) => void): () => void; // engine-internal typed emitter (ORB-MORPH-003)
  readonly current: Formation; // settled positions when idle (= from)
  dispose(): void; // resolves any active handle 'cancelled', removes listeners
}
export function createMorphController(opts: MorphControllerOptions): MorphController;
// engine/morph/MorphStrategy.ts — ADR-0009: `interface MorphStrategy { bake(from, to, p, phase, stagger, easing): void }` with `cpuBakeStrategy` as the only V1 implementation
```

Shader side (`shaders/chunks/easing.glsl`, `shaders/chunks/morph.glsl`; uniforms added to `UniformName`: `uMorphStagger`, `uMorphEasing`):

```glsl
// easing.glsl — constrained grammar: float literals, arithmetic, clamp/mix/step, max, comparisons, if/else, ternaries and cos; no dynamic evaluation.
// EASING_INDEX: linear=0, easeInOutCubic=1, easeOutCubic=2, easeInOutSine=3, smoothstep=4.
// orbEase implements the five core/easing.ts formulas; all five branches are checked by the TS/GLSL parity suite.
float orbEase(int id, float p);
// morph.glsl
float orbMorphLocal(float p, float phase, float stagger) { return clamp((p - phase * stagger) / max(1.0 - stagger, 1e-4), 0.0, 1.0); }
vec3 orbMorph(vec3 from, vec3 to, float p, float phase) { return mix(from, to, orbEase(uMorphEasing, orbMorphLocal(p, phase, uMorphStagger))); }
```

**Behavior.**

- _Progress_: `p(now) = durationMs === 0 ? 1 : clamp((now − startMs) / durationMs, 0, 1)` (ORB-MORPH-001). Per-particle local progress `p_i = clamp((p − phase_i·s) / (1 − s), 0, 1)`, eased `e_i = ease(easing, p_i)`, position `mix(from_i, to_i, e_i)`; with `phase` omitted, `s = 0` and every particle shares `p`.
- _Start_ (`morphTo` at `t0 = clock.now()`): `assertFormation(target, N)` (mismatch → throw `FormationError('count_mismatch')`; the manager resamples before calling); if active → `interrupt(t0)`; copy `target` into `to` (the caller's array is never retained); `startMs = t0`, `durationMs = max(0, opts.durationMs)`; mark `dirty`; log `orb.morph.started`.
- _Interrupt_ (`interrupt(now)`), the ORB-MORPH-002 core: `p = p(now)`; for each `i` in index order compute `e_i` exactly as the shader does and write `from_i = from_i + (to_i − from_i)·e_i` (float64 arithmetic, float32 store — the same rounding the GPU applies to the uploaded attribute); set `active = false`; resolve the handle `'interrupted'`; log `orb.morph.interrupted { progress, elapsedMs, bakeMs }`. O(N): ≈ 0.3 ms at 50 k particles on the reference machine. The subsequent `morphTo` starts at `p = 0` from the baked buffer with the full new duration (restart, not remaining time — deterministic and documented, per the analysis recommendation).
- _Atomicity_: the manager (4.5) applies bake → `uploadTargets(from, to)` → `setUniform('uMorphProgress', 0)` inside one `frame()` before `render()`; the GPU never observes a new `from` with an old `p` or vice versa.
- _Completion_: on the first `frame()` where `p === 1`, copy `to` into `from` (idle positions are the exact target, not a float32 mix), `active = false`, resolve `'completed'`, emit `MorphCompletedEvent`, log `orb.morph.completed`. `durationMs = 0` completes on the next `frame()` (A-15 path).
- _Cancel_: `handle.cancel()` = bake at `clock.now()` and stop with no target — particles hold their intermediate positions (`to` ← `from`), outcome `'cancelled'`.
- _Isolation_ (ORB-MORPH-004): `engine/morph` may import only `core/` and `formations/domain` (dependency-cruiser); it has no reference to `EventBus`, `StateMachine` or `OrbController` by construction; `MorphCompletedEvent` lacks `type`/`timestamp` so it cannot be passed to `EventBus.emit` without a compile error.

**Edge cases.**

- `morphTo` with `durationMs` negative → treated as 0; `NaN` → throw `RangeError`.
- `interrupt` when idle → no-op, no log.
- `frame(now)` with `now < startMs` (clock skew) → `p = 0`, no completion.
- Two `morphTo` calls in the same millisecond → the first resolves `'interrupted'` at `p = 0` (bake is the identity), the second proceeds normally.
- `dispose()` during an active morph → handle resolves `'cancelled'`; later `frame()` calls return `active: false` and never emit.
- A listener that throws inside `onComplete` → error logged `orb.morph.listener_error`, other listeners still run, the promise still resolves.

**Acceptance criteria.**

- ORB-MORPH-002 — Given random formations A, B, C at `n ∈ {100, 2000}`, random `phase`, `stagger ∈ [0, 0.5]`, each easing, and random `t_i ∈ (0, duration)`; When `morphTo(B)` is advanced to `t_i`, positions `P` are evaluated with the reference `mix` formula, then `morphTo(C)` is issued; Then `max_i |from_i − P_i| ≤ 1e-6` and the rendered position at the first frame of the new morph (`p = 0`) equals `from` exactly — `tests/unit/morph/interrupt.property.test.ts` (fast-check, `numRuns` 200 in CI, seed printed on failure).
- ORB-MORPH-001, ORB-FORM-002 — Given `durationMs ∈ {0, 1, 800, 5000}`; When `frame` is called at `startMs − 5`, `startMs`, every 16.67 ms, and `startMs + 10·durationMs`; Then progress is within `[0, 1]`, non-decreasing, reaches exactly 1, and `durationMs = 0` completes on the first `frame` — `tests/unit/morph/controller.test.ts`.
- ORB-MORPH-003 — Given an active morph; When it completes, is interrupted, or is cancelled; Then `handle.promise` resolves with the matching `MorphOutcome`, `onComplete` fires exactly once per morph with `progressAtEnd`, and an unsubscribed listener never fires — `tests/unit/morph/controller.test.ts`.
- ORB-MORPH-004 — Given `MorphCompletedEvent`; When type-checked against `OrbEvent` and `EventBus.emit`; Then `expectTypeOf<MorphCompletedEvent>().not.toMatchTypeOf<OrbEvent>()`; and at runtime, 100 completions with a spied `transition` never call it and `snapshot` is deep-equal before/after — `tests/unit/morph/never-semantic.test.ts`, `tests/architecture/morph-isolation.test.ts`.
- Easing parity — Given `shaders/chunks/easing.glsl`; When transliterated by `tests/support/glslEval.ts` (a ≤ 150-line evaluator for the constrained grammar above; the chunk header documents the grammar) and sampled at 1 001 values of `p` for each `EasingId`; Then `|glsl(p) − ease(id, p)| ≤ 1e-6`, and `orbMorphLocal` matches the TS twin for 1 001 × 5 `(p, phase, stagger)` samples — `tests/unit/morph/easing-parity.test.ts`.

**Observability.** `orb.morph.started { targetId, durationMs, easing, stagger }`, `orb.morph.interrupted { targetId, progress, elapsedMs, bakeMs }`, `orb.morph.completed { targetId, outcome, elapsedMs }`, `orb.morph.listener_error { message }`. `correlationId` is attached by the caller's child logger when an operation is active (Wave 4).

### 4.5 FormationManager + connection lines — bounded contexts `engine` (`engine/FormationManager.ts`, `engine/render/ConnectionLines.ts`) and `shaders`

**Objective.** The application service that turns a `FormationId` into GPU buffers: registry lookup, seeded resolve cache, resampling to the live particle count, morph orchestration through `ParticleBufferPort`, and connection edges rendered as `LineSegments` that share the particle attributes (ADR-0008).

**Contracts.**

```ts
// engine/ports/ParticleBufferPort.ts
export type ParticleBufferPort = Pick<
  RendererPort,
  "uploadTargets" | "setUniform" | "setConnections"
>;

// engine/FormationManager.ts
export interface FormationManagerOptions {
  registry: FormationRegistry;
  particleCount: number;
  prng: Prng /* engine prng; forked per id */;
  clock: Clock;
  port: ParticleBufferPort;
  phase?: Float32Array;
  initial?: FormationId /* 'sphere' */;
  defaultMorphDurationMs?: number /* 800 */;
  defaultEasing?: EasingId;
  logger?: Logger;
}
export interface ResolvedFormation {
  id: FormationId;
  n: number;
  points: Formation;
  edges: Uint32Array | null;
  is2D: boolean;
}
export interface FormationManager {
  readonly activeFormation: FormationId; // target of the latest morph (or initial)
  readonly particleCount: number;
  registerFormation(
    name: string,
    source: Float32Array | FormationDefinition["points"] | FormationDefinition,
    opts?: { override?: boolean; edges?: "auto" | Uint32Array },
  ): Result<FormationId, FormationError>; // SVG/url sources: Wave 6
  resolve(id: FormationId): ResolvedFormation; // cached per (id, n, seed); throws 'unknown_formation'
  morphTo(id: FormationId, opts?: { durationMs?: number; easing?: EasingId }): MorphHandle; // throws 'unknown_formation' synchronously (OrbEngine wraps into a rejected promise)
  setConnectionDensity(d: number): void; // requested 0–1
  setConnectionDensityCap(cap: number): void; // from QualityProfile.connectionDensityCap; effective = min(d, cap)
  setParticleCount(n: number): void; // ORB-RENDER-008 (Wave 2 owns): invalidate cache, resample active formation, instant placement (no morph)
  frame(nowMs: number): void; // morph.frame → if dirty: uploadTargets + setUniform('uMorphProgress', 0); every frame: setUniform('uMorphProgress', p)
  onMorphComplete(cb: (e: MorphCompletedEvent) => void): () => void;
  dispose(): void;
}
export function createFormationManager(opts: FormationManagerOptions): FormationManager;

// engine/render/ConnectionLines.ts (three)
export interface ConnectionLinesOptions {
  maxEdges: number /* 2·maxParticles */;
  sharedAttributes: {
    aFrom: THREE.BufferAttribute;
    aTo: THREE.BufferAttribute;
    aPhase: THREE.BufferAttribute;
    aSeed: THREE.BufferAttribute;
  };
}
export class ConnectionLines {
  readonly object: THREE.LineSegments;
  setEdges(edges: Uint32Array | null): void;
  setDensity(effective: number): void; /* drawRange = 2·floor(effective·edgeCount) */
  setUniform(name: UniformName, v: number): void;
  dispose(): void;
}
```

`RendererPort.setConnections(edges, density)` (Wave 2 port) is implemented in this wave by delegating to `ConnectionLines`; `uMorphProgress`, `uMorphStagger`, `uMorphEasing`, `uTime`, `uTurbulence` are shared between `particle.vert.glsl` and `connection.vert.glsl` through the same `uniforms.ts` object so lines and points always evaluate the identical `orbMorph` + displacement chain.

**Behavior.**

- _Resolve_: `def.points(n, prng.fork(id))`; if the definition came from `Float32Array` (already normalized) and `length ≠ n·3` → `resampleFormation(points, n, prng.fork(id))`; `edges = def.edges?.(n, prng.fork(id + ':edges')) ?? (opts.edges === 'auto' ? computeEdges(points, prng.fork(id + ':edges')) : null)`; generators receive `n` directly and are not resampled. Cache key `(id, n, engineSeed)`; invalidated by `setParticleCount` and by `override` registration. First resolve of `face` at 15 k must complete in ≤ 40 ms on the reference machine (perf-bench, non-blocking).
- _Morph_: `morphTo(id)` → `resolve(id)` → `morph.morphTo(points, { durationMs: opts.durationMs ?? default, easing, targetId: id })` → `activeFormation = id` → `port.setConnections(edges, effectiveDensity)` immediately (lines belong to the _target_ formation and fade in with `uMorphProgress` in `connection.frag.glsl`; a target without edges clears the lines at morph start).
- _Connections strategy (ADR-0008, implemented here)_: edges are precomputed per formation at resolve time (4.1), capped at `2·N`; the `LineSegments` geometry owns only an index buffer (`Uint32Array` of `2·edgeCount`) and _reuses_ the `THREE.BufferAttribute` instances of the particle geometry (`aFrom`, `aTo`, `aPhase`, `aSeed`), so the line vertex shader runs the same `orbMorph(aFrom, aTo, uMorphProgress, aPhase)` + displacement chunk and lines stay attached to particles during morph and turbulence with zero per-frame CPU work. `connectionDensity` maps to `setDrawRange(0, 2·floor(effective·edgeCount))` — an O(1) change; edges are length-sorted so thinning drops the longest first. Effective density = `min(requested, cap)`; `ci` and mobile presets set cap `0` → the lines object is not added to the scene (ORB-PERF-005 degrade axis). Material: additive blending, `depthWrite: false`, `uConnectionOpacity` (default 0.35) × `uMorphProgress` fade-in.
- _Reduced motion / state wiring_: not here — Wave 4 calls `morphTo(id, { durationMs: 0 })` under reduced motion (A-15).

**Edge cases.**

- `morphTo(activeFormation)` while idle → no-op morph: handle resolves `'completed'` on the next frame, no upload.
- `morphTo(unknown)` → `FormationError('unknown_formation')`; the active morph is unaffected.
- `setParticleCount(n)` mid-morph → morph cancelled (`'cancelled'`), cache invalidated, the _target_ formation resampled and placed instantly, connections recomputed.
- `registerFormation('sphere', …)` without `override` → `'duplicate_id'` and the built-in stays; with `override` the cache entry for `'sphere'` is dropped and the next morph uses the new definition.
- `setConnectionDensity(1.5)` / `(−1)` → clamped to `[0, 1]`; `NaN` → 0.
- `setConnections` called with an edge count above `maxEdges` (custom `Uint32Array` edges) → truncated to `maxEdges` with `orb.connections.truncated`.

**Acceptance criteria.**

- ORB-FORM-001, ORB-FORM-006 — Given `ParticleSystem` (Wave 2) + `FormationManager` with a fake clock; When morphing through all 12 built-ins in sequence, interrupting every second morph at 40 %, for 600 frames at 16.67 ms; Then `__orbDebug.renderer.id` is unchanged, `renderer.info.memory.geometries` is constant after the first frame, `uMorphProgress` is continuous (no frame-to-frame decrease except the reset to 0 at a morph start that coincides with a bake), and draw calls per frame are ≤ 2 — `tests/integration/morph-harness.test.ts` (Node, fake `RendererPort` recording calls) + `tests/e2e/morph.interrupt.spec.ts` (SwiftShader, `?preset=ci&seed=1`).
- ORB-FORM-011 — Given two `FormationManager`s built with `createPrng(7)`; When both resolve `neural` at 15 k; Then `points` and `edges` are byte-identical; with `createPrng(8)` they differ — `tests/unit/formation-manager/resolve.test.ts`.
- ORB-FORM-001 — Given `network` resolved at 5 k; When `setConnectionDensity(0.5)`; Then the fake port receives `edges` (unchanged reference) and `density 0.5`, and `ConnectionLines.object.geometry.drawRange.count === 2·floor(0.5·edgeCount)`; with cap 0 the object is not in the scene — `tests/unit/formation-manager/connections.test.ts`, `tests/integration/connection-lines.test.ts` (three + jsdom, no WebGL context needed for geometry assertions).
- ORB-MORPH-004 — Given the E2E harness; When `morphTo('face')` completes; Then `__orbDebug.snapshot` (state, activeOperation, lastOutcome) is deep-equal before and after and no `orb.state.transition` log line was emitted — `tests/e2e/morph.interrupt.spec.ts`.

**Observability.** `orb.formation.resolved { formationId, n, cached, ms, edgeCount }`, `orb.connections.updated { formationId, edgeCount, requested, effective, drawCount }`, `orb.connections.truncated { formationId, edgeCount, maxEdges }`, morph events from 4.4 re-emitted with `formationId`.

### 4.6 Playground additions — bounded context `components/playground`

**Objective.** Make every knob of this wave visible and scriptable so reviewers and E2E tests exercise the same paths.

**Contracts.** `components/playground/FormationPanel.tsx` (formation `<select>` listing `registry.ids()`, "Morph duration" range 0–5000 ms step 50, "Easing" select, "Connection density" range 0–1 step 0.05, "Interrupt mid-morph" button, "Seed" number input + "Apply" → navigates with `?seed=`), `components/store/orbStore.ts` gains `formation`, `morphDurationMs`, `easing`, `connectionDensity`. Debug snapshot additions (read-only, debug builds): `window.__orbDebug.morph = { active, progress, fromId, toId, lastOutcome, interrupts, lastBake: { progress, elapsedMs, bakeMs } | null }`, `window.__orbDebug.formation = { active, ids, edgeCount, connectionDensity: { requested, effective } }`.

**Behavior.** "Interrupt mid-morph" starts a morph to the _next_ formation in the select list and, via the injected `Scheduler` at 40 % of the current duration, a second morph to the one after it; both handles' outcomes are shown in the panel (`interrupted`, `completed`). Every control routes through `OrbEngine` methods (`morphTo`, `setConnectionDensity` via visual state) — never through the state controller; the panel is labelled "visual only" (ORB-PLAY-002, owned by Wave 4, is not weakened: nothing here touches governance).

**Edge cases.** Selecting the active formation → no-op (button disabled); duration 0 with reduced motion emulation → morph completes next frame and the outcome still displays; `?seed=` non-numeric → default seed 1 with a visible notice.

**Acceptance criteria.** ORB-FORM-001, ORB-MORPH-002 — Given `/playground?preset=ci&seed=1`; When "Interrupt mid-morph" is clicked; Then within 3 s the panel shows `interrupted` then `completed`, `__orbDebug.morph.interrupts === 1` and `lastBake.progress ∈ (0.3, 0.5)` — `tests/e2e/playground.formations.spec.ts`.

**Observability.** Only engine events; the panel emits no logs.

## 5. Parallel tracks

| Track                             | Slices    | Can start                                                                        | Meets at                                                                            |
| --------------------------------- | --------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A — geometry (pure TS)            | 4.1 → 4.2 | immediately after G0                                                             | `FormationRegistry` consumed by 4.5                                                 |
| B — SVG sampler (pure TS)         | 4.3       | immediately after G0; needs `face.svg`/`aisac.svg` assets commissioned in week 1 | `trustedSvgFormation` registered by `createBuiltInRegistry` (4.1)                   |
| C — morph (pure TS + GLSL chunks) | 4.4       | after G0 (`core/easing.ts`)                                                      | `MorphController` consumed by 4.5; chunks included by Wave 2's `particle.vert.glsl` |
| D — integration (three)           | 4.5 → 4.6 | after G2 and A/C interfaces frozen (day 1 stubs are fine)                        | `FormationManager` + `ConnectionLines` wired into `ParticleSystem`; E2E             |

A, B and C are independent Node-only tracks with fake `Prng`/`Clock`; D is the only track that needs a browser.

## 6. Threat model delta (STRIDE)

Only surfaces introduced or changed by this wave. Mitigations land in this wave; the full model is `docs/security/threats/svg-import.md`.

| Surface                                                        | S                                                 | T                                                                     | R                         | I                                               | D                                                     | E                                             | Mitigation                                                                                                                                                                                                                                                                                                                                                      | Req IDs                                  |
| -------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------- | ------------------------- | ----------------------------------------------- | ----------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Bundled SVG assets → inert sampler (`assets/formations/*.svg`) | –                                                 | PR/supply chain adds `<script>`/`on*`/`<use href>` to a trusted asset | asset provenance disputed | `<image href>`, `<use href>`, `@import` beacons | billion laughs, external DTD, deep nesting, huge file | script/SMIL/foreignObject execution           | Hand-written tokenizer, no DOM, no eval (lint + arch test); allow-list snapshot; `'reject'` mode + `pnpm svg:lint` in CI over `assets/formations/**`; CODEOWNERS on that folder; pre-scan rejects DOCTYPE/ENTITY/PI; limits from `core/limits`; CSP `img-src 'self' data:` unchanged; provenance in `assets/formations/LICENSE.md`; structured `orb.svg.*` logs | ORB-SEC-005, ORB-FORM-007, ORB-SVG-001   |
| `registerFormation` (in-process, Float32Array/generator)       | name collision impersonates a built-in (`'gate'`) | override of a semantic formation                                      | –                         | –                                               | `length % 3 ≠ 0`, NaN, 10⁸ points, throwing generator | –                                             | Built-in ids reserved (`override` explicit + logged); `assertFormation`; count from the engine (`maxParticles` alloc) not the source; generator exceptions caught → `FormationError`; a11y text (Wave 1) remains the sole semantic indicator                                                                                                                    | ORB-FORM-004, ORB-FORM-005, ORB-FORM-007 |
| Morph completion channel                                       | –                                                 | –                                                                     | –                         | –                                               | –                                                     | completion misread as backend/tool completion | `MorphCompletedEvent` not assignable to `OrbEvent`; `engine/morph` cannot import bus/state (dependency-cruiser); runtime snapshot-unchanged test                                                                                                                                                                                                                | ORB-MORPH-004, ORB-ARCH-004              |
| Connection edges (memory / GPU)                                | –                                                 | custom `edges` with out-of-range indices                              | –                         | –                                               | `N²` edges, per-frame rebuild                         | –                                             | Cap `2·N`, index validated `< N`, precomputed once, `drawRange` only per frame, cap 0 on mobile/ci                                                                                                                                                                                                                                                              | ORB-PERF-005, ORB-FORM-007               |
| Playground formation controls                                  | –                                                 | –                                                                     | –                         | –                                               | morph spam (a `morphTo` per ms)                       | governance bypass via visuals                 | Manager coalesces: a new `morphTo` replaces the previous (bake is O(N), bounded); controls never reach `OrbController`; debug snapshot read-only                                                                                                                                                                                                                | ORB-PLAY-002 (Wave 4), ORB-FORM-006      |

## 7. Tests

| Test (name references requirement IDs)                                                                                                                                                           | Type        | Req IDs                                                  | File                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `${req('ORB-FORM-004')}` normalize: centre at origin, max radius 1, idempotent, degenerate → origin (fast-check)                                                                                 | unit        | ORB-FORM-004                                             | `tests/unit/formations/normalize.property.test.ts`     |
| `${req('ORB-FORM-005','ORB-FORM-011')}` resample byte-identical per (input, n, seed); differs across seeds; bbox within 5 %                                                                      | unit        | ORB-FORM-005, ORB-FORM-011                               | `tests/unit/formations/resample.property.test.ts`      |
| `${req('ORB-FORM-011')}` computeEdges deterministic, `a<b<n`, ≤ 2·n, sorted by length                                                                                                            | unit        | ORB-FORM-011                                             | `tests/unit/formations/edges.test.ts`                  |
| `${req('ORB-FORM-008','ORB-FORM-009')}` every built-in returns n·3 finite floats inside the unit sphere for n ∈ {2000, 3000, 5000, 15000, 50000}; required ids present                           | unit        | ORB-FORM-008, ORB-FORM-009                               | `tests/unit/formations/required-set.test.ts`           |
| `${req('ORB-FORM-010')}` SHOULD set resolves; collapse compact; error-distortion ≠ sphere                                                                                                        | unit        | ORB-FORM-010                                             | `tests/unit/formations/should-set.test.ts`             |
| `${req('ORB-FORM-011')}` golden fixtures per generator at n=1000 (positions 1e-4, edges hash exact)                                                                                              | unit        | ORB-FORM-011                                             | `tests/unit/formations/golden.test.ts`                 |
| `${req('ORB-FORM-004','ORB-FORM-007')}` registry: id pattern, reserved built-ins, override logged, throwing generator → FormationError                                                           | unit        | ORB-FORM-004, ORB-FORM-007                               | `tests/unit/formations/registry.test.ts`               |
| `${req('ORB-SEC-005','ORB-FORM-007')}` malicious corpus in both modes: expected code, no canary, no spy calls, DOM untouched                                                                     | unit        | ORB-SEC-005, ORB-FORM-007                                | `tests/unit/formations-svg/malicious.test.ts`          |
| `${req('ORB-SVG-001','ORB-FORM-004')}` benign corpus: polyline counts, known points within 1e-3 user units, normalized output                                                                    | unit        | ORB-SVG-001, ORB-FORM-004                                | `tests/unit/formations-svg/benign.test.ts`             |
| `${req('ORB-SVG-001')}` tokenizer: entities, CDATA/comments/PI skipped, namespaced prefix, unbalanced → MALFORMED_XML, limits → LIMIT_EXCEEDED                                                   | unit        | ORB-SVG-001                                              | `tests/unit/formations-svg/tokenizer.test.ts`          |
| `${req('ORB-SVG-003')}` flatten: arc→cubic against SVG 1.1 F.6 reference points, transforms composed, relative commands                                                                          | unit        | ORB-SVG-003                                              | `tests/unit/formations-svg/flatten.test.ts`            |
| `${req('ORB-SVG-004')}` extrude: depth 0 → z = 0; depth 0.3 → range; noise 0 → stable; even-odd fill ratio honoured                                                                              | unit        | ORB-SVG-004                                              | `tests/unit/formations-svg/extrude.test.ts`            |
| `${req('ORB-SVG-001','ORB-SVG-005','ORB-SVG-003')}` face + aisac assets: no warnings, exact n, aspect ratio, cached resolve                                                                      | unit        | ORB-SVG-001, ORB-SVG-005, ORB-SVG-003                    | `tests/unit/formations-svg/face-fixture.test.ts`       |
| `${req('ORB-SEC-005')}` allow-list snapshot                                                                                                                                                      | unit        | ORB-SEC-005                                              | `tests/unit/formations-svg/allowlist.snapshot.test.ts` |
| `${req('ORB-FORM-007')}` formations/** contain no DOM/eval tokens; imports only core                                                                                                             | arch        | ORB-FORM-007                                             | `tests/architecture/formations-inert.test.ts`          |
| `${req('ORB-MORPH-002')}` interrupt bake equals rendered position (fast-check, 200 runs)                                                                                                         | unit        | ORB-MORPH-002                                            | `tests/unit/morph/interrupt.property.test.ts`          |
| `${req('ORB-MORPH-001','ORB-FORM-002','ORB-MORPH-003')}` progress bounds, durations, outcomes, listeners, cancel, dispose                                                                        | unit        | ORB-MORPH-001, ORB-FORM-002, ORB-MORPH-003               | `tests/unit/morph/controller.test.ts`                  |
| `${req('ORB-MORPH-002')}` GLSL/TS easing + local-progress parity (1 001 samples, 1e-6)                                                                                                           | unit        | ORB-MORPH-002                                            | `tests/unit/morph/easing-parity.test.ts`               |
| `${req('ORB-MORPH-004')}` completion event not an OrbEvent (type-level); snapshot unchanged after 100 completions                                                                                | unit        | ORB-MORPH-004                                            | `tests/unit/morph/never-semantic.test.ts`              |
| `${req('ORB-MORPH-004')}` engine/morph imports only core + formations/domain                                                                                                                     | arch        | ORB-MORPH-004                                            | `tests/architecture/morph-isolation.test.ts`           |
| `${req('ORB-FORM-011','ORB-FORM-001')}` manager resolve cache, seeds, unknown id, override invalidation, setParticleCount instant placement                                                      | unit        | ORB-FORM-011, ORB-FORM-001                               | `tests/unit/formation-manager/resolve.test.ts`         |
| `${req('ORB-FORM-001')}` connections: density → port call, clamp, cap 0, truncation                                                                                                              | unit        | ORB-FORM-001                                             | `tests/unit/formation-manager/connections.test.ts`     |
| `${req('ORB-FORM-001','ORB-FORM-006')}` 600-frame harness through all built-ins with interruptions on a fake port: upload/uniform ordering atomic, progress continuous                           | integration | ORB-FORM-001, ORB-FORM-006                               | `tests/integration/morph-harness.test.ts`              |
| `${req('ORB-FORM-001')}` ConnectionLines shares attribute instances, drawRange math, dispose releases index buffer                                                                               | integration | ORB-FORM-001                                             | `tests/integration/connection-lines.test.ts`           |
| `${req('ORB-FORM-001','ORB-FORM-006','ORB-MORPH-002','ORB-MORPH-004')}` E2E sphere→face→network with interruption under SwiftShader; renderer id stable; progress continuous; snapshot unchanged | e2e         | ORB-FORM-001, ORB-FORM-006, ORB-MORPH-002, ORB-MORPH-004 | `tests/e2e/morph.interrupt.spec.ts`                    |
| `${req('ORB-FORM-009','ORB-SVG-005')}` E2E cycle through the six required formations; face visible (non-zero pixel coverage in the face bbox)                                                    | e2e         | ORB-FORM-009, ORB-SVG-005                                | `tests/e2e/formations.cycle.spec.ts`                   |
| `${req('ORB-FORM-001','ORB-MORPH-002')}` playground interrupt button flow                                                                                                                        | e2e         | ORB-FORM-001, ORB-MORPH-002                              | `tests/e2e/playground.formations.spec.ts`              |
| `${req('ORB-SVG-003')}` face recognisable at 5 k and 15 k — reviewer sign-off with screenshots                                                                                                   | manual      | ORB-SVG-003                                              | `docs/reference/formations.md`                         |
| Resolve/bake timings: face 15 k resolve ≤ 40 ms, bake 50 k ≤ 1 ms (reference machine), nightly                                                                                                   | perf        | ORB-MORPH-002                                            | `tests/perf/formations.bench.ts`                       |

CI: every unit/arch/integration test plus the three E2E specs run on every PR (`?preset=ci` = 2 000 particles, connections cap 0 except `connection-lines` which runs in jsdom without GL; `?seed=1`; fake `Clock` in Node; `page.clock` in Playwright). Determinism: fast-check seeds are printed and re-runnable via `FC_SEED`; golden files are regenerated only by `pnpm formations:golden --update` with a PR note; no `sleep`, no real timers. Perf and manual rows are non-blocking for G3 but recorded.

## 8. ADRs to record

- ADR-0009 — Morph interruption strategy: **context** ORB-MORPH-002 forbids snapping when a morph is superseded, while the GPU only sees `from`/`to`/`p`; **options** (a) CPU-bake `from = mix(from, to, eased(p))` on interrupt (O(N) once, exact, testable in Node), (b) GPU ping-pong position textures / transform feedback (velocity-continuous but needs float textures, breaks shared-attribute connections, untestable headlessly), (c) `readPixels` of GPU positions (stalls the pipeline); **recommendation** (a) behind a `MorphStrategy` interface with the per-particle stagger/easing duplicated in TS and GLSL and enforced by a parity test; (b) recorded as the future WebGPU-era strategy.
- ADR-0010 — SVG inert parsing: **context** ORB-SEC-005/ORB-FORM-007 require geometry without any execution path, for bundled assets now and uploads in Wave 6; **options** (a) hand-written allow-list XML tokenizer + own path flattener (zero deps, Node-testable, reject-by-default), (b) `DOMParser('image/svg+xml')` on a detached document + `getPointAtLength` (browser-only, a live DOM object exists, jsdom lacks path geometry), (c) DOMPurify + DOM parse (sanitizes for _display_, still constructs a DOM, broader surface); **recommendation** (a) with `'reject'` for trusted assets and `'drop'` for uploads, an allow-list snapshot test and a malicious corpus; `svgpath`-class libraries may be vendored for arc math only if audited.
- ADR-0008 (recorded in Wave 2) is _implemented_ here as specified in 4.5; no new decision.

## 9. Deliverables

- `formations/domain/{Formation,FormationId,normalize,resample,edges}.ts`, `formations/registry.ts`, `formations/generators/{sphere,rings,neural,polyhedron,network,gate,generic-tool,explosion,collapse,error-distortion,index}.ts`, `formations/index.ts` (public surface: types, `BUILT_IN_FORMATIONS`, `normalizeFormation`, `resampleFormation`, `computeEdges`, `createBuiltInRegistry`, `svgToFormation`).
- `formations/svg/{tokenizer,allowlist,flatten,sample,extrude,svgToFormation,trustedAssets}.ts`.
- `assets/formations/face.svg`, `assets/formations/aisac.svg`, `assets/formations/LICENSE.md`; `next.config.ts` `asset/source` rule; `scripts/svg-lint.ts` (`pnpm svg:lint`), `scripts/formations-golden.ts` (`pnpm formations:golden`).
- `core/easing.ts` (extend Wave 0 with `EASING_INDEX` if absent), `shaders/chunks/{easing,morph,displacement}.glsl`, `shaders/connection.vert.glsl`, `shaders/connection.frag.glsl`, `shaders/index.ts` exports.
- `engine/morph/{MorphController,MorphStrategy}.ts`, `engine/ports/ParticleBufferPort.ts`, `engine/FormationManager.ts`, `engine/render/ConnectionLines.ts`, `engine/render/uniforms.ts` (+ `uMorphStagger`, `uMorphEasing`, `uConnectionOpacity`), `engine/render/ParticleSystem.impl.ts` (implements `setConnections`, includes the chunks).
- `components/playground/FormationPanel.tsx`, `components/store/orbStore.ts` fields, `__orbDebug.morph` / `.formation`.
- Tests and fixtures listed in §7 plus `tests/support/glslEval.ts`, `tests/fixtures/formations/*.n1000.json`, `tests/fixtures/svg/{benign,malicious}/**`, `tests/fixtures/svg/allowlist.snapshot.json`.
- Docs: `docs/adr/0009-morph-interruption-strategy.md`, `docs/adr/0010-svg-inert-parsing.md`, `docs/security/threats/svg-import.md`, `docs/reference/formations.md` (ids, parameters, generator sketches, screenshots at 5 k/15 k, allow-list), `docs/explanation/morphing.md` (why bake, why restart-not-resume, why completion is not evidence), `.dependency-cruiser.cjs` rules for `formations/**` and `engine/morph/**`, `.eslintrc` `no-restricted-globals`/`no-restricted-syntax` for `formations/**`.
- `specs/TRACEABILITY.md` rows for the 19 owned IDs; `specs/requirement-ids.lock` unchanged (no new IDs introduced by this wave).

## 10. Exit criteria (Gate G3)

1. `tests/unit/formations/required-set.test.ts` green: all 12 built-ins return `n·3` finite floats inside the unit sphere for `n ∈ {2000, 3000, 5000, 15000, 50000}`; `REQUIRED_FORMATIONS` all present.
2. `resample.property.test.ts` and `edges.test.ts` green: byte-for-byte determinism for the same `(input, n, seed)`, divergence across seeds, 200 fast-check runs.
3. `golden.test.ts` green with committed fixtures for all 10 procedural generators.
4. `malicious.test.ts` green for every fixture in `tests/fixtures/svg/malicious/` in both modes; `allowlist.snapshot.test.ts` green; `formations-inert.test.ts` (arch) green; `pnpm svg:lint` green over `assets/formations/**`.
5. `face-fixture.test.ts` green at 5 k and 15 k; reviewer sign-off with screenshots recorded in `docs/reference/formations.md` for `face` and `aisac`.
6. `interrupt.property.test.ts` green (`max |pos(t_interrupt) − new from| ≤ 1e-6`, 200 runs) and `easing-parity.test.ts` green (1e-6 over 1 001 samples per easing).
7. `never-semantic.test.ts` and `morph-isolation.test.ts` green; `expectTypeOf<MorphCompletedEvent>().not.toMatchTypeOf<OrbEvent>()` compiles as a passing assertion.
8. `tests/integration/morph-harness.test.ts` green (600 frames, all built-ins, interruptions, atomic upload/uniform ordering) and `tests/integration/connection-lines.test.ts` green (shared attribute instances by identity).
9. E2E under SwiftShader green in CI: `morph.interrupt.spec.ts` (renderer id stable, `__orbDebug.morph.progress` continuous, snapshot unchanged by completion), `formations.cycle.spec.ts`, `playground.formations.spec.ts`.
10. `pnpm req:coverage` shows every MUST in §3 covered by ≥ 1 test and no uncovered MUST; `specs/TRACEABILITY.md` updated.
11. ADR-0009 and ADR-0010 accepted; `docs/security/threats/svg-import.md` merged; dependency-cruiser passes with the new `formations/**` and `engine/morph/**` rules.
12. `tests/perf/formations.bench.ts` numbers recorded in `docs/reference/perf-matrix.md` (non-blocking: face 15 k resolve ≤ 40 ms, 50 k bake ≤ 1 ms on the reference machine).

## 11. Risks, spikes and open questions

- Risk: face quality from contour-only sampling looks sparse or "uncanny" → mitigation: even-odd interior fill at ratio 0.15 for eyes/mouth, depth 0.12, and a day-1 spike rendering the commissioned `face.svg` at 5 k/15 k before the asset is finalised (owner: maintainer; result in `docs/reference/formations.md`).
- Risk: transcendental drift across JS engines breaks golden tests (WebKit `Math.sin` differs in the last ulp) → mitigation: goldens compare positions at 1e-4 and only integer artefacts (edges) exactly; `resample`/`edges` are transcendental-free by rule (lint `no-restricted-properties` on `Math.sin|cos|pow|exp` inside `formations/domain/resample.ts` and `edges.ts`).
- Risk: CPU bake at 50 k particles on low-end mobile exceeds a frame during a morph storm → mitigation: bake is O(N) with float64 math (bench ≤ 1 ms desktop); interrupts are coalesced per frame; if the mobile perf matrix (Wave 8) shows > 4 ms, ADR-0009 option (b) is the recorded escalation.
- Risk: `asset/source` webpack rule conflicts with Next.js's default SVG handling or Turbopack → spike (½ day): verify `import face from '@/assets/formations/face.svg'` yields a string under both bundlers; fallback is a `scripts/prebake-formations.ts` step emitting `assets/formations/<id>.svg.ts` string modules (still the same inert pipeline at runtime).
- Risk: the constrained-GLSL evaluator in `tests/support/glslEval.ts` silently accepts constructs that differ in real GLSL (integer division, precision) → mitigation: the chunk uses floats only, no integer arithmetic beyond `id` comparisons, `highp` declared; nightly E2E pixel-delta check between consecutive frames at an interruption as a second signal.
- Spike: arc-to-cubic and adaptive flattening correctness → validate against SVG 1.1 F.6 worked examples and a browser `getPointAtLength` cross-check run manually once (documented in `flatten.test.ts` fixture provenance).
- Open question (spec-amendment writer / maintainer): the ORB-FORM-008 level raise (§11 SHOULD → MUST, amendment Q-5) needs maintainer sign-off in the 0.2.0 PR; this wave treats `N × 3` as a hard contract of `Formation` either way.
- Shared easing contract reconciled: use W0's five EasingId values and indices; the GLSL twin and parity evaluator cover all five, including cosine for easeInOutSine.
- Open question (Wave 2 owner): `ParticleSystem` must expose the `aPhase`/`aSeed` `BufferAttribute` instances (or accept `ConnectionLines` as a collaborator) so the line geometry can share them by identity; and must accept `phase: Float32Array` generation from `prng.fork('phase')` so the manager can pass the same array to `MorphController`.
- Open question (maintainer): who produces the original `face.svg`/`aisac.svg` and under which licence (CC0 vs Apache-2.0 contribution) — blocks item 5 of G3.
- Open question (Wave 6 owner): whether `'drop'` mode should also surface a user-visible count of dropped forbidden elements; this wave only records `SvgWarning`s.
- Open question (Wave 6 owner): mapping `SvgParseError.code` (+ `limit`) onto Wave 6's `FormationErrorCode` — `LIMIT_EXCEEDED`/`maxBytes|maxElements|maxDepth|maxPathCommands|maxSampledPoints` → `TOO_LARGE|TOO_MANY_ELEMENTS|NESTING_TOO_DEEP|TOO_MANY_PATH_COMMANDS|TOO_MANY_POINTS`, `MALFORMED_XML` → `MALFORMED_SVG`; the mapping test lives in Wave 6 and no code is dropped silently.

## 12. Playground and demo controls introduced

- `FormationPanel`: formation selector (all registry ids), morph duration (0–5000 ms), easing (`linear` / `smoothstep` / `easeInOutCubic`), connection density (0–1, shows requested vs effective under the active quality cap), "Interrupt mid-morph" button with outcome readout, seed input (`?seed=`).
- Debug snapshot: `window.__orbDebug.morph` (`active`, `progress`, `fromId`, `toId`, `lastOutcome`, `interrupts`, `lastBake`) and `window.__orbDebug.formation` (`active`, `ids`, `edgeCount`, `connectionDensity`).
- Demo page (`/`): none in this wave — formation changes driven by state arrive in Wave 4.
