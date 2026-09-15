# Wave 2 — GPU particle renderer and quality

| Field                     | Value                                                                                                                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                | proposed                                                                                                                                                                                                                                                                      |
| **Milestones (SPEC §27)** | V0.1 Particle renderer (+ the §10 preset/adaptive-quality half of V1 performance)                                                                                                                                                                                             |
| **Depends on**            | Wave 0 (`core/` kernel: `Clock`, `Scheduler`, `Prng`, `Logger`, `limits`; CI with SwiftShader + `--disable-webgl` projects; `req()` tooling; CSP nonce; dependency-cruiser). Runs concurrently with Wave 1; shares only `core/` and the port interfaces below                 |
| **Spec version**          | SPEC.md 0.2.0 (0.1.0 + amendments; decisions A-15, A-16 apply — see `specs/SPEC-amendments-proposal.md`)                                                                                                                                                                      |
| **Gate**                  | G2 — a configurable-count `THREE.Points` renderer behind `RendererPort` renders under SwiftShader in CI, degrades gracefully without WebGL, adapts quality without oscillation, honours reduced motion through `uMotionScale`, and mounts exactly once under React StrictMode |
| **Estimated size**        | L — Three.js infrastructure + GLSL + a pure quality controller + React host + playground v0 + nightly perf probe                                                                                                                                                              |

## 1. Objective

At the end of this wave `/playground` shows a seeded sphere of 3 000–50 000 additive point sprites drawn by one `THREE.Points` + `BufferGeometry` + `ShaderMaterial`, hosted by a thin React component around a framework-agnostic `OrbEngine` (ADR-0001). Particle count, quality preset, pixel ratio, shader tier and post-processing change at runtime without recreating the renderer, canvas or GL context (ORB-RENDER-004/008). A pure `QualityController` degrades and upgrades quality axes independently with hysteresis (ORB-PERF-003/005). When WebGL is unavailable the engine constructs anyway in headless mode and the host shows a text fallback (ORB-RENDER-006). `prefers-reduced-motion` sets `uMotionScale = 0` from day one (ORB-A11Y-003). Everything observable is exposed read-only through `window.__orbDebug` (`?debug=1`) so CI asserts semantics, not pixels (ADR-0004). No formation other than a bootstrap sphere, no morph, no state, no events — those arrive in Waves 3 and 4 on top of the ports frozen here.

## 2. Scope

### 2.1 In scope

- `shaders/`: `particle.vert.glsl`, `particle.frag.glsl`, `chunks/noise.glsl`, typed loader `shaders/index.ts` with the attribute/uniform contract (§4.1).
- `engine/ports/`: `RendererPort`, `ParticleBufferPort`, `FrameTimeSource`, `NullRenderer` (headless implementation, pure TS).
- `engine/render/` + `engine/ParticleSystem.ts`: allocate-max / draw-range particle system, DPR cap, additive blending, context-loss handling, disposal, optional bloom pass, bootstrap sphere.
- `engine/quality/`: `capabilities.ts`, `presets.ts` (`QUALITY_PRESETS`, `selectInitialPreset`), `FrameTimeSampler.ts`, `ladder.ts`, `QualityController.ts`.
- `engine/OrbEngine.ts` v0 + `engine/index.ts` v0 (construct / resize / dispose / count / quality / visual override / reduced motion; `setState`, `morphTo`, `emit` are stubs that throw `NotImplementedError` until Wave 4 and are excluded from the v0 export snapshot).
- `components/orb/OrbCanvas.tsx`, `useOrbEngine.ts`, `OrbFallback.tsx`; `components/store/orbStore.ts` v0 (quality + motion fields).
- `/playground` v0 with `QualityPanel`, `MotionPanel`, `PerfReadout`; `app/smoke/**` from Wave 0 deleted and its arch sunset guard flipped.
- Playwright `perf` project (nightly, non-blocking) + `docs/reference/perf-matrix.md` template.
- ADR-0007 (adaptive quality controller) and ADR-0008 (connection rendering strategy — decided here, implemented in Wave 3).

### 2.2 Out of scope (deferred)

- Procedural formations, `FormationManager`, `MorphController`, `uMorphProgress` animation (v1 shader mixes `position → aTarget` with a constant progress), `ConnectionLines` (`setConnections` is a recorded no-op returning `connections.supported = false` until Wave 3) → Wave 3.
- `OrbController` wiring, `setState`/`emit`/`morphTo`, visual policy, a11y state panel, public API snapshot (ORB-API-001) → Wave 4 (Wave 1 for the semantic side).
- Pointer and audio uniforms are declared and default to zero; no input pipeline → Wave 5.
- Real-device perf matrix rows, preset tuning, WebGL1 fallback check on a real device, cross-browser smoke → Wave 8.

## 3. Requirements owned by this wave

Every ID listed here is owned by this wave and must be fully satisfied and verified before the gate closes. These are planned obligations; no test evidence is implied. Shared declaration owners and integration rules are in `specs/SHARED-CONTRACTS.md`.

| ID             | Level    | Summary                                                                                                                                                                                                                                               | Slice    | Verification                                                                                                               |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| ORB-RENDER-001 | MUST     | Rendering MUST use GPU-accelerated browser graphics.                                                                                                                                                                                                  | 4.2      | e2e (SwiftShader smoke: live WebGL2 context, frames advance)                                                               |
| ORB-RENDER-002 | MUST NOT | MUST NOT create one independent Three.js `Mesh` per particle.                                                                                                                                                                                         | 4.2      | unit (scene = 1 `Points`) + e2e (`render.calls ≤ 3` at 1 000 and 5 000)                                                    |
| ORB-RENDER-003 | MUST     | Particle count MUST be configurable.                                                                                                                                                                                                                  | 4.2, 4.4 | unit (option + runtime setter, clamped) + e2e (`?particles=`)                                                              |
| ORB-RENDER-004 | MUST NOT | Formation changes MUST NOT recreate the renderer.                                                                                                                                                                                                     | 4.2      | unit (identity of renderer / canvas / context / `Points` across 50 `uploadTargets`)                                        |
| ORB-RENDER-005 | MUST     | Render loop MUST remain independent of AI network latency.                                                                                                                                                                                            | 4.4      | unit (synchronous tick, 600 frames with a pending promise) + e2e (all routes hung, frames advance)                         |
| ORB-RENDER-006 | MUST     | Unsupported graphics capability MUST fail gracefully.                                                                                                                                                                                                 | 4.2, 4.4 | unit (decision table, constructor never throws) + e2e (`--disable-webgl`, `WEBGL_lose_context`)                            |
| ORB-RENDER-007 | SHOULD   | Per-particle GPU attributes `position`, `aTarget`, `aSize`, `aBrightness`, `aPhase`, `aSeed`; per-frame animation in the vertex shader from uniforms.                                                                                                 | 4.1      | unit (shader contract) + e2e (program compiles, no shader error)                                                           |
| ORB-RENDER-008 | MUST     | Runtime particle-count change reallocates buffers (up to the configured maximum, else `setDrawCount`), places every particle instantly, and MUST NOT recreate context, `WebGLRenderer` or canvas.                                                     | 4.2, 4.4 | unit (below/above max paths) + e2e (`renderer.id` stable across count change)                                              |
| ORB-PERF-001   | SHOULD   | Desktop SHOULD target 60 FPS.                                                                                                                                                                                                                         | 4.6      | perf-bench (manual, `docs/reference/perf-matrix.md`; override entry `verification: manual`)                                |
| ORB-PERF-003   | SHOULD   | Adaptive quality SHOULD react to sustained frame degradation.                                                                                                                                                                                         | 4.3      | unit (synthetic series) + property (no oscillation, never above ceiling) + e2e (degrades under SwiftShader, no throw)      |
| ORB-PERF-005   | SHOULD   | Particle count, connections, shader complexity and post-processing SHOULD degrade independently.                                                                                                                                                      | 4.3      | unit (`setAxis` per axis leaves the others untouched; ladder order)                                                        |
| ORB-PERF-006   | SHOULD   | Presets `mobile-low` 3 000 · `mobile-default` 5 000 · `desktop-default` 15 000 · `desktop-high` 30 000 · `desktop-ultra` 50 000 (when `CapabilityReport` permits) · `ci` 2 000; initial preset from `CapabilityReport`; host and `?preset=` override. | 4.3      | unit (table + `selectInitialPreset`) + e2e (`devices['Pixel 7']` → `mobile-default`)                                       |
| ORB-A11Y-003   | MUST     | `prefers-reduced-motion` MUST be respected.                                                                                                                                                                                                           | 4.4      | unit (`resolveMotionPreference`, runtime media change) + e2e (`emulateMedia` → `uMotionScale === 0`, canvas still renders) |

Requirements touched but owned elsewhere: ORB-A11Y-004 (W4 — this wave guarantees the canvas keeps rendering the formation at `uMotionScale = 0`, never blank), ORB-A11Y-007 (W4 — the `uMotionScale` mechanism and the "no rotation/turbulence/pulse" shader guarantee land here), ORB-PERF-002 (W8 — mobile presets and DPR cap exist here; targets measured in W8), ORB-API-001 (W4 — v0 facade adds `setParticleCount`, `setQuality`, `setVisualOverride`, `setReducedMotion`; see §11), ORB-FORM-006 (W3 — alias of ORB-RENDER-004, proven by the same identity test), ORB-ARCH-005 (W1 — the canvas is `aria-hidden`; headless mode keeps the HTML UI working), ORB-ARCH-001 (W0 — `engine/render/**` imports `three` + `shaders` only, enforced by dependency-cruiser).

## 4. Vertical slices

### 4.1 Shaders v1 — bounded context `shaders`

**Objective.** One vertex/fragment pair that owns all per-frame particle animation on the GPU, declares every attribute and uniform the later waves need (morph, pointer, audio) with inert defaults, and multiplies every animated term by `uMotionScale`.

**Contracts.**

```ts
// shaders/index.ts — the only importer of *.glsl (engine/render imports this module)
export const SHADER_CONTRACT = {
  attributes: ["position", "aTarget", "aSize", "aBrightness", "aPhase", "aSeed"] as const,
  uniforms: [
    /* UniformName from SHARED_CONTRACTS */ "uTime",
    "uMorphProgress",
    "uRotationSpeed",
    "uTurbulence",
    "uPulseStrength",
    "uParticleScale",
    "uMotionScale",
    "uPointerPos",
    "uPointerRadius",
    "uPointerStrength",
    "uPointerMode",
    "uAudioUser",
    "uAudioAssistant",
    "uAudioBands",
  ] as const,
  internalUniforms: [
    "uRotationAngle",
    "uPixelRatio",
    "uBasePointSize",
    "uMaxPointSize",
    "uShaderTier",
    "uColorInner",
    "uColorOuter",
    "uOpacity",
  ] as const, // set by ParticleSystem only, never via RendererPort
} as const;
export function assembleParticleShaders(): { vertex: string; fragment: string }; // resolves `#include <orb_noise>` chunks
// shaders/glsl.d.ts: declare module '*.glsl' { const src: string; export default src }
// next.config.ts: turbopack rule `*.glsl` → raw source; vitest.config.ts: plugin transforming .glsl → `export default "<src>"`
```

| Attribute     | GLSL type | itemSize | Source / range                                                                                                  | Written when                                                        |
| ------------- | --------- | -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `position`    | `vec3`    | 3        | current ("from") position, unit sphere space                                                                    | `allocate`, `setParticleCount` (instant placement), morph bake (W3) |
| `aTarget`     | `vec3`    | 3        | target position, unit sphere space                                                                              | `uploadTargets(from, to)`                                           |
| `aSize`       | `float`   | 1        | `0.5 + prng.fork('size').next()` ∈ [0.5, 1.5)                                                                   | `allocate`                                                          |
| `aBrightness` | `float`   | 1        | `0.4 + 0.6·prng.fork('brightness').next()` ∈ [0.4, 1.0)                                                         | `allocate`                                                          |
| `aPhase`      | `float`   | 1        | `prng.fork('phase').next()` ∈ [0, 1) — stagger and pulse phase; exposed via `getPhaseArray()` for W3 CPU parity | `allocate`                                                          |
| `aSeed`       | `float`   | 1        | `prng.fork('seed').next()` ∈ [0, 1) — noise offset                                                              | `allocate`                                                          |

| Uniform                                                                | GLSL type                          | Default                                   | Set by                                             | Role in v1 shader                                                                                             |
| ---------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `uTime`                                                                | `float`                            | 0                                         | `ParticleSystem.render` (seconds, always advances) | phase for turbulence and pulse                                                                                |
| `uMorphProgress`                                                       | `float`                            | 1                                         | port (`FormationManager`, W3)                      | `mix(position, aTarget, uMorphProgress)`; W3 replaces with `orbMorph` chunk                                   |
| `uRotationSpeed`                                                       | `float`                            | 0.15                                      | port                                               | integrated on CPU into `uRotationAngle` each frame (no snap on speed change)                                  |
| `uTurbulence`                                                          | `float`                            | 0                                         | port                                               | simplex displacement amplitude × 0.15 (tier ≥ noise)                                                          |
| `uPulseStrength`                                                       | `float`                            | 0                                         | port                                               | radial pulse `1 + 0.08·s·sin(2π(uTime·0.5 + aPhase))` (tier full)                                             |
| `uParticleScale`                                                       | `float`                            | 1                                         | port                                               | multiplier on point size                                                                                      |
| `uMotionScale`                                                         | `float`                            | 1                                         | engine (`resolveMotionPreference`)                 | multiplies rotation delta, turbulence, pulse, pointer and audio terms; `uMorphProgress` is NOT multiplied     |
| `uPointerPos` / `uPointerRadius` / `uPointerStrength` / `uPointerMode` | `vec3` / `float` / `float` / `int` | 0 / 0 / 0 / 0                             | port (W5)                                          | reserved; term contributes 0 while `uPointerStrength == 0`                                                    |
| `uAudioUser` / `uAudioAssistant` / `uAudioBands`                       | `float` / `float` / `vec3`         | 0                                         | port (W5)                                          | reserved; contributes 0                                                                                       |
| `uRotationAngle`                                                       | `float`                            | 0                                         | internal: `+= uRotationSpeed·dt·uMotionScale`      | Y-axis rotation of the displaced position                                                                     |
| `uPixelRatio`, `uBasePointSize`, `uMaxPointSize`                       | `float`                            | dpr, 3.0 (desktop) / 2.2 (mobile), probed | internal (`setProfile`, `resize`, capabilities)    | `gl_PointSize = clamp(uBasePointSize·aSize·uParticleScale·uPixelRatio·(1/-mvPosition.z), 1.0, uMaxPointSize)` |
| `uShaderTier`                                                          | `int`                              | 2                                         | internal (`setProfile`)                            | 0 basic (morph + rotation), 1 noise (+ turbulence), 2 full (+ pulse, pointer, audio, soft glow sprite)        |
| `uColorInner`, `uColorOuter`, `uOpacity`                               | `vec3`, `vec3`, `float`            | neutral palette, 0.85                     | internal                                           | fragment radial gradient, `discard` outside `r > 0.5`; additive blending, `depthWrite: false`                 |

**Behavior.** Order in the vertex shader: `base = mix(position, aTarget, uMorphProgress)` → `+ noise·uTurbulence·uMotionScale` (tier ≥ 1) → `× pulse` (tier 2) → `+ pointer + audio` (all tiers when attached in W5, zero in W2) → rotate by `uRotationAngle` → project → point size. Tier branching is on a uniform (no recompilation; `setProfile` never rebuilds the material). Under `uMotionScale = 0` the output is a pure function of `position`, `aTarget`, `uMorphProgress` and camera — no term depends on `uTime` (ORB-A11Y-007 mechanism).

**Edge cases.**

- `uMorphProgress` outside [0, 1] → clamped in the shader (`clamp(uMorphProgress, 0.0, 1.0)`), never NaN.
- `-mvPosition.z ≤ 0` (particle behind camera) → size term clamped to 1.0; sprite discarded by the frustum, never `Infinity`.
- WebGL1 context (if the pinned `three` still supports it) → same GLSL through three's `GLSL1` prefix; `uShaderTier` becomes `float` compare; `#version` is never hardcoded in `.glsl` files.
- Shader compile error → `THREE.WebGLProgram` logs; `ParticleSystem` detects `renderer.info.programs` diagnostics `false` after first frame, calls `onContextLost` path with `reason: 'shader-compile'` → headless fallback (ORB-RENDER-006), never an uncaught exception.

**Acceptance criteria.**

- Given `SHADER_CONTRACT`, When `assembleParticleShaders()` runs, Then the vertex source declares every attribute and every uniform in the table exactly once with the listed GLSL type, contains no `#version` line, no `Math.random`, and resolves all `#include <orb_*>` chunks — ORB-RENDER-007 — `tests/unit/shaders/contract.test.ts`.
- Given the rotation/turbulence/pulse terms, When the source is scanned, Then each `uTime`-dependent expression is multiplied by `uMotionScale` (regex over the three named terms) — ORB-A11Y-003 (mechanism) — `tests/unit/shaders/contract.test.ts`.
- Given `/playground?debug=1&preset=ci&adaptive=0&seed=1` under SwiftShader, When 10 frames have rendered, Then `__orbDebug.renderer.info.programs ≥ 1`, and the console collector saw no line matching `/THREE\.WebGLProgram|Shader Error/` — ORB-RENDER-007, ORB-RENDER-001 — `tests/e2e/renderer.smoke.spec.ts`.

**Observability.** None at runtime (shaders are bundled strings). Compile failure surfaces as `orb.render.fallback { reason: 'shader-compile' }` from slice 4.2.

### 4.2 ParticleSystem — bounded context `engine` (`engine/render/`, `engine/ParticleSystem.ts`, `engine/ports/`)

**Objective.** The only module that touches Three.js: implements `RendererPort` with allocate-max / draw-range buffers, capability detection, DPR cap, context-loss recovery and full disposal; renderer, canvas, GL context and `Points` object are created once per instance and never recreated.

**Contracts.**

```ts
// engine/ports/RendererPort.ts — verbatim from SHARED_CONTRACTS plus W2 additions (marked)
export interface RendererPort {
  readonly capabilities: CapabilityReport;
  allocate(maxParticles: number): void;
  setDrawCount(n: number): void;
  uploadTargets(from: Formation, to: Formation): void;
  setUniform(name: UniformName, value: number | [number, number] | [number, number, number]): void;
  setConnections(edges: Uint32Array | null, density: number): void; // W2: recorded no-op, `snapshot().connections.supported === false`
  render(nowMs: number): void;
  onContextLost(cb: () => void): () => void;
  resize(w: number, h: number, dpr: number): void;
  dispose(): void;
  // W2 additions
  readonly maxParticles: number;
  readonly drawCount: number;
  readonly mode: "webgl" | "headless";
  setProfile(profile: QualityProfile): void; // pixelRatio, shaderTier, postProcessing; count is applied by the engine via setDrawCount
  onContextRestored(cb: () => void): () => void;
  snapshot(): RendererDebugSnapshot; // read-only, cheap (no GPU readback)
}
export type ParticleBufferPort = Pick<
  RendererPort,
  "uploadTargets" | "setUniform" | "setConnections"
>;
export interface FrameTimeSource {
  onFrame(cb: (dtMs: number, nowMs: number) => void): () => void;
}
export interface RendererDebugSnapshot {
  id: string;
  contextCreated: boolean;
  isWebGL2: boolean;
  contextLost: boolean;
  frames: number;
  glErrors: number;
  drawCount: number;
  maxParticles: number;
  pixelRatio: number;
  pointsObjectId: number;
  canvasId: string;
  geometryVersion: number;
  info: { geometries: number; textures: number; programs: number; calls: number; points: number };
  connections: { supported: boolean; edgeCount: number; density: number };
  instancesAlive: number; // module-level counter of live ParticleSystem instances
}

// engine/render/ParticleSystem.impl.ts (entry re-exported by engine/ParticleSystem.ts)
export interface WebGLRendererLike {
  // structural subset of THREE.WebGLRenderer used by the system; the fake in tests/support/fakes implements it
  domElement: HTMLCanvasElement;
  capabilities: { isWebGL2: boolean };
  info: THREE.WebGLRenderer["info"];
  setPixelRatio(v: number): void;
  setSize(w: number, h: number, updateStyle: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  getContext(): WebGLRenderingContext | WebGL2RenderingContext;
  dispose(): void;
  forceContextLoss(): void;
}
export interface ParticleSystemOptions {
  canvas: HTMLCanvasElement;
  capabilities: CapabilityReport;
  prng: Prng;
  logger: Logger;
  createRenderer?: (canvas: HTMLCanvasElement, cap: CapabilityReport) => WebGLRendererLike; // default: new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false })
  createPostPass?: (
    renderer: WebGLRendererLike,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) => PostPass; // default: UnrealBloomPass(strength 0.6, radius 0.4, threshold 0.85)
}
export class ParticleSystem implements RendererPort {
  constructor(opts: ParticleSystemOptions); // creates renderer, scene, PerspectiveCamera(45°, z = 3.2), one THREE.Points, ShaderMaterial; NEVER throws — a factory failure flips mode to 'headless' and logs orb.render.fallback
  getSharedAttributes(): {
    position: THREE.BufferAttribute;
    aTarget: THREE.BufferAttribute;
    aPhase: THREE.BufferAttribute;
    aSeed: THREE.BufferAttribute;
  }; // for ConnectionLines (W3), same-package only
  getPhaseArray(): Float32Array; // copy of aPhase for CPU-side parity (W3 MorphController)
  placeInstantly(points: Formation, count: number): void; // position[i] = aTarget[i] = points[i] for i < count; used by setParticleCount
}
// engine/quality/capabilities.ts
export function detectCapabilities(
  canvas: HTMLCanvasElement,
  env: CapabilityEnv = browserEnv(),
): CapabilityReport;
export interface CapabilityEnv {
  getContext(canvas: HTMLCanvasElement, kind: "webgl2" | "webgl"): WebGLRenderingContext | null;
  matchMedia(q: string): boolean;
  maxTouchPoints: number;
  deviceMemoryGb: number | null;
  uaMobile: boolean | null;
}
// core/limits.ts (added constants) — LIMITS.particles = { min: 100, max: 200_000 }; LIMITS.dpr = { mobile: 1.5, desktop: 2 }
```

**Behavior.**

- `allocate(max)`: `max` clamped to `LIMITS.particles`; builds one `BufferGeometry` with the six attributes (`Float32Array(max·3)` ×2, `Float32Array(max)` ×4) filled from `prng.fork(...)`; `drawRange = (0, drawCount)`; if a geometry already exists it is disposed and replaced on the same `Points` object (`geometryVersion++`); renderer/material/scene/camera are untouched. Logs `orb.render.allocated`.
- `setDrawCount(n)`: `n` clamped to `[0, maxParticles]`; only `geometry.setDrawRange(0, n)`. O(1).
- `uploadTargets(from, to)`: validates `from.length === to.length` and `length % 3 === 0` and `length / 3 ≥ drawCount` and every value finite (else `Result` error logged `orb.render.rejected_targets`, buffers untouched — the engine never throws into the loop); copies `from` → `position`, `to` → `aTarget` for `[0, drawCount)`, `needsUpdate = true`, `uMorphProgress` untouched (W3 owns it). Never creates objects.
- `setProfile(p)`: `setPixelRatio(min(p.pixelRatio, devicePixelRatio, capabilities.mobile ? 1.5 : 2))`; `uShaderTier` ← tier; post-processing toggles between `renderer.render(scene, camera)` and `postPass.render()`; composer created lazily once, kept for the instance lifetime. Never recompiles or recreates.
- `render(nowMs)`: if `contextLost || mode === 'headless'` → increments `frames` only (headless keeps a frame counter so `__orbDebug.frames` advances; W1 a11y UI proof) and returns; else `dt = clamp(nowMs − lastNowMs, 0, 250)`, `uTime += dt/1000`, `uRotationAngle += uRotationSpeed·dt/1000·uMotionScale`, draw, `glErrors += gl.getError() !== NO_ERROR ? 1 : 0` only when `debug` is on (never per frame in production).
- Context loss: listens `webglcontextlost` (calls `preventDefault()`, sets `contextLost = true`, notifies `onContextLost` callbacks, logs `orb.render.context_lost`) and `webglcontextrestored` (re-uploads all attributes with `needsUpdate`, resets `uTime`-independent state, `contextLost = false`, logs `orb.render.context_restored`, notifies `onContextRestored`). No new renderer.
- `resize(w, h, dpr)`: `setSize(w, h, false)`, camera aspect, `uPixelRatio`; zero-size → skipped (no `setSize(0, 0)`), pending until non-zero.
- `dispose()`: geometry, material, composer/passes, `renderer.dispose()`, `forceContextLoss()`, removes listeners, `instancesAlive--`, logs `orb.render.disposed`; idempotent.
- Capability detection decision table (`detectCapabilities` is called once per engine, before the renderer factory; it uses a throw-away probe context on the same canvas — never `WEBGL_debug_renderer_info`):

| `webgl2`                                                                         | `webgl1` | `mobile` | Mode                                                                                                                  | Shader-tier ceiling | Auto preset (`selectInitialPreset`)                                                       | `reason`                                     |
| -------------------------------------------------------------------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| true                                                                             | true     | false    | `webgl`                                                                                                               | `full`              | `desktop-default` (`desktop-high`/`desktop-ultra` only by host option or `?preset=`)      | —                                            |
| true                                                                             | true     | true     | `webgl`                                                                                                               | `noise`             | `mobile-default`; `mobile-low` if `deviceMemoryGb !== null && ≤ 2` or `maxPointSize < 32` | —                                            |
| false                                                                            | true     | any      | `webgl` attempted with `basic` ceiling; if the renderer factory throws (three ≥ r163 has no WebGL1 path) → `headless` | `basic`             | `mobile-low`                                                                              | `'webgl1'` / `'webgl1-unsupported-by-three'` |
| false                                                                            | false    | any      | `headless` (`NullRenderer` port, no canvas drawn, host shows fallback region)                                         | —                   | `mobile-low` (profile still reported)                                                     | `'no-webgl'`                                 |
| context creation throws / returns null with `failIfMajorPerformanceCaveat` false |          |          | `headless`                                                                                                            | —                   | `mobile-low`                                                                              | `'context-error'`                            |

`mobile = (matchMedia('(pointer: coarse)') && maxTouchPoints > 0) || uaMobile === true`. `maxPointSize = gl.getParameter(ALIASED_POINT_SIZE_RANGE)[1]` (0 when headless).

**Edge cases.**

- `allocate` called twice with the same `max` → no-op (no reallocation, `geometryVersion` unchanged).
- `uploadTargets` while `contextLost` → CPU arrays updated, GPU upload deferred to restore (attributes are marked `needsUpdate`).
- `setDrawCount(n)` with `n > maxParticles` → clamped to `maxParticles` and logged `orb.render.count_clamped`; the engine (4.4) is responsible for reallocating first.
- `render` on a detached canvas (host unmounted without dispose) → renders nothing after `dispose`; `render` after `dispose` is a no-op that logs once.
- `dispose` during `contextLost` → still releases everything; restore listener removed so no callback fires post-dispose.
- `NullRenderer` implements every method as a recorder (`calls: Array<{ method; args }>`), `mode: 'headless'`, `snapshot()` with `contextCreated: false`; Wave 1 uses it as the test renderer, Wave 2 uses it as the production headless port.

**Acceptance criteria.**

- Given a `ParticleSystem` with a fake `WebGLRendererLike` and `allocate(5000)`, When the scene is inspected, Then it contains exactly one `THREE.Points` and zero `Mesh`, `geometry.attributes` has exactly the six contract names with itemSizes 3,3,1,1,1,1 and lengths for 5 000, and `drawRange.count === drawCount` — ORB-RENDER-002, ORB-RENDER-007, ORB-RENDER-003 — `tests/unit/engine/render/particle-system.test.ts`.
- Given the same system, When `uploadTargets` is called 50 times with different seeded formations, Then the `WebGLRendererLike` instance, `domElement`, `getContext()` result, `Points` object id and `geometryVersion` are identical before and after, and no `dispose` was called on the fake — ORB-RENDER-004, ORB-FORM-006 (touched) — `tests/unit/engine/render/particle-system.test.ts`.
- Given `allocate(10000)` and `drawCount 5000`, When `setDrawCount(8000)` is called, Then `geometryVersion` is unchanged and `drawRange.count === 8000`; When the engine reallocates to 20 000 (`allocate(20000)` + `placeInstantly`), Then `geometryVersion` increments by 1, the renderer/canvas/context identities are unchanged, and `position` equals `aTarget` for `[0, drawCount)` — ORB-RENDER-008 — `tests/unit/engine/render/count-change.test.ts`.
- Given a jsdom canvas, When `webglcontextlost` is dispatched, Then `preventDefault` was called, `snapshot().contextLost === true`, `render` increments `frames` without calling the fake renderer, and the `onContextLost` callback fired once; When `webglcontextrestored` is dispatched, Then all six attributes have `needsUpdate === true`, `contextLost === false`, and no second renderer was created — ORB-RENDER-006 — `tests/unit/engine/render/context-loss.test.ts`.
- Given `detectCapabilities` with a fake env for each row of the decision table, When called, Then the report and `selectInitialPreset(report)` match the row exactly — ORB-RENDER-006, ORB-PERF-006 — `tests/unit/engine/quality/capabilities.test.ts`.
- Given a renderer factory that throws, When `new ParticleSystem(...)` runs, Then no exception escapes, `mode === 'headless'`, and `orb.render.fallback { reason: 'context-error' }` was logged — ORB-RENDER-006 — `tests/unit/engine/render/particle-system.test.ts`.
- Given `/playground?debug=1&preset=ci&adaptive=0&seed=1` under SwiftShader, When loaded, Then `expect.poll(() => __orbDebug.renderer.frames)` increases across two samples 500 ms apart, `contextCreated === true`, `isWebGL2 === true`, `glErrors === 0`, `renderer.info.points === 2000` — ORB-RENDER-001 — `tests/e2e/renderer.smoke.spec.ts`.
- Given `?particles=1000` and `?particles=5000` (ci preset ceiling ignored for `?particles=`, clamped to `LIMITS`), When each loads, Then `info.calls ≤ 3` in both and `info.points` equals the requested count — ORB-RENDER-002, ORB-RENDER-003 — `tests/e2e/renderer.batching.spec.ts`.
- Given the SwiftShader page, When `page.evaluate` triggers `WEBGL_lose_context.loseContext()` via `__orbDebug.renderer.loseContext()` (debug only) and later `restoreContext()`, Then no `pageerror`, `contextLost` flips true then false, `renderer.id` is unchanged, frames keep advancing — ORB-RENDER-006 — `tests/e2e/renderer.capability-failure.spec.ts`.

**Observability.** `orb.render.allocated { maxParticles, geometryVersion }`, `orb.render.count_clamped { requested, applied }`, `orb.render.rejected_targets { reason }`, `orb.render.context_lost`, `orb.render.context_restored`, `orb.render.fallback { reason }`, `orb.render.disposed { frames }`. Never per-frame logs; `glErrors` counted only under `debug`.

### 4.3 Quality — bounded context `engine` (`engine/quality/`)

**Objective.** A preset table and a pure, deterministic controller that turns injected frame-time samples into ordered, independent quality-axis decisions with hysteresis, cooldown and freeze windows, never oscillating and never exceeding the ceiling.

**Contracts.**

```ts
// engine/quality/presets.ts
export type QualityPreset =
  "mobile-low" | "mobile-default" | "desktop-default" | "desktop-high" | "desktop-ultra" | "ci";
export interface QualityProfile {
  preset: QualityPreset;
  particleCount: number;
  connectionDensityCap: number;
  shaderTier: "basic" | "noise" | "full";
  postProcessing: boolean;
  pixelRatio: number;
}
export const QUALITY_PRESETS: Readonly<Record<QualityPreset, QualityProfile>>;
export const PRESET_COUNT_LADDER: readonly number[] = [3000, 5000, 15000, 30000, 50000];
export function selectInitialPreset(cap: CapabilityReport): QualityPreset;
export function isPresetPermitted(preset: QualityPreset, cap: CapabilityReport): boolean; // desktop-ultra requires webgl2 && !mobile; desktop-* require webgl2
export function frameBudgetMs(cap: CapabilityReport): number; // mobile ? 33.3 : 16.7
// engine/quality/FrameTimeSampler.ts (infrastructure, rAF-backed)
export class RafFrameTimeSource implements FrameTimeSource {
  constructor(win: Window);
} // dt clamped [0, 250]; pauses on visibilitychange hidden, resumes with a freeze notification
// engine/quality/QualityController.ts (pure)
export type QualityAxis =
  "postProcessing" | "pixelRatio" | "connections" | "shaderTier" | "particleCount";
export interface QualityHysteresisConfig {
  windowFrames: number;
  emaAlpha: number;
  percentile: number;
  degradeRatio: number;
  degradeSustainMs: number;
  upgradeRatio: number;
  upgradeSustainMs: number;
  cooldownMs: number;
  freezeFrames: number;
  outlierDtMs: number;
}
export const DEFAULT_HYSTERESIS: QualityHysteresisConfig = {
  windowFrames: 120,
  emaAlpha: 0.1,
  percentile: 0.75,
  degradeRatio: 1.25,
  degradeSustainMs: 2000,
  upgradeRatio: 0.7,
  upgradeSustainMs: 10000,
  cooldownMs: 3000,
  freezeFrames: 30,
  outlierDtMs: 250,
};
export interface QualityDecision {
  kind: "degrade" | "upgrade";
  axis: QualityAxis;
  from: number | string | boolean;
  to: number | string | boolean;
  atMs: number;
  p75Ms: number;
  ladderIndex: number;
}
export interface QualityControllerOptions {
  ceiling: QualityPreset;
  capabilities: CapabilityReport;
  adaptive: boolean;
  budgetMs?: number;
  config?: Partial<QualityHysteresisConfig>;
  particleCountOverride?: number;
  logger?: Logger;
}
export interface QualityController {
  // SHARED_CONTRACTS methods + W2 additions
  observe(dtMs: number): void; // pure function of the sample sequence; internal time = Σ dt
  profile(): QualityProfile;
  setCeiling(p: QualityPreset): void; // clamps current profile to the new ceiling; resets ladder; freeze
  freeze(): void; // ignore the next freezeFrames samples and clear the window (resize, count change, morph start, visibility resume, context restore)
  setAdaptive(on: boolean): void; // false → observe() records nothing and decides nothing
  setAxis(axis: QualityAxis, value: number | string | boolean): void; // manual per-axis override (playground / host); other axes untouched; freeze
  onDecision(cb: (d: QualityDecision) => void): () => void;
  readonly ladderIndex: number;
  readonly frameStats: { emaMs: number; p75Ms: number; samples: number };
}
```

Preset table (all `QualityProfile` fields; frame budget and target FPS are controller inputs, not profile fields):

| Preset            | particleCount | connectionDensityCap | shaderTier | postProcessing | pixelRatio (cap) | Target FPS (SPEC §10) | Budget ms | Auto-selected when                                        |
| ----------------- | ------------: | -------------------: | ---------- | -------------- | ---------------: | --------------------: | --------: | --------------------------------------------------------- |
| `mobile-low`      |         3 000 |                    0 | `basic`    | false          |              1.0 |                 30–60 |      33.3 | mobile + low memory / small point range; WebGL1; headless |
| `mobile-default`  |         5 000 |                  0.5 | `noise`    | false          |              1.5 |                 30–60 |      33.3 | mobile + WebGL2                                           |
| `desktop-default` |        15 000 |                  1.0 | `full`     | false          |              2.0 |                    60 |      16.7 | desktop + WebGL2                                          |
| `desktop-high`    |        30 000 |                  1.0 | `full`     | true           |              2.0 |                    60 |      16.7 | never auto; host option / `?preset=`                      |
| `desktop-ultra`   |        50 000 |                  1.0 | `full`     | true           |              2.0 |                    60 |      16.7 | never auto; permitted only if `webgl2 && !mobile`         |
| `ci`              |         2 000 |                    0 | `basic`    | false          |              1.0 |                   n/a |      16.7 | `?preset=ci` only (SwiftShader)                           |

**Behavior.**

- Sampling: each `observe(dt)` with `dt > outlierDtMs` is dropped (tab switch / GC hitch) and counts as a freeze of 1 frame; otherwise pushed to a ring of `windowFrames`; `ema = ema + α(dt − ema)`; `p75` computed over the ring when full.
- Degrade rule: window full **and** `p75 > degradeRatio × budget` continuously for `≥ degradeSustainMs` **and** `now − lastDecisionAt ≥ cooldownMs` → one ladder step down; window cleared; `freeze()`.
- Upgrade rule: `p75 < upgradeRatio × budget` continuously for `≥ upgradeSustainMs` **and** cooldown elapsed **and** `ladderIndex > 0` → one step up (exact reverse of the last degrade); never above ceiling.
- Freeze: `freezeFrames` samples ignored and the sustain timers reset; used on resize, count change, `setCeiling`, `setAxis`, morph start (W3 calls `freeze()`), visibility resume, context restore.
- Degrade ladder (fixed order per SHARED_CONTRACTS; steps that are already at floor are skipped): (1) `postProcessing` true→false; (2) `pixelRatio` −0.5 per step down to 1.0; (3) `connections` cap ×0.5 then 0 (two steps; no-op until W3 but still recorded so ordering is stable); (4) `shaderTier` full→noise→basic; (5) `particleCount` to the next lower entry of `PRESET_COUNT_LADDER` below the current count, floor 3 000. At floor, `orb.quality.floor` is logged once and no further decisions are made until an upgrade.
- Independence (ORB-PERF-005): `setAxis` changes one axis, leaves the other four untouched, and pins that axis (adaptive steps skip pinned axes until `setAxis(axis, 'auto')`).
- `adaptive: false` (host option, `?adaptive=0`, playground toggle) → `observe` is a no-op; profile equals the ceiling preset exactly (plus `particleCountOverride` if given).

**Edge cases.**

- Ceiling lower than the current profile (e.g. `setCeiling('mobile-low')` after degrading from desktop) → profile clamped to the ceiling, ladder rebuilt from the new ceiling, no decision emitted.
- `observe` before the window is full → no decision, even at 200 ms frames (prevents startup shader-compile hitches from degrading).
- A single 240 ms frame amid 16 ms frames → within window, `p75` unaffected, no decision (spike immunity).
- Alternating 12 ms / 24 ms frames (p75 = 24 > 20.8 at desktop) → degrades once, then stays (the sustained-under-0.7 upgrade needs p75 < 11.7 ms, which never happens): no oscillation.
- `particleCountOverride` (from `particles:` option or `?particles=`) above the preset count → allowed up to `LIMITS.particles.max`; the ladder's count step goes from the override to the next lower ladder value.

**Acceptance criteria.**

- Given `desktop-default` ceiling and 600 samples of 16 ms, When observed, Then no decision — ORB-PERF-003 — `tests/unit/engine/quality/quality-controller.test.ts`.
- Given 120 samples of 16 ms then 30 ms frames, When 2 000 ms of 30 ms frames have been observed after the window filled, Then exactly one `degrade` on axis `pixelRatio` (2.0 → 1.5; `postProcessing` skipped because already false) and none earlier — ORB-PERF-003, ORB-PERF-005 — same file.
- Given continued 30 ms frames for 60 s, When observed, Then decisions occur no more often than every `cooldownMs` and follow the exact ladder order `pixelRatio 1.5, pixelRatio 1.0, connections 0.5, connections 0, shaderTier noise, shaderTier basic, particleCount 5000, particleCount 3000`, then `orb.quality.floor` once — ORB-PERF-005 — same file.
- Given a degraded profile and 10 s of 10 ms frames, When observed, Then exactly one `upgrade` reversing the last step; Given a synthetic 30 s trace alternating 12/24 ms, Then ≤ 1 decision in total — ORB-PERF-003 — same file.
- Given `freeze()` then 30 samples of 100 ms then 16 ms frames, When observed, Then no decision — ORB-PERF-003 — same file.
- Given `setAxis('shaderTier', 'basic')`, When degradation continues, Then `shaderTier` never changes and other axes still step — ORB-PERF-005 — same file.
- Given fast-check arbitrary sample sequences (dt ∈ [1, 300], length ≤ 5 000) and arbitrary ceilings, When observed, Then the profile never exceeds the ceiling on any axis, `particleCount ≥ 3000`, `pixelRatio ≥ 1`, consecutive decisions are ≥ `cooldownMs` apart, and `adaptive: false` yields zero decisions (seed printed on failure) — ORB-PERF-003 — `tests/unit/engine/quality/quality-controller.property.test.ts`.
- Given `QUALITY_PRESETS`, When compared to the table above, Then every field matches, `ci.particleCount === 2000`, and `isPresetPermitted('desktop-ultra', mobileReport) === false` — ORB-PERF-006 — `tests/unit/engine/quality/presets.test.ts`.
- Given `RafFrameTimeSource` with a fake window, When `visibilitychange` hidden then visible fires, Then no frame callbacks while hidden and the first callback after resume carries `dt ≤ outlierDtMs` — ORB-PERF-003 — `tests/unit/engine/quality/frame-time-sampler.test.ts`.
- Given `/playground?debug=1&preset=desktop-high&adaptive=1&seed=1` under SwiftShader, When observed for ≤ 20 s, Then `__orbDebug.quality.decisions.length ≥ 1`, the first decision is `postProcessing → false`, no `pageerror`, frames keep advancing — ORB-PERF-003 — `tests/e2e/renderer.adaptive.spec.ts`.
- Given Playwright `devices['Pixel 7']` on `/playground?debug=1&seed=1`, When loaded, Then `__orbDebug.capabilities.mobile === true`, `__orbDebug.quality.profile.preset === 'mobile-default'`, `pixelRatio ≤ 1.5`, `postProcessing === false` — ORB-PERF-006 — `tests/e2e/mobile.preset.spec.ts`.

**Observability.** `orb.quality.degraded` / `orb.quality.upgraded { axis, from, to, p75Ms, ladderIndex }`, `orb.quality.floor`, `orb.quality.ceiling_changed { from, to }`, `orb.quality.axis_pinned { axis, value }`. `frameStats` exposed in `__orbDebug.quality`, never logged per frame.

### 4.4 Engine facade v0 + React host — bounded contexts `engine` (`engine/OrbEngine.ts`, `engine/index.ts`) and `components/orb`

**Objective.** A framework-agnostic `OrbEngine` composition root (capabilities → port → controller → frame loop) that never throws on construction, plus a React host that creates exactly one engine per mount, is StrictMode- and SSR-safe, renders a text fallback in headless mode, and respects `prefers-reduced-motion` at mount and on change.

**Contracts.**

```ts
// engine/OrbEngine.ts — SHARED_CONTRACTS options + W2 additions (all optional)
export interface OrbEngineOptions {
  container: HTMLElement;
  particles?: number;
  quality?: QualityPreset | "auto";
  seed?: number;
  reducedMotion?: "auto" | "on" | "off";
  pointer?: PointerForceConfig | false;
  clock?: Clock;
  scheduler?: Scheduler;
  logger?: Logger;
  // W2 additions
  adaptive?: boolean; // default true; false → controller frozen at the preset
  maxParticles?: number; // default max(particles ?? 0, QUALITY_PRESETS[ceiling].particleCount) clamped to LIMITS.particles
  frameTimeSource?: FrameTimeSource; // default RafFrameTimeSource(window)
  rendererFactory?: (canvas: HTMLCanvasElement, cap: CapabilityReport) => WebGLRendererLike; // tests / hosts
  matchMedia?: (query: string) => MediaQueryList; // default window.matchMedia
  debug?: boolean; // exposes window.__orbDebug (also enabled by ?debug=1 in the host)
}
export class OrbEngine {
  static readonly SPEC_VERSION = "0.2.0";
  constructor(options: OrbEngineOptions); // never throws for missing WebGL; invalid options may throw; creates <canvas aria-hidden="true"> inside container (or reuses an existing data-orb-canvas)
  readonly capabilities: CapabilityReport;
  readonly mode: "webgl" | "headless";
  setParticleCount(n: number): void; // clamp → (n > maxParticles ? allocate(n) : nothing) → placeInstantly(bootstrap/active formation resampled to n) → setDrawCount(n) → quality.freeze(); ORB-RENDER-008
  setQuality(
    input:
      | QualityPreset
      | "auto"
      | { adaptive?: boolean; axis?: { [K in QualityAxis]?: number | string | boolean | "auto" } },
  ): void;
  setVisualOverride(
    patch: Partial<
      Pick<OrbVisualState, "rotationSpeed" | "turbulence" | "pulseStrength" | "particleScale">
    > | null,
  ): void; // cosmetic; W4 merges it over the state's resolved visual
  setReducedMotion(pref: "auto" | "on" | "off"): void; // recomputes uMotionScale immediately
  subscribeQuality(cb: (p: QualityProfile, d: QualityDecision | null) => void): () => void;
  resize(): void;
  dispose(): void;
  tick(dtMs: number, nowMs: number): void; // engine-internal; tests reach it through the frame source/port, not the public package API
  // Wave 4 completes: setState, morphTo, emit, registerFormation, registerToolVisual, attachAdapter, onApprovalDecision, subscribe, attachAudio, setPointerForce
}
export function resolveMotionPreference(
  option: "auto" | "on" | "off",
  mediaReduced: boolean,
): { preference: MotionPreference; motionScale: 0 | 1 };
// engine/index.ts v0 exports: OrbEngine, resolveMotionPreference, QUALITY_PRESETS, selectInitialPreset, detectCapabilities, NullRenderer, types (RendererPort, QualityProfile, QualityPreset, CapabilityReport, FrameTimeSource, OrbEngineOptions)

// components/orb/useOrbEngine.ts
export function useOrbEngine(
  containerRef: RefObject<HTMLElement | null>,
  options: Omit<OrbEngineOptions, "container">,
): { engine: OrbEngine | null; mode: "webgl" | "headless" | "pending"; reason?: string };
// components/orb/OrbCanvas.tsx ('use client'; always loaded via next/dynamic({ ssr: false }))
export interface OrbCanvasProps {
  options?: Omit<OrbEngineOptions, "container">;
  onEngine?: (engine: OrbEngine | null) => void;
  className?: string;
  fallback?: ReactNode;
}
// components/orb/OrbFallback.tsx → <div role="status" data-testid="orb-fallback">Particle rendering is unavailable ({reason}). Agent state is shown as text.</div>
// window.__orbDebug (debug only; Object.freeze'd getters, read-only)
export interface OrbDebugSnapshot {
  renderer: RendererDebugSnapshot & { loseContext(): void; restoreContext(): void }; // the two methods exist only under debug
  quality: {
    profile: QualityProfile;
    adaptive: boolean;
    ceiling: QualityPreset;
    decisions: QualityDecision[];
    frameStats: QualityController["frameStats"];
  };
  uniforms: Record<UniformName, number | number[]>;
  reducedMotion: boolean;
  capabilities: CapabilityReport;
  fallback: boolean;
  frames: number;
  perf: {
    capture(
      durationMs: number,
    ): Promise<{ frames: number; medianFps: number; p95FrameMs: number; droppedPct: number }>;
  };
}
```

**Behavior.**

- Construction order: `detectCapabilities(canvas)` → `selectInitialPreset` unless `quality` given (a non-permitted preset is clamped down with `orb.quality.ceiling_changed`) → `ParticleSystem` (or `NullRenderer` when headless) → `allocate(maxParticles)` → `placeInstantly(bootstrapSphere(count, prng.fork('sphere')), count)` → `setDrawCount(count)` → `QualityController` → `setProfile` → `resolveMotionPreference` → `setUniform('uMotionScale', …)` → `ResizeObserver(container)` → `frameTimeSource.onFrame(tick)`. Every step is inside one `try`; any failure downgrades to headless and logs `orb.render.fallback` — the constructor never throws (ORB-RENDER-006, ORB-API-001 touched).
- `tick(dt, now)`: `quality.observe(dt)` → (decision? → `port.setProfile(profile)`; count decisions → `setParticleCount`) → `port.render(now)`. No `await`, no promise, no adapter calls in this path (ORB-RENDER-005).
- `reducedMotion: 'auto'` subscribes to `matchMedia('(prefers-reduced-motion: reduce)')` `change`; `'on'` / `'off'` ignore the media query. `motionScale = 0` also sets `uTurbulence`, `uPulseStrength` to 0 and freezes `uRotationAngle`; the formation still renders (ORB-A11Y-004 touched). Logs `orb.motion.preference_changed { preference, source: 'media' | 'option' }`.
- `useOrbEngine`: engine created in `useEffect` (never during render), disposed in the cleanup; option changes after mount go through setters in a second effect keyed on the individual values (`particles`, `quality`, `adaptive`, `reducedMotion`), never through re-creation. `next.config.ts` keeps `reactStrictMode: true`.
- `OrbCanvas` renders `<div ref className>` with the canvas injected by the engine (`aria-hidden="true"`, `tabIndex -1`) and `<OrbFallback>` when `mode === 'headless'`; the canvas never carries text or ARIA semantics (ORB-ARCH-005 touched).

**Edge cases.**

- Container has zero size at mount (hidden tab, collapsed panel) → engine constructs, `resize` deferred until the observer reports a non-zero box; frames still tick.
- `particles` option outside `LIMITS.particles` → clamped, logged `orb.render.count_clamped`; `NaN`/negative → default preset count.
- `?preset=desktop-ultra` on a mobile report → `desktop-default`? No: the highest permitted preset for the report (`mobile-default`), logged.
- Two `OrbCanvas` on one page → two engines, two canvases, `instancesAlive === 2`; shared nothing.
- `dispose()` twice, or `tick` after `dispose` → no-ops.
- Media query flips while `reducedMotion: 'on'` → ignored (option wins).
- Headless mode: `__orbDebug.frames` still advances (NullRenderer counts), `fallback === true`, `uniforms` reflect setter calls.

**Acceptance criteria.**

- Given `<React.StrictMode><OrbCanvas options={{ rendererFactory: fake }} /></React.StrictMode>` in jsdom with a counting factory, When mounted, Then `constructed − disposed === 1` and `__orbDebug.renderer.instancesAlive === 1`; When unmounted, Then `instancesAlive === 0` — ORB-RENDER-004 (renderer lifetime), ORB-RENDER-006 — `tests/unit/components/orb/OrbCanvas.strictmode.test.tsx`.
- Given `OrbCanvas` imported by `app/playground/page.tsx`, When the page module is evaluated in Node (SSR), Then no `window` access happens (`next/dynamic` with `ssr: false`), verified by rendering the route with `renderToString` in the arch test — ORB-RENDER-006 — `tests/unit/arch/boundaries.test.ts`.
- Given a `FakeFrameTimeSource` and an engine with a recording `NullRenderer`, When 600 frames are stepped while an unresolved promise and a `setTimeout`-blocked microtask queue exist, Then 600 `render` calls were recorded synchronously and `expectTypeOf(engine.tick).returns.toBeVoid()` — ORB-RENDER-005 — `tests/unit/engine/render/frame-loop.test.ts`.
- Given the SwiftShader page after 10 frames, When `page.route('**/*', () => new Promise(() => {}))` hangs every further request, Then frames advance by ≥ 10 over the next 2 s — ORB-RENDER-005 — `tests/e2e/renderer.latency-independence.spec.ts`.
- Given `resolveMotionPreference` for the 6 combinations of option × media, When called, Then `'on'` → 0, `'off'` → 1, `'auto'` → media; and an engine with a fake `matchMedia` whose list dispatches `change`, When the media flips, Then `uMotionScale` flips and `uTurbulence === 0 && uPulseStrength === 0` at 0 — ORB-A11Y-003 — `tests/unit/a11y/reduced-motion-config.test.ts`.
- Given `page.emulateMedia({ reducedMotion: 'reduce' })` on the SwiftShader playground, When loaded, Then `__orbDebug.reducedMotion === true`, `uniforms.uMotionScale === 0`, `uniforms.uTurbulence === 0`, frames advance and `info.points === 2000` (formation still drawn); When `emulateMedia({ reducedMotion: 'no-preference' })`, Then `uMotionScale === 1` without reload — ORB-A11Y-003, ORB-A11Y-004 (touched) — `tests/e2e/a11y.reduced-motion.spec.ts`.
- Given the `chromium-nowebgl` project, When `/playground?debug=1` loads, Then `[data-testid="orb-fallback"]` is visible with `role="status"`, `__orbDebug.fallback === true`, `__orbDebug.frames > 0`, and no `pageerror` — ORB-RENDER-006 — `tests/e2e/renderer.capability-failure.spec.ts`.
- Given `new OrbEngine({ container, particles: 12000 })` with a fake env, When `setParticleCount(20000)` then `setParticleCount(4000)` are called, Then the port recorded `allocate(20000)` once, `setDrawCount(20000)` and `setDrawCount(4000)`, `placeInstantly` twice, and `quality.freeze` twice — ORB-RENDER-003, ORB-RENDER-008 — `tests/unit/engine/orb-engine.test.ts`.
- Given the SwiftShader playground at `?particles=1000`, When the count input is set to 1 500 and applied, Then `__orbDebug.renderer.id`, `canvasId` and `pointsObjectId` are unchanged, `info.points === 1500`, no `pageerror` — ORB-RENDER-008 — `tests/e2e/renderer.count.spec.ts`.

**Observability.** `orb.engine.created { mode, preset, particles, maxParticles, reducedMotion }`, `orb.engine.disposed`, `orb.motion.preference_changed`, plus 4.2/4.3 events. `__orbDebug` only when `debug` (never in the public demo without `?debug=1`).

### 4.5 Playground v0 — bounded context `components/playground`, `components/store`, `app/playground`

**Objective.** A developer page that exercises every runtime knob of this wave with URL-param parity, so E2E and humans drive the same code paths.

**Contracts.**

```ts
// components/store/orbStore.ts v0 (Zustand; fields added by later waves)
export interface OrbStoreV0 {
  particles: number;
  preset: QualityPreset | "auto";
  adaptive: boolean;
  axisOverrides: Partial<Record<QualityAxis, number | string | boolean | "auto">>;
  visual: {
    rotationSpeed: number;
    turbulence: number;
    pulseStrength: number;
    particleScale: number;
  };
  reducedMotion: "auto" | "on" | "off";
  seed: number;
  profile: QualityProfile | null;
  frameStats: { emaMs: number; p75Ms: number } | null;
}
// app/playground/page.tsx — query params (validated with zod, clamped, never trusted):
//   particles (int, LIMITS), preset (QualityPreset | 'auto'), adaptive ('0' | '1'), seed (int ≥ 0), reducedMotion ('auto' | 'on' | 'off'), debug ('1')
```

**Behavior.** Controls: particle count (number input 100–200 000 step 100 + preset chips), preset select (6 values + auto), adaptive toggle, per-axis override selects (post-processing, pixel ratio, connections cap — inert until W3, shader tier, count), turbulence 0–1, rotation 0–2 rad/s, pulse 0–1, particle scale 0.25–4, reduced-motion override, seed input + Apply (navigates with `?seed=`), read-only `PerfReadout` (EMA ms, p75 ms, FPS, profile, ladder index, decisions log, capabilities), "Simulate context loss" (debug only). All inputs are labelled `<label for>`; the page passes axe (W4 owns the full axe suite; W2 runs axe on `/playground` as part of the smoke test).

**Edge cases.** Invalid or out-of-range params → defaults + a visible "(clamped)" hint; `debug` absent → `__orbDebug` undefined and the context-loss button hidden.

**Acceptance criteria.**

- Given `/playground?debug=1&preset=ci&adaptive=0&seed=1`, When the turbulence slider is set to 0.8, Then `__orbDebug.uniforms.uTurbulence === 0.8` on the next poll; When "adaptive" is toggled on, Then `__orbDebug.quality.adaptive === true` — ORB-RENDER-003, ORB-PERF-003 — `tests/e2e/playground.quality.spec.ts`.
- Given the same page, When axe runs, Then zero violations of WCAG 2.1 AA tags — ORB-A11Y-003 (control labelled "Reduced motion") — `tests/e2e/playground.quality.spec.ts`.

**Observability.** None beyond the engine's; the store is client state.

### 4.6 Perf probe — `tests/perf`, `docs/reference`

**Objective.** A non-blocking, reproducible frame-rate measurement per preset that produces JSON artifacts nightly and a manual perf-matrix template for real devices (ORB-PERF-001 is verified manually; CI numbers are relative regression guards only).

**Contracts.**

```ts
// tests/perf/fps.perf.spec.ts (Playwright project `perf`; nightly + label `perf-impact`; `continue-on-error`)
// per preset in ['ci','mobile-low','mobile-default','desktop-default','desktop-high']:
//   goto `/playground?debug=1&preset=${p}&adaptive=0&seed=1` → expect.poll(frames ≥ 60) → r = await page.evaluate(() => __orbDebug.perf.capture(10_000))
//   → write reports/perf/${p}.json { preset, particles, medianFps, p95FrameMs, droppedPct, gl: 'swiftshader' | 'gpu', commit, date }
//   → compare with tests/perf/baseline.swiftshader.json; regression > 20 % → annotate (never fail)
```

`docs/reference/perf-matrix.md` template columns: date · commit · device · OS · browser · GL renderer (manual entry) · preset · particles · connections · post-processing · DPR · median FPS · p95 frame ms · dropped % · pointer latency ms (W5) · reviewer. Target rows flagged: `desktop-default ≥ 55 FPS`, `mobile-default ≥ 30 FPS`.

**Acceptance criteria.**

- Given the nightly workflow, When the `perf` project runs, Then five JSON artifacts are uploaded and `ci` median FPS ≥ 8 under SwiftShader (sanity floor, not a target) — ORB-PERF-001 (evidence pipeline) — `tests/perf/fps.perf.spec.ts`.
- Given the maintainer's reference machine, When `desktop-default` is measured for 10 s with `?adaptive=0`, Then median FPS ≥ 55 is recorded in `docs/reference/perf-matrix.md` with the commit SHA, and `specs/requirements.overrides.yaml` carries `ORB-PERF-001: { verification: manual, evidence: docs/reference/perf-matrix.md, reviewedAt }` — ORB-PERF-001 — manual.

**Observability.** `__orbDebug.perf.capture` only (debug builds).

## 5. Parallel tracks

| Track       | Slices                                                   | Environment                                | Can start                                                                       | Meets                      |
| ----------- | -------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------- |
| A — Render  | 4.1 shaders, 4.2 `ParticleSystem` + capabilities         | browser / three (unit with `FakeRenderer`) | after G0                                                                        | A + B in 4.4               |
| B — Quality | 4.3 presets + `QualityController` + `RafFrameTimeSource` | pure TS (Vitest, fake timers)              | after G0, independent of A                                                      | 4.4                        |
| C — Host    | 4.4 `OrbEngine` v0 + `OrbCanvas`, 4.5 playground         | jsdom + Next                               | day 1 against `NullRenderer` and a stub controller; swaps in A/B when they land | 4.4 → E2E on `/playground` |
| D — Perf    | 4.6                                                      | Playwright `perf`                          | after 4.4 renders in CI                                                         | G2                         |

Integration point: `OrbEngine` constructor (4.4) is the composition root; `tests/e2e/renderer.smoke.spec.ts` is the first test that needs A + B + C together. Wave 3 may begin its pure formation domain (3.1–3.3) against `NullRenderer` at any time; it needs `ParticleSystem.getSharedAttributes()` / `getPhaseArray()` from 4.2 only for 3.5.

## 6. Threat model delta (STRIDE)

| Surface                                                              | S   | T   | R   | I   | D   | E   | Mitigation                                                                                                                                                                                                 | Req IDs                        |
| -------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Particle count from URL / host option / playground (`particles=1e9`) | –   | –   | –   | –   | ✓   | –   | zod-parse + clamp to `LIMITS.particles` (100–200 000); allocate max once, `drawRange` for count; `?particles=` never triggers a reload loop                                                                | ORB-RENDER-003, ORB-RENDER-008 |
| WebGL context loss (other tabs, GPU reset, driver crash)             | –   | –   | –   | –   | ✓   | –   | `webglcontextlost` `preventDefault` + `webglcontextrestored` re-upload; headless fallback keeps the HTML UI functional; E2E forces loss                                                                    | ORB-RENDER-006                 |
| Capability probe (fingerprinting via GPU strings, `deviceMemory`)    | –   | –   | –   | ✓   | –   | –   | Never read `WEBGL_debug_renderer_info`; report holds only booleans, point-size range, `deviceMemoryGb` (coarse, already public); nothing sent anywhere                                                     | ORB-RENDER-006                 |
| `window.__orbDebug` snapshot                                         | –   | ✓   | –   | ✓   | –   | –   | Attached only with `?debug=1`/`debug: true`; frozen object of getters (no setters into the engine except the two explicit debug methods); no PII, no metadata strings; absent from the public demo default | ORB-RENDER-006 (evidence hook) |
| Render loop vs async work (adapters, fetch, SVG parsing later)       | –   | –   | –   | –   | ✓   | –   | `tick` is synchronous by contract and test; no `await` in `engine/render/**` (`no-restricted-syntax` on `AwaitExpression` inside that folder); adapters arrive off-loop in W4/W7                           | ORB-RENDER-005                 |
| Post-processing / three examples (`UnrealBloomPass`)                 | –   | ✓   | –   | –   | ✓   | –   | Pinned `three` version (W0 SCA/Dependabot); bloom only on `desktop-high`/`ultra`; first rung of the degrade ladder; never in `ci`                                                                          | ORB-PERF-005                   |
| Shader sources                                                       | –   | ✓   | –   | –   | –   | –   | Only bundled `.glsl` modules compile; no runtime shader strings from users, formations or metadata; CSP unchanged (WebGL needs no `unsafe-eval`)                                                           | ORB-RENDER-007                 |
| Perf artifacts (nightly JSON)                                        | –   | –   | ✓   | ✓   | –   | –   | Artifacts contain preset numbers, commit, GL kind — no user data; workflow `permissions: contents: read`; regression comment is informational                                                              | ORB-PERF-001                   |
| Background tab / hidden container                                    | –   | –   | –   | –   | ✓   | –   | rAF source pauses on `visibilitychange`; zero-size container skips `setSize`; `ResizeObserver` callbacks coalesced per frame                                                                               | ORB-PERF-003                   |

Threat notes recorded in `docs/security/threats/renderer.md`.

## 7. Tests

| Test (name references requirement IDs)                                                                                                                              | Type                         | Req IDs                                | File                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| `req('ORB-RENDER-007')` vertex/fragment declare the contract attributes and uniforms once, no `#version`, chunks resolved                                           | unit                         | ORB-RENDER-007                         | `tests/unit/shaders/contract.test.ts`                                 |
| `req('ORB-A11Y-003')` every uTime-dependent term is scaled by uMotionScale                                                                                          | unit                         | ORB-A11Y-003                           | `tests/unit/shaders/contract.test.ts`                                 |
| `req('ORB-RENDER-002','ORB-RENDER-007','ORB-RENDER-003')` one Points, six attributes, drawRange equals count                                                        | unit                         | ORB-RENDER-002, 003, 007               | `tests/unit/engine/render/particle-system.test.ts`                    |
| `req('ORB-RENDER-004','ORB-FORM-006')` 50 uploadTargets keep renderer/canvas/context/Points identity                                                                | unit                         | ORB-RENDER-004                         | `tests/unit/engine/render/particle-system.test.ts`                    |
| `req('ORB-RENDER-006')` renderer factory throws → headless, no exception                                                                                            | unit                         | ORB-RENDER-006                         | `tests/unit/engine/render/particle-system.test.ts`                    |
| `req('ORB-RENDER-008')` count below max → drawRange only; above max → reallocate once, identities stable, position === aTarget                                      | unit                         | ORB-RENDER-008                         | `tests/unit/engine/render/count-change.test.ts`                       |
| `req('ORB-RENDER-006')` context lost → preventDefault, render skipped, callbacks; restored → needsUpdate on all attributes                                          | unit                         | ORB-RENDER-006                         | `tests/unit/engine/render/context-loss.test.ts`                       |
| `req('ORB-RENDER-005')` 600 synchronous ticks with pending promises; tick returns void                                                                              | unit                         | ORB-RENDER-005                         | `tests/unit/engine/render/frame-loop.test.ts`                         |
| `req('ORB-RENDER-006','ORB-PERF-006')` capability decision table rows → report + initial preset                                                                     | unit                         | ORB-RENDER-006, ORB-PERF-006           | `tests/unit/engine/quality/capabilities.test.ts`                      |
| `req('ORB-PERF-006')` QUALITY_PRESETS values, ci preset, isPresetPermitted                                                                                          | unit                         | ORB-PERF-006                           | `tests/unit/engine/quality/presets.test.ts`                           |
| `req('ORB-PERF-003','ORB-PERF-005')` degrade after sustained overrun; ladder order; cooldown; upgrade; freeze; spike immunity; setAxis independence; adaptive=false | unit                         | ORB-PERF-003, ORB-PERF-005             | `tests/unit/engine/quality/quality-controller.test.ts`                |
| `req('ORB-PERF-003')` fast-check: never above ceiling, floors respected, cooldown spacing, no decisions when adaptive=false                                         | property                     | ORB-PERF-003                           | `tests/unit/engine/quality/quality-controller.property.test.ts`       |
| `req('ORB-PERF-003')` RafFrameTimeSource clamps dt, pauses when hidden, freezes on resume                                                                           | unit                         | ORB-PERF-003                           | `tests/unit/engine/quality/frame-time-sampler.test.ts`                |
| `req('ORB-RENDER-003','ORB-RENDER-008','ORB-RENDER-006')` OrbEngine: clamps, setParticleCount paths, never throws, headless mode                                    | unit                         | ORB-RENDER-003, 006, 008               | `tests/unit/engine/orb-engine.test.ts`                                |
| `req('ORB-A11Y-003')` resolveMotionPreference table; runtime media change flips uMotionScale                                                                        | unit                         | ORB-A11Y-003                           | `tests/unit/a11y/reduced-motion-config.test.ts`                       |
| `req('ORB-RENDER-004','ORB-RENDER-006')` StrictMode double mount → exactly one live renderer; unmount → zero                                                        | unit (RTL, jsdom)            | ORB-RENDER-004, ORB-RENDER-006         | `tests/unit/components/orb/OrbCanvas.strictmode.test.tsx`             |
| `req('ORB-ARCH-001','ORB-RENDER-006')` `three` imported only under `engine/render/**` and `shaders/**`; playground route SSR-safe; smoke sunset guard flipped       | arch                         | ORB-ARCH-001 (touched), ORB-RENDER-006 | `tests/unit/arch/boundaries.test.ts`                                  |
| `req('ORB-RENDER-001','ORB-RENDER-007')` SwiftShader smoke: WebGL2 context, frames advance, programs ≥ 1, no GL/shader errors, axe clean                            | e2e                          | ORB-RENDER-001, ORB-RENDER-007         | `tests/e2e/renderer.smoke.spec.ts`                                    |
| `req('ORB-RENDER-002','ORB-RENDER-003')` calls ≤ 3 and points === N at 1 000 / 5 000                                                                                | e2e                          | ORB-RENDER-002, ORB-RENDER-003         | `tests/e2e/renderer.batching.spec.ts`                                 |
| `req('ORB-RENDER-008')` runtime count change keeps renderer/canvas/Points ids                                                                                       | e2e                          | ORB-RENDER-008                         | `tests/e2e/renderer.count.spec.ts`                                    |
| `req('ORB-RENDER-005')` all routes hung → frames still advance                                                                                                      | e2e                          | ORB-RENDER-005                         | `tests/e2e/renderer.latency-independence.spec.ts`                     |
| `req('ORB-RENDER-006')` `--disable-webgl` fallback region + `WEBGL_lose_context` round-trip                                                                         | e2e (nowebgl + swiftshader)  | ORB-RENDER-006                         | `tests/e2e/renderer.capability-failure.spec.ts`                       |
| `req('ORB-PERF-003')` desktop-high + adaptive under SwiftShader degrades in ladder order without errors                                                             | e2e                          | ORB-PERF-003                           | `tests/e2e/renderer.adaptive.spec.ts`                                 |
| `req('ORB-PERF-006')` Pixel 7 emulation → mobile-default, DPR ≤ 1.5                                                                                                 | e2e                          | ORB-PERF-006                           | `tests/e2e/mobile.preset.spec.ts`                                     |
| `req('ORB-A11Y-003','ORB-A11Y-004')` emulateMedia reduce → uMotionScale 0, formation still drawn; toggling back restores                                            | e2e                          | ORB-A11Y-003                           | `tests/e2e/a11y.reduced-motion.spec.ts`                               |
| `req('ORB-RENDER-003','ORB-PERF-003')` playground controls reach uniforms and controller; axe clean                                                                 | e2e                          | ORB-RENDER-003, ORB-PERF-003           | `tests/e2e/playground.quality.spec.ts`                                |
| `req('ORB-PERF-001')` FPS capture per preset, JSON artifacts, baseline comparison                                                                                   | perf (nightly, non-blocking) | ORB-PERF-001                           | `tests/perf/fps.perf.spec.ts`                                         |
| `req('ORB-PERF-001')` desktop-default ≥ 55 FPS median on the reference machine                                                                                      | manual                       | ORB-PERF-001                           | `docs/reference/perf-matrix.md` + `specs/requirements.overrides.yaml` |

CI: unit/property/arch in stage 4 (coverage ≥ 90 % lines on `engine/quality/**`, ≥ 85 % on `engine/render/**` excluding the three-bound `createRenderer.ts`/`postprocessing.ts` which are covered by E2E); E2E in stage 7 on `chromium-swiftshader` and `chromium-nowebgl` against the production build with `?preset=ci&adaptive=0&seed=1&debug=1`; perf in stage 12 nightly. Determinism: every random value from `Prng` (`?seed=`, `NEXT_PUBLIC_ORB_SEED`); controller time = Σ injected dt (no `Date.now`); `FakeFrameTimeSource` / `FakeRenderer` / `FakeCanvas` in `tests/support/fakes/`; `expect.poll` only; the adaptive E2E asserts order and count of decisions, never timing.

## 8. ADRs to record

- ADR-0007 — Adaptive quality controller: context — SPEC §10 asks for adaptive quality with independent axes but no thresholds; naive FPS thresholds oscillate and misread resize/morph/tab-switch as degradation. Options — (a) static presets only (fails PERF-003 SHOULD); (b) GPU timer queries (`EXT_disjoint_timer_query`, widely disabled); (c) pure frame-time controller with EMA + p75, hysteresis bands (1.25×/0.7× budget), sustain windows (2 s / 10 s), cooldown 3 s, freeze windows, fixed ladder `postProcessing → pixelRatio → connections → shaderTier → particleCount`, count changes via `drawRange` over a max-allocated buffer. Recommendation — (c); deterministic and unit-testable with synthetic series; thresholds tunable in W8 from the device matrix.
- ADR-0008 — Connection rendering strategy (decision now, implemented in Wave 3): context — `connectionDensity` and the `network` formation need lines that follow particles through morph, turbulence and pointer forces without per-frame CPU work or O(N²) cost. Options — (a) per-frame CPU neighbour search + line rebuild (O(N log N)–O(N²), not viable at 15k+); (b) screen-space post effect (cheap, not "network" semantics); (c) GPU position textures (needs the ping-pong path rejected in ADR-0009's default). (d) precomputed seeded k-nearest edge list per formation (cap ≈ 2N), one `THREE.LineSegments` whose vertex attributes are the shared `position`/`aTarget`/`aPhase`/`aSeed` `BufferAttribute` instances of the particle geometry, same vertex-shader chain, `connectionDensity` → `drawRange` (O(1)), first rung of the degrade ladder after post-processing/DPR. Recommendation — (d); `ParticleSystem.getSharedAttributes()` exists from this wave so Wave 3 attaches lines without touching the renderer lifecycle.

## 9. Deliverables

- `shaders/particle.vert.glsl`, `shaders/particle.frag.glsl`, `shaders/chunks/noise.glsl`, `shaders/index.ts`, `shaders/glsl.d.ts`; `next.config.ts` (`.glsl` raw rule, `reactStrictMode: true`), `vitest.config.ts` (`.glsl` transform).
- `engine/ports/{RendererPort.ts, ParticleBufferPort.ts, FrameTimeSource.ts, NullRenderer.ts}`.
- `engine/render/{ParticleSystem.impl.ts, createRenderer.ts, uniforms.ts, materials.ts, disposal.ts, contextLoss.ts, postprocessing.ts, bootstrapSphere.ts, debugSnapshot.ts}`; `engine/ParticleSystem.ts` (entry re-export). `bootstrapSphere.ts` is replaced by `formations/generators/sphere.ts` in Wave 3 (deleted then).
- `engine/quality/{capabilities.ts, presets.ts, ladder.ts, QualityController.ts, FrameTimeSampler.ts}`.
- `engine/OrbEngine.ts` (v0), `engine/index.ts` (v0 surface), `core/limits.ts` (particles, dpr constants — touch, W0-owned file).
- `components/orb/{OrbCanvas.tsx, useOrbEngine.ts, OrbFallback.tsx}`, `components/playground/{QualityPanel.tsx, MotionPanel.tsx, PerfReadout.tsx}`, `components/store/orbStore.ts` (v0), `app/playground/page.tsx`, `app/playground/searchParams.ts` (zod).
- Deleted: `app/smoke/**`, the `ORB_SMOKE_ROUTES` env entry, and the Wave 0 smoke E2E (`tests/e2e/smoke.webgl.spec.ts` is superseded by `renderer.smoke.spec.ts`); the arch sunset guard in `tests/unit/arch/boundaries.test.ts` now asserts the exception is gone.
- `.eslintrc` rule: `no-restricted-syntax` `AwaitExpression` under `engine/render/**` and `engine/quality/**`.
- `tests/support/fakes/{FakeRenderer.ts, FakeFrameTimeSource.ts, FakeCanvas.ts, FakeCapabilityEnv.ts}`; all test files in §7; `tests/perf/{fps.perf.spec.ts, baseline.swiftshader.json}`; `playwright.config.ts` (`perf` project), `.github/workflows/nightly.yml` (perf step, artifact upload).
- `docs/adr/0007-adaptive-quality-controller.md`, `docs/adr/0008-connection-rendering-strategy.md`, `docs/security/threats/renderer.md`, `docs/reference/perf-matrix.md` (template + first desktop row), `specs/requirements.overrides.yaml` (ORB-PERF-001 manual entry), `specs/waves/wave-02-particle-renderer.md` (this file), `CHANGELOG.md` entry `V0.1`.

## 10. Exit criteria (Gate G2)

1. `tests/e2e/renderer.smoke.spec.ts` green on `chromium-swiftshader`: WebGL2 context created, frames advance, `programs ≥ 1`, `glErrors === 0`, `info.points === 2000`, no console errors, axe clean on `/playground`.
2. `tests/e2e/renderer.capability-failure.spec.ts` green on `chromium-nowebgl` (fallback region visible, `fallback === true`, frames counted, no `pageerror`) and on `chromium-swiftshader` (`loseContext`/`restoreContext` round-trip with stable `renderer.id`).
3. `tests/unit/engine/quality/quality-controller.test.ts` and `.property.test.ts` green: ladder order, hysteresis, cooldown, freeze, spike immunity, per-axis independence, never above ceiling (fast-check 1 000 runs).
4. `tests/unit/components/orb/OrbCanvas.strictmode.test.tsx` green: exactly one live renderer under `React.StrictMode`, zero after unmount.
5. `tests/unit/engine/render/count-change.test.ts` + `tests/e2e/renderer.count.spec.ts` green: count change never recreates renderer/canvas/context/`Points`.
6. `tests/e2e/a11y.reduced-motion.spec.ts` green: `uMotionScale === 0` under `prefers-reduced-motion: reduce`, formation still drawn, runtime toggle works.
7. `tests/e2e/renderer.latency-independence.spec.ts` and `tests/unit/engine/render/frame-loop.test.ts` green.
8. `tests/e2e/mobile.preset.spec.ts` green (Pixel 7 → `mobile-default`, DPR ≤ 1.5).
9. `docs/reference/perf-matrix.md` contains a `desktop-default` row from the maintainer's reference machine with median FPS ≥ 55 at `?adaptive=0`, commit SHA and date; `specs/requirements.overrides.yaml` lists ORB-PERF-001 as manual with that evidence.
10. Nightly `perf` project produced five JSON artifacts on at least one run; `tests/perf/baseline.swiftshader.json` committed.
11. `pnpm req:coverage` reports every ORB-RENDER-001…008, ORB-PERF-003/005/006 and ORB-A11Y-003 covered by ≥ 1 passing test; ORB-PERF-001 by the override entry.
12. `pnpm arch` green: `three` only under `engine/render/**` + `shaders/**`; `engine/render/**` and `engine/quality/**` contain no `await`; `app/smoke/**` removed and its sunset guard flipped.
13. Coverage thresholds from §7 met; ADR-0007 and ADR-0008 accepted; `docs/security/threats/renderer.md` merged; CHANGELOG `V0.1` entry present.

## 11. Risks, spikes and open questions

- Risk: SwiftShader too slow for the `ci` preset (2 000 additive sprites + bloom off) to reach the `frames` assertions inside the 15 s expect timeout → spike (½ day) in the first PR: measure `ci` FPS on GitHub Actions; if median < 8 FPS drop `ci` to 1 000 particles via a spec amendment to ORB-PERF-006 → owner: spec-amendment.
- Risk: `three ≥ r163` has no WebGL1 renderer, so the "WebGL1 → basic tier" row degrades to headless on WebGL1-only devices → decision needed: pin `three ≤ r162` (maintenance cost) or accept WebGL1 → headless (ORB-RENDER-006 is satisfied either way; W8's device matrix records the real-world share) → owner: ADR addendum to ADR-0007 / user.
- Risk: `UnrealBloomPass` + Turbopack ESM import of `three/examples/jsm` fails to bundle → spike (½ day) in Track A; fallback is a minimal in-house two-pass blur under `engine/render/postprocessing.ts` (same `PostPass` interface) → owner: ADR-0007 addendum.
- Risk: adaptive E2E under SwiftShader is timing-shaped (needs ≥ 2 s sustained overrun + window fill) → mitigated by asserting decision order/count only, with `expect.poll` timeout 20 s; if flaky > 2/week, replace with a `__orbDebug.quality.injectFrameTimes([...])` debug hook feeding the same controller → owner: Wave 2 maintainer.
- Risk: `navigator.deviceMemory` is Chromium-only → `deviceMemoryGb: null` on Firefox/Safari; the mobile-low heuristic then relies on `maxPointSize` only; W8 tunes → owner: W8.
- Open question (W4 owner / spec amendment ORB-API-001): the v0 facade adds `setParticleCount`, `setQuality`, `setVisualOverride`, `setReducedMotion`, `subscribeQuality`, `tick`, `mode` to the §22 surface; the Wave 4 API snapshot and the amendment text for ORB-API-001 must include them or move them behind a `debug`/host namespace.
- Open question (W3 owner): Wave 3's `ConnectionLinesOptions.sharedAttributes` names `aFrom`/`aTo`; this wave's contract names are `position`/`aTarget` (ORB-RENDER-007). Wave 3 should consume `getSharedAttributes()` as `{ position, aTarget, aPhase, aSeed }` and drop the alias names.
- Planning assignment: ORB-A11Y-007 belongs to W4; this wave supplies the motion mechanism and W5 adds pointer/audio regression coverage.
- Open question (spec-amendment): `postProcessing` (bloom) is visual polish under SPEC §28 rule 9; confirm it stays a degradable axis in V1 rather than being dropped, since ORB-PERF-005 names post-processing explicitly.

## 12. Playground and demo controls introduced

`/playground` v0 (no demo page yet): particle count input + preset chips; quality preset select (`auto`, `mobile-low`, `mobile-default`, `desktop-default`, `desktop-high`, `desktop-ultra`, `ci`); adaptive toggle; per-axis overrides (post-processing, pixel ratio, connections cap — inert until Wave 3, shader tier, count); turbulence, rotation speed, pulse strength, particle scale sliders; reduced-motion override (`auto`/`on`/`off`); seed input; `PerfReadout` (EMA / p75 frame time, FPS, active profile, ladder index, decision log, capability report, fallback reason); "Simulate context loss" (debug only). URL parity: `?particles=`, `?preset=`, `?adaptive=0|1`, `?seed=`, `?reducedMotion=`, `?debug=1`. `window.__orbDebug` gains `renderer`, `quality`, `uniforms`, `reducedMotion`, `capabilities`, `fallback`, `frames`, `perf.capture`.
