# Wave 5 — Pointer interaction and audio reactivity

| Field                     | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**                | proposed                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Milestones (SPEC §27)** | V0.3 Pointer interaction + V0.7 Audio reactivity                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Depends on**            | Wave 4 (`OrbEngine` public API incl. `setPointerForce`/`attachAudio` stubs, real `RendererPort` wiring, demo page `/`, playground state panel, `reducedMotion` option), Wave 2 (`RendererPort.setUniform`, `UniformName` incl. `uPointer*`/`uAudio*`, `FrameTimeSource`, `uMotionScale`), Wave 3 (`shaders/chunks/displacement.glsl`, `tests/support/glslEval.ts`), Wave 0 (`core/{clock,prng,logger}`, `Permissions-Policy: microphone=(self)`, `__orbDebug`, `req()` helper) |
| **Spec version**          | SPEC.md 0.2.0 (0.1.0 + amendments A-02, A-08, A-15, A-17; user decision U-2 — see `specs/SPEC-amendments-proposal.md`)                                                                                                                                                                                                                                                                                                                                                         |
| **Gate**                  | G5 — two independent sub-gates that MUST both be green: **G5-P** pointer forces displace particles and spring back (< 0.01 within 2 s), input→uniform p95 ≤ 50 ms at `ci` preset, touch works, snapshot never changes; **G5-A** microphone only after a gesture, denied/unsupported paths keep the engine running with features at 0, fake-device E2E raises `uAudioUser`, user/assistant/synthetic sources are separate, audio can never change `OrbSnapshot`                 |
| **Estimated size**        | M — two parallel tracks of ~1 week each for one contributor; the engine already exposes the uniforms and the facade methods, so the work is domain math, DOM/Web Audio infrastructure, permission UX, tests and docs                                                                                                                                                                                                                                                           |

## 1. Objective

After Wave 4 the orb renders every canonical state but ignores the person in front of it. This wave adds two cosmetic input layers that feed shader uniforms and nothing else: (1) pointer forces — mouse and touch positions mapped from client pixels to NDC to the orb's z = 0 plane, applied on the GPU as a stateless displacement in `repel`, `attract` or `wave` mode, with a critically-damped spring envelope that returns every particle to its active formation; (2) audio reactivity — `AudioFeatures` (RMS amplitude + low/mid/high bands, attack/release smoothed) extracted from an `AnalyserLike` for a user source (microphone, permission-gated behind an explicit gesture), an assistant source (HTML media element) and a deterministic `SyntheticSource` used by the credential-free demo while the orb is `speaking` and by CI. A stakeholder can open `/`, wave the mouse over the orb and watch particles part and return, press "Enable microphone", speak and see the orb breathe, run the AI sequence and see the face pulse with synthetic speech — while the accessible status text and `OrbSnapshot` never change because of any of it.

## 2. Scope

### 2.1 In scope

- `pointer/domain`: `PointerForceConfig` validation, NDC mapping, pointer-plane projection, `PointerState` with velocity, spring-return envelope, TypeScript reference of the GPU displacement function (§4.1).
- `pointer/infrastructure`: `PointerInput` (Pointer Events incl. touch, passive listeners, `pointercancel`), once-per-frame sampling, latency probe, `uPointer*` uniform writes (§4.2).
- `shaders/chunks/displacement.glsl`: `pointerDisplacement()` and `audioDisplacement()` GLSL twins, wired into `particle.vert.glsl`/`particle.frag.glsl`, all multiplied by `uMotionScale` (A-15).
- `audio/domain`: `AudioFeatures`, `extractFeatures` (RMS, bands, bin mapping by sample rate), attack/release smoothing constants, `withGain` decorator (§4.3).
- `audio/infrastructure`: `MicrophoneSource` with the permission state machine, `MediaElementSource`, `SyntheticSource` (seeded, clock-driven, Node-safe), `AnalyserPump` on `FrameTimeSource` (§4.4).
- Engine wiring of `setPointerForce` and `attachAudio`, `__orbDebug.pointer` / `__orbDebug.audio`, demo speaking → `SyntheticSource`, `MicrophoneToggle` HTML control with privacy statement, playground `PointerPanel` and `AudioPanel` (§4.5).
- Threat model `docs/security/threats/audio.md`, ADR-0012, reference and explanation docs, dependency-cruiser rules for `pointer/**` and `audio/**`.

### 2.2 Out of scope (deferred)

- Assistant audio from a provider voice stream (OpenAI Realtime API) → Wave 7 / U-2; the `assistant` kind accepts any `HTMLMediaElement` so a future adapter needs no engine change.
- Voice-activity detection that emits `USER_SPEAKING` — never in `audio/**` (ORB-AUDIO-004); an adapter MAY implement it in Wave 7 as adapter code with `source: 'adapter'`.
- Real-device pointer latency and microphone matrix (Chrome/Safari/Firefox, iOS suspended `AudioContext`) → Wave 8 `docs/reference/perf-matrix.md` and `manual-verification.md`.
- Multi-pointer forces (two fingers = two force centres) → post-V1; V1 tracks the primary pointer only.
- Audio-driven formation switching, haptics, audio playback control, spectrogram visuals → not in V1 (would violate ORB-AUDIO-004 or add scope).
- Pointer forces as part of the adaptive-quality degrade ladder → not needed: the cost is one uniform write per frame (ORB-PERF-005 unaffected).

## 3. Requirements owned by this wave

Every ID listed here is owned by this wave and must be fully satisfied and verified before the gate closes. These are planned obligations; no test evidence is implied. Shared declaration owners and integration rules are in `specs/SHARED-CONTRACTS.md`.

| ID              | Level    | Summary                                                                                                                                                                                                                                                         | Slice         | Verification                                                       |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| ORB-POINTER-001 | MUST     | Particles displaced by pointer forces MUST return toward their active formation; with no pointer input, max displacement MUST fall below ε = 0.01 (unit-sphere units) within 2 s at any preset.                                                                 | 4.1, 4.2      | unit (property) + GLSL parity + e2e                                |
| ORB-POINTER-002 | MUST NOT | Pointer interaction MUST NOT mutate semantic state: no pointer input may change `OrbSnapshot` (identity-equal), emit an `OrbEvent` or call `respondToApproval`; effects live only in `uPointer*` uniforms.                                                      | 4.1, 4.2, 4.5 | arch + integration + e2e                                           |
| ORB-POINTER-003 | SHOULD   | Touch SHOULD be supported via Pointer Events (`pointerdown/move/up/cancel`, passive listeners); `pointercancel` MUST release the force.                                                                                                                         | 4.2           | unit (jsdom) + e2e (touch emulation)                               |
| ORB-POINTER-004 | MUST     | `PointerForceConfig` MUST be `{ radius; strength; mode: repel / attract / wave }` with `radius` in unit-sphere world units and `strength ≥ 0`; `setPointerForce(config \| null)` MUST apply it without re-creating the renderer; `null` disables pointer input. | 4.1, 4.5      | unit + integration                                                 |
| ORB-PERF-004    | SHOULD   | Pointer feedback SHOULD appear within 50 ms when hardware permits.                                                                                                                                                                                              | 4.2           | e2e latency probe (CI, `ci` preset) + perf-matrix row (manual, W8) |
| ORB-AUDIO-001   | MUST     | Microphone access MUST require user permission (`getUserMedia` only from an explicit user gesture; never on load, construct or attach).                                                                                                                         | 4.4, 4.5      | unit + static + e2e (denied, prompt)                               |
| ORB-AUDIO-002   | MUST     | Engine MUST work without microphone permission (features 0, uniforms 0, render loop and state unaffected on denied/unsupported/no source).                                                                                                                      | 4.3, 4.4, 4.5 | unit + e2e                                                         |
| ORB-AUDIO-003   | SHOULD   | User and assistant audio SHOULD be distinguishable sources (`AudioSource.kind`, `uAudioUser` vs `uAudioAssistant`, independent pipelines).                                                                                                                      | 4.3, 4.4      | unit + integration + e2e (demo speaking)                           |
| ORB-AUDIO-004   | MUST NOT | Audio effects MUST NOT determine semantic agent state (no VAD, no events, no dependency on `engine/state`).                                                                                                                                                     | 4.3, 4.4      | arch + property + e2e                                              |
| ORB-AUDIO-005   | MAY      | Audio MAY modulate radius, displacement, brightness, pulse and wave propagation exclusively through `uAudioUser`, `uAudioAssistant`, `uAudioBands`; never `OrbSnapshot`/`OrbVisualState`.                                                                       | 4.3, 4.4      | unit + GLSL parity                                                 |

Requirements touched but owned elsewhere: ORB-A11Y-003 (W2 — `uMotionScale = 0` zeroes pointer and audio displacement), ORB-A11Y-007 (W4; this wave verifies its pointer/audio clause), ORB-API-001 (W4 — `setPointerForce`/`attachAudio` implemented, api snapshot gains only re-exported pointer/audio types), ORB-ARCH-005 (W1 — microphone toggle and status are semantic HTML outside the canvas), ORB-STATE-001 (W1 — `transition()` never receives pointer/audio input), ORB-EVENT-008 (W1 — no event source exists for pointer/audio), ORB-RENDER-005 (W2 — `AnalyserPump` and `PointerInput` never await on the frame path), ORB-PLAY-001 (W8 — playground gains pointer forces and audio reactivity controls), ORB-PLAY-002 (W4 — new panels cannot reach governance), ORB-DEMO-002 (W1 — synthetic assistant audio is covered by the existing "Simulated" badge), ORB-PERF-005 (W2 — pointer/audio excluded from the degrade ladder by design).

## 4. Vertical slices

### 4.1 Pointer domain — bounded context `pointer/domain`

**Objective.** Pure, Node-testable math: validate the force config, map client pixels → NDC → the orb's z = 0 plane, integrate the spring-return envelope, and provide the TypeScript reference of the GPU displacement so the shader can be parity-tested and the maximum displacement can be reported without GPU readback.

**Contracts.**

```ts
// pointer/domain/PointerForceConfig.ts
export interface PointerForceConfig { radius: number; strength: number; mode: 'repel' | 'attract' | 'wave' }  // verbatim SHARED_CONTRACTS
export const POINTER_LIMITS = { radiusMin: 0.05, radiusMax: 2, strengthMin: 0, strengthMax: 2 } as const;   // unit-sphere units
export const DEFAULT_POINTER_FORCE: PointerForceConfig = { radius: 0.35, strength: 0.25, mode: 'repel' };
export type PointerConfigErrorCode = 'invalid_radius' | 'invalid_strength' | 'invalid_mode' | 'not_finite';
export class PointerConfigError extends Error { constructor(readonly code: PointerConfigErrorCode, readonly field: keyof PointerForceConfig) }
export function validatePointerForceConfig(input: unknown): Result<PointerForceConfig, PointerConfigError>;  // zod schema; rejects NaN/Infinity/out of range; never clamps silently

// pointer/domain/ndc.ts
export interface CanvasRect { left: number; top: number; width: number; height: number }        // CSS px (getBoundingClientRect)
export interface CameraModel { distance: number; fovRad: number; aspect: number }              // perspective camera on +z looking at origin
export function clientToNdc(clientX: number, clientY: number, rect: CanvasRect): [number, number];
export function ndcToPointerPlane(ndc: [number, number], cam: CameraModel): [number, number];  // world xy on the z = 0 plane
export function isInsideCanvas(ndc: [number, number]): boolean;                                // |x| ≤ 1 && |y| ≤ 1

// pointer/domain/pointerState.ts
export interface PointerState {
  enabled: boolean;            // config !== null
  active: boolean;             // a primary pointer is over the canvas (mouse) or down on it (touch)
  ndc: [number, number];       // last sample, raw (never smoothed)
  world: [number, number];     // pointer-plane position, raw
  velocity: [number, number];  // world units / s, EMA τ = 50 ms; readout only in V1
  envelope: number;            // effective strength 0..cfg.strength (spring, §Behavior)
  envelopeVelocity: number;
  lastInputAtMs: number | null;
}
export const INITIAL_POINTER_STATE: PointerState;
export function samplePointer(s: PointerState, input: { ndc: [number, number]; active: boolean; nowMs: number }, cam: CameraModel): PointerState;  // pure
export function stepPointer(s: PointerState, cfg: PointerForceConfig, dtS: number): PointerState;   // spring + velocity decay; pure
export function pointerUniforms(s: PointerState, cfg: PointerForceConfig | null): { uPointerPos: [number, number, number]; uPointerRadius: number; uPointerStrength: number; uPointerMode: number };  // mode: repel 0, attract 1, wave 2
export function maxPointerDisplacement(s: PointerState, motionScale: number): number;               // = envelope · motionScale (analytic bound, see displacement.ts)

// pointer/domain/spring.ts
export const POINTER_SPRING = { omega: (2 * Math.PI) / 0.35, zeta: 1, maxDtS: 1 / 30, settleEpsilon: 0.01 } as const;
export interface SpringState { value: number; velocity: number }
export function stepSpring(s: SpringState, target: number, dtS: number, p?: typeof POINTER_SPRING): SpringState;

// pointer/domain/displacement.ts — TypeScript twin of GLSL pointerDisplacement()
export const POINTER_WAVE = { k: 12, omega: 6 } as const;       // radians per world unit, radians per second
export function pointerDisplacement(p: [number, number, number], u: ReturnType<typeof pointerUniforms>, timeS: number, motionScale: number, seedDir: [number, number]): [number, number, number];
```

**Behavior.**

NDC mapping (DPR-invariant: `clientX/Y` and the rect are both CSS px; the drawing-buffer scale cancels):

```text
xNdc =  ((clientX − rect.left) / rect.width)  · 2 − 1
yNdc = −(((clientY − rect.top) / rect.height) · 2 − 1)
```

Pointer plane (the orb is a unit sphere at the origin; the camera sits at `(0, 0, distance)` with vertical field of view `fovRad` and `aspect = width / height`; the plane z = 0 is `distance` away from the camera):

```text
halfH = distance · tan(fovRad / 2);  halfW = halfH · aspect
world = (xNdc · halfW, yNdc · halfH, 0)
```

`CameraModel` comes from the renderer (`RendererPort.camera`, added in §4.2; `NullRenderer` reports `{ distance: 3, fovRad: 50° = 0.8727, aspect: 1 }`). `resize()` refreshes `aspect` and the cached rect.

Spring-return envelope (critically damped, semi-implicit Euler, `dt` clamped to `maxDtS` so a background tab does not explode the integrator):

```text
target = active ? cfg.strength : 0
if active:      envelope = cfg.strength, envelopeVelocity = 0          // instant attack (ORB-PERF-004: feedback on the very next frame)
else:           dt = min(dtS, 1/30)
                a  = −2·ζ·ω·v − ω²·(x − 0)
                v' = v + a·dt;  x' = max(0, x + v'·dt)
```

With ω = 2π/0.35 rad/s and ζ = 1, `x` decays below 1 % of its start in ≈ 0.25 s — an order of magnitude inside the 2 s bound of ORB-POINTER-001. Position uniforms are never smoothed (smoothing adds latency); only the envelope is.

Displacement (applied in the vertex shader after rotation, before audio and projection; `p` is the rotated particle position; `d` is measured in the view-aligned xy plane so front and back particles react alike):

```text
d    = length(p.xy − uPointerPos.xy)
w    = smoothstep(uPointerRadius, 0, d)                   // 1 at the pointer, 0 at the radius edge, 0 outside
dir  = d > 1e-4 ? (p.xy − uPointerPos.xy) / d : seedDir   // seedDir = unit vector from aSeed (no NaN at the exact centre)
s    = uPointerStrength · uMotionScale
repel   : p.xy += dir · w · s
attract : p.xy −= dir · min(w · s, d)                     // never crosses the pointer
wave    : p.z  += sin(d · 12 − uTime · 6) · w · s
```

Bound: `|Δp| ≤ s = envelope · uMotionScale` in every mode — this is what `maxPointerDisplacement` reports and what `__orbDebug.pointer.maxDisplacement` exposes; a 256-point parity test proves the GLSL and TS functions agree.

**Edge cases.**

- `validatePointerForceConfig({ radius: 0, … })` → `invalid_radius` (below `radiusMin`); `strength: -1` → `invalid_strength`; `mode: 'push'` → `invalid_mode`; `NaN` anywhere → `not_finite`. `setPointerForce` throws the `PointerConfigError`; the previous config stays applied.
- `strength: 0` is valid and is the identity (displacement 0 everywhere).
- Pointer exactly at a particle (`d = 0`) → `seedDir` used; no NaN, no division by zero.
- `rect.width === 0` (canvas hidden) → `clientToNdc` returns `[NaN, NaN]`; `samplePointer` treats a non-finite NDC as `active: false`.
- `dtS ≤ 0` or non-finite → `stepPointer` returns the state unchanged.
- `uMotionScale = 0` (reduced motion, A-15) → displacement and `maxDisplacement` are 0 even while the pointer is active; `PointerState.active` still tracks input (for the playground readout).
- NDC outside `[-1, 1]` (pointer left the canvas but the browser still delivered an event) → `active: false`.

**Acceptance criteria.**

- Given the rect `{left: 10, top: 20, width: 200, height: 100}`, When `clientToNdc(10, 20)` and `clientToNdc(210, 120)` are called, Then they return `[-1, 1]` and `[1, -1]`, and the results are identical for any DPR. — ORB-POINTER-004 — `tests/unit/pointer/ndc.test.ts`
- Given any `SpringState` with `|value| ≤ 2` and `|velocity| ≤ 20` and any sequence of `dtS ∈ (0, 0.1]` summing to 2 s, When `stepSpring` is applied toward 0, Then the final `|value| < 0.01` and `value ≥ 0` at every step. — ORB-POINTER-001 — `tests/unit/pointer/spring.property.test.ts`
- Given any particle `p` in the unit sphere, any valid config, any envelope and any mode, When `pointerDisplacement` is applied, Then `|Δp| ≤ envelope · motionScale`, `Δp = 0` for `d ≥ radius`, `repel` does not decrease `d`, and `attract` does not increase `d` nor cross the pointer. — ORB-POINTER-001, ORB-POINTER-004 — `tests/unit/pointer/displacement.property.test.ts`
- Given 256 seeded sample tuples `(p, uniforms, time)`, When the GLSL `pointerDisplacement()` is evaluated through `tests/support/glslEval.ts` and compared with the TS twin, Then `max |Δ| < 1e-4`. — ORB-POINTER-001 — `tests/unit/shaders/pointer.parity.test.ts`
- Given `motionScale = 0`, When the pointer is active with `strength = 2`, Then `maxPointerDisplacement` and the displacement at every sample point are exactly 0. — ORB-POINTER-001 (touches ORB-A11Y-007) — `tests/unit/pointer/displacement.test.ts`

**Observability.** None (pure module). Positions are never logged anywhere in this wave.

### 4.2 Pointer infrastructure and shader — bounded contexts `pointer/infrastructure`, `shaders/`, `engine/render`

**Objective.** Attach DOM listeners to the canvas host, sample at most once per frame, write the four `uPointer*` uniforms through `RendererPort`, implement the GLSL twin, and measure input→uniform latency so ORB-PERF-004 is a number, not an opinion.

**Contracts.**

```ts
// pointer/infrastructure/PointerInput.ts
export interface PointerInputOptions {
  target: HTMLElement;
  clock: Clock;
  touch?: boolean /* default true */;
  touchAction?: "none" | "inherit"; /* default 'none' */
}
export interface PointerSample {
  ndc: [number, number];
  active: boolean;
  inputTimeStampMs: number /* event.timeStamp */;
  seq: number;
}
export interface PointerInput {
  attach(): void; // pointermove/down/up/cancel/leave (+ 'blur' on window) with { passive: true }
  detach(): void; // removes every listener; idempotent
  take(): PointerSample | null; // returns the latest sample since the previous take(), then clears it (once-per-frame)
  setRect(rect: CanvasRect): void; // engine calls on resize(); ResizeObserver + scroll refresh inside
}
export function createPointerInput(o: PointerInputOptions): PointerInput;

// pointer/infrastructure/latencyProbe.ts
export interface LatencyReport {
  samples: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}
export interface LatencyProbe {
  record(inputTimeStampMs: number, uniformAppliedMs: number): void;
  report(): LatencyReport;
  reset(): void;
} // ring buffer of 256
export function createLatencyProbe(): LatencyProbe;

// engine/ports/RendererPort.ts — ADDED field (a wave may add, never rename)
export interface RendererPort {
  /* … existing … */ readonly camera: CameraModel;
}

// engine/render/uniforms.ts — defaults added
// uPointerPos [0,0,0], uPointerRadius 0.35, uPointerStrength 0, uPointerMode 0, uAudioUser 0, uAudioAssistant 0, uAudioBands [0,0,0]
```

```glsl
// shaders/chunks/displacement.glsl — functions added this wave (uniform names verbatim from UniformName)
uniform vec3  uPointerPos; uniform float uPointerRadius; uniform float uPointerStrength; uniform float uPointerMode;
uniform float uAudioUser;  uniform float uAudioAssistant; uniform vec3 uAudioBands;
vec3 pointerDisplacement(vec3 p, vec2 seedDir, float time, float motionScale);
vec3 audioDisplacement(vec3 p, vec3 normal, float seed, float time, float motionScale);   // §4.3 constants
float audioBrightness(float brightness);                                                   // brightness · (1 + 0.5 · uAudioAssistant + 0.25 · uAudioUser)
// particle.vert.glsl order: base = mix(from,to,eased) → rotate(uRotationSpeed·uTime) → turbulence/pulse (W3) → pointerDisplacement → audioDisplacement → project
```

**Behavior.**

- The engine's frame callback (registered on `FrameTimeSource.onFrame` by Wave 4) does, in order: `sample = input.take()`; if `sample` → `state = samplePointer(...)`; `state = stepPointer(state, cfg, dtS)`; `setUniform` × 4; then `renderer.render(nowMs)`; then if `sample` → `probe.record(sample.inputTimeStampMs, clock.now())`. One sample per frame regardless of event rate (mitigation g5); `getCoalescedEvents` is not used.
- Mouse: `pointermove` over the target activates; `pointerleave`, window `blur`, or NDC outside `[-1, 1]` deactivates. Touch (`pointerType === 'touch'`): only between `pointerdown` and `pointerup`/`pointercancel`/`pointerleave`; only `event.isPrimary` pointers are tracked (multi-touch: the first finger wins, others ignored). Pen behaves as mouse.
- `touchAction: 'none'` sets `style.touchAction = 'none'` on the target while attached (restored on detach) so touch drags reach the orb instead of scrolling; hosts that embed the orb inside scrollable content pass `'inherit'` and accept that vertical drags scroll.
- Latency definition (ORB-PERF-004): `latency = uniformAppliedMs − event.timeStamp`, where `uniformAppliedMs` is `clock.now()` immediately after `renderer.render()` of the first frame that consumed the sample. This measures the CPU pipeline (listener → next rAF → uniform → draw submitted); GPU presentation is outside browser observability and is the "when hardware permits" clause, recorded manually in Wave 8. The probe is always on (cost: two numbers per frame) and exposed as `__orbDebug.pointer.latency` in debug builds; `performance.mark('orb:pointer:input')`/`performance.measure('orb:pointer:latency')` are emitted only when `?debug=1`.
- `OrbEngine.resize()` re-reads `getBoundingClientRect()` and `renderer.camera.aspect`; `PointerInput` also refreshes the rect on `scroll` (capture, passive) and via `ResizeObserver` so a moving canvas maps correctly.
- `setPointerForce(null)` → `input.detach()`, `state.enabled = false`, `active = false`; the envelope decays through the spring (no snap). `setPointerForce(cfg)` on a disabled engine re-attaches. `dispose()` detaches.
- Constructor option `pointer` omitted → `DEFAULT_POINTER_FORCE` attached (pointer interaction works out of the box, SPEC §26); `pointer: false` → never attached.
- Headless mode (`capabilities.webgl2 = false`, Wave 2 fallback): `PointerInput` is not attached (nothing to displace); `setPointerForce` still validates and stores the config.

**Edge cases.**

- 1 000 `pointermove` events in one frame → exactly one `setUniform` batch and one probe sample (the last event's timestamp — the latest input is what the user sees).
- `pointercancel` (browser takes over the gesture for scrolling) → `active = false` immediately; envelope springs back.
- Tab hidden for 10 s then visible → `dtS` clamps to 1/30; the envelope continues from its stored value; no NaN.
- `detach()` twice → no throw; listener count on the target is 0 (asserted with a spied `addEventListener`/`removeEventListener` pair).
- Canvas removed from DOM while attached → `ResizeObserver` reports 0×0 → NDC non-finite → `active = false`.
- Event storms cannot allocate: `PointerSample` is a reused object (no per-event allocation).

**Acceptance criteria.**

- Given a jsdom target and 50 `pointermove` events dispatched between two frames, When `take()` is called once, Then it returns one sample whose `ndc` matches the last event, `seq` advanced by 50, and every listener was registered with `{ passive: true }`. — ORB-POINTER-003, ORB-PERF-004 — `tests/unit/pointer/PointerInput.test.ts`
- Given a touch `pointerdown` (`isPrimary: true`) followed by a second finger (`isPrimary: false`) and then `pointercancel` for the primary, When samples are taken, Then the second finger never produces a sample and the last sample has `active: false`. — ORB-POINTER-003 — `tests/unit/pointer/PointerInput.test.ts`
- Given an attached input, When `detach()` is called twice, Then every `addEventListener` has a matching `removeEventListener` and `style.touchAction` is restored. — ORB-POINTER-002 — `tests/unit/pointer/PointerInput.test.ts`
- Given a fake `RendererPort` and an `OrbEngine` with a `FakeClock`, When a sample at NDC `(0.25, −0.5)` is fed and one frame runs, Then `setUniform('uPointerPos', …)` received the pointer-plane projection of that NDC using `renderer.camera`, `uPointerStrength` equals `cfg.strength`, and the `OrbSnapshot` returned by `subscribe` before and after is the same object. — ORB-POINTER-001, ORB-POINTER-002 — `tests/integration/engine/pointer.test.ts`
- Given the same engine, When `setPointerForce(null)` is called and 2 s of frames run, Then `input.detach` was called once and `uPointerStrength` is `< 0.01` at the end and never increased. — ORB-POINTER-004, ORB-POINTER-001 — `tests/integration/engine/pointer.test.ts`
- Given `/?preset=ci&adaptive=0&seed=1&debug=1` under SwiftShader, When `page.mouse.move` crosses the canvas centre over 20 steps, Then `__orbDebug.pointer.maxDisplacement > 0` and `__orbDebug.uniforms.uPointerPos` ≈ expected world position (±0.05); When the mouse moves off the canvas, Then `maxDisplacement < 0.01` within 2 s; and the bus spy (`__orbDebug.bus.emitted`) and `__orbDebug.snapshot.updatedAt` are unchanged throughout. — ORB-POINTER-001, ORB-POINTER-002, ORB-POINTER-004 — `tests/e2e/pointer.spec.ts`
- Given `devices['Pixel 7']` (`hasTouch: true`), When a touch `pointerdown` + 10 `pointermove` are dispatched on the canvas, Then `maxDisplacement > 0`; When `pointerup` is dispatched, Then it returns below 0.01 within 2 s. — ORB-POINTER-003 — `tests/e2e/pointer.touch.spec.ts`
- Given the `ci` preset, When 200 `page.mouse.move` steps are driven by explicit rendered-frame acknowledgements, Then `__orbDebug.pointer.latency.samples ≥ 150` and latency percentiles are recorded in CI; `p95Ms ≤ 50` is checked on the reference GPU (`p50Ms` is written to the CI artifact for the perf history). — ORB-PERF-004 — `tests/e2e/pointer.latency.spec.ts`
- Given `page.emulateMedia({ reducedMotion: 'reduce' })`, When the mouse moves over the orb, Then `maxDisplacement === 0`, `__orbDebug.pointer.active === true`, and the `role="status"` text is present. — ORB-POINTER-001 (touches ORB-A11Y-003, ORB-A11Y-007) — `tests/e2e/pointer.reduced-motion.spec.ts`

**Observability.** `orb.pointer.force_changed { mode, radius, strength } | { disabled: true }` (info, on every `setPointerForce`); `orb.pointer.input_attached { touch: boolean, touchAction }` / `orb.pointer.input_detached` (info). No coordinates, no timestamps of individual inputs, no per-frame logs. Latency percentiles are exposed through `__orbDebug` and the Wave 2 perf probe JSON (`pointerLatencyMs: { p50, p95 }` added to the artifact).

### 4.3 Audio domain — bounded context `audio/domain`

**Objective.** A pure, deterministic feature extractor and smoother that turns one frame of `AnalyserLike` bytes into `AudioFeatures`, plus the constants that define what "audio affects particles" means on the GPU.

**Contracts.**

```ts
// audio/domain/AudioFeatures.ts
export interface AudioFeatures {
  amplitude: number;
  low: number;
  mid: number;
  high: number;
} // verbatim SHARED_CONTRACTS; all 0–1, smoothed
export const ZERO_FEATURES: Readonly<AudioFeatures>;
export function zeroFeatures(out: AudioFeatures): AudioFeatures;

// audio/domain/extractFeatures.ts
export const AUDIO_ANALYSIS = {
  fftSize: 1024, // frequencyBinCount 512; bin width = sampleRate / 1024 (46.9 Hz @ 48 kHz, 43.1 Hz @ 44.1 kHz)
  nativeSmoothing: 0, // AnalyserNode.smoothingTimeConstant — we smooth ourselves (deterministic, dt-based)
  minDecibels: -100,
  maxDecibels: -30, // AnalyserNode defaults; byte 0..255 spans this range
  rmsNoiseFloor: 0.01,
  rmsFullScale: 0.5, // amplitudeRaw = clamp((rms − floor) / (full − floor), 0, 1); full-scale sine (rms 0.707) → 1
  bands: { low: [20, 250], mid: [250, 2000], high: [2000, 8000] } as const, // Hz, inclusive bins
  maxDtMs: 100, // dt clamp for smoothing
} as const;
export interface AnalyserScratch {
  time: Uint8Array;
  freq: Uint8Array;
} // allocated once per source, length fftSize / frequencyBinCount
export interface RawFeatures extends AudioFeatures {} // unsmoothed
export function binRange(
  hz: readonly [number, number],
  sampleRate: number,
  fftSize: number,
  binCount: number,
): [number, number]; // round(hz·fftSize/sampleRate) clamped to [1, binCount−1]
export function extractRaw(
  analyser: AnalyserLike,
  sampleRate: number,
  scratch: AnalyserScratch,
  out: RawFeatures,
): RawFeatures; // reads bytes, computes rms + band means; allocation-free

// audio/domain/smoothing.ts
export const AUDIO_SMOOTHING = {
  amplitude: { attackMs: 30, releaseMs: 150 },
  bands: { attackMs: 50, releaseMs: 250 },
} as const;
export function smoothFeatures(
  prev: AudioFeatures,
  raw: RawFeatures,
  dtMs: number,
  out: AudioFeatures,
): AudioFeatures;
//   per field: τ = raw > prev ? attackMs : releaseMs;  y = prev + (raw − prev) · (1 − exp(−dt / τ));  dt clamped to [0, maxDtMs]

// audio/domain/gain.ts
export interface GainedAudioSource extends AudioSource {
  setGain(gain: number): void;
} // multiplies every feature, clamps 0–1; gain ∈ [0, 2]
export function withGain(source: AudioSource, gain?: number): GainedAudioSource;

// audio/domain/audioUniforms.ts
export const AUDIO_EFFECT = {
  radiusUser: 0.08,
  radiusAssistant: 0.12,
  highJitter: 0.05,
  midWave: 0.06,
  midWaveK: 8,
  midWaveOmega: 4,
  brightnessAssistant: 0.5,
  brightnessUser: 0.25,
} as const;
export function audioUniforms(
  user: AudioFeatures | null,
  assistant: AudioFeatures | null,
): { uAudioUser: number; uAudioAssistant: number; uAudioBands: [number, number, number] };
//   uAudioUser = user?.amplitude ?? 0; uAudioAssistant = assistant?.amplitude ?? 0; uAudioBands = element-wise max of attached sources' (low, mid, high)
export function audioDisplacement(
  p: Vec3,
  normal: Vec3,
  seed: number,
  timeS: number,
  u: ReturnType<typeof audioUniforms>,
  motionScale: number,
): Vec3; // TS twin of the GLSL function
```

**Behavior.**

- RMS from time-domain bytes: `x = (b − 128) / 128`, `rms = sqrt(mean(x²))`, then normalised with the floor/full-scale constants. Silence bytes (all 128) → `amplitude = 0` exactly; a full-scale square wave → 1.
- Bands: mean of frequency bytes over the inclusive bin range, divided by 255. The bin ranges are recomputed from `sampleRate` (passed by infrastructure from `AudioContext.sampleRate`) so 44.1 kHz and 48 kHz devices map the same Hz windows.
- Smoothing is a one-pole filter with asymmetric time constants; it is the only stateful step and is a pure function of `(prev, raw, dt)`.
- GPU effect (ORB-AUDIO-005 — the exhaustive list of what audio may change; every term multiplied by `uMotionScale`):

```text
radial     : p *= 1 + 0.12 · uAudioAssistant + 0.08 · uAudioUser                       // breathing radius
high jitter: p += normal · 0.05 · uAudioBands.z · noise(seed, uTime · 3)              // sparkle on sibilants
mid wave   : p += normal · 0.06 · uAudioBands.y · sin(8 · atan(p.y, p.x) − 4 · uTime)  // wave propagation around the orb
pulse      : the W3 pulse phase gains + 0.5 · uAudioBands.x (bass drives pulse)
brightness : b *= 1 + 0.5 · uAudioAssistant + 0.25 · uAudioUser                       // fragment shader
```

`uMorphProgress`, the formation, `uRotationSpeed` and every `OrbVisualState` field are untouched by audio.

**Edge cases.**

- `dtMs = 0` → output equals `prev`; `dtMs > 100` → clamped to 100 (a background tab does not jump).
- `sampleRate` unknown (`0`/`NaN`) → infrastructure passes 48 000 and logs `orb.audio.sample_rate_defaulted` once.
- Frequency bytes all 255 (clipping) → every band = 1; amplitude still computed from the time domain.
- `frequencyBinCount` smaller than a band's upper bin (e.g. `fftSize 256`) → `binRange` clamps to `binCount − 1`; no out-of-bounds read.
- `withGain(source, 0)` → all features 0 while `source.sample` is still called (source lifecycle unaffected).
- Non-finite raw values (defensive) → treated as 0 before smoothing.

**Acceptance criteria.**

- Given a fake `AnalyserLike` writing all-128 time bytes and all-0 frequency bytes, When `extractRaw` + `smoothFeatures` run, Then every field is exactly 0; Given a full-scale square wave (bytes alternating 0/255), Then `amplitude = 1`. — ORB-AUDIO-002 — `tests/unit/audio/extractFeatures.test.ts`
- Given `sampleRate ∈ {44100, 48000}` and frequency bytes set to 255 only in the bins of the `low` window, When `extractRaw` runs, Then `low = 1`, `mid = 0`, `high = 0`; likewise for `mid` and `high`. — ORB-AUDIO-005 — `tests/unit/audio/bands.test.ts`
- Given `prev = 0`, `raw = 1`, `dt = 30`, When `smoothFeatures` runs, Then `amplitude = 1 − e⁻¹ ± 1e-6`; Given `prev = 1`, `raw = 0`, `dt = 150`, Then `amplitude = e⁻¹ ± 1e-6`; Given the same `(prev, raw, dt)` sequence twice, Then outputs are byte-identical. — ORB-AUDIO-005 — `tests/unit/audio/smoothing.test.ts`
- Given 256 seeded tuples, When GLSL `audioDisplacement()` is evaluated via `glslEval` against the TS twin, Then `max |Δ| < 1e-4`; and with `uAudioUser = uAudioAssistant = 0`, `uAudioBands = 0` the displacement is exactly 0. — ORB-AUDIO-005, ORB-AUDIO-002 — `tests/unit/shaders/audio.parity.test.ts`
- Given `user = null`, `assistant = {0.4, 0.1, 0.9, 0.2}`, When `audioUniforms` runs, Then `uAudioUser = 0`, `uAudioAssistant = 0.4`, `uAudioBands = [0.1, 0.9, 0.2]`; Given both attached, Then `uAudioBands` is the element-wise max. — ORB-AUDIO-003 — `tests/unit/audio/audioUniforms.test.ts`

**Observability.** None (pure module).

### 4.4 Audio infrastructure — bounded context `audio/infrastructure`

**Objective.** Three `AudioSource` implementations and the per-frame pump. The microphone one owns the permission state machine and is the only code in the repository that may call `getUserMedia`; the synthetic one runs in Node and CI with byte-identical output for a seed.

**Contracts.**

```ts
// audio/infrastructure/permissionState.ts
export type MicrophonePermissionState =
  "idle" | "requesting" | "granted" | "denied" | "unsupported";
export type MicrophoneDenyReason =
  "not_allowed" | "no_device" | "insecure_context" | "api_missing" | "track_ended" | "unknown";
export interface MicrophoneStatus {
  state: MicrophonePermissionState;
  reason: MicrophoneDenyReason | null;
  changedAt: number;
}
export function isMicrophoneSupported(
  nav: Pick<Navigator, "mediaDevices"> | undefined,
  secure: boolean,
): { ok: true } | { ok: false; reason: "api_missing" | "insecure_context" };

// audio/infrastructure/MicrophoneSource.ts — the ONLY file allowed to reference navigator.mediaDevices.getUserMedia (ESLint no-restricted-properties elsewhere)
export interface MicrophoneSourceOptions {
  clock: Clock;
  logger: Logger;
  audioContextFactory?: () => AudioContext;
  mediaDevices?: MediaDevices;
  constraints?: MediaTrackConstraints; /* default { echoCancellation: true, noiseSuppression: true, autoGainControl: false } */
}
export interface MicrophoneSource extends AudioSource {
  readonly kind: "user";
  readonly status: MicrophoneStatus;
  subscribe(cb: (status: MicrophoneStatus) => void): () => void;
  start(): Promise<void>; // MUST be called from a user gesture; never rejects — outcome is in status
  stop(): void; // track.stop() on every track, disconnect nodes, status → idle
  sample(out: AudioFeatures): void; // zero unless granted
}
export function createMicrophoneSource(o: MicrophoneSourceOptions): MicrophoneSource;

// audio/infrastructure/MediaElementSource.ts
export interface MediaElementSourceOptions {
  element: HTMLMediaElement;
  clock: Clock;
  logger: Logger;
  audioContextFactory?: () => AudioContext;
  kind?: "assistant" | "user"; /* default 'assistant' */
}
export function createMediaElementSource(o: MediaElementSourceOptions): AudioSource; // analyser → destination so playback continues; one MediaElementAudioSourceNode per element (WeakMap)

// audio/infrastructure/SyntheticSource.ts — no Web Audio, runs in Node
export interface SyntheticSourceOptions {
  clock: Clock;
  prng: Prng /* engine prng.fork('audio-synthetic') */;
  kind?: "assistant" | "user"; /* default 'assistant' */
}
export const SYNTHETIC = {
  syllablePeriodS: 0.22,
  jitterS: 0.06,
  decayS: 0.09,
  base: 0.15,
  peak: 0.55,
  tremoloHz: 1.7,
  sibilanceHz: 5.3,
} as const;
export function createSyntheticSource(o: SyntheticSourceOptions): AudioSource;
export function syntheticFeatures(seed: number, tS: number, out: AudioFeatures): AudioFeatures; // pure function of (seed, t)

// audio/infrastructure/AnalyserPump.ts
export interface AnalyserPump {
  attach(source: AudioSource): () => void; // one per kind; attaching a second of the same kind stops + replaces it; returns idempotent detach
  tick(nowMs: number): void; // called from the engine frame callback: sample each source, compute audioUniforms, setUniform × 3
  features(kind: "user" | "assistant"): Readonly<AudioFeatures> | null;
  dispose(): void; // stop() + detach all
}
export function createAnalyserPump(o: {
  renderer: Pick<RendererPort, "setUniform">;
  clock: Clock;
  logger: Logger;
}): AnalyserPump;
```

**Behavior.**

Permission state machine (`MicrophoneSource`):

| From         | Trigger                                                     | To                                               | Side effects                                                                                                                             |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| idle         | `start()` and `isMicrophoneSupported` fails                 | unsupported (`api_missing` / `insecure_context`) | log `orb.audio.permission_state`                                                                                                         |
| idle, denied | `start()`                                                   | requesting                                       | `getUserMedia(constraints)` called synchronously inside the gesture task; `AudioContext` created lazily and `resume()`d in the same task |
| requesting   | stream resolved                                             | granted                                          | `MediaStreamAudioSourceNode → AnalyserNode` (fftSize 1024, smoothing 0, no destination); `track.onended` armed                           |
| requesting   | `NotAllowedError`, `SecurityError`, `PermissionDeniedError` | denied (`not_allowed`)                           | log `orb.audio.permission_denied { reason }`; features stay 0                                                                            |
| requesting   | `NotFoundError`, `OverconstrainedError`, `NotReadableError` | unsupported (`no_device`)                        | same log, `reason: 'no_device'`                                                                                                          |
| requesting   | any other error                                             | denied (`unknown`)                               | log with `reason: 'unknown'` (error class name only, never the message)                                                                  |
| requesting   | `start()` again                                             | requesting                                       | no second `getUserMedia`; returns the pending promise                                                                                    |
| granted      | `stop()` / `dispose()`                                      | idle                                             | `track.stop()` ∀ tracks, nodes disconnected, context closed if this source created it                                                    |
| granted      | track `ended` (revoked, unplugged)                          | idle (`track_ended`)                             | log `orb.audio.permission_state`; features → 0 next tick                                                                                 |
| unsupported  | `start()`                                                   | unsupported                                      | no-op                                                                                                                                    |

- The engine never calls `start()`; `attachAudio(source)` only registers the source with the pump. The UI (§4.5) calls `start()` in a click/keydown handler, satisfying browser gesture requirements and ORB-AUDIO-001.
- `navigator.permissions.query({ name: 'microphone' })` is used opportunistically by the UI to pre-render "denied" without prompting; it is wrapped in try/catch and ignored where unsupported (Firefox).
- `MediaElementSource`: `createMediaElementSource(element)` reroutes the element's output, so the graph is `element → analyser → destination`; the node is cached per element for the page lifetime (the browser throws on a second call). `start()` only builds the graph and resumes the context; it never calls `element.play()`. If features stay exactly 0 for 1 s while `!element.paused && element.volume > 0`, log `orb.audio.silent_source { kind }` once (likely a cross-origin element without `crossOrigin="anonymous"` — the browser silently yields zeros; documented in `docs/how-to/assistant-audio.md`).
- `SyntheticSource` determinism: `t = (clock.now() − startedAtMs) / 1000`; `k = floor(t / 0.22)`; `onset_k = k · 0.22 + 0.06 · hash01(seed, k)`; `e = t ≥ onset_k ? exp(−(t − onset_k) / 0.09) : exp(−(t − onset_{k−1}) / 0.09)`; `amplitude = clamp(0.15 + 0.55 · e · (0.75 + 0.25 · sin(2π · 1.7 · t)), 0, 1)`; `low = 0.6 · amplitude`; `mid = amplitude`; `high = clamp(0.4 · amplitude · (0.5 + 0.5 · sin(2π · 5.3 · t)), 0, 1)`. `hash01` is an integer mix (xorshift-multiply on `seed ^ (k · 0x9E3779B9)`) implemented locally — no `Math.random`, no floating-point accumulation across calls, so the output is a pure function of `(seed, t)` and identical on every engine. `seed` is read once from `prng.fork('audio-synthetic').int(2 ** 31)` at construction. Before `start()` and after `stop()` `sample` writes zeros.
- `AnalyserPump.tick` runs inside the engine frame callback after the pointer step and before `renderer.render()`; it never awaits, never allocates per frame (scratch buffers per source), and clamps `dt` to `maxDtMs`.

**Edge cases.**

- `attachAudio` twice with the same instance → second call returns a detach that is a no-op for the first registration; no double sampling.
- Detach after `dispose()` → no throw.
- `MicrophoneSource.sample` called while `requesting` → zeros (no partial data).
- `AudioContext` construction throws (Safari private mode, resource limits) → status `unsupported (unknown)`, engine unaffected.
- Source `sample` throws (buggy custom source) → the pump catches, writes zeros for that kind, logs `orb.audio.source_failed { kind }` once per attach, and keeps the frame loop alive (ORB-RENDER-005).
- Clock goes backwards (fake clock reset) → `SyntheticSource` clamps `t` to 0.

**Acceptance criteria.**

- Given a fake `mediaDevices.getUserMedia` that resolves with a fake stream, When `start()` is awaited, Then status moves `idle → requesting → granted` and exactly one `getUserMedia` call was made with `echoCancellation: true`; Given it rejects with `NotAllowedError`, Then status is `denied/not_allowed`, `start()` resolved (did not reject), `sample` writes zeros; Given `mediaDevices` is undefined, Then status is `unsupported/api_missing` and `getUserMedia` was never referenced. — ORB-AUDIO-001, ORB-AUDIO-002 — `tests/unit/audio/MicrophoneSource.test.ts`
- Given a granted source, When `stop()` runs, Then every track's `stop()` was called, every node's `disconnect()` was called, and status is `idle`; When the track fires `ended`, Then status is `idle/track_ended`. — ORB-AUDIO-002 — `tests/unit/audio/MicrophoneSource.test.ts`
- Given `new OrbEngine(opts)` followed by `attachAudio(createMicrophoneSource(...))` with a spied `getUserMedia`, When 100 frames run, Then `getUserMedia` was called 0 times. — ORB-AUDIO-001 — `tests/unit/engine/audio-wiring.test.ts`
- Given seed 1 and instants `t = 0, 1/60, …, 119/60`, When `syntheticFeatures` runs, Then the output equals `tests/fixtures/audio/synthetic-seed-1.golden.json` exactly (`toEqual`, no tolerance), and seed 2 differs. — ORB-AUDIO-003 — `tests/unit/audio/SyntheticSource.test.ts`
- Given a pump with a user source at amplitude 0.3 and an assistant source at 0.7, When `tick` runs, Then `setUniform('uAudioUser', 0.3)`, `setUniform('uAudioAssistant', 0.7)` and `uAudioBands` = element-wise max; Given no source or after detach, Then all three are 0. — ORB-AUDIO-003, ORB-AUDIO-002 — `tests/unit/audio/AnalyserPump.test.ts`
- Given a fake `AudioContext`, When `createMediaElementSource` is called twice for the same element, Then `ctx.createMediaElementSource` was called once and the analyser is connected to `ctx.destination`. — ORB-AUDIO-003 — `tests/unit/audio/MediaElementSource.test.ts`
- Given any random sequence of `AudioFeatures` frames (fast-check, 200 runs) fed to the pump while a fixed governed event sequence drives `OrbController`, When snapshots are compared with a run without audio, Then every `OrbSnapshot` is deep-equal and the bus recorded no additional events. — ORB-AUDIO-004 — `tests/unit/audio/no-semantic-influence.property.test.ts`
- Given the dependency-cruiser API, When `audio/**` and `pointer/**` are analysed, Then neither imports `engine/state/**`, `engine/bus/**`, `events/**`, `adapters/**`, `react`, or `next`, and `getUserMedia` appears in exactly one source file. — ORB-AUDIO-004, ORB-POINTER-002, ORB-AUDIO-001 — `tests/unit/arch/pointer-audio-boundaries.test.ts`

**Observability.** `orb.audio.permission_state { from, to, reason }` (info), `orb.audio.permission_denied { reason }` (warn), `orb.audio.source_attached { kind, sourceType: 'microphone' | 'media' | 'synthetic' | 'custom' }`, `orb.audio.source_detached { kind, replaced }`, `orb.audio.silent_source { kind }` (warn, once), `orb.audio.source_failed { kind, errorName }` (error, once), `orb.audio.sample_rate_defaulted` (warn, once). Never: device labels, stream ids, feature values, error messages.

### 4.5 Engine wiring, demo and playground — bounded contexts `engine/`, `components/`, `app/`

**Objective.** Make `setPointerForce` and `attachAudio` real, expose the debug surface, give the demo a microphone toggle with honest privacy text and synthetic assistant speech while `speaking`, and give the playground full control of both layers without any path to governance.

**Contracts.**

```ts
// engine/OrbEngine.ts (signatures verbatim from SHARED_CONTRACTS; semantics fixed here)
setPointerForce(config: PointerForceConfig | null): void;   // validates (throws PointerConfigError), attaches/detaches PointerInput, logs orb.pointer.force_changed
attachAudio(source: AudioSource): () => void;               // pump.attach; never calls source.start()
// engine/index.ts — public re-exports added (api snapshot updated, additive only):
//   PointerForceConfig, PointerConfigError, DEFAULT_POINTER_FORCE, POINTER_LIMITS, AudioFeatures, AudioSource, AnalyserLike,
//   MicrophoneSource, MicrophoneStatus, MicrophonePermissionState, createMicrophoneSource, createMediaElementSource, createSyntheticSource, withGain, isMicrophoneSupported

// __orbDebug additions (debug builds / ?debug=1 only; read-only)
interface OrbDebugSmoke { /* … W0–W4 … */
  pointer: { enabled: boolean; active: boolean; ndc: [number, number]; world: [number, number]; velocity: [number, number]; envelope: number; maxDisplacement: number; mode: string | null; radius: number; strength: number; latency: LatencyReport };
  audio: { user: AudioFeatures | null; assistant: AudioFeatures | null; sources: { user: string | null; assistant: string | null }; microphone: MicrophonePermissionState | null };
  bus: { emitted: number };  // count of accepted events (spy for "no events were emitted" assertions)
}

// components/a11y/MicrophoneToggle.tsx
export function MicrophoneToggle(props: { source: MicrophoneSource; label?: string }): JSX.Element;
//   <button aria-pressed={granted} disabled={requesting || unsupported} onClick={granted ? stop : start}> + <p role="status"> + privacy line

// components/playground/PointerPanel.tsx, AudioPanel.tsx — read/write through components/store/orbStore.ts only
```

**Behavior.**

- Demo page `/`: `app/page.tsx` subscribes to `OrbController` snapshots (existing Wave 4 wiring); on entering `speaking` it calls `synthetic.start()`, on leaving it calls `synthetic.stop()`. The engine is unaware — the app decides when simulated speech plays, and the page already shows the "Simulated" badge (ORB-DEMO-002). A `MicrophoneToggle` sits in the accessible panel with the privacy line: "Audio is analysed locally in your browser to move particles. It is never recorded, stored or sent anywhere, and it never changes the agent state."
- Status text per state (all `role="status"`, no colour-only cues): idle "Microphone off"; requesting "Requesting microphone permission…"; granted "Microphone on — audio affects particles only"; denied "Microphone permission was denied. Enable it in your browser settings and try again." (button enabled for retry); unsupported "Microphone is not available in this browser or context." (button disabled). Denial is not an error state: no `error` OrbState, no `orb.error` log.
- Playground `/playground`: `PointerPanel` — enable toggle, mode select, radius slider (0.05–2, step 0.01), strength slider (0–2, step 0.01), readout of `__orbDebug.pointer` incl. latency p50/p95; `AudioPanel` — `MicrophoneToggle`, synthetic on/off + seed input (re-creates the source with `prng.fork` of the entered seed), gain slider (0–2) via `withGain`, readout of features per kind. Neither panel imports anything from `engine/state`, `adapters` or the approval components; both call only `engine.setPointerForce` / `engine.attachAudio` through the store.
- `?pointer=0` disables pointer input on `/` and `/playground` (for E2E baselines); `?audio=synthetic` on `/playground` attaches the synthetic source at load (never the microphone).
- Reduced motion (`reducedMotion: 'on'` or media query): both layers keep sampling but `uMotionScale = 0` zeroes every displacement; the panels show "(reduced motion: displacement disabled)".

**Edge cases.**

- `attachAudio` before the renderer is ready (headless fallback) → the pump still samples and stores features (`__orbDebug.audio` populated) and `setUniform` is a no-op on `NullRenderer`.
- Two `MicrophoneToggle` instances for one source → both reflect the same status via `subscribe`.
- `speaking` entered twice quickly (ASSISTANT_SPEAKING → STOPPED → SPEAKING) → `start()`/`stop()` are idempotent; the synthetic clock restarts on each `start()`.
- Playground seed change while synthetic is running → stop, re-create, start; features restart from `t = 0`.

**Acceptance criteria.**

- Given `/` with `chromium-fake-mic` (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-audio-capture=tests/fixtures/audio/tone-440.wav`, `context.grantPermissions(['microphone'])`), When "Enable microphone" is clicked, Then status reads "Microphone on…", `__orbDebug.uniforms.uAudioUser > 0.05` within 2 s, and `__orbDebug.snapshot.state` remains `idle` for 3 s of loud tone. — ORB-AUDIO-001, ORB-AUDIO-004, ORB-AUDIO-005 — `tests/e2e/audio.fake-device.spec.ts`
- Given `/` in the default project (no permission granted; `getUserMedia` wrapped by an init script counter), When the page loads and 60 frames pass, Then the counter is 0; When "Enable microphone" is clicked, Then the counter is 1, status reads the denied text, `__orbDebug.frames` keeps increasing, `uAudioUser === 0`, and the state is unchanged. — ORB-AUDIO-001, ORB-AUDIO-002 — `tests/e2e/audio.denied.spec.ts`
- Given an init script that deletes `navigator.mediaDevices`, When `/` loads, Then the toggle is disabled with the unsupported text and the orb renders (`frames > 0`). — ORB-AUDIO-002 — `tests/e2e/audio.unsupported.spec.ts`
- Given `/?sequencer=manual&seed=1&debug=1`, When the sequencer is stepped to `speaking`, Then `__orbDebug.audio.assistant.amplitude > 0` and `uAudioAssistant > 0` within 500 ms while `uAudioUser === 0`; When stepped to `idle`, Then `uAudioAssistant < 0.01` within 1 s. — ORB-AUDIO-003, ORB-AUDIO-002 — `tests/e2e/audio.demo-speaking.spec.ts`
- Given `/`, When axe runs and the toggle is operated by keyboard (Tab, Enter), Then 0 violations and the status text updates. — ORB-AUDIO-001 (touches ORB-A11Y-002) — `tests/e2e/audio.a11y.spec.ts`
- Given `/playground`, When mode/radius/strength are changed, Then `__orbDebug.pointer` reflects them and `__orbDebug.bus.emitted` is unchanged; When the audio gain is set to 0 with synthetic on, Then `uAudioAssistant === 0`. — ORB-POINTER-004, ORB-POINTER-002, ORB-AUDIO-005 — `tests/e2e/playground.pointer-audio.spec.ts`

**Observability.** Reuses §4.2 and §4.4 events; the demo logs `orb.demo.synthetic_audio { started: boolean }` (info) on start/stop.

## 5. Parallel tracks

| Track       | Slices    | Owner profile                                                       | Meets at                                                             |
| ----------- | --------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| P — pointer | 4.1 → 4.2 | one contributor comfortable with DOM events + GLSL                  | 4.5 (`setPointerForce`, `PointerPanel`, `__orbDebug.pointer`)        |
| A — audio   | 4.3 → 4.4 | one contributor comfortable with Web Audio + Playwright media flags | 4.5 (`attachAudio`, `AudioPanel`, `MicrophoneToggle`, demo speaking) |

Both tracks touch `shaders/chunks/displacement.glsl` and `engine/OrbEngine.ts`'s frame callback; the integration rule is fixed here to avoid merge conflicts: frame order is pointer step → pump tick → render → latency record, and the shader chunk exposes two independent functions called in that order. Each track has its own sub-gate (G5-P, G5-A in §10) so one can merge before the other; G5 closes when both are green and the 4.5 E2E suite passes on the merged tree.

## 6. Threat model delta (STRIDE)

Only surfaces introduced or changed by this wave. Mitigations land in this wave; full write-up in `docs/security/threats/audio.md` (pointer rows appended to `docs/security/threats/demo-and-playground.md`).

| Surface                                                | S   | T   | R   | I   | D   | E   | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Req IDs                                     |
| ------------------------------------------------------ | --- | --- | --- | --- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Pointer DOM input (mouse/touch/pen on the canvas host) | –   | ✓   | –   | –   | ✓   | ✓   | Input can only reach `uPointer*` uniforms (dependency-cruiser: `pointer/**` ↛ `engine/state`, `events`); one sample per frame, reused sample object (event storms cost O(1)); coordinates never logged; no path to `emit`/`respondToApproval` (integration + E2E assert snapshot identity and `bus.emitted` unchanged)                                                                                                                                                                                                                                                                                                                                                           | ORB-POINTER-002, ORB-PERF-004, ORB-SEC-003  |
| Microphone capture (`getUserMedia`, `AudioContext`)    | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | S: request only inside a user-gesture handler, never on load/construct/attach (unit spy + E2E counter). T: audio cannot flip state (no VAD, property test, arch rule). R: permission transitions logged with reason category, no PII. I: graph is `stream → analyser` only — no destination, no `MediaRecorder`, no `fetch`/`WebSocket` in `audio/**` (arch rule); privacy text in UI; `track.stop()` on disable/unmount/dispose. D: `AudioContext` created once and closed on stop; pump never awaits. E: `Permissions-Policy: microphone=(self)` from W0 keeps third-party iframes from inheriting capture; embedding hosts must opt in with `allow="microphone"` (documented) | ORB-AUDIO-001, ORB-AUDIO-002, ORB-AUDIO-004 |
| Assistant audio via `HTMLMediaElement`                 | –   | ✓   | –   | ✓   | –   | –   | Same tamper mitigation as above; cross-origin media without CORS yields zeros (functional, not a leak) and is detected/logged once; the engine never calls `play()` (no autoplay escalation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ORB-AUDIO-003, ORB-AUDIO-004                |
| `SyntheticSource` in the public demo                   | ✓   | –   | –   | –   | –   | –   | Only ever attached as `assistant`; the page already carries the "Simulated" badge; the source cannot emit events                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ORB-AUDIO-003, ORB-DEMO-002                 |
| Playground `PointerPanel` / `AudioPanel`               | –   | –   | –   | –   | ✓   | ✓   | Sliders clamp to `POINTER_LIMITS` and gain ≤ 2 (no 1e9 strength); panels import only the store; `ORB-PLAY-002` E2E extended with these controls (no path to approval)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ORB-POINTER-004, ORB-PLAY-002               |
| `__orbDebug.pointer` / `.audio`                        | –   | –   | –   | ✓   | –   | –   | Debug builds / `?debug=1` only (W0 rule); exposes smoothed 0–1 features and latency percentiles, never raw audio bytes or device info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ORB-AUDIO-002                               |

## 7. Tests

Titles start with `${req('ORB-…')}` (`tests/support/req.ts`); Playwright specs carry `tag: tags('ORB-…')`. Fake `Clock`/`Scheduler`/`Prng` from `tests/support/fakes/`; new fakes added this wave: `fakeAnalyser.ts` (`AnalyserLike` writing given byte arrays), `fakeMediaDevices.ts` (resolve/reject scripted `getUserMedia`, fake tracks with `stop()`/`ended`), `fakeAudioContext.ts` (records `createMediaElementSource`, `connect`, `disconnect`, `close`). fast-check `numRuns` 200 in CI, 50 locally, seed printed.

| Test (name references requirement IDs)                                                                                                                                               | Type                              | Req IDs                                           | File                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `${req('ORB-POINTER-004')} validatePointerForceConfig accepts repel/attract/wave and rejects NaN, negative and out-of-range values with typed codes`                                 | unit                              | ORB-POINTER-004                                   | `tests/unit/pointer/PointerForceConfig.test.ts`                      |
| `${req('ORB-POINTER-004')} clientToNdc maps rect corners to ±1 and is DPR-invariant; ndcToPointerPlane uses distance/fov/aspect`                                                     | unit                              | ORB-POINTER-004                                   | `tests/unit/pointer/ndc.test.ts`                                     |
| `${req('ORB-POINTER-001')} stepSpring settles below 0.01 within 2 s from any state and never goes negative (property)`                                                               | unit                              | ORB-POINTER-001                                   | `tests/unit/pointer/spring.property.test.ts`                         |
| `${req('ORB-POINTER-001','ORB-POINTER-004')} pointerDisplacement is bounded by envelope·motionScale, zero outside radius, repel/attract monotonic, attract never crosses (property)` | unit                              | ORB-POINTER-001, ORB-POINTER-004                  | `tests/unit/pointer/displacement.property.test.ts`                   |
| `${req('ORB-POINTER-001')} displacement is exactly 0 with motionScale 0 and with strength 0; centre singularity uses seedDir`                                                        | unit                              | ORB-POINTER-001                                   | `tests/unit/pointer/displacement.test.ts`                            |
| `${req('ORB-POINTER-001')} GLSL pointerDisplacement matches the TS twin at 256 seeded points (max Δ < 1e-4)`                                                                         | unit                              | ORB-POINTER-001                                   | `tests/unit/shaders/pointer.parity.test.ts`                          |
| `${req('ORB-POINTER-003','ORB-PERF-004')} PointerInput coalesces N events per frame into one sample and registers passive listeners`                                                 | unit                              | ORB-POINTER-003, ORB-PERF-004                     | `tests/unit/pointer/PointerInput.test.ts`                            |
| `${req('ORB-POINTER-003')} touch: only isPrimary is tracked; pointerup/pointercancel/pointerleave/blur deactivate; touchAction applied and restored`                                 | unit                              | ORB-POINTER-003                                   | `tests/unit/pointer/PointerInput.test.ts`                            |
| `${req('ORB-POINTER-002')} detach removes every listener and is idempotent`                                                                                                          | unit                              | ORB-POINTER-002                                   | `tests/unit/pointer/PointerInput.test.ts`                            |
| `${req('ORB-PERF-004')} latencyProbe reports p50/p95/max over a 256-sample ring`                                                                                                     | unit                              | ORB-PERF-004                                      | `tests/unit/pointer/latencyProbe.test.ts`                            |
| `${req('ORB-POINTER-001','ORB-POINTER-002')} OrbEngine frame writes uPointer* from the sample and the snapshot stays identity-equal`                                                 | integration                       | ORB-POINTER-001, ORB-POINTER-002                  | `tests/integration/engine/pointer.test.ts`                           |
| `${req('ORB-POINTER-004')} setPointerForce(null) detaches input and the envelope decays without snapping; invalid config throws and keeps the previous one`                          | integration                       | ORB-POINTER-004, ORB-POINTER-001                  | `tests/integration/engine/pointer.test.ts`                           |
| `${req('ORB-AUDIO-002')} extractRaw+smoothFeatures give exact zeros for silence and 1 for full scale`                                                                                | unit                              | ORB-AUDIO-002                                     | `tests/unit/audio/extractFeatures.test.ts`                           |
| `${req('ORB-AUDIO-005')} band bin ranges follow sampleRate (44.1 k / 48 k) and isolate low/mid/high`                                                                                 | unit                              | ORB-AUDIO-005                                     | `tests/unit/audio/bands.test.ts`                                     |
| `${req('ORB-AUDIO-005')} smoothing follows attack/release constants, clamps dt and is deterministic`                                                                                 | unit                              | ORB-AUDIO-005                                     | `tests/unit/audio/smoothing.test.ts`                                 |
| `${req('ORB-AUDIO-003')} audioUniforms separates user/assistant amplitude and takes element-wise max bands`                                                                          | unit                              | ORB-AUDIO-003                                     | `tests/unit/audio/audioUniforms.test.ts`                             |
| `${req('ORB-AUDIO-005','ORB-AUDIO-002')} GLSL audioDisplacement matches the TS twin and is 0 for zero uniforms`                                                                      | unit                              | ORB-AUDIO-005, ORB-AUDIO-002                      | `tests/unit/shaders/audio.parity.test.ts`                            |
| `${req('ORB-AUDIO-003')} SyntheticSource output equals the seed-1 golden at 120 instants and differs for seed 2`                                                                     | unit                              | ORB-AUDIO-003                                     | `tests/unit/audio/SyntheticSource.test.ts`                           |
| `${req('ORB-AUDIO-001','ORB-AUDIO-002')} MicrophoneSource state machine: idle→requesting→granted/denied/unsupported; start never rejects; sample is zero unless granted`             | unit                              | ORB-AUDIO-001, ORB-AUDIO-002                      | `tests/unit/audio/MicrophoneSource.test.ts`                          |
| `${req('ORB-AUDIO-002')} MicrophoneSource.stop releases tracks/nodes; track ended returns to idle`                                                                                   | unit                              | ORB-AUDIO-002                                     | `tests/unit/audio/MicrophoneSource.test.ts`                          |
| `${req('ORB-AUDIO-003')} MediaElementSource keeps playback via destination and caches one node per element`                                                                          | unit                              | ORB-AUDIO-003                                     | `tests/unit/audio/MediaElementSource.test.ts`                        |
| `${req('ORB-AUDIO-003','ORB-AUDIO-002')} AnalyserPump writes uniforms per kind, zeros when empty/detached, survives a throwing source`                                               | unit                              | ORB-AUDIO-003, ORB-AUDIO-002                      | `tests/unit/audio/AnalyserPump.test.ts`                              |
| `${req('ORB-AUDIO-001')} OrbEngine constructor and attachAudio never call getUserMedia`                                                                                              | unit                              | ORB-AUDIO-001                                     | `tests/unit/engine/audio-wiring.test.ts`                             |
| `${req('ORB-AUDIO-004')} random audio frames never change OrbSnapshot nor emit events (property)`                                                                                    | unit                              | ORB-AUDIO-004                                     | `tests/unit/audio/no-semantic-influence.property.test.ts`            |
| `${req('ORB-AUDIO-004','ORB-POINTER-002','ORB-AUDIO-001')} architecture: pointer/** and audio/** boundaries; getUserMedia in exactly one file`                                       | arch                              | ORB-AUDIO-004, ORB-POINTER-002, ORB-AUDIO-001     | `tests/unit/arch/pointer-audio-boundaries.test.ts`                   |
| `${req('ORB-AUDIO-003','ORB-AUDIO-002')} attachAudio replaces a same-kind source, detach is idempotent, dispose stops all`                                                           | integration                       | ORB-AUDIO-003, ORB-AUDIO-002                      | `tests/integration/engine/audio.test.ts`                             |
| pointer moves displace, leaving returns < 0.01 in 2 s, snapshot and bus unchanged                                                                                                    | e2e                               | ORB-POINTER-001, ORB-POINTER-002, ORB-POINTER-004 | `tests/e2e/pointer.spec.ts`                                          |
| touch emulation (Pixel 7) displaces while down and returns after pointerup                                                                                                           | e2e                               | ORB-POINTER-003                                   | `tests/e2e/pointer.touch.spec.ts`                                    |
| input→uniform latency p95 ≤ 50 ms over 200 moves at ci preset                                                                                                                        | e2e (perf, blocking)              | ORB-PERF-004                                      | `tests/e2e/pointer.latency.spec.ts`                                  |
| reduced motion: pointer active but displacement 0, status text present                                                                                                               | e2e                               | ORB-POINTER-001                                   | `tests/e2e/pointer.reduced-motion.spec.ts`                           |
| fake microphone raises uAudioUser and never changes state                                                                                                                            | e2e (`chromium-fake-mic` project) | ORB-AUDIO-001, ORB-AUDIO-004, ORB-AUDIO-005       | `tests/e2e/audio.fake-device.spec.ts`                                |
| no getUserMedia on load; denied path keeps engine running                                                                                                                            | e2e                               | ORB-AUDIO-001, ORB-AUDIO-002                      | `tests/e2e/audio.denied.spec.ts`                                     |
| mediaDevices missing → unsupported text, orb renders                                                                                                                                 | e2e                               | ORB-AUDIO-002                                     | `tests/e2e/audio.unsupported.spec.ts`                                |
| demo speaking drives uAudioAssistant via SyntheticSource, user stays 0                                                                                                               | e2e                               | ORB-AUDIO-003, ORB-AUDIO-002                      | `tests/e2e/audio.demo-speaking.spec.ts`                              |
| microphone toggle: axe clean, keyboard operable, status updates                                                                                                                      | e2e                               | ORB-AUDIO-001                                     | `tests/e2e/audio.a11y.spec.ts`                                       |
| playground pointer/audio panels change uniforms only                                                                                                                                 | e2e                               | ORB-POINTER-004, ORB-POINTER-002, ORB-AUDIO-005   | `tests/e2e/playground.pointer-audio.spec.ts`                         |
| real-device pointer latency + microphone matrix (Chrome/Safari/Firefox, iOS)                                                                                                         | manual (W8 evidence)              | ORB-PERF-004, ORB-AUDIO-001                       | `docs/reference/perf-matrix.md`, `specs/requirements.overrides.yaml` |

CI: all unit/integration/arch tests in the `unit` stage; E2E in the `e2e` stage on `chromium-swiftshader` (`?preset=ci&adaptive=0&seed=1`) plus the new `chromium-fake-mic` project (same flags + fake media args, `grantPermissions(['microphone'])`); the latency spec is blocking at p95 ≤ 50 ms and additionally writes `pointerLatencyMs` into the perf artifact. Fixtures: `tests/fixtures/audio/tone-440.wav` (2 s, 48 kHz mono, −6 dBFS, committed; regenerable with `scripts/gen-audio-fixture.ts`), `tests/fixtures/audio/silence.wav`, `tests/fixtures/audio/synthetic-seed-1.golden.json`, `tests/fixtures/audio/frames/{silence,fullscale,low,mid,high}.json`.

## 8. ADRs to record

- ADR-0012 — Audio sources and permission UX: context — SPEC §18 names microphone and assistant audio but not how they are attached, when permission is requested, or how the demo/CI get audio; options — (a) engine-owned `enableMicrophone()` that requests permission itself, (b) `AudioSource` port with `MicrophoneSource` / `MediaElementSource` / `SyntheticSource` implementations, permission requested only by UI gesture handlers, HTML status state machine idle/requesting/granted/denied/unsupported, (c) adapter-supplied audio only; recommendation — (b): keeps ORB-AUDIO-001 enforceable by a static rule, makes CI deterministic via the synthetic source, and leaves room for a Realtime-API source in Wave 7 without engine changes. Also records the GPU effect list of ORB-AUDIO-005 and the "denial is not an error" rule.
- No standalone pointer ADR: the stateless GPU displacement with a CPU spring envelope is a direct consequence of ADR-0009 (accepted in Wave 3: displacement is a stateless function of base position, time and uniforms). The choice of instant attack + critically damped release and the z = 0 pointer plane are recorded as a decision note in `docs/explanation/pointer.md`; if reviewers want a numbered ADR it takes the next free number after Wave 7's ADR-0014 (see §11).

## 9. Deliverables

- `pointer/domain/{PointerForceConfig.ts, ndc.ts, pointerState.ts, spring.ts, displacement.ts}`, `pointer/infrastructure/{PointerInput.ts, latencyProbe.ts}`, `pointer/index.ts`.
- `audio/domain/{AudioFeatures.ts, extractFeatures.ts, smoothing.ts, gain.ts, audioUniforms.ts}`, `audio/infrastructure/{permissionState.ts, MicrophoneSource.ts, MediaElementSource.ts, SyntheticSource.ts, AnalyserPump.ts}`, `audio/index.ts`.
- `shaders/chunks/displacement.glsl` (+ `pointerDisplacement`, `audioDisplacement`, `audioBrightness`), `shaders/particle.vert.glsl`, `shaders/particle.frag.glsl` (wiring), `engine/render/uniforms.ts` (defaults), `engine/ports/RendererPort.ts` (`camera`), `engine/render/ParticleSystem.impl.ts` (reports `camera`), `engine/OrbEngine.ts` (frame order, `setPointerForce`, `attachAudio`, `__orbDebug.pointer/.audio/.bus`), `engine/index.ts` (re-exports), `tests/e2e/api-surface.snapshot` updated (additive).
- `components/a11y/MicrophoneToggle.tsx`, `components/playground/{PointerPanel,AudioPanel}.tsx`, `components/store/orbStore.ts` (pointer/audio fields), `app/page.tsx` (toggle, privacy line, speaking → synthetic), `app/playground/page.tsx` (panels, `?audio=synthetic`, `?pointer=0`).
- Tests and fixtures listed in §7, plus `tests/support/fakes/{fakeAnalyser,fakeMediaDevices,fakeAudioContext}.ts`, `playwright.config.ts` project `chromium-fake-mic`, `scripts/gen-audio-fixture.ts`.
- `.dependency-cruiser.cjs` rules for `pointer/**` and `audio/**`; `.eslintrc` `no-restricted-properties` for `mediaDevices.getUserMedia` outside `audio/infrastructure/MicrophoneSource.ts` and `no-restricted-globals` (`fetch`, `WebSocket`, `MediaRecorder`) inside `audio/**`.
- Docs: `docs/adr/0012-audio-sources-and-permission-ux.md`, `docs/security/threats/audio.md`, `docs/explanation/pointer.md` (NDC math, spring, why stateless), `docs/reference/audio.md` (constants, bands, permission states, log events), `docs/reference/pointer.md` (config, limits, debug fields), `docs/how-to/assistant-audio.md` (media element + CORS), `docs/how-to/embed-with-microphone.md` (`allow="microphone"`, HTTPS, iOS gesture), `docs/reference/perf-matrix.md` template rows for pointer latency and microphone.
- `specs/TRACEABILITY.md` rows for the 10 owned IDs; `specs/requirement-ids.lock` unchanged.

## 10. Exit criteria (Gate G5)

G5 closes only when every item in both sub-gates and the common list is green in CI on the merged tree.

**G5-P (pointer)**

1. `tests/unit/pointer/**` and `tests/unit/shaders/pointer.parity.test.ts` green; the spring and displacement property tests pass 200 runs with the printed seed reproducible.
2. `tests/integration/engine/pointer.test.ts` green: uniforms written from a sample, snapshot identity-equal, `setPointerForce(null)` decays to < 0.01 within 2 s of fake-clock frames.
3. `tests/e2e/pointer.spec.ts` green under SwiftShader: `maxDisplacement > 0` on move, `< 0.01` within 2 s after leaving, `snapshot.updatedAt` and `bus.emitted` unchanged.
4. `tests/e2e/pointer.touch.spec.ts` green with Pixel 7 emulation.
5. `tests/e2e/pointer.latency.spec.ts` green: ≥ 150 samples, latency samples recorded at the `ci` preset; the ≤ 50 ms hardware target is verified on a real reference device; `pointerLatencyMs` present in the perf artifact.
6. `tests/e2e/pointer.reduced-motion.spec.ts` green (`maxDisplacement === 0` under `prefers-reduced-motion: reduce`).
7. dependency-cruiser: `pointer/**` imports only `core/**` and its own context; no `engine/state`, `events`, `react`.

**G5-A (audio)**

1. `tests/unit/audio/**`, `tests/unit/shaders/audio.parity.test.ts`, `tests/unit/engine/audio-wiring.test.ts` green; the synthetic golden compares with `toEqual` (no tolerance).
2. `tests/unit/audio/no-semantic-influence.property.test.ts` green over 200 runs.
3. `tests/unit/arch/pointer-audio-boundaries.test.ts` green: `getUserMedia` referenced in exactly `audio/infrastructure/MicrophoneSource.ts`; no `fetch`/`WebSocket`/`MediaRecorder` in `audio/**`.
4. `tests/e2e/audio.fake-device.spec.ts` green on the `chromium-fake-mic` project: `uAudioUser > 0.05` within 2 s, state stays `idle`.
5. `tests/e2e/audio.denied.spec.ts` and `audio.unsupported.spec.ts` green: 0 `getUserMedia` calls before the click, denied/unsupported text, `frames` advancing, uniforms 0.
6. `tests/e2e/audio.demo-speaking.spec.ts` green: `uAudioAssistant > 0` only while `speaking`, `uAudioUser === 0`.
7. `tests/e2e/audio.a11y.spec.ts` green (axe 0 violations, keyboard operable).
8. `docs/security/threats/audio.md` merged; ADR-0012 status `accepted`.

**Common** 9. `tests/e2e/playground.pointer-audio.spec.ts` green; the Wave 4 `ORB-PLAY-002` E2E still green with the new panels present. 10. API surface snapshot diff contains only the additive re-exports listed in §4.5 (reviewed against ADR-0011: minor bump). 11. `pnpm req:coverage` shows all 10 owned IDs covered by ≥ 1 test; `specs/TRACEABILITY.md` rows updated to `W5`. 12. The Wave 2 perf project shows no FPS regression > 5 % at `desktop-default` with pointer active and synthetic audio on (uniform-only cost). 13. Lighthouse a11y ≥ 95 on `/` with the microphone toggle present (Wave 4 threshold maintained).

## 11. Risks, spikes and open questions

- Risk: SwiftShader frame time makes the 50 ms p95 flaky in CI → mitigation: `ci` preset (2 000 particles, no connections/post), 200-sample window, probe measures CPU input→uniform (not GPU present); spike S5-1 (½ day) runs the latency spec 20× on CI before making it blocking; if p95 is bimodal the gate falls back to p50 ≤ 50 ms with p95 reported, recorded as a documented deviation (SPEC §28 rule 7) → decision owner: maintainer, in the Wave 5 PR.
- Risk: `touch-action: none` on the canvas blocks page scroll on mobile demo → mitigation: the demo canvas is full-viewport (no scroll expected); hosts choose `touchAction: 'inherit'`; Wave 8 mobile checklist verifies → owner: ADR note in `docs/explanation/pointer.md`.
- Risk: iOS Safari keeps `AudioContext` suspended unless created in the gesture task; `await` before construction breaks it → mitigation: `MicrophoneSource.start()` constructs and resumes the context synchronously before the first `await`; manual verification row in W8 → owner: W8.
- Risk: Playwright fake-mic flags differ across Chromium versions (`%noloop`, file path quoting) → spike S5-2 (½ day) pins the working invocation in `playwright.config.ts` with a comment and a CI smoke that asserts `uAudioUser > 0.05`.
- Risk: `createMediaElementSource` on a cross-origin element yields silent zeros, misread as a bug → mitigation: `orb.audio.silent_source` warn + how-to; not a gate item.
- Risk: golden-JSON synthetic test breaks on any constant tweak → accepted: constants are normative for CI determinism; changing them regenerates the golden in the same PR (documented in `docs/reference/audio.md`).
- Planning assignment: ORB-A11Y-007 belongs to W4; pointer/audio regression tests are added here.
- Open question OQ5-2: should the stateless-displacement + spring envelope decision get its own ADR number (next free after ADR-0014) or stay a note under ADR-0009? → decision owner: maintainer at PR review.
- Open question OQ5-3: `RendererPort.camera` is an additive port field; confirm Wave 2's `ParticleSystem.impl.ts` fixed camera (`distance`, `fov`) values so `NullRenderer` defaults match → decision owner: Wave 2 author, before 4.2 starts.
- Open question OQ5-4: U-2 chose the Responses API (no assistant voice) — the demo therefore uses `SyntheticSource` for `speaking`; if U-2 flips to Realtime, Wave 7 must supply a `MediaStream`-based assistant source (a fourth `AudioSource` implementation, no engine change) → decision owner: user (U-2).
- Open question OQ5-5: multi-touch as multiple force centres is deferred; if wanted for V1 it needs `uPointerPos` to become an array uniform (SHARED `UniformName` change) → decision owner: spec amendment.

## 12. Playground and demo controls introduced

- Demo `/`: "Enable microphone" / "Disable microphone" toggle (`aria-pressed`, `role="status"` text for idle/requesting/granted/denied/unsupported) with the privacy statement; synthetic assistant speech automatically while the orb is `speaking` (labelled by the existing "Simulated" badge); pointer forces enabled by default (`repel`, radius 0.35, strength 0.25); `?pointer=0` disables them.
- Playground `/playground`: **PointerPanel** — enable toggle, mode (`repel` / `attract` / `wave`), radius 0.05–2, strength 0–2, live readout (active, NDC, world, envelope, maxDisplacement, latency p50/p95); **AudioPanel** — microphone toggle with permission status, synthetic on/off with seed input, gain 0–2, per-kind feature readout (amplitude/low/mid/high), reduced-motion notice; `?audio=synthetic` attaches the synthetic source at load.
- `__orbDebug.pointer`, `__orbDebug.audio`, `__orbDebug.bus.emitted` (debug builds / `?debug=1`).
