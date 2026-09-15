# Wave 4 — Integrated orb demo and public engine API

| Field                     | Value                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                | proposed                                                                                                                                                                                                                                                                                                                                                             |
| **Milestones (SPEC §27)** | V0.6 Governed tool lifecycle demo (integrates V0.1–V0.5 into the `/` page and closes the §22 public API)                                                                                                                                                                                                                                                             |
| **Depends on**            | Wave 1 (`OrbController`, `EventBus`, `transition`, visual policy, `MockAdapter` + scripts, `components/a11y/*`, `components/store/orbStore.ts`), Wave 3 (`FormationManager`, `MorphController`, all built-in formations), Wave 2 via Wave 3 (`ParticleSystem` as `RendererPort`, `QualityController`, `capabilities.ts`, `OrbCanvas`/`useOrbEngine`, `uMotionScale`) |
| **Spec version**          | SPEC.md 0.2.0 (0.1.0 + amendments; decisions A-02, A-03, A-04, A-06, A-09, A-11, A-12, A-13, A-15 apply — see `specs/SPEC-amendments-proposal.md`)                                                                                                                                                                                                                   |
| **Gate**                  | G4 — the credential-free demo at `/` runs the governed lifecycle on the real renderer through the accessible UI under SwiftShader in CI, the §22 API surface is frozen by a committed snapshot, and morph completion, settle timers and reduced motion cannot change the semantic snapshot; manual state changes only the public display projection                  |
| **Estimated size**        | M — wiring of already-tested contexts, one facade, two pages, three playground panels, seven E2E specs and a Lighthouse job; no new algorithms                                                                                                                                                                                                                       |

## 1. Objective

Before this wave the semantic runtime (Wave 1) drives a `NullRenderer` and the particle renderer (Waves 2–3) is driven only by playground knobs. At the end of this wave `OrbController` drives `ParticleSystem` through the visual policy: every accepted event changes the accessible text first and the formation/uniforms second, `success`/`error` settle back to the idle formation on a cosmetic Scheduler timer that provably never touches the snapshot, and reduced motion makes every formation change instantaneous while the text keeps announcing every state. `new OrbEngine({ container })` exposes the complete §22 API from `engine/index.ts` only, with typed errors, manual provenance for `setState`, single-adapter attachment, a UI → application approval-decision channel and a committed export-surface snapshot (ADR-0011). A stakeholder opens `/` from a fresh clone with no `.env`, presses "Run AI Sequence", sees `idle → listening → thinking → tool_call → waiting_approval`, approves with the keyboard, sees `executing → success → speaking → idle` with a persistent "Simulated" badge, and can repeat the run with approval disabled, denied, or failing — on a phone at `mobile-default`, with WebGL disabled, or with `prefers-reduced-motion: reduce`.

## 2. Scope

### 2.1 In scope

- `engine/OrbController.ts` wired to the real `RendererPort` (`ParticleSystem`) and `FormationManager`; `engine/visual-policy/apply.ts`; per-state `morphDurationMs`; cosmetic settle timer (ORB-STATE-008, A-03); host `morphTo` override; runtime motion preference port.
- `engine/OrbEngine.ts` complete per SHARED_CONTRACTS + `static SPEC_VERSION`; `OrbEngineError` typed errors; `engine/index.ts` frozen (runtime + declaration snapshots); `docs/reference/engine-api.md`.
- Demo page `/` (`app/page.tsx`): `OrbCanvas` + a11y panel + "Run AI Sequence" + "Require approval" switch + scenario select + persistent Simulated badge + capability fallback + preset readout; query-parameter contract (`?seed`, `?preset`, `?adaptive`, `?sequencer`, `?debug`, `?reducedMotion`, `?scenario`, `?approval`); mobile heuristic → `mobile-default`.
- Playground `/playground`: `StatePanel` (manual provenance), `MockEventsPanel` (raw simulated events), `ToolVisualPanel` (tool → formation registry editor), wired to the same engine + mock adapter.
- Reduced motion integrated end-to-end (A-15 / ORB-A11Y-007 mechanics, ORB-A11Y-004 proof).
- E2E suite: `demo-governance`, `demo.no-credentials`, `a11y`, `reduced-motion`, `public-api`, `mobile-preset`, `no-webgl`; Lighthouse accessibility job; `tests/e2e/fixtures/demo.ts` fixture.
- ADR-0011 (public API stability policy). STRIDE delta for the host-API, demo, query-param, playground and decision-channel surfaces; `docs/security/threats/demo-and-public-api.md`.

### 2.2 Out of scope (deferred)

- Pointer forces and audio uniforms behind `setPointerForce` / `attachAudio` → Wave 5 (signatures frozen here; bodies store config and are inert, documented `@remarks`).
- `registerFormation` with `{ svg }` / `{ url }` sources, Worker parsing, `FormationError` codes for uploads → Wave 6 (Wave 4 accepts `Float32Array` and generator sources only, ORB-API-002 owned by Wave 6).
- Real adapter selection (`?adapter=openai`, `ORB_ADAPTER` env), gateway routes, "Connected: OpenAI (live)" indicator → Wave 7 (`?adapter` is reserved and ignored with a notice in this wave).
- Real-device performance matrix, cross-browser smoke, complete §21 control list (ORB-PLAY-001), Diátaxis docs beyond the API reference → Wave 8.
- Multi-operation visualisation (pending queue as a visual), richer governance visuals → post-V1 (§27 candidates).

## 3. Requirements owned by this wave

Every ID listed here is owned by this wave and must be fully satisfied and verified before the gate closes. These are planned obligations; no test evidence is implied. Shared declaration owners and integration rules are in `specs/SHARED-CONTRACTS.md`.

| ID           | Level    | Summary                                                                                                                                                                                                                                                                                                                                       | Slice    | Verification                                    |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------- |
| ORB-ARCH-004 | MUST NOT | Rendering MUST NOT be authoritative evidence of backend execution (morph completion, settle, uniforms, manual state never change semantic state)                                                                                                                                                                                              | 4.1, 4.2 | integration (property) + e2e                    |
| ORB-DEMO-001 | MUST     | Credential-free demo MUST exist; a fresh clone runs without provider credentials                                                                                                                                                                                                                                                              | 4.3, 4.6 | e2e (scrubbed env, cross-origin blocked)        |
| ORB-DEMO-003 | SHOULD   | Demo SHOULD expose `Run AI Sequence`                                                                                                                                                                                                                                                                                                          | 4.3      | e2e                                             |
| ORB-DEMO-006 | MUST     | Demo runs `idle → listening → thinking → tool_call → waiting_approval → executing → success → speaking → idle` through the mock adapter with approval required by default; disabling approval is an explicit labelled toggle whose auto-approval events still carry `source: 'mock'`; denied and failed variants reachable from the same page | 4.3, 4.6 | integration + e2e                               |
| ORB-API-001  | MUST     | `OrbEngine` public API (§22) exposed from `engine/index.ts` only; constructor never throws on missing WebGL (headless); surface changes bump the spec version and the API snapshot                                                                                                                                                            | 4.2      | unit (snapshots) + arch + e2e                   |
| ORB-API-004  | MUST     | `setState(state)` is manual provenance: sets state + `provenance = 'manual'`, records anomaly `manual_override`, never opens/advances/closes an operation, never writes `lastOutcome`, never triggers policy; a11y appends "(manual)"                                                                                                         | 4.2, 4.4 | unit + e2e                                      |
| ORB-PLAY-002 | MUST NOT | Playground controls MUST NOT bypass production governance: manual state via `setState`, raw events forced to `source: 'mock'`, no `source: 'adapter'` emission, approvals only through the same Approve/Deny channel                                                                                                                          | 4.4      | unit (jsdom) + e2e                              |
| ORB-A11Y-004 | MUST     | Reduced-motion mode MUST preserve semantic state visibility: formation still changes per state (instantly) and accessible text reflects every state                                                                                                                                                                                           | 4.5, 4.6 | unit + e2e                                      |
| ORB-A11Y-007 | MUST     | Reduced motion sets `uMotionScale = 0`, makes formation changes instant and suppresses rotation, turbulence, pulse, pointer and audio displacement without changing semantic state. W5 extends verification when those inputs land.                                                                                                           | 4.5, 4.6 | unit + e2e (`tests/e2e/reduced-motion.spec.ts`) |

Requirements touched but owned elsewhere: ORB-GOV-001…ORB-GOV-010 (Wave 1 — proven here on the integrated page, not re-specified), ORB-STATE-002 and ORB-STATE-008 (Wave 1 — visual proof of defaults and settle), ORB-TOOLVIS-001/003, ORB-EVENT-008, ORB-DEMO-002/004, ORB-ADAPTER-007, ORB-A11Y-001/002/003/005/006 (Wave 1), ORB-RENDER-006, ORB-PERF-006 (Wave 2), ORB-MORPH-004 (Wave 3), ORB-ADAPTER-006 (Wave 7), ORB-SEC-006 (Wave 7 — default mock asserted here), ORB-PERF-002 (Wave 8 — first mobile emulation check).

## 4. Vertical slices

### 4.1 Wiring — bounded context `engine` (`engine/OrbController.ts`, `engine/visual-policy/apply.ts`, `engine/ports/MotionPreferencePort.ts`, `engine/render/matchMediaMotion.ts`)

**Objective.** Replace the Wave 1 `NullRenderer` path with the real renderer without changing a single semantic test: bus → `transition` → subscribers (a11y) → visual policy → `FormationManager` + uniforms, plus the cosmetic settle timer and host override, all driven by injected `Clock`/`Scheduler`.

**Contracts.**

```ts
// engine/ports/MotionPreferencePort.ts
export interface MotionPreferencePort {
  current(): MotionPreference; // 'full' | 'reduced'
  subscribe(cb: (m: MotionPreference) => void): () => void;
}
// engine/render/matchMediaMotion.ts (infrastructure; safe without window)
export function createMotionPreferencePort(input: {
  override: "auto" | "on" | "off"; // OrbEngineOptions.reducedMotion
  matchMedia?: (q: string) => MediaQueryList; // injected for tests; absent → 'full', no subscription
}): MotionPreferencePort; // 'on' → always reduced; 'off' → always full; 'auto' → media + change events

// engine/visual-policy/apply.ts — pure over ports; the only place visuals are written from state
export interface ApplyVisualDeps {
  renderer: RendererPort;
  formations: FormationManager;
}
export interface ApplyVisualOptions {
  motion: MotionPreference;
  easingId: EasingId;
  previous: OrbVisualState | null;
}
export function applyVisualState(
  deps: ApplyVisualDeps,
  visual: OrbVisualState,
  opts: ApplyVisualOptions,
): MorphHandle | null;
//   setUniform uRotationSpeed/uTurbulence/uPulseStrength/uParticleScale from `visual`, uMotionScale = motion === 'reduced' ? 0 : 1;
//   formations.morphTo(visual.formation, { durationMs: motion === 'reduced' ? 0 : visual.morphDurationMs, easingId })
//   only when visual.formation !== previous?.formation (returns null otherwise); connection density via formations.

// engine/OrbController.ts — Wave 1 class, additive changes only
export interface OrbControllerDeps {
  bus: EventBus;
  renderer: RendererPort;
  formations: FormationManager;
  toolVisuals: ToolVisualRegistry;
  motion: MotionPreferencePort;
  clock: Clock;
  scheduler: Scheduler;
  logger: Logger;
  settleMs?: number; // default SETTLE_MS = 1500 (core/limits.ts)
}
export interface VisualLayerState {
  applied: OrbVisualState;
  motion: MotionPreference;
  settled: boolean; // cosmetic return to STATE_VISUAL_DEFAULTS.idle.formation
  override: { formation: FormationId; durationMs: number } | null; // host morphTo, cleared on next accepted transition or setState
}
export class OrbController {
  subscribe(cb: (s: OrbSnapshot) => void): () => void; // Wave 1
  dispatch(event: OrbEvent<OrbEventMetadata>): EmitResult; // Wave 1 (bus → transition → publish → apply)
  setState(state: OrbState): void; // Wave 1 (manual provenance, ORB-API-004)
  morphOverride(formation: FormationId, durationMs?: number): MorphHandle; // Wave 4
  visual(): Readonly<VisualLayerState>; // Wave 4; read by OrbEngine debug snapshot and tests only
  dispose(): void; // Wave 4: cancels settle, unsubscribes motion port
}
```

**Behavior.**

1. `dispatch(event)`: `bus.emit` (validate → dedupe → lifecycle guards) → `transition(snapshot, event)`. Rejected events end here (`orb.bus.rejected`, Wave 1).
2. Accepted: cancel any settle timer, `settled = false`, `override = null`; publish the new snapshot to subscribers **synchronously and before** any renderer call (text never lags visuals); then `visual = resolveVisualState(snapshot.state, { toolVisuals, motion: motion.current() })` and `applyVisualState(...)`.
3. If `snapshot.state ∈ { success, error }`: `settleTimer = scheduler.schedule(settle, settleMs)`. `settle()` sets `settled = true` and re-applies the current visual with `formation = STATE_VISUAL_DEFAULTS.idle.formation`, keeping every uniform of the outcome state. It never calls `transition`, never publishes a snapshot, never touches `lastOutcome` or accessible text (ORB-STATE-008, A-03).
4. `setState(state)` (Wave 1 semantics) also clears `override`/`settled` and applies the visual for the manual state.
5. `morphOverride` calls `formations.morphTo` directly, records `override`, returns the `MorphHandle`; the next accepted transition re-applies the state visual (interruption-safe via Wave 3 bake).
6. Motion port change: re-resolve and re-apply the current visual; if a morph is in flight and the new preference is `reduced`, `formations.morphTo(same target, { durationMs: 0 })` completes it on the next frame. Motion never changes the snapshot.
7. Headless mode: `renderer` is the Wave 1 `NullRenderer`; steps 1–6 run unchanged.

**Edge cases.**

- Accepted event with unchanged `state` (e.g. `USER_STOPPED_SPEAKING` while `thinking`): snapshot published (flags changed), no `morphTo` (same formation), uniforms re-set idempotently.
- Transition while a morph is in flight → Wave 3 interruption (CPU bake), no snap.
- `TOOL_REQUESTED` with `metadata.tool` unregistered → `generic-tool`, `orb.visual.unregistered_formation` logged once per tool (ORB-TOOLVIS-001, A-13).
- Settle fires after `dispose()` → impossible: `dispose()` cancels; a stale callback is a bug caught by `settle.test.ts`.
- `settleMs = 0` → settle on the next scheduler tick; `settleMs = Infinity` (not allowed: `core/limits` clamps to `[0, 60_000]`).
- Renderer `onContextLost` during a morph → Wave 2 restore; controller state untouched.

**Acceptance criteria.**

- ORB-ARCH-004, ORB-MORPH-004 — Given `OrbController` with a recording fake `RendererPort`, a fake `Scheduler`/`Clock` and the real `FormationManager`; When fast-check generates 200 sequences of accepted events and after every event the morph promise is resolved, the settle timer is fired and the motion port is flipped; Then `snapshot` is deep-equal before and after every visual event, and `lastOutcome` changes only on `TOOL_COMPLETED`, `TOOL_FAILED`, `APPROVAL_DENIED`, `ERROR` — `tests/integration/engine/visual-never-semantic.test.ts`.
- ORB-STATE-002, ORB-TOOLVIS-001 — Given each of the 9 states reached by its canonical event path; When applied; Then the recorded morph target equals `STATE_VISUAL_DEFAULTS[state].formation` (or the registered tool visual for `tool_call`) and the recorded uniforms equal the resolved `OrbVisualState` — `tests/integration/engine/wiring.visual.test.ts`.
- ORB-STATE-008 — Given `success`; When the fake scheduler advances `settleMs`; Then `visual().settled === true`, the last morph target is `sphere`, subscribers were not called and `snapshot` is unchanged; When an event arrives before `settleMs`; Then the timer is cancelled (`scheduler.pending() === 0`) — `tests/unit/engine/settle.test.ts`.
- ORB-A11Y-004 — Given motion `reduced`; When the 9 states are traversed; Then `morphTo` is called with `durationMs: 0` for every formation change and `uMotionScale === 0` — `tests/unit/engine/motionPreference.test.ts`.

**Observability.** `orb.state.transition { from, to, eventType, correlationId, source }` (Wave 1); `orb.visual.applied { state, formation, durationMs, motion, override }`; `orb.visual.settled { state, settleMs }`; `orb.visual.motion_changed { motion }`; `orb.visual.unregistered_formation { tool }` (once per tool). `__orbDebug.visual = VisualLayerState` (debug builds).

### 4.2 OrbEngine public API and frozen export surface — bounded context `engine` (`engine/OrbEngine.ts`, `engine/index.ts`)

**Objective.** Ship the complete §22 facade with typed errors, single-adapter attachment, the approval-decision channel, headless construction and a committed export-surface snapshot so that later waves (5–8) add behaviour without changing signatures.

**Contracts.**

```ts
// engine/OrbEngine.ts — SHARED_CONTRACTS shape; additive optional options only
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
  settleMs?: number; // Wave 4: cosmetic settle after success/error, default 1500, clamped [0, 60_000]
  adaptive?: boolean; // Wave 4: false freezes QualityController at the initial profile (E2E ?adaptive=0)
  debug?: boolean; // Wave 4: attaches window.__orbDebug (read-only snapshot), default false
  easing?: EasingId; // Wave 4: default 'easeInOutCubic' (Wave 3 EasingId)
}
export type OrbEngineErrorCode =
  | "invalid_container"
  | "invalid_particles"
  | "invalid_state"
  | "unknown_formation"
  | "adapter_already_attached"
  | "disposed";
export class OrbEngineError extends Error {
  readonly code: OrbEngineErrorCode;
  readonly details?: Record<string, unknown>;
}

export class OrbEngine {
  static readonly SPEC_VERSION: "0.2.0";
  constructor(options: OrbEngineOptions);
  readonly capabilities: CapabilityReport;
  readonly mode: "webgl" | "headless";
  // Preserve setParticleCount, setQuality, setVisualOverride, setReducedMotion and subscribeQuality from W2 §4.4 with their exact signatures.
  setState(state: OrbState): void;
  morphTo(formation: FormationId | string, options?: { duration?: number }): Promise<MorphOutcome>;
  emit(event: OrbEvent): EmitResult;
  registerFormation(name: string, source: FormationSource): Promise<FormationId>;
  registerToolVisual(input: { tool: string; formation: FormationId | string }): void;
  attachAdapter(adapter: AgentAdapter): () => void;
  onApprovalDecision(callback: (decision: ApprovalDecision) => void): () => void;
  decideApproval(decision: ApprovalDecision): void; // Wave 4 additive entry for the UI side of ORB-GOV-010 (see §11 Q-2)
  subscribe(callback: (snapshot: OrbSnapshot) => void): () => void;
  attachAudio(source: AudioSource): () => void;
  setPointerForce(config: PointerForceConfig | null): void;
  resize(): void;
  dispose(): void;
}
```

`engine/index.ts` freezes the union of public exports introduced in W1/W2/W3 plus the following facade surface (existing controls and types must not disappear): `OrbEngine`, `OrbEngineError`, `ORB_STATES`, `STATE_VISUAL_DEFAULTS`, `BUILT_IN_FORMATIONS`, `QUALITY_PRESETS`, `orbEventSchema`, and types `OrbEngineOptions`, `OrbEngineErrorCode`, `OrbState`, `OrbSnapshot`, `ActiveOperation`, `LastOutcome`, `ApprovalStatus`, `OrbVisualState`, `FormationId`, `FormationSource`, `FormationError`, `MorphOutcome`, `MorphHandle`, `OrbEvent`, `OrbEventType`, `OrbEventSource`, `OrbEventMetadata`, `EmitResult`, `AgentAdapter`, `ApprovalDecision`, `AudioSource`, `PointerForceConfig`, `QualityPreset`, `QualityProfile`, `CapabilityReport`, `MotionPreference`, `Clock`, `Scheduler`, `Logger`, `Prng`, `Result`. The declaration and runtime snapshot tests verify that union against `SHARED-CONTRACTS.md`; lower-level classes remain excluded from the eventual package consumer surface unless explicitly exported here.

**Public API table** (behavior → provenance → errors; "disposed" means every member except `dispose()` and `capabilities` throws `OrbEngineError('disposed')` after disposal):

| Member                                    | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                             | Provenance                                                                             | Errors                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new OrbEngine(options)`                  | Builds `Prng(seed ?? 1)`, `EventBus`, `FormationManager`, `QualityController` (frozen when `adaptive === false`), `capabilities = detectCapabilities()`; `webgl2 === false` → `NullRenderer`, no canvas, no rAF loop ("headless": state, a11y, adapters still work); otherwise `ParticleSystem` mounted in `container`, preset from `quality` (`'auto'` → Wave 2 `selectPreset(capabilities)`); `debug` attaches `window.__orbDebug` | —                                                                                      | throws `invalid_container` (not an `HTMLElement`), `invalid_particles` (outside `[MIN_PARTICLES, capabilities-derived hard max]`); never throws for missing WebGL |
| `capabilities`                            | Frozen `CapabilityReport` computed once                                                                                                                                                                                                                                                                                                                                                                                              | —                                                                                      | —                                                                                                                                                                 |
| `OrbEngine.SPEC_VERSION`                  | Literal `'0.2.0'`; bumped with SPEC.md (§28 rule 10)                                                                                                                                                                                                                                                                                                                                                                                 | —                                                                                      | —                                                                                                                                                                 |
| `setState(state)`                         | `controller.setState`: `snapshot.state = state`, `provenance = 'manual'`, anomaly `manual_override` logged, clears override/settle, applies the state visual; no operation opened/closed, `lastOutcome` untouched, no callback into adapters                                                                                                                                                                                         | manual                                                                                 | `invalid_state` (not in `ORB_STATES`), `disposed`                                                                                                                 |
| `morphTo(formation, { duration })`        | Cosmetic override; resolves `MorphOutcome` (`completed`/`interrupted`/`cancelled`); cleared by the next accepted transition or `setState`; `duration` defaults to the current visual's `morphDurationMs`; reduced motion forces 0                                                                                                                                                                                                    | none (snapshot unchanged)                                                              | rejects with `unknown_formation`; throws `disposed`                                                                                                               |
| `emit(event)`                             | `source` defaults to `'adapter'`; runs the Wave 1 bus (schema, dedupe, guards) and `transition`; returns `EmitResult`; invalid input → `{ accepted: false, reason: 'invalid' }`                                                                                                                                                                                                                                                      | as given (`adapter` / `mock` / `manual` — manual lifecycle rejected `manual_override`) | never throws except `disposed`                                                                                                                                    |
| `registerFormation(name, source)`         | Wave 4: `Float32Array` or generator sources → `normalizeFormation` + registry; id must not shadow a built-in; `{ svg }` / `{ url }` → `FormationError('unsupported_source')` until Wave 6                                                                                                                                                                                                                                            | —                                                                                      | rejects with `FormationError`; throws `disposed`                                                                                                                  |
| `registerToolVisual({ tool, formation })` | Registry write; unknown formation id → warn, resolves to `generic-tool`; never consulted by governance                                                                                                                                                                                                                                                                                                                               | —                                                                                      | `disposed`                                                                                                                                                        |
| `attachAdapter(adapter)`                  | `adapter.subscribe(e => emit(withSource(e)))` then `adapter.connect()`; `withSource`: `adapter.simulated` → `source = 'mock'` (rewrites `'adapter'` with `orb.engine.source_rewritten`), else `source = 'adapter'`; `connect()` rejection logged `orb.adapter.connect_failed`, engine keeps running; returns detach = unsubscribe + `disconnect()`; one adapter at a time                                                            | adapter / mock                                                                         | `adapter_already_attached`, `disposed`                                                                                                                            |
| `onApprovalDecision(cb)`                  | Registers a host listener; returns unregister                                                                                                                                                                                                                                                                                                                                                                                        | —                                                                                      | `disposed`                                                                                                                                                        |
| `decideApproval(decision)`                | Accepted only if `activeOperation?.correlationId === decision.correlationId && approvalStatus === 'pending'` and it is the first decision for that `correlationId`; then delivers through `adapter.respondToApproval` when present, with listeners observing only; otherwise the host listener owns delivery; never changes the snapshot (the authoritative `APPROVAL_*` returns through the adapter)                                | —                                                                                      | never throws; rejections logged `orb.engine.decision_rejected { reason }`                                                                                         |
| `subscribe(cb)`                           | Calls `cb(snapshot)` synchronously once, then after every accepted change; returns unsubscribe                                                                                                                                                                                                                                                                                                                                       | —                                                                                      | `disposed`                                                                                                                                                        |
| `attachAudio(source)`                     | Stores the source; Wave 5 wires `AnalyserPump`; returns detach                                                                                                                                                                                                                                                                                                                                                                       | —                                                                                      | `disposed`                                                                                                                                                        |
| `setPointerForce(config)`                 | Stores config (`null` disables); Wave 5 wires uniforms                                                                                                                                                                                                                                                                                                                                                                               | —                                                                                      | `disposed`                                                                                                                                                        |
| `resize()`                                | Re-reads container size and DPR cap → `renderer.resize`                                                                                                                                                                                                                                                                                                                                                                              | —                                                                                      | `disposed`                                                                                                                                                        |
| `dispose()`                               | Idempotent: detaches adapter (`disconnect()`), cancels settle/quality timers, unsubscribes motion port, `renderer.dispose()`, drops listeners, removes `__orbDebug`                                                                                                                                                                                                                                                                  | —                                                                                      | never throws                                                                                                                                                      |

**Behavior.** Export-surface freeze: `tests/unit/engine/api-surface.snapshot.test.ts` compares `Object.keys(await import('@/engine/index')).sort()` and `Object.getOwnPropertyNames(OrbEngine.prototype).sort()` + static names with `tests/fixtures/api/engine-index.exports.json` / `OrbEngine.members.json`; `pnpm api:dts` (`tsc -p tsconfig.api.json --emitDeclarationOnly`) produces `engine/index.d.ts` compared byte-for-byte with `tests/fixtures/api/engine-index.d.ts` in `api-surface.dts.test.ts`. Updating either snapshot requires `pnpm api:update` and a `CHANGELOG.md` entry under "Public API" (reviewed; ADR-0011). Debug snapshot additions: `window.__orbDebug.engine = { specVersion, capabilities, adapter: { name, simulated } | null, motion, preset: { requested, effective } }`, `.snapshot` (current `OrbSnapshot`), `.visual` (4.1). All debug objects are deep-frozen.

**Edge cases.**

- `attachAdapter` after `dispose()` → `disposed`; `detach()` twice → no-op.
- Adapter emits before `connect()` resolves → accepted (subscription precedes connect).
- `decideApproval` for a pending operation in the FIFO queue (not active) → rejected `not_active` (ORB-GOV-009).
- `emit` with `source: 'manual'` and a non-lifecycle type (`USER_SPEAKING`) → accepted with `provenance = 'manual'` (Wave 1 G3 rule).
- `morphTo` while headless → resolves `completed` on the next scheduler tick (NullRenderer), still no snapshot change.
- StrictMode double mount in `useOrbEngine` → one engine, one adapter attach (effect cleanup detaches and disposes; Wave 2 test extended).
- `container` detached from the document at construction → allowed (canvas mounts later); `resize()` with zero size → renderer keeps last size, logs `orb.render.zero_size` once.

**Acceptance criteria.**

- ORB-API-001 — Given `engine/index.ts`; When the runtime, member and `.d.ts` snapshots are compared; Then they match the committed fixtures and `OrbEngine.SPEC_VERSION === '0.2.0'` — `tests/unit/engine/api-surface.snapshot.test.ts`, `tests/unit/engine/api-surface.dts.test.ts`.
- ORB-API-001, ORB-RENDER-006 — Given `detectCapabilities` stubbed to `{ webgl2: false, webgl1: false }`; When `new OrbEngine({ container })`; Then no throw, `capabilities.webgl2 === false`, no `<canvas>` child, and `emit`/`subscribe`/`setState`/`attachAdapter` behave identically to the WebGL path — `tests/unit/engine/OrbEngine.headless.test.ts`.
- ORB-API-004, ORB-GOV-003 — Given an active operation in `executing`; When `setState('success')`; Then `snapshot.state === 'success'`, `provenance === 'manual'`, `activeOperation` unchanged, `lastOutcome === null`, anomaly `manual_override` logged, no adapter method called; When `TOOL_COMPLETED` then arrives; Then it is processed by the Appendix A row for `executing` (manual state is not a governance phase) — `tests/unit/engine/OrbEngine.setState.test.ts`.
- ORB-GOV-010, ORB-GOV-005 — Given `waiting_approval` with a `MockAdapter` spy; When `decideApproval({ correlationId, decision: 'approve', idempotencyKey })`; Then listeners and `respondToApproval` receive it once, `snapshot` is unchanged until the adapter's `APPROVAL_GRANTED` arrives; a second decision for the same id is dropped — `tests/unit/engine/OrbEngine.decision.test.ts`.
- ORB-API-001, ORB-ADAPTER-006, ORB-ADAPTER-007 — Given a simulated adapter emitting `source: 'adapter'`; When attached; Then events reach the bus with `source: 'mock'` and one `orb.engine.source_rewritten` warning; Given `connect()` rejects; Then the rejection is logged and `emit` still works; Given a second `attachAdapter`; Then `adapter_already_attached` — `tests/unit/engine/OrbEngine.adapter.test.ts`.

**Observability.** `orb.engine.created { preset, particles, headless, seed }`, `orb.engine.disposed`, `orb.engine.decision { correlationId, decision, idempotencyKey }`, `orb.engine.decision_rejected { correlationId, reason }`, `orb.engine.source_rewritten { adapter }`, `orb.adapter.connect_failed { adapter, reason }`, `orb.api.error { code }` (once per throw). No metadata strings in logs.

### 4.3 Demo page `/` — bounded contexts `app` and `components` (`app/page.tsx`, `app/_lib/searchParams.ts`, `app/_lib/demoConfig.ts`, `components/demo/*`)

**Objective.** The credential-free demo: one page composing `OrbCanvas`, the Wave 1 a11y components, the mock adapter and the demo controls, deterministic under query parameters, identifiable as simulated at every moment.

**Contracts.**

```ts
// app/_lib/searchParams.ts — zod at the boundary; unknown keys ignored; invalid values → default + key reported
export const demoSearchParamsSchema = z.object({
  seed: z.coerce.number().int().min(0).max(0xffff_ffff), // default env.NEXT_PUBLIC_ORB_SEED ?? 1
  preset: z
    .enum([
      "auto",
      "mobile-low",
      "mobile-default",
      "desktop-default",
      "desktop-high",
      "desktop-ultra",
      "ci",
    ])
    .default("auto"),
  adaptive: z.enum(["0", "1"]).default("1"), // '0' → OrbEngineOptions.adaptive = false
  sequencer: z.enum(["auto", "manual"]).default("auto"), // 'manual' → mock + settle timers advance only via __orbDebug.sequencer
  debug: z.enum(["0", "1"]).default("0"), // '1' → window.__orbDebug
  reducedMotion: z.enum(["auto", "on", "off"]).default("auto"),
  scenario: z.enum(["governed", "tool-failure"]).default("governed"), // denied variant = press Deny
  approval: z.enum(["0", "1"]).default("1"), // initial "Require approval" switch state
});
export type DemoSearchParams = z.infer<typeof demoSearchParamsSchema>;
export function parseDemoSearchParams(
  sp: URLSearchParams,
  env: { NEXT_PUBLIC_ORB_SEED?: string },
): { params: DemoSearchParams; invalid: string[]; reserved: string[] /* e.g. 'adapter' */ };

// app/_lib/demoConfig.ts
export type DemoScenario = "governed" | "tool-failure";
export interface DemoRuntime {
  engine: Omit<OrbEngineOptions, "container">; // quality, seed, reducedMotion, adaptive, debug, scheduler, clock
  adapter: MockAdapterOptions; // { scheduler, clock, script: DEMO_SCRIPTS[scenario], requireApproval, autoApproveAfterMs: 600 }
  sequencer: { mode: "auto" | "manual"; step(): boolean; pending(): number; flushEngine(): number }; // manual: two ManualSchedulers (adapter, engine)
}
export function buildDemoRuntime(params: DemoSearchParams): DemoRuntime;

// core/scheduler.ts (Wave 4 addition to the kernel; pure)
export function createManualScheduler(): Scheduler & {
  step(): boolean;
  pending(): number;
  flush(): number;
};

// components/demo/DemoControls.tsx
export interface DemoControlsProps {
  running: boolean;
  requireApproval: boolean;
  scenario: DemoScenario;
  disabled: boolean;
  onRun(): void;
  onRequireApprovalChange(v: boolean): void;
  onScenarioChange(s: DemoScenario): void;
}
// components/demo/DemoApp.tsx ('use client'): owns engine (useOrbEngine), MockAdapter lifecycle, store wiring, __orbDebug.sequencer/demo
// components/store/orbStore.ts (Wave 1) gains: adapter: { name, simulated } | null; demo: { running, requireApproval, scenario }; actions decide(), runSequence(), setRequireApproval(), setScenario()
```

Stable selectors (`data-testid`): `orb-canvas`, `fallback`, `status` (`role="status"` live region, Wave 1), `active-operation`, `approve`, `deny`, `provenance-badge`, `run-sequence`, `require-approval` (`role="switch"`), `scenario`, `preset-readout`, `demo-notice`.

**Behavior.**

1. `app/page.tsx` (server) parses `searchParams` → `DemoApp` (client). No engine on the server; `DemoApp` constructs the engine in an effect through `useOrbEngine` (Wave 2) with `buildDemoRuntime(params).engine`.
2. On mount: `adapter = new MockAdapter(runtime.adapter)`; `detach = engine.attachAdapter(adapter)`; `engine.onApprovalDecision(d => logger.info('orb.demo.decision', ...))` (the engine already forwards to `respondToApproval`); store subscribes to `engine.subscribe`.
3. "Run AI Sequence" → `adapter.run()` (Wave 1 `MockAdapter` script trigger; see §11 Q-3). Button `disabled` while the script is in flight (`running` from script start until its last event or a denial). Observed state trace for `governed` with approval on: `idle → listening → thinking → tool_call(not_required) → waiting_approval(pending) → [decision] → tool_call(granted) → executing → success → speaking → idle`, tool `web_search`, every event `source: 'mock'`, `metadata.simulated: true`.
4. Approve/Deny (Wave 1 `ApprovalControls`, enabled only while `approvalStatus === 'pending'`) → `store.decide` → `engine.decideApproval({ correlationId, decision, idempotencyKey: ids.next() })` → mock schedules `APPROVAL_GRANTED`/`APPROVAL_DENIED`. Deny → `idle`, `lastOutcome.kind = 'denied'`, announcement "Action denied: web_search", run ends.
5. "Require approval" switch (default on, label "Require approval"; helper text "off = simulated auto-approval, applies to the next run"): off → `requireApproval: false` → mock still emits `APPROVAL_REQUIRED` then `APPROVAL_GRANTED` after `autoApproveAfterMs`, both `source: 'mock'`; the status announces "Approval: auto (simulated)". Changing the switch or scenario while not running detaches the current adapter (`disconnect()`), builds a new `MockAdapter`, re-attaches.
6. Scenario `tool-failure` → `TOOL_FAILED` instead of `TOOL_COMPLETED` → `error` with icon "✕" + text; then `ASSISTANT_SPEAKING`? No: the failure script ends at `error` (settle to `sphere` is cosmetic; text stays "Error").
7. `ProvenanceBadge` renders "Simulated" (icon + text) permanently on `/` because `adapter.simulated === true`; every live-region announcement is prefixed "Simulated:" (risk d1).
8. Capability fallback: `capabilities.webgl2 === false` → `OrbCanvas` renders `data-testid="fallback"` ("WebGL unavailable — text state remains available", reason); all controls work.
9. Preset: `quality: params.preset` (`'auto'` → Wave 2 `selectPreset`: `mobile && deviceMemoryGb ≤ 2 → mobile-low`, `mobile → mobile-default`, else `desktop-default`; `desktop-high`/`ultra` never auto-selected); `preset-readout` shows "Quality: <effective> (<auto | requested>)" and "(clamped)" when the capability report lowered the request.
10. Sequencer `manual`: `window.__orbDebug.sequencer = runtime.sequencer` (attached only when `debug === '1' && sequencer === 'manual'`); `step()` runs the next scheduled mock callback, `flushEngine()` runs pending engine timers (settle). Nothing else can create events.
11. Network: the page issues no cross-origin request and no `fetch` at all in this wave (system font stack, no analytics). `?adapter` is reserved (Wave 7): reported in `reserved`, notice "adapter parameter reserved; mock adapter in use".

**Edge cases.**

- Invalid value (`?seed=abc`, `?preset=huge`) → default, `demo-notice` lists the keys, `orb.demo.params_invalid { keys }` logged.
- `?preset=desktop-ultra` on `mobile` capabilities → Wave 2 clamp; readout "(clamped)".
- Run clicked twice → second ignored (button disabled, `aria-disabled`).
- Deny path then Run again → new `correlationId`, previous outcome cleared on the next accepted event only.
- Tab hidden → rAF paused, mock timers continue (auto mode), a11y updates, renderer catches up; no semantic effect.
- Switch toggled during a run → applies to the next run (helper text says so); not disabled to keep it reachable.
- `?sequencer=manual` without `?debug=1` → sequencer object not attached; page shows notice "manual sequencer requires debug=1"; the run never advances (documented).
- Missing `.env` / `NEXT_PUBLIC_ORB_SEED` unset → seed 1 (ORB-DEMO-001).

**Acceptance criteria.**

- ORB-DEMO-001, ORB-DEMO-003, ORB-DEMO-006, ORB-GOV-001, ORB-GOV-002, ORB-GOV-004, ORB-DEMO-002 — Given `/?sequencer=manual&preset=ci&seed=1&adaptive=0&debug=1` under SwiftShader; When "Run AI Sequence" is activated and `__orbDebug.sequencer.step()` is called until `waiting_approval`; Then the `status` text passed through "Listening", "Thinking", "Tool requested: web_search", "Awaiting approval: web_search" in that order (request ≠ approval), `approve` gains focus on Tab, Enter emits a decision and the snapshot is unchanged until the next `step()` yields `tool_call (granted)` then `executing`, `success` ("Success ✓" icon + text), `speaking`, `idle`; `provenance-badge` reads "Simulated" throughout; `__orbDebug.snapshot.lastOutcome.kind === 'success'` only after `TOOL_COMPLETED` — `tests/e2e/demo-governance.spec.ts`.
- ORB-DEMO-006, ORB-GOV-004 — Given `waiting_approval`; When `deny` is activated and stepped; Then state `idle`, status "Action denied: web_search", no "Error" text ever appears, `run-sequence` re-enabled — `tests/e2e/demo-governance.spec.ts`.
- ORB-DEMO-006 — Given `?scenario=tool-failure`; When run to completion; Then state `error`, status "Error", `lastOutcome.kind === 'error'`; Given `require-approval` switched off; When run; Then `waiting_approval` is entered and left without any decision, status contains "auto (simulated)", `__orbDebug.snapshot.provenance === 'mock'` — `tests/e2e/demo-governance.spec.ts`.
- ORB-DEMO-006, ORB-DEMO-004 — Given `MockAdapter` (each script) + manual scheduler + headless `OrbEngine` in Node; When stepped to exhaustion; Then the state trace equals the expected array per scenario, every event has `source: 'mock'`, and the engine's own scheduler received no callback that emits an event — `tests/integration/demo/sequence.test.ts`.
- ORB-DEMO-001, ORB-SEC-006 — Given the production build started with a scrubbed env and every non-`localhost` request aborted by `context.route`; When the governed run completes; Then the recorded request hosts are all `localhost` and no `pageerror` occurred — `tests/e2e/demo.no-credentials.spec.ts`.
- ORB-PERF-002, ORB-PERF-006 — Given `devices['Pixel 7']` (touch, mobile UA, `deviceMemory` 4); When `/` loads with `?sequencer=manual&adaptive=0&debug=1`; Then `__orbDebug.engine.preset.effective === 'mobile-default'`, `preset-readout` says "(auto)", frames advance, and the governed run completes with touch taps; Given `?preset=mobile-low`; Then effective `mobile-low` — `tests/e2e/mobile-preset.spec.ts`.
- ORB-RENDER-006, ORB-A11Y-006, ORB-ARCH-005 — Given the `chromium-nowebgl` project; When `/` loads and the governed run is stepped with keyboard approval; Then `fallback` is visible, `orb-canvas` absent, every status text of the sequence appears, no `pageerror` — `tests/e2e/no-webgl.spec.ts`.
- ORB-DEMO-006 — Given `parseDemoSearchParams`; When given defaults / invalid / unknown / reserved inputs; Then defaults apply, `invalid` and `reserved` list the keys — `tests/unit/app/searchParams.test.ts`.

**Observability.** `orb.demo.run { scenario, requireApproval, sequencer }`, `orb.demo.decision { correlationId, decision }`, `orb.demo.params_invalid { keys }`, `orb.demo.reserved_param { key }`, `orb.demo.adapter_rebuilt { reason }`. `__orbDebug.demo = { scenario, requireApproval, running, params }`. Client logs go to the Wave 0 browser `Logger` (console JSON in dev, no-op in prod unless `debug`).

### 4.4 Playground state panel — bounded context `components/playground` (`StatePanel.tsx`, `MockEventsPanel.tsx`, `ToolVisualPanel.tsx`, `app/playground/page.tsx`)

**Objective.** Give developers direct state and raw-event controls that are visibly manual/simulated and structurally unable to bypass governance.

**Contracts.**

```tsx
// components/playground/StatePanel.tsx — 9 buttons "Set <state> (manual)", data-testid="set-state-<state>"; readout: snapshot.state, provenance, anomaly count
// components/playground/MockEventsPanel.tsx
interface RawEventForm {
  type: OrbEventType;
  correlationId: string /* auto: active → pending head → ids.next() */;
  tool?: string /* ^[A-Za-z0-9_.:-]{1,64}$ */;
  label?: string; /* ≤ 120, printable */
}
//   "Emit (simulated)" → store.emitMock(form) → engine.emit({ type, timestamp: clock.now(), id: ids.next(), correlationId, source: 'mock', metadata: { tool, label, simulated: true } })
//   source is not a form field; result readout shows EmitResult (accepted / deduplicated / reason); panel disabled when store.adapter?.simulated === false
// components/playground/ToolVisualPanel.tsx — tool input + formation <select> (registry ids) → engine.registerToolVisual; list of mappings; caption "visual only — never affects policy"
// app/playground/page.tsx — same engine + MockAdapter wiring as DemoApp (shared components/demo/useDemoRuntime.ts), plus Wave 2/3 panels
```

**Behavior.** `StatePanel` calls `engine.setState` (ORB-API-004): the a11y `StateAnnouncer` appends "(manual)" and `ProvenanceBadge` shows "(manual)". `MockEventsPanel` emits through the public `emit` with `source: 'mock'` forced; the playground has no code path that emits `source: 'adapter'` or calls `respondToApproval` — approvals go through the same `ApprovalControls` → `decideApproval` channel as the demo. `ToolVisualPanel` writes the registry only; governance never reads it (Wave 1 `transition` has no registry dependency — arch test). The debug snapshot exposes the same read-only objects as `/`.

**Edge cases.**

- Raw `APPROVAL_GRANTED` for the pending operation → accepted (mock events are authoritative for the demo, ORB-GOV-008) and labelled "Simulated"; for a non-pending id → `out_of_phase`/`unknown_correlation` shown in the readout.
- Raw lifecycle event with a typed `source` in devtools → impossible: the store constructs the event; `emit` from the console with `source: 'manual'` is rejected `manual_override` (Wave 1).
- Non-simulated adapter attached (Wave 7) → `MockEventsPanel` disabled with the reason "live adapter connected"; `StatePanel` stays enabled (manual is always cosmetic).
- Tool name failing the pattern → form error, no emit.

**Acceptance criteria.**

- ORB-PLAY-002, ORB-API-004 — Given `StatePanel` (RTL, jsdom, headless engine); When "Set success (manual)" is activated during `executing`; Then `snapshot.provenance === 'manual'`, `lastOutcome === null`, the live region reads "Success (manual)"; Given `MockEventsPanel`; When any event is emitted; Then the engine received `source: 'mock'` and `metadata.simulated === true`; Given `store.adapter = { simulated: false }`; Then the panel is disabled — `tests/unit/components/playground/governance.test.tsx`.
- ORB-PLAY-002, ORB-API-001, ORB-API-004 — Given `/playground?preset=ci&seed=1&adaptive=0&debug=1`; When "Set executing (manual)" then raw `TOOL_COMPLETED` for a fresh id is emitted; Then the readout shows `unknown_correlation` and `state` stays `executing` with provenance `manual`; `__orbDebug.engine.specVersion === '0.2.0'` — `tests/e2e/public-api.spec.ts`.
- ORB-TOOLVIS-003 — Given `ToolVisualPanel` maps `web_search → rings`; When the demo run reaches `tool_call`; Then `__orbDebug.formation.active === 'rings'` and the governance trace is identical to the unmapped run — `tests/e2e/public-api.spec.ts`.

**Observability.** `orb.playground.set_state { state }`, `orb.playground.emit { type, result }`, `orb.playground.tool_visual { tool, formation }`.

### 4.5 Reduced motion integrated — bounded contexts `engine` and `components` (A-15, ORB-A11Y-007 mechanics, ORB-A11Y-004 proof)

**Objective.** Under `prefers-reduced-motion: reduce` or `reducedMotion: 'on'` the orb still changes formation for every state — instantly — with no rotation, turbulence or pulse, and the text is always present.

**Contracts.** `createMotionPreferencePort` (4.1); `OrbEngineOptions.reducedMotion`; `?reducedMotion=`; Wave 2 `MotionPanel` override select (`auto`/`on`/`off`) bound to the same option (engine rebuilt on change in the playground). Applied values (Appendix C.2): `morphDurationMs = 0`, `rotationSpeed = turbulence = pulseStrength = 0`, `uMotionScale = 0`; `formation`, `connectionDensity`, `particleScale` unchanged.

**Behavior.** `applyVisualState` (4.1) with `motion: 'reduced'` calls `formations.morphTo(target, { durationMs: 0 })` (Wave 3: completes on the next frame, `uMorphProgress` jumps to 1) and zeroes the animated uniforms; `uMotionScale = 0` gates every animated shader term including the Wave 5 pointer/audio displacement. Runtime media change → `orb.visual.motion_changed`, re-apply; an in-flight morph is completed instantly. The snapshot, `lastOutcome`, provenance and a11y text are never read or written by the motion path (ORB-A11Y-007 "MUST NOT alter OrbSnapshot").

**Edge cases.**

- `matchMedia` undefined (SSR, jsdom) → `'full'`, no subscription, no error.
- `reducedMotion: 'off'` with media `reduce` → `'full'` (explicit host override; documented as an accessibility decision the host owns).
- Settle under reduced motion → instant `sphere`, text still "Success".
- Motion flips during `waiting_approval` → visual re-applied, controls unaffected.

**Acceptance criteria.**

- ORB-A11Y-003, ORB-A11Y-004, ORB-A11Y-007 — Given `page.emulateMedia({ reducedMotion: 'reduce' })` and `/?sequencer=manual&preset=ci&seed=1&adaptive=0&debug=1`; When the governed run is stepped with approval; Then after every step `__orbDebug.uniforms.uMotionScale === 0`, `uRotationSpeed === uTurbulence === uPulseStrength === 0`, `__orbDebug.formation.active` equals `STATE_VISUAL_DEFAULTS[state].formation` within two polls (`__orbDebug.morph.progress === 1`), and the `status` text equals the state label; the sequence of `__orbDebug.snapshot` values is deep-equal to the same run without reduced motion; When `emulateMedia({ reducedMotion: 'no-preference' })`; Then `uMotionScale === 1` without reload — `tests/e2e/reduced-motion.spec.ts`.
- ORB-A11Y-007, ORB-A11Y-004 — Given the port with a fake `matchMedia`; When `override` is `'on'`/`'off'`/`'auto'` and the media flips; Then `current()` follows the table above and unsubscribe removes the listener; Given `applyVisualState` with `reduced`; Then `morphTo` receives `durationMs: 0` and uniforms are zero — `tests/unit/engine/motionPreference.test.ts`.

**Observability.** `orb.visual.motion_changed { motion, source: 'media' | 'option' }`; `__orbDebug.engine.motion`.

### 4.6 E2E suite — `tests/e2e/**` (Playwright)

**Objective.** One fixture and seven specs that make G4 objectively checkable under SwiftShader, with no sleeps and no pixels.

**Contracts.**

```ts
// tests/e2e/fixtures/demo.ts
export const test = base.extend<{ demo: DemoPage }>({
  /* one context per test; pageerror + console collector (allow-list: THREE info); request recorder */
});
export interface DemoPage {
  goto(
    params?: Partial<
      Record<
        | "seed"
        | "preset"
        | "adaptive"
        | "sequencer"
        | "debug"
        | "reducedMotion"
        | "scenario"
        | "approval",
        string
      >
    >,
  ): Promise<void>; // defaults: sequencer=manual, preset=ci, seed=1, adaptive=0, debug=1
  debug<T>(read: (d: OrbDebug) => T): Promise<T>; // page.evaluate over window.__orbDebug
  step(): Promise<boolean>; // __orbDebug.sequencer.step()
  stepUntil(state: OrbState, max?: number): Promise<void>; // step + expect.poll(snapshot.state)
  flushEngine(): Promise<number>;
  statusText(): Promise<string>;
  requests(): string[]; // hostnames seen
}
```

Playwright projects: `chromium-swiftshader` (default, `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`), `chromium-nowebgl` (`--disable-webgl`, runs `no-webgl.spec.ts` only), `mobile-pixel7` (`devices['Pixel 7']`, runs `mobile-preset.spec.ts` only). Lighthouse: `.lighthouserc.cjs` with `lhci autorun` against the production build on `/` and `/playground`, assertion `categories:accessibility >= 0.95` (median of 3 runs), CI job `lighthouse` (blocking).

**Behavior.** Every spec navigates with the canonical params, drives the mock only through `step()`, asserts on `__orbDebug` and DOM text, and fails on any unexpected `pageerror`/console error. Tags carry the requirement IDs (`{ tag: ['@ORB-DEMO-006', …] }`).

**Acceptance criteria.** The specs listed in §7 are green in CI on every PR; `pnpm req:coverage` shows every MUST in §3 with ≥ 1 E2E where user-observable.

**Observability.** Playwright traces on first retry; Lighthouse JSON uploaded as a CI artefact; `reports/playwright.json` feeds `scripts/req-coverage.ts`.

## 5. Parallel tracks

- **Track A (engine):** 4.1 → 4.2 → 4.5, one implementer; unit/integration only until 4.2 lands.
- **Track B (pages):** 4.3 and 4.4 can start immediately against the Wave 1 `NullRenderer` + Wave 2 `OrbCanvas` (fixed sphere) and the Wave 1 `MockAdapter`; they consume `OrbEngine` through `useOrbEngine` only.
- **Integration point:** `components/orb/useOrbEngine.ts` switching from the Wave 2 engine v0 to the 4.2 facade (one PR, both tracks review). 4.6 starts when 4.3 renders the sequence and finishes after 4.5.
- Spike before Track B: a 1-day harness (`tests/integration/engine/wiring.visual.test.ts` skeleton) proving Wave 1 controller + Wave 3 manager compile and morph together.

## 6. Threat model delta (STRIDE)

Only surfaces introduced or changed by this wave. Mitigations land in this wave. Companion document: `docs/security/threats/demo-and-public-api.md`.

| Surface                                                                                                        | S   | T   | R   | I   | D   | E   | Mitigation                                                                                                                                                                                                                                                                                                                                                           | Req IDs                                                                       |
| -------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Host ↔ public engine API (`emit`, `setState`, `morphTo`, `attachAdapter`, `decideApproval`)                    | ✓   | ✓   | ✓   | –   | ✓   | ✓   | Host is the application authority by design; `source: 'manual'` lifecycle rejected; simulated adapters forced to `'mock'`; `orbEventSchema` + metadata sanitizer at `emit`; structured logs with `correlationId`; bus LRU dedupe + O(1) transition; `morphTo` coalesced (Wave 3); `setState` cannot write `lastOutcome`; `decideApproval` never changes the snapshot | ORB-API-001, ORB-API-004, ORB-GOV-005, ORB-GOV-010, ORB-SEC-003, ORB-ARCH-004 |
| Demo page `/` + mock adapter                                                                                   | ✓   | –   | –   | –   | ✓   | ✓   | Persistent "Simulated" badge and "Simulated:" prefix on announcements; `adapter.simulated → source 'mock'`; no server, no network; Run disabled while running; Approve/Deny grant nothing locally — only the mock's labelled `APPROVAL_*` advances state                                                                                                             | ORB-DEMO-001, ORB-DEMO-002, ORB-DEMO-006, ORB-SEC-006, ORB-GOV-005            |
| Query parameters (`seed`, `preset`, `adaptive`, `sequencer`, `debug`, `reducedMotion`, `scenario`, `approval`) | –   | ✓   | –   | ✓   | ✓   | –   | zod enums/ints with defaults and a visible notice; no `?particles` on `/`; `preset` clamped by `CapabilityReport`; `?debug=1` exposes a deep-frozen read-only snapshot (no engine instance, no secrets); `sequencer.step()` only runs already-scheduled mock callbacks and is absent when the adapter is not simulated                                               | ORB-PERF-006, ORB-RENDER-003, ORB-DEMO-004                                    |
| Playground panels (`StatePanel`, `MockEventsPanel`, `ToolVisualPanel`)                                         | ✓   | –   | –   | –   | ✓   | ✓   | Manual provenance label; `source` not user-selectable (forced `'mock'`); panel disabled with a non-simulated adapter; one emit per activation + dedupe; registry has no policy fields (type-level)                                                                                                                                                                   | ORB-PLAY-002, ORB-API-004, ORB-SEC-003, ORB-TOOLVIS-002                       |
| Approval-decision channel (UI → `decideApproval` → `respondToApproval`)                                        | ✓   | –   | ✓   | –   | –   | ✓   | A forged decision has the same trust as a click and grants nothing; first-decision-wins per `correlationId`; only while `pending` and active; `orb.engine.decision` log with `idempotencyKey`; the authoritative event returns through the adapter                                                                                                                   | ORB-GOV-010, ORB-GOV-005, ORB-A11Y-002                                        |
| `window.__orbDebug` (`engine`, `snapshot`, `visual`, `demo`, `sequencer`)                                      | –   | –   | –   | ✓   | –   | –   | Debug builds or `?debug=1` only; deep-frozen; no PII, no adapter objects, no functions except `sequencer.*` under manual mode                                                                                                                                                                                                                                        | ORB-DEMO-004                                                                  |

## 7. Tests

| Test (name references requirement IDs)                                                                                                                                                                                                                         | Type                     | Req IDs                                                                                       | File                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `req('ORB-API-001')` engine index runtime exports + OrbEngine members match committed snapshots; `SPEC_VERSION === '0.2.0'`                                                                                                                                    | unit                     | ORB-API-001                                                                                   | `tests/unit/engine/api-surface.snapshot.test.ts`         |
| `req('ORB-API-001')` emitted `engine/index.d.ts` equals committed declaration snapshot                                                                                                                                                                         | unit (build artefact)    | ORB-API-001                                                                                   | `tests/unit/engine/api-surface.dts.test.ts`              |
| `req('ORB-API-001','ORB-RENDER-006')` headless construction: no throw without WebGL; state/a11y/adapter paths identical                                                                                                                                        | unit                     | ORB-API-001, ORB-RENDER-006                                                                   | `tests/unit/engine/OrbEngine.headless.test.ts`           |
| `req('ORB-API-001')` typed errors: invalid_container, invalid_particles, invalid_state, unknown_formation, adapter_already_attached, disposed; `emit` never throws                                                                                             | unit                     | ORB-API-001                                                                                   | `tests/unit/engine/OrbEngine.errors.test.ts`             |
| `req('ORB-API-004','ORB-GOV-003')` setState is manual provenance: anomaly logged, no operation change, no lastOutcome, override/settle cleared                                                                                                                 | unit                     | ORB-API-004, ORB-GOV-003                                                                      | `tests/unit/engine/OrbEngine.setState.test.ts`           |
| `req('ORB-API-001','ORB-ADAPTER-006','ORB-ADAPTER-007')` attachAdapter: source rewrite for simulated, connect failure tolerated, detach disconnects, single adapter                                                                                            | unit                     | ORB-API-001, ORB-ADAPTER-006, ORB-ADAPTER-007                                                 | `tests/unit/engine/OrbEngine.adapter.test.ts`            |
| `req('ORB-GOV-010','ORB-GOV-005')` decideApproval fan-out + respondToApproval; snapshot unchanged; not-pending / wrong id / duplicate rejected                                                                                                                 | unit                     | ORB-GOV-010, ORB-GOV-005                                                                      | `tests/unit/engine/OrbEngine.decision.test.ts`           |
| `req('ORB-ARCH-004','ORB-MORPH-004')` property: 200 event sequences with morph completions, settle timers and motion flips never change the snapshot                                                                                                           | integration (fast-check) | ORB-ARCH-004, ORB-MORPH-004                                                                   | `tests/integration/engine/visual-never-semantic.test.ts` |
| `req('ORB-STATE-002','ORB-TOOLVIS-001')` every state applies its default formation + uniforms; tool visual registry honoured; unknown tool → generic-tool                                                                                                      | integration              | ORB-STATE-002, ORB-TOOLVIS-001                                                                | `tests/integration/engine/wiring.visual.test.ts`         |
| `req('ORB-STATE-008')` settle timer: scheduler-driven, formation → sphere, snapshot and subscribers untouched, cancelled by next event and by dispose                                                                                                          | unit                     | ORB-STATE-008                                                                                 | `tests/unit/engine/settle.test.ts`                       |
| `req('ORB-A11Y-007','ORB-A11Y-004')` motion port precedence + apply under reduced: durationMs 0, uMotionScale 0, animated uniforms 0, formation still changes                                                                                                  | unit                     | ORB-A11Y-007, ORB-A11Y-004                                                                    | `tests/unit/engine/motionPreference.test.ts`             |
| `req('ORB-DEMO-006','ORB-DEMO-004')` Node sequence per scenario (governed, denied, tool-failure, approval off): exact state trace, all events `source: 'mock'`, no engine-originated events                                                                    | integration              | ORB-DEMO-006, ORB-DEMO-004                                                                    | `tests/integration/demo/sequence.test.ts`                |
| `req('ORB-DEMO-006')` demo search params: defaults, invalid → default + key, unknown ignored, `adapter` reserved                                                                                                                                               | unit                     | ORB-DEMO-006                                                                                  | `tests/unit/app/searchParams.test.ts`                    |
| `req('ORB-PLAY-002','ORB-API-004')` playground panels (RTL): manual label, forced source mock, disabled with live adapter, registry never reaches transition                                                                                                   | unit (jsdom)             | ORB-PLAY-002, ORB-API-004                                                                     | `tests/unit/components/playground/governance.test.tsx`   |
| `req('ORB-API-001','ORB-SEC-006')` boundaries: `app/**` and `components/**` import only `engine/index.ts`, `adapters/index.ts`, `formations/index.ts`; no `adapters/openai/**`; `engine/**` never imports `adapters/mock/**`                                   | arch                     | ORB-API-001, ORB-SEC-006                                                                      | `tests/architecture/demo-boundaries.test.ts`             |
| `@ORB-DEMO-001 @ORB-DEMO-003 @ORB-DEMO-006 @ORB-DEMO-002 @ORB-GOV-001 @ORB-GOV-002 @ORB-GOV-004` governed run stepped manually; keyboard approve; deny; tool-failure; approval off; Simulated badge; request/approval/execution/result distinct in status text | e2e                      | ORB-DEMO-001, ORB-DEMO-003, ORB-DEMO-006, ORB-DEMO-002, ORB-GOV-001, ORB-GOV-002, ORB-GOV-004 | `tests/e2e/demo-governance.spec.ts`                      |
| `@ORB-DEMO-001 @ORB-SEC-006` production build, scrubbed env, cross-origin requests aborted → run completes; request hosts all localhost                                                                                                                        | e2e                      | ORB-DEMO-001, ORB-SEC-006                                                                     | `tests/e2e/demo.no-credentials.spec.ts`                  |
| `@ORB-A11Y-001 @ORB-A11Y-002 @ORB-A11Y-005 @ORB-A11Y-006 @ORB-GOV-006` axe zero violations in each of the 9 states; keyboard-only approve/deny with visible focus; success/error icon + text; live region names the tool                                       | e2e                      | ORB-A11Y-001, ORB-A11Y-002, ORB-A11Y-005, ORB-A11Y-006, ORB-GOV-006                           | `tests/e2e/a11y.spec.ts`                                 |
| `@ORB-A11Y-003 @ORB-A11Y-004 @ORB-A11Y-007` reduced-motion emulation: uniforms zero, instant formation per state, text per state, snapshot trace identical to full motion, runtime flip back                                                                   | e2e                      | ORB-A11Y-003, ORB-A11Y-004, ORB-A11Y-007                                                      | `tests/e2e/reduced-motion.spec.ts`                       |
| `@ORB-API-001 @ORB-API-004 @ORB-PLAY-002 @ORB-TOOLVIS-003` playground manual/mock provenance in the browser; `specVersion`; tool visual mapping changes formation only                                                                                         | e2e                      | ORB-API-001, ORB-API-004, ORB-PLAY-002, ORB-TOOLVIS-003                                       | `tests/e2e/public-api.spec.ts`                           |
| `@ORB-PERF-002 @ORB-PERF-006` Pixel 7 emulation auto-selects `mobile-default`; `?preset=mobile-low` honoured; frames advance; run completes with touch                                                                                                         | e2e                      | ORB-PERF-002, ORB-PERF-006                                                                    | `tests/e2e/mobile-preset.spec.ts`                        |
| `@ORB-RENDER-006 @ORB-A11Y-006 @ORB-ARCH-005` WebGL disabled: fallback visible, full governed run with approvals via text UI, no pageerror                                                                                                                     | e2e                      | ORB-RENDER-006, ORB-A11Y-006, ORB-ARCH-005                                                    | `tests/e2e/no-webgl.spec.ts`                             |
| `@ORB-A11Y-001` Lighthouse accessibility ≥ 0.95 on `/` and `/playground` (median of 3)                                                                                                                                                                         | e2e (lhci)               | ORB-A11Y-001                                                                                  | `.lighthouserc.cjs` (CI job `lighthouse`)                |

CI: all unit/integration/arch tests in the Vitest job (fake `Clock`/`Scheduler`, `Prng(1)`, fast-check `numRuns` 200 with `FC_SEED` printed); `api-surface.dts.test.ts` runs after `pnpm api:dts` in the same job; Playwright projects `chromium-swiftshader`, `chromium-nowebgl`, `mobile-pixel7` on every PR against `next build && next start` with `NEXT_PUBLIC_ORB_SEED=1` and an otherwise empty env; `lighthouse` job after build. Determinism: every E2E uses `?sequencer=manual&preset=ci&seed=1&adaptive=0&debug=1`, advances the mock only through `__orbDebug.sequencer.step()` / `flushEngine()`, asserts with `expect.poll` on `__orbDebug` and DOM text, never `waitForTimeout`, never `page.clock` mixed with frame-count assertions. Manual: none required for G4 (screen-reader checklist is Wave 8).

## 8. ADRs to record

- ADR-0011 — Public API stability policy: **context** ORB-API-001 requires a frozen §22 surface from `engine/index.ts` and §28 rule 10 requires releases to record the spec version; waves 5–8 must add behaviour without breaking hosts; **options** (a) api-extractor with an `.api.md` report (heavy toolchain, designed for packages), (b) committed runtime-keys + `.d.ts` snapshots regenerated by `pnpm api:update` with a CHANGELOG entry, (c) review-only; **recommendation** (b) now — semver for the surface (`SPEC_VERSION` bumps with SPEC.md, package version follows semver at extraction), additive optional members allowed in a minor, removals/renames only in a major with a deprecation cycle of one minor; api-extractor reconsidered at Wave 8 extraction (ADR-0003).

## 9. Deliverables

- `engine/OrbEngine.ts` (complete facade, `OrbEngineError`, `SPEC_VERSION`, debug snapshot), `engine/index.ts` (frozen), `engine/OrbController.ts` (real renderer wiring, settle, override, motion), `engine/visual-policy/apply.ts`, `engine/ports/MotionPreferencePort.ts`, `engine/render/matchMediaMotion.ts`, `core/scheduler.ts` (`createManualScheduler`), `core/limits.ts` (`SETTLE_MS`, `SETTLE_MS_MAX`).
- `app/page.tsx`, `app/_lib/searchParams.ts`, `app/_lib/demoConfig.ts`, `app/playground/page.tsx` (rewired), `components/demo/{DemoApp,DemoControls,DemoNotice,useDemoRuntime}.tsx`, `components/orb/useOrbEngine.ts` (adapter attach/detach, StrictMode-safe), `components/store/orbStore.ts` (adapter/demo slices, `decide`), `components/a11y/ProvenanceBadge.tsx` (persistent simulated mode), `components/playground/{StatePanel,MockEventsPanel,ToolVisualPanel}.tsx`.
- Tests and fixtures of §7; `tests/e2e/fixtures/demo.ts`; `tests/fixtures/api/{engine-index.exports.json,OrbEngine.members.json,engine-index.d.ts}`; `tsconfig.api.json`; `package.json` scripts `api:dts`, `api:update`; `playwright.config.ts` projects `chromium-nowebgl`, `mobile-pixel7`; `.lighthouserc.cjs`; `.github/workflows/ci.yml` (`lighthouse` job, new projects).
- `docs/adr/0011-public-api-stability.md`; `docs/reference/engine-api.md` (the §4.2 table, generated header from the `.d.ts` snapshot); `docs/reference/demo-query-params.md`; `docs/security/threats/demo-and-public-api.md`; `docs/how-to/embed-in-your-app.md` (minimal host: `new OrbEngine`, `emit`, `subscribe`, `onApprovalDecision`).
- `specs/TRACEABILITY.md` regenerated; `specs/requirement-ids.lock` unchanged; `CHANGELOG.md` "Public API" section started; `README.md` quick-start pointing at `/` (no credentials).

## 10. Exit criteria (Gate G4)

1. `api-surface.snapshot.test.ts` and `api-surface.dts.test.ts` green with fixtures committed; `OrbEngine.SPEC_VERSION === '0.2.0'`; `docs/reference/engine-api.md` matches the `.d.ts` snapshot (CI diff).
2. `visual-never-semantic.test.ts` green (200 fast-check runs): morph completion, settle and motion changes leave `OrbSnapshot` unchanged; manual state changes only the display projection, never the retained semantic state, operation ledger or outcome (ORB-ARCH-004).
3. `wiring.visual.test.ts`, `settle.test.ts`, `motionPreference.test.ts`, `OrbEngine.{headless,errors,setState,adapter,decision}.test.ts` green.
4. `sequence.test.ts` green for `governed`, `denied`, `tool-failure` and approval-off traces; `searchParams.test.ts` and `governance.test.tsx` green.
5. `demo-boundaries.test.ts` and `pnpm arch` green with the new `engine/render/matchMediaMotion.ts` and `components/demo/**` rules.
6. E2E green in CI under SwiftShader: `demo-governance.spec.ts`, `demo.no-credentials.spec.ts`, `a11y.spec.ts`, `reduced-motion.spec.ts`, `public-api.spec.ts`; `mobile-preset.spec.ts` on `mobile-pixel7`; `no-webgl.spec.ts` on `chromium-nowebgl`; zero `pageerror`, zero axe violations.
7. `demo.no-credentials.spec.ts` proves the production build runs the governed sequence with an empty env and every non-localhost request aborted (ORB-DEMO-001, ORB-SEC-006).
8. Lighthouse accessibility ≥ 0.95 on `/` and `/playground` (median of 3) recorded as a CI artefact.
9. `pnpm req:coverage`: every MUST in §3 covered (unit/integration + E2E where user-observable); ORB-GOV-001…010 each show ≥ 1 E2E from this wave; no uncovered MUST; `specs/TRACEABILITY.md` regenerated.
10. ADR-0011 accepted; `docs/security/threats/demo-and-public-api.md` merged; `docs/how-to/embed-in-your-app.md` and `docs/reference/demo-query-params.md` published.
11. Fresh-clone check recorded in the PR: `git clone && pnpm install --frozen-lockfile && pnpm build && pnpm start` with no `.env` serves `/` and the run completes (reviewer sign-off).
12. `CHANGELOG.md` records the frozen API and the demo; `pnpm api:update` documented in `CONTRIBUTING.md`.

## 11. Risks, spikes and open questions

- Risk: Wave 1 controller and Wave 3 manager were built against fakes and meet for the first time here → spike: integration harness first (`wiring.visual.test.ts` skeleton, day 1); owner: Track A.
- Risk: Lighthouse scores vary under SwiftShader/CI load → run against the static production build, 3 runs, assert the median; fixed viewport; owner: ADR-0004 conventions.
- Risk: StrictMode double mount attaches two adapters or leaks timers → `useOrbEngine` cleanup detaches + disposes; Wave 2 StrictMode test extended to assert one `connect()`; owner: Track B.
- Risk: settle timer races E2E assertions on `formation.active` after `success` → manual mode routes engine timers to a second `ManualScheduler` (`flushEngine()`); auto mode never asserted in E2E; owner: 4.3.
- Risk: `matchMedia` change events not emulated consistently across Playwright versions → `reduced-motion.spec.ts` also covers the `?reducedMotion=on` path so the assertion does not depend on emulation alone.
- Spike: `.d.ts` snapshot stability across TypeScript minor upgrades (comment/ordering churn) → pin `typescript` exact version; if churn appears, switch to api-extractor per ADR-0011 fallback.
- Q-1 resolved in the proposed plan: ORB-A11Y-007 belongs to W4 §4.5, with W2/W5 mechanism tests.
- Q-2 resolved in the proposed amendment: ORB-API-001 includes `decideApproval` and the W2 public controls; W4 freezes their cumulative surface. Acceptance of the amendment remains the W0 review gate.
- Q-3 (Wave 1 ↔ Wave 4 integration): the name of the `MockAdapter` script trigger (assumed `run(): void`, no-op while running) and whether options can change between runs (assumed no: the demo rebuilds the adapter). Resolved by whichever Wave 1 ships; this file is updated in the 4.3 PR.
- Q-4 (spec-amendment wording): ORB-STATE-008 names `success`/`error` for the settle; default assumed both settle to `sphere` after `settleMs`; if the maintainer prefers `error` to persist visually, `settle` is limited to `success` (one-line change, tests parameterised).
- Q-5 (user): keep `?debug=1` (read-only snapshot, mock only) enabled on the public deploy? Default yes; Wave 8 may gate it behind `NEXT_PUBLIC_ORB_DEBUG`.
- Q-6 (CI tooling): `@lhci/cli` (default) vs `playwright-lighthouse`; either satisfies G4 item 8.

## 12. Playground and demo controls introduced

- Demo `/`: "Run AI Sequence" button; "Require approval" switch (default on; off = simulated auto-approval, labelled); "Scenario" select (`governed`, `tool-failure`); persistent "Simulated" badge; preset readout ("Quality: mobile-default (auto)"); parameter notice; capability fallback region. Query parameters: `seed`, `preset`, `adaptive`, `sequencer`, `debug`, `reducedMotion`, `scenario`, `approval` (`adapter` reserved for Wave 7).
- Playground `/playground`: `StatePanel` (9 "Set <state> (manual)" buttons + provenance/anomaly readout), `MockEventsPanel` (type, correlationId, tool, label → "Emit (simulated)", `EmitResult` readout, disabled with a live adapter), `ToolVisualPanel` (tool → formation mapping editor); the same demo controls and a11y panel as `/`; Wave 2 `MotionPanel` override now rebuilds the engine with `reducedMotion: 'auto' | 'on' | 'off'`.
- Debug snapshot: `window.__orbDebug.engine` (`specVersion`, `capabilities`, `adapter`, `motion`, `preset`), `.snapshot` (`OrbSnapshot`), `.visual` (`VisualLayerState`), `.demo` (`scenario`, `requireApproval`, `running`, `params`), `.sequencer` (`mode`, `pending()`, `step()`, `flushEngine()`; manual mode only).
