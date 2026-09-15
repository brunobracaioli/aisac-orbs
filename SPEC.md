# AISAC Orbs — Specification

**Status:** Draft

**Version:** 0.2.0

**Repository:** `aisac-orbs`

**License target:** Apache-2.0

**Reference stack:** TypeScript, Next.js, Three.js, React Three Fiber, GLSL

> **A state-aware, GPU-accelerated particle interface for AI agents.**

## 1. Purpose

AISAC Orbs is an open-source visual runtime that represents observable AI-agent and application states through an interactive GPU-rendered particle system.

It translates real events—listening, model processing, tool requests, approvals, execution, success, failure, and assistant speech—into explicit visual states.

AISAC Orbs does **not** claim to visualize hidden reasoning, chain-of-thought, neural-network internals, or literal neural activity.

**Core principle:** The AI/application determines what is happening. The Orb Engine determines how that state is represented.

## 2. Normative language

**MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** indicate requirement levels.

## 3. Goals

V1 MUST:

1. Render thousands of animated particles efficiently in-browser.
2. Morph particles between predefined and custom formations.
3. Represent agent lifecycle states through a deterministic state controller.
4. Normalize provider events into a provider-independent event model.
5. Distinguish tool proposal, approval, execution, and result.
6. Provide a credential-free mock/demo mode.
7. Remain independent of any specific AI provider or agent framework.
8. Support pointer interaction and audio-reactive behavior.
9. Provide a developer playground.
10. Be suitable for later extraction into a reusable package.

## 4. Non-goals

V1 MUST NOT claim to expose hidden model reasoning, infer tool success from animation timing, authorize privileged actions from visual state, require a remote GPU, require an AI provider for the demo, or couple the Orb Engine directly to provider SDKs.

## 5. Architecture

```text
AI / AGENT
    │ provider events
    ▼
ADAPTER + EVENT LAYER
    │ normalized OrbEvent
    ▼
STATE CONTROLLER
    │ OrbState
    ▼
ORB ENGINE
    │ particles / formations / shaders / audio
    ▼
WEBGL CANVAS + ACCESSIBLE HTML UI
```

- **ORB-ARCH-001** — Orb Engine MUST NOT import an AI provider SDK.
- **ORB-ARCH-002** — Provider-specific behavior MUST live behind adapters.
- **ORB-ARCH-003** — State Controller MUST consume normalized `OrbEvent` objects.
- **ORB-ARCH-004** — Rendering MUST NOT be authoritative evidence of backend execution.
- **ORB-ARCH-005** — Semantic HTML/UI MUST remain separable from WebGL rendering.

## 6. Reference stack

| Layer             | Technology              |
| ----------------- | ----------------------- |
| Application       | Next.js                 |
| Language          | TypeScript              |
| Rendering         | Three.js                |
| React integration | React Three Fiber       |
| GPU effects       | GLSL / `ShaderMaterial` |
| State             | Zustand or equivalent   |
| Audio             | Web Audio API           |
| Styling           | Tailwind CSS            |
| Unit tests        | Vitest                  |
| E2E               | Playwright              |

Direct Three.js MAY be used in rendering-critical paths.

## 7. Canonical states

```ts
export type OrbState =
  | "idle"
  | "listening"
  | "thinking"
  | "tool_call"
  | "waiting_approval"
  | "executing"
  | "success"
  | "error"
  | "speaking";
```

- **ORB-STATE-001** — State transitions MUST be deterministic from normalized events.
- **ORB-STATE-002** — Every state MUST define a default visual configuration.
- **ORB-STATE-003** — `tool_call`, `waiting_approval`, and `executing` MUST remain distinct.
- **ORB-STATE-004** — `success` MUST only follow authoritative success.
- **ORB-STATE-005** — Active-operation metadata SHOULD be retained for accessible UI.

- **ORB-STATE-006** — `OrbState` MUST be exactly the closed set `idle, listening, thinking, tool_call, waiting_approval, executing, success, error, speaking`. Adapters, visual policy, hosts and playground MUST NOT add, alias, or remove states; an exhaustive `switch` over `OrbState` MUST compile without a default branch.
- **ORB-STATE-007** — State transitions MUST follow Appendix A exhaustively: every (state, event) pair yields exactly one result — next state, snapshot effects, and anomaly code — computed by the pure function `transition(snapshot, event, ctx)`. Pairs marked rejected or no-op MUST return the snapshot unchanged. Appendix A is normative; an implementation that differs from it MUST amend the appendix first (§28 rule 7).
- **ORB-STATE-008** — `success` and `error` MUST persist as semantic state until the next accepted event. The State Controller MUST NOT run any timer that changes `OrbSnapshot.state`. A visual return to the idle formation after `success`/`error` (settle) is cosmetic: it MUST NOT change `state`, `lastOutcome`, or accessible text, and it MUST be driven by the injected `Scheduler`, never by wall-clock reads.

## 8. Visual-state model

```ts
export interface OrbVisualState {
  formation: FormationId;
  rotationSpeed: number;
  turbulence: number;
  pulseStrength: number;
  connectionDensity: number;
  particleScale: number;
  morphDurationMs: number;
}
```

Visual defaults are specified by ORB-VISUAL-002 and Appendix C.1.

- **ORB-VISUAL-001** — Every `OrbState` MUST resolve to an `OrbVisualState` with the fields and units of Appendix C.2 (`formation: FormationId`, `rotationSpeed` rad/s, `turbulence` 0–1, `pulseStrength` 0–1, `connectionDensity` 0–1, `particleScale` multiplier with 1 = preset default, `morphDurationMs` ms). The applied visual layer MUST resolve in this order: state default → registered tool visual (`tool_call` only) → host override → motion preference (ORB-A11Y-007). `OrbSnapshot.visual` retains semantic defaults; applied overrides MUST NOT rewrite it. Resolution MUST be pure and MUST NOT read the snapshot's provenance to alter semantics.
- **ORB-VISUAL-002** — `STATE_VISUAL_DEFAULTS` SHOULD map `idle→sphere`, `listening→rings`, `thinking→neural`, `tool_call→polyhedron` (or the registered tool visual), `waiting_approval→gate`, `executing→network`, `success→collapse`, `error→error-distortion`, `speaking→face` (Appendix C.1). Hosts MAY override any entry; an override MUST NOT change semantic state or provenance.

## 9. Particle renderer

Reference path:

```text
THREE.Points + THREE.BufferGeometry + THREE.ShaderMaterial
```

Particle data SHOULD include position, target position, size, brightness, phase, and random seed.

- **ORB-RENDER-001** — Rendering MUST use GPU-accelerated browser graphics.
- **ORB-RENDER-002** — MUST NOT create one independent Three.js `Mesh` per particle.
- **ORB-RENDER-003** — Particle count MUST be configurable.
- **ORB-RENDER-004** — Formation changes MUST NOT recreate the renderer.
- **ORB-RENDER-005** — Render loop MUST remain independent of AI network latency.
- **ORB-RENDER-006** — Unsupported graphics capability MUST fail gracefully.

- **ORB-RENDER-007** — Per-particle GPU attributes SHOULD be `position`, `aTarget` (target position), `aSize`, `aBrightness`, `aPhase`, `aSeed`, uploaded as `BufferAttribute`s of one `BufferGeometry`; per-frame animation SHOULD be computed in the vertex shader from uniforms (Appendix C.3), not by CPU writes to `position`.
- **ORB-RENDER-008** — Changing the particle count at runtime MUST reallocate particle buffers (up to the configured maximum, else `setDrawCount`), place every particle instantly on the active formation without a morph, and MUST NOT recreate the WebGL context, `WebGLRenderer`, or `<canvas>`. "Renderer" in ORB-RENDER-004 and ORB-FORM-006 means exactly that triple.

## 10. Performance

| Preset          |       Target particles |
| --------------- | ---------------------: |
| Mobile low      |                  3,000 |
| Mobile default  |                  5,000 |
| Desktop default |                 15,000 |
| Desktop high    |                 30,000 |
| Desktop ultra   | 50,000+ when supported |

- **ORB-PERF-001** — Desktop SHOULD target 60 FPS.
- **ORB-PERF-002** — Mobile SHOULD target 30–60 FPS.
- **ORB-PERF-003** — Adaptive quality SHOULD react to sustained frame degradation.
- **ORB-PERF-004** — Pointer feedback SHOULD appear within 50 ms when hardware permits.
- **ORB-PERF-005** — Particle count, connections, shader complexity, and post-processing SHOULD degrade independently.

- **ORB-PERF-006** — Quality presets SHOULD be `mobile-low` 3 000, `mobile-default` 5 000, `desktop-default` 15 000, `desktop-high` 30 000, `desktop-ultra` 50 000 (when `CapabilityReport` permits), plus `ci` 2 000 with no connections, no post-processing and shader tier `basic`, used by automated tests. The initial preset SHOULD be chosen from `CapabilityReport` (mobile heuristic + device memory) and MUST be overridable by the host and by `?preset=`.

## 11. Formation system

```ts
export type Formation = Float32Array;
```

The coordinate layout and normalization contract is ORB-FORM-008 below; its MUST level supersedes the earlier unnumbered SHOULD.

V1 MUST include `sphere`, `rings`, `neural`, `polyhedron`, `network`, and `face`.

V1 SHOULD include `aisac`, `explosion`, `collapse`, and `error-distortion`.

- **ORB-FORM-001** — Engine MUST support morphing between formations.
- **ORB-FORM-002** — Morph duration MUST be configurable.
- **ORB-FORM-003** — Custom SVG formations MUST be supported.
- **ORB-FORM-004** — Imported coordinates MUST be normalized.
- **ORB-FORM-005** — Point-count mismatch MUST use deterministic sampling/downsampling.
- **ORB-FORM-006** — Morphing MUST preserve the running renderer.
- **ORB-FORM-007** — Formation assets MUST NOT execute arbitrary code.

- **ORB-FORM-008** — A `Formation` MUST be a `Float32Array` of length `N × 3` (x, y, z interleaved, particle `i` at `[3i, 3i+1, 3i+2]`), containing only finite values, normalized to the unit sphere (max radius 1, centroid at the origin). `FormationId` MUST be a branded string validated against the registry (Appendix C.1).
- **ORB-FORM-009** — V1 MUST ship the built-in formations `sphere`, `rings`, `neural`, `polyhedron`, `network`, `face`; each MUST be available at every preset particle count without runtime assets other than `assets/formations/face.svg`.
- **ORB-FORM-010** — V1 SHOULD ship `aisac`, `explosion`, `collapse`, `error-distortion`, `gate`, and `generic-tool`; when absent, the visual defaults of Appendix C.1 fall back to `polyhedron` (`gate`, `generic-tool`) and `sphere` (others) without changing semantic state.
- **ORB-FORM-011** — Sampling and downsampling (ORB-FORM-005) MUST be seeded: `seed = prng.fork(formationId)` from the engine `Prng` (mulberry32), the engine seed MUST be configurable (`OrbEngineOptions.seed`, `?seed=` in demo and playground), and equal `(input, N, seed)` MUST produce byte-identical `Formation`s across runs and engines. `Math.random` MUST NOT be used in `engine/`, `formations/`, `audio/` or `pointer/`.

## 12. Morphing

Conceptually:

```glsl
vec3 position = mix(currentPosition, targetPosition, morphProgress);
```

- **ORB-MORPH-001** — Morph progress conceptually ranges `0.0–1.0`.
- **ORB-MORPH-002** — Interrupting a morph MUST continue from the visually current state without snapping.
- **ORB-MORPH-003** — Morph completion MUST be observable.
- **ORB-MORPH-004** — Morph completion MUST NOT imply backend completion.

## 13. SVG formations

```text
SVG → parse inert geometry → sample → normalize → map particles → Formation
```

- **ORB-SVG-001** — Trusted local SVG assets MUST be supported.
- **ORB-SVG-002** — Untrusted SVG MUST be sanitized or parsed as inert geometry.
- **ORB-SVG-003** — Logos, icons, faces, and line art SHOULD be representable.
- **ORB-SVG-004** — Configurable depth/noise SHOULD give 2D shapes spatial presence.

The initial face pipeline is specified by ORB-SVG-005 below.

- **ORB-SVG-005** — The built-in `face` formation SHOULD be produced by the trusted SVG pipeline from `assets/formations/face.svg` (optionally pre-baked to `.formation.json` at build time); it MUST pass ORB-SVG-002/ORB-SEC-005 fixtures like any other SVG.
- **ORB-SVG-006** — Untrusted SVG input MUST be rejected with a typed `FormationError` when it exceeds 2 MiB, 5 000 elements, 200 000 path commands, or 200 000 sampled points; `DOCTYPE`, entity declarations, `<script>`, `<foreignObject>`, `<use href>`, `<style>`, `on*` attributes and external references MUST be rejected or ignored without evaluation; parsing MUST run in a Web Worker with a 2 s timeout and MUST NOT fetch network resources unless the source is `{ url, trust }` and same-origin or explicitly allowed.

## 14. Event model

```ts
export type OrbEventSource = "adapter" | "mock" | "manual";

export interface OrbEvent<T = Record<string, unknown>> {
  type: OrbEventType;
  timestamp: number;
  id?: string;
  correlationId?: string;
  source?: OrbEventSource;
  metadata?: T;
}

export type OrbEventType =
  | "USER_SPEAKING"
  | "USER_STOPPED_SPEAKING"
  | "MODEL_STARTED"
  | "MODEL_COMPLETED"
  | "TOOL_REQUESTED"
  | "TOOL_STARTED"
  | "TOOL_COMPLETED"
  | "TOOL_FAILED"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "ASSISTANT_SPEAKING"
  | "ASSISTANT_STOPPED_SPEAKING"
  | "ERROR";
```

- **ORB-EVENT-001** — Events MUST contain timestamps.
- **ORB-EVENT-002** — Events SHOULD support correlation IDs.
- **ORB-EVENT-003** — Provider-native events MUST be normalized before State Controller.
- **ORB-EVENT-004** — Metadata MUST be treated as untrusted presentation data unless validated.
- **ORB-EVENT-005** — Execution events SHOULD be idempotently handled when IDs permit.

- **ORB-EVENT-006** — `OrbEvent` MUST be `{ type: OrbEventType; timestamp: number; id?: string; correlationId?: string; source?: OrbEventSource; metadata?: T }`, validated at `EventBus.emit` with `orbEventSchema` (zod). Invalid events, including re-entrant `emit` calls during dispatch, MUST be rejected with `EmitResult { accepted: false, reason: 'invalid' }` and MUST NOT throw into the caller or the render loop. `timestamp` is Unix epoch ms.
- **ORB-EVENT-007** — `OrbEventType` MUST be exactly the closed set of 14 values in §14. An event with any other `type` MUST be rejected (`reason: 'unknown_type'`), logged as `orb.bus.rejected`, and MUST NOT change the snapshot. Adapters MUST NOT introduce provider-specific types (§28 rule 8).
- **ORB-EVENT-008** — Every event MUST carry provenance `source ∈ { 'adapter', 'mock', 'manual' }`; an adapter that omits it is normalized to `'adapter'` at the adapter boundary; the mock adapter MUST set `'mock'`; `setState` MUST set `'manual'`; raw playground events MUST use `'mock'` in an explicitly simulated session (ORB-PLAY-002). `OrbSnapshot.provenance` MUST expose the source of the last accepted snapshot-changing event or manual override; accepted no-ops preserve the snapshot; the accessible UI MUST label `'mock'` as "Simulated" and `'manual'` as "(manual)" with icon + text, never colour alone.
- **ORB-EVENT-009** — The State Controller MUST process events in arrival order; `timestamp` MUST NOT be used to reorder, delay or drop events (it serves logging and metrics only). An event that cannot be applied in the current phase (Appendix A: rejected rows) MUST leave the snapshot unchanged, return `accepted: false` and be logged once as `orb.bus.rejected` with `{ type, state, correlationId, anomaly }`. Duplicate detection (ORB-EVENT-005) MUST be by `id` over a bounded LRU of 512 entries plus the phase rules of Appendix A.

## 15. Governance lifecycle

```text
thinking
 → TOOL_REQUESTED
 → tool_call
 → APPROVAL_REQUIRED (if policy requires)
 → waiting_approval
 → APPROVAL_GRANTED
 → TOOL_STARTED
 → executing
 → TOOL_COMPLETED / TOOL_FAILED
 → success / error
```

`APPROVAL_DENIED` terminates the proposed action without representing it as execution failure.

- **ORB-GOV-001** — Proposal and execution MUST be separate phases.
- **ORB-GOV-002** — Approval-required actions MUST NOT enter `executing` before approval and authoritative execution start.
- **ORB-GOV-003** — `success` MUST only follow authoritative successful execution.
- **ORB-GOV-004** — Approval denial MUST be a governance outcome, not tool failure.
- **ORB-GOV-005** — Visual state alone MUST NOT grant approval.
- **ORB-GOV-006** — Accessible UI SHOULD identify the active tool/action.

- **ORB-GOV-007** — `APPROVAL_DENIED` for the active operation in `waiting_approval` MUST close the operation with `lastOutcome.kind = 'denied'`, MUST move to `idle` (or to `tool_call` for the next pending operation, ORB-GOV-009), and MUST NOT enter `error`. The accessible UI MUST announce "Action denied: <tool>".
- **ORB-GOV-008** — An event is authoritative when `source ∈ { 'adapter', 'mock' }` and its `correlationId` matches the active operation. Only authoritative `TOOL_COMPLETED`, `TOOL_FAILED`, `APPROVAL_GRANTED`, `APPROVAL_DENIED` MUST advance or close an operation. Pointer, audio, morph completion, cosmetic timers and `setState` MUST NOT originate authoritative lifecycle events. Manual lifecycle events MUST be rejected (`manual_override`). The mock adapter/sequencer and raw playground controls MAY emit `source: 'mock'` lifecycle events only in an explicitly simulated session; the playground MUST NOT inject those events into a real-adapter session. Mock events are authoritative for the demo and MUST be labelled per ORB-EVENT-008.
- **ORB-GOV-009** — The controller MUST track exactly one `activeOperation` and a FIFO `pendingOperations` queue, both exposed on `OrbSnapshot`. `TOOL_REQUESTED` with a new `correlationId` while an operation is active MUST enqueue; lifecycle events for a pending operation MUST be rejected `out_of_phase` until it is promoted; the queue MUST be bounded to 32 entries, with excess `TOOL_REQUESTED` rejected `out_of_phase` without mutation; closing the active operation (`success`, `error`, `denied`) MUST promote the queue head to `tool_call` (phase `proposed`, `approvalStatus` as recorded); `ERROR` MUST abort the active operation and clear the queue. Events whose `correlationId` matches neither MUST be rejected `unknown_correlation`.
- **ORB-GOV-010** — Approval decisions MUST travel UI → application: `OrbEngine.onApprovalDecision(cb)` receives `ApprovalDecision { correlationId, decision, idempotencyKey }`; the engine MUST deliver it once via `AgentAdapter.respondToApproval` when present (host listeners then observe only); otherwise the host listener MUST forward it through its own channel. Activating an Approve/Deny control MUST NOT change `OrbSnapshot`; the state changes only when the authoritative `APPROVAL_GRANTED`/`APPROVAL_DENIED` returns through the adapter. Controls MUST be enabled only while `activeOperation.approvalStatus === 'pending'`.

Authoritative lifecycle events are defined by ORB-GOV-008; ORB-STATE-004, ORB-GOV-002 and ORB-GOV-003 use that definition. Only the retained semantic snapshot is reduced by Appendix A; manual display projections are separate.

### 15.1 Semantic contracts

The following declarations define the shared event, snapshot and approval contracts. They agree with the event and adapter excerpts in §§14 and 17.

```ts
export type OrbEventSource = "adapter" | "mock" | "manual";
export interface OrbEvent<T = Record<string, unknown>> {
  type: OrbEventType;
  timestamp: number;
  id?: string;
  correlationId?: string;
  source?: OrbEventSource;
  metadata?: T;
}
export interface OrbEventMetadata {
  tool?: string;
  label?: string;
  reason?: string;
  simulated?: boolean;
} // validated subset; strings ≤ 120 chars, printable
export type EmitResult =
  | { accepted: true; deduplicated: boolean }
  | { accepted: false; reason: "invalid" | "duplicate" | "out_of_phase" | "unknown_type" };

export type ApprovalStatus = "not_required" | "pending" | "granted" | "denied";
export interface ActiveOperation {
  correlationId: string;
  tool: string;
  approvalStatus: ApprovalStatus;
  phase: "proposed" | "awaiting_approval" | "executing";
  startedAt: number;
  source: OrbEventSource;
}
export interface LastOutcome {
  kind: "success" | "error" | "denied" | "aborted";
  correlationId?: string;
  tool?: string;
  at: number;
  source: OrbEventSource;
}
export interface OrbSnapshot {
  state: OrbState;
  previousState: OrbState | null;
  activeOperation: ActiveOperation | null;
  pendingOperations: ReadonlyArray<ActiveOperation>;
  lastOutcome: LastOutcome | null;
  userSpeaking: boolean;
  provenance: OrbEventSource | null;
  visual: OrbVisualState;
  updatedAt: number;
}
export interface TransitionResult {
  snapshot: OrbSnapshot;
  anomaly?: {
    code: "out_of_phase" | "unknown_correlation" | "duplicate" | "manual_override";
    message: string;
  };
}
export type NormalizedOrbEvent = OrbEvent<OrbEventMetadata> & { readonly source: OrbEventSource };
export interface TransitionContext {
  now: number;
  resolveVisual: (state: OrbState, op: ActiveOperation | null) => OrbVisualState;
}
export function transition(
  snapshot: OrbSnapshot,
  event: NormalizedOrbEvent,
  ctx: TransitionContext,
): TransitionResult; // Pure; Appendix A is normative; the resolver returns semantic defaults only

export type FormationId = string & { readonly __brand: "FormationId" };
export interface OrbVisualState {
  formation: FormationId;
  rotationSpeed: number;
  turbulence: number;
  pulseStrength: number;
  connectionDensity: number;
  particleScale: number;
  morphDurationMs: number;
}
export interface PointerForceConfig {
  radius: number;
  strength: number;
  mode: "repel" | "attract" | "wave";
}
export interface ApprovalDecision {
  correlationId: string;
  decision: "approve" | "deny";
  idempotencyKey: string;
}
export interface AgentAdapter {
  readonly name: string;
  readonly simulated: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(callback: (event: OrbEvent) => void): () => void;
  respondToApproval?(decision: ApprovalDecision): Promise<void>;
}
```

## 16. Tool visual registry

```ts
registerToolVisual({ tool: "web_search", formation: "radar" });
registerToolVisual({ tool: "database_query", formation: "data-grid" });
registerToolVisual({ tool: "execute_code", formation: "code-network" });
```

Unknown tools MUST fall back to a generic tool visual. Visual mappings MUST NOT modify execution policy.

- **ORB-TOOLVIS-001** — A `tool_call` operation whose `tool` has no registered visual MUST render the `generic-tool` formation (fallback `polyhedron` when absent). Registration state MUST NOT affect `OrbSnapshot`; `executing` keeps the state default `network` unless a host visual override is supplied.
- **ORB-TOOLVIS-002** — Visual mappings MUST NOT modify execution policy, approval requirements, or event handling; `registerToolVisual` MUST be a pure registry write with no side effect outside `engine/visual-policy`.
- **ORB-TOOLVIS-003** — The engine SHOULD expose `registerToolVisual({ tool: string; formation: FormationId })`; a `formation` not present in the registry SHOULD resolve to `generic-tool` and log `orb.visual.unregistered_formation` once. The §16 names `radar`, `data-grid`, `code-network` are examples, not built-ins.

## 17. Provider adapters

```ts
export interface AgentAdapter {
  readonly name: string;
  readonly simulated: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(callback: (event: OrbEvent) => void): () => void;
  respondToApproval?(decision: ApprovalDecision): Promise<void>;
}
```

- **ORB-ADAPTER-001** — A mock adapter MUST exist.
- **ORB-ADAPTER-002** — Reference project SHOULD include an OpenAI adapter.
- **ORB-ADAPTER-003** — Provider secrets MUST NOT ship in browser source.
- **ORB-ADAPTER-004** — Provider events MUST normalize into `OrbEvent`.
- **ORB-ADAPTER-005** — Disconnect MUST release owned listeners/resources.
- **ORB-ADAPTER-006** — Rendering MUST remain safe if provider connectivity fails.

- **ORB-ADAPTER-007** — Adapters MUST implement `AgentAdapter { readonly name; readonly simulated; connect(); disconnect(); subscribe(cb): unsubscribe; respondToApproval?(decision) }` (§2). `simulated` MUST be `true` for the mock adapter and `false` for adapters relaying a real application; events from a `simulated` adapter MUST carry `source: 'mock'`. `subscribe` MUST deliver events in the order the adapter received them.

The reference gateway uses a mock tool executor. Real actions require a host-provided executor and remain outside the default V1 implementation. Responses API streaming is the accepted U-2 transport; Realtime voice is deferred. Untrusted SVG upload is available in the gated playground only (U-3), not on the public demo page.

## 18. Audio reactivity

```text
microphone / assistant audio
 → Web Audio API / AnalyserNode
 → normalized amplitude/frequency data
 → shader uniforms
 → particles
```

Audio MAY affect radius, displacement, brightness, pulse, and wave propagation.

- **ORB-AUDIO-001** — Microphone access MUST require user permission.
- **ORB-AUDIO-002** — Engine MUST work without microphone permission.
- **ORB-AUDIO-003** — User and assistant audio SHOULD be distinguishable sources.
- **ORB-AUDIO-004** — Audio effects MUST NOT determine semantic agent state.

- **ORB-AUDIO-005** — Audio MAY modulate radius, displacement, brightness, pulse and wave propagation, exclusively through the shader uniforms `uAudioUser`, `uAudioAssistant`, `uAudioBands` fed by normalized `AudioFeatures` (0–1); it MUST NOT write to `OrbSnapshot` or `OrbVisualState` (ORB-AUDIO-004).

## 19. Pointer interaction

```ts
export interface PointerForceConfig {
  radius: number;
  strength: number;
  mode: "repel" | "attract" | "wave";
}
```

Displaced particles MUST return toward their active formation. Pointer interaction MUST NOT mutate semantic state. Touch SHOULD be supported.

- **ORB-POINTER-001** — Particles displaced by pointer forces MUST return toward their active formation once the pointer leaves or stops: with no pointer input, maximum displacement MUST fall below ε = 0.01 (unit-sphere units) within 2 s at any preset.
- **ORB-POINTER-002** — Pointer interaction MUST NOT mutate semantic state: no pointer input may change `OrbSnapshot` (identity-equal before and after), emit an `OrbEvent`, or call `respondToApproval`. Pointer effects live only in `uPointer*` uniforms.
- **ORB-POINTER-003** — Touch SHOULD be supported via Pointer Events (`pointerdown/move/up/cancel`, passive listeners); `pointercancel` MUST release the force.
- **ORB-POINTER-004** — `PointerForceConfig` MUST be `{ radius: number; strength: number; mode: 'repel' | 'attract' | 'wave' }` with `radius` in unit-sphere world units and `strength` ≥ 0; `OrbEngine.setPointerForce(config | null)` MUST apply it without re-creating the renderer; `null` disables pointer input.

## 20. Demo mode

A fresh clone MUST run without provider credentials.

```text
idle → listening → thinking → tool_call
→ waiting_approval → executing → success → speaking → idle
```

- **ORB-DEMO-001** — Credential-free demo MUST exist.
- **ORB-DEMO-002** — Simulated events MUST be identifiable as simulated where ambiguity could mislead.
- **ORB-DEMO-003** — Demo SHOULD expose `Run AI Sequence`.
- **ORB-DEMO-004** — Demo timing MUST NOT become authoritative execution logic.

- **ORB-DEMO-006** — The credential-free demo MUST run, through the mock adapter, the sequence `idle → listening → thinking → tool_call → waiting_approval → executing → success → speaking → idle` with approval **required by default** (the user activates Approve/Deny); disabling approval MUST be an explicit, labelled toggle whose auto-approval events are still emitted by the mock adapter with `source: 'mock'`. The denied and failed variants MUST be reachable from the same page.

## 21. Developer playground

The playground SHOULD expose state, formation, particle count, quality, turbulence, rotation, pulse, connection density, morph duration, pointer forces, audio reactivity, and mock lifecycle events.

Playground controls MUST NOT bypass production governance.

- **ORB-PLAY-001** — The playground SHOULD expose controls for: state (manual), formation, particle count, quality preset (+ adaptive on/off), turbulence, rotation, pulse, connection density, morph duration, pointer forces (radius, strength, mode), audio reactivity (mic toggle, synthetic source, gain), reduced-motion override, seed, mock lifecycle events (raw emit, governed sequences), tool visual registry, custom SVG upload, and a read-only `OrbSnapshot`/FPS/profile panel.
- **ORB-PLAY-002** — Playground controls MUST NOT bypass production governance: manual state changes go through `setState` (ORB-API-004, provenance `'manual'`); raw events emitted from the playground MUST carry `source: 'mock'`; the playground MUST NOT emit authoritative events with `source: 'adapter'` and MUST NOT call `respondToApproval` except through the same Approve/Deny controls as the demo.

## 22. Public engine API

The following facade is the cumulative public contract. Supporting type declarations are owned by the wave slices indexed in `specs/SHARED-CONTRACTS.md`; later waves implement reserved input/source capabilities without shrinking this surface.

```ts
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
  settleMs?: number;
  adaptive?: boolean;
  debug?: boolean;
  easing?: EasingId;
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
  setParticleCount(n: number): void;
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
  ): void;
  setReducedMotion(pref: "auto" | "on" | "off"): void;
  subscribeQuality(cb: (p: QualityProfile, d: QualityDecision | null) => void): () => void;
  setState(state: OrbState): void;
  morphTo(formation: FormationId | string, options?: { duration?: number }): Promise<MorphOutcome>;
  emit(event: OrbEvent): EmitResult;
  registerFormation(name: string, source: FormationSource): Promise<FormationId>;
  registerToolVisual(input: { tool: string; formation: FormationId | string }): void;
  attachAdapter(adapter: AgentAdapter): () => void;
  onApprovalDecision(callback: (decision: ApprovalDecision) => void): () => void;
  decideApproval(decision: ApprovalDecision): void;
  subscribe(callback: (snapshot: OrbSnapshot) => void): () => void;
  attachAudio(source: AudioSource): () => void;
  setPointerForce(config: PointerForceConfig | null): void;
  resize(): void;
  dispose(): void;
}
```

Custom formation registration and package extraction follow ORB-API-002 and ORB-API-003 below.

- **ORB-API-001** — `OrbEngine` MUST expose, from `engine/index.ts` only: `constructor(OrbEngineOptions)`, `capabilities`, `mode`, `setParticleCount`, `setQuality`, `setVisualOverride`, `setReducedMotion`, `subscribeQuality`, `setState`, `morphTo`, `emit`, `registerFormation`, `registerToolVisual`, `attachAdapter`, `onApprovalDecision`, `decideApproval`, `subscribe`, `attachAudio`, `setPointerForce`, `resize`, `dispose`, and static `SPEC_VERSION`. The constructor MUST NOT throw when WebGL is unavailable (`capabilities.webgl2 === false` → headless: state and accessible UI still work). Changes to this surface MUST bump the spec version and the API snapshot test.
- **ORB-API-002** — Custom formations SHOULD be registered with `registerFormation(name: string, source: FormationSource): Promise<FormationId>` where `FormationSource = Float32Array | FormationDefinition['points'] | { svg, trust, depth?, noise? } | { url, trust }`; untrusted sources MUST go through the Worker sampler (ORB-SVG-006); failures MUST reject with a typed `FormationError` and MUST NOT affect the running renderer.
- **ORB-API-003** — The engine SHOULD remain extractable as `@aisac/orbs`: `core/`, `events/`, `engine/`, `formations/`, `shaders/`, `pointer/`, `audio/` MUST NOT import `react`, `next`, `app/**`, `components/**`, `adapters/*/server/**` or any provider SDK; `engine/index.ts` MUST be the only public entry; the rule MUST be enforced in CI (`.dependency-cruiser.cjs`) and rehearsed by a package build before V1.0.
- **ORB-API-004** — `setState(state)` MUST be recorded as manual provenance: it sets `OrbSnapshot.state` and `provenance = 'manual'`, records anomaly `manual_override`, and MUST NOT open, advance or close an operation, MUST NOT write `lastOutcome`, and MUST NOT trigger approval or execution policy. The accessible UI MUST append "(manual)" to the announced state. `setState('success')` therefore never satisfies ORB-STATE-004. The controller MUST retain the semantic snapshot separately and reduce subsequent events against it; a manual display override MUST NOT change which Appendix A row applies.

## 23. Accessibility

The always-available semantic indicator follows ORB-A11Y-006 below.

- **ORB-A11Y-001** — States MUST have accessible textual equivalents.
- **ORB-A11Y-002** — Approval controls MUST be keyboard accessible.
- **ORB-A11Y-003** — `prefers-reduced-motion` MUST be respected.
- **ORB-A11Y-004** — Reduced-motion mode MUST preserve semantic state visibility.
- **ORB-A11Y-005** — Critical success/error information MUST NOT rely only on color.

- **ORB-A11Y-006** — Particles MUST NOT be the sole semantic state indicator: a `role="status"` live region MUST announce every accepted state change (state, active tool, approval status, last outcome, provenance label) and MUST be rendered even when WebGL is unavailable or the canvas is hidden.
- **ORB-A11Y-007** — Under reduced motion (`prefers-reduced-motion: reduce` or `reducedMotion: 'on'`) the engine MUST set `uMotionScale = 0`: formation changes are instantaneous (`morphDurationMs = 0`), `rotationSpeed`, `turbulence`, `pulseStrength`, pointer and audio displacement are 0, while formation changes and the accessible text still reflect every state (ORB-A11Y-004). Reduced motion MUST NOT alter `OrbSnapshot`.

## 24. Security

```text
Browser → server-side application/API → AI provider/tools
```

- **ORB-SEC-001** — Secret provider keys MUST NOT be embedded in client bundles.
- **ORB-SEC-002** — Tool execution MUST remain behind application-defined policy/authorization.
- **ORB-SEC-003** — Visual state MUST NOT constitute authorization.
- **ORB-SEC-004** — Untrusted labels/metadata MUST be safely rendered.
- **ORB-SEC-005** — Imported SVG MUST NOT execute scripts.
- **ORB-SEC-006** — Public demo MUST use mock data unless explicitly connected to a real backend.
- **ORB-SEC-007** — Approval/execution endpoints SHOULD protect against replay and duplicate execution.

- **ORB-SEC-008** — The topology MUST be `browser → server-side application/API → AI provider/tools`: browser code (including `adapters/openai.ts`) MUST talk only to the application's own server endpoints; provider credentials, tool execution and approval policy MUST live server-side (`app/api/**`, `adapters/*/server/**`); a bundle scan MUST fail CI when a server-only module or secret marker is reachable from the client bundle.

## 25. Repository structure

```text
aisac-orbs/
├── app/
│   ├── page.tsx
│   └── playground/
├── components/
├── engine/
│   ├── OrbEngine.ts
│   ├── OrbController.ts
│   ├── ParticleSystem.ts
│   ├── FormationManager.ts
│   ├── StateMachine.ts
│   └── EventBus.ts
├── formations/
├── shaders/
├── adapters/
│   ├── mock.ts
│   └── openai.ts
├── audio/
├── events/
├── assets/formations/
├── specs/
├── tests/
├── SPEC.md
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## 26. V1 acceptance criteria

V1 is complete when:

- GPU particle orb renders smoothly;
- at least six required formations work;
- morphing is interruption-safe;
- face formation works;
- pointer interaction works;
- canonical state machine is implemented;
- normalized event bus drives state;
- governed tool demo distinguishes request/approval/execution/result;
- audio affects particles;
- playground works;
- demo mode works without credentials;
- mobile quality preset works;
- reduced-motion behavior exists;
- provider secrets remain server-side;
- unit/E2E tests cover critical state and governance behavior;
- README, CONTRIBUTING, LICENSE, and this specification are present.

## 27. Implementation milestones

```text
V0.1  Particle renderer
V0.2  Formation generators + morphing
V0.3  Pointer interaction
V0.4  State machine
V0.5  Event bus
V0.6  Governed tool lifecycle demo
V0.7  Audio reactivity
V0.8  SVG → particle formations
V0.9  Provider adapter
V1.0  Public release
```

Future candidates: WebGPU renderer, npm package, formation SDK, additional agent-framework adapters, mesh/GLB sampling, and richer governance visualization.

## 28. Spec-driven development rules

1. `SPEC.md` is the source of truth for normative behavior.
2. Code MUST implement the specification; the specification MUST NOT merely document implementation retroactively.
3. New normative behavior MUST receive a stable requirement ID before merge.
4. Pull requests that alter normative behavior MUST update this specification.
5. Tests SHOULD reference requirement IDs where practical.
6. A requirement MUST NOT be silently weakened to make an implementation pass.
7. Intentional deviations MUST be documented in the PR and resolved by updating either the implementation or specification.
8. Provider adapters MUST NOT redefine canonical Orb semantics.
9. Visual polish MAY evolve without a spec revision when semantic behavior is unchanged.
10. Releases SHOULD record the specification version they implement.

## 29. Definition of the project

**AISAC Orbs is an event-driven visual runtime for AI agents—not merely an animated loading indicator.**

Its purpose is to make observable agent state, tool usage, execution boundaries, approvals, and interaction visible while preserving a strict separation between semantic application truth and visual representation.

## 30. Changelog

- **0.2.0** — amendments per `specs/SPEC-amendments-proposal.md`: 41 new IDs, transition table, provenance, governance, public API and accepted U-1–U-5 defaults. Existing requirement IDs and levels are preserved.

## Appendix A — Normative transition table (ORB-STATE-007)

### A.1 Rules that apply to every row

- **G1 Vocabulary.** Governance states = `{tool_call, waiting_approval, executing}`. Lifecycle events = `TOOL_REQUESTED, TOOL_STARTED, TOOL_COMPLETED, TOOL_FAILED, APPROVAL_REQUIRED, APPROVAL_GRANTED, APPROVAL_DENIED`. "matches active" = `e.correlationId === snapshot.activeOperation?.correlationId`; "matches pending" = a `pendingOperations` entry has that id; "cid" = `e.correlationId`; "e" = the event.
- **G2 Correlation required.** A lifecycle event without `correlationId` is rejected with `unknown_correlation` (ORB-GOV-009).
- **G3 Manual never governs.** A lifecycle event or `ERROR` with `source: 'manual'` is rejected with `manual_override` before any row applies (ORB-GOV-008, ORB-API-004). Non-lifecycle events with `source: 'manual'` are accepted and set `provenance = 'manual'`.
- **G4 Anomaly resolution "†"** for a rejected lifecycle event: `duplicate` when cid equals `lastOutcome.correlationId` or the row says so; otherwise `out_of_phase` when cid matches active or pending; otherwise `unknown_correlation`. At the bus, `EmitResult.reason` is `'out_of_phase'` for both `out_of_phase` and `unknown_correlation`, `'duplicate'` for `duplicate`, `'invalid'` for `manual_override`.
- **G4a Queue bound.** Rows 47, 61 and 75 additionally require `pendingOperations.length < 32`; overflow is rejected `out_of_phase`, with the identical snapshot.
- **G5 Closure and promotion "‡".** Closing the active operation (`TOOL_COMPLETED`, `TOOL_FAILED`, `APPROVAL_DENIED`) writes `lastOutcome`; if `pendingOperations` is non-empty its head becomes `activeOperation` (its recorded `approvalStatus`/phase kept: `not_required` → state `tool_call`) and the next state is `tool_call` instead of `success`/`error`/`idle`. `ERROR` never promotes (queue cleared).
- **G6 Common effects.** Every accepted, snapshot-changing row also sets `provenance = e.source`, `updatedAt = ctx.now`, `visual = ctx.resolveVisual(state, activeOperation)` (semantic defaults only) (ORB-VISUAL-001) and, when `state` changes, `previousState = prior state`. Rows marked "no-op" or "rejected" return the identical snapshot object. `tool = sanitize(e.metadata?.tool) ?? 'unknown'`.
- **G7 Logging.** The controller/bus performs these effects outside the pure reducer. Rejected rows log `orb.bus.rejected` (warn) with `{ type, state, correlationId, anomaly }`; accepted state changes log `orb.state.transition` (info) with `{ from, to, type, correlationId, source }`; no-ops log `orb.state.noop` (debug). No metadata strings > 120 chars; no PII.
- **Invariants** (property-tested over arbitrary event and explicit context sequences through `transition()` on the retained semantic snapshot; `setState` is a separate manual display projection outside this function and is covered by ORB-API-004; file `tests/unit/engine/state/transitions.property.test.ts`): I1 `activeOperation !== null ⇔ state ∈ governance states`; I2 `pendingOperations.length > 0 ⇒ activeOperation !== null`; I3 `state === 'executing' ⇒ activeOperation.phase === 'executing' ∧ approvalStatus ∈ {not_required, granted}`; I4 `state === 'waiting_approval' ⇒ approvalStatus === 'pending'`; I5 `state === 'success' ⇒ lastOutcome.kind === 'success'` and `state === 'error' ⇒ lastOutcome.kind ∈ {error, aborted}`; I6 `success` is reachable only via row 77; I7 `userSpeaking` never changes `state` by itself.

### A.2 Table (9 states × 14 events = 126 rows)

| #   | State              | Event                        | Guard / condition                                         | Next state         | Effects on snapshot                                                                                                                                              | Anomaly                                                                                          |
| --- | ------------------ | ---------------------------- | --------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | `idle`             | `USER_SPEAKING`              | –                                                         | `listening`        | userSpeaking = true                                                                                                                                              | –                                                                                                |
| 2   | `idle`             | `USER_STOPPED_SPEAKING`      | –                                                         | `idle`             | userSpeaking = false (no-op when already false)                                                                                                                  | –                                                                                                |
| 3   | `idle`             | `MODEL_STARTED`              | –                                                         | `thinking`         | no operation opened                                                                                                                                              | –                                                                                                |
| 4   | `idle`             | `MODEL_COMPLETED`            | –                                                         | `idle`             | no-op; snapshot unchanged                                                                                                                                        | –                                                                                                |
| 5   | `idle`             | `TOOL_REQUESTED`             | cid new (∉ active, pending, lastOutcome)                  | `tool_call`        | activeOperation = {correlationId, tool, approvalStatus: not_required, phase: proposed, startedAt: e.timestamp, source}                                           | – (else †)                                                                                       |
| 6   | `idle`             | `TOOL_STARTED`               | –                                                         | `idle`             | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 7   | `idle`             | `TOOL_COMPLETED`             | –                                                         | `idle`             | rejected; snapshot unchanged (never success without executing; ORB-STATE-004)                                                                                    | †                                                                                                |
| 8   | `idle`             | `TOOL_FAILED`                | –                                                         | `idle`             | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 9   | `idle`             | `APPROVAL_REQUIRED`          | –                                                         | `idle`             | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 10  | `idle`             | `APPROVAL_GRANTED`           | –                                                         | `idle`             | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 11  | `idle`             | `APPROVAL_DENIED`            | –                                                         | `idle`             | rejected; snapshot unchanged (never error; ORB-GOV-004)                                                                                                          | †                                                                                                |
| 12  | `idle`             | `ASSISTANT_SPEAKING`         | –                                                         | `speaking`         | no operation opened                                                                                                                                              | –                                                                                                |
| 13  | `idle`             | `ASSISTANT_STOPPED_SPEAKING` | –                                                         | `idle`             | no-op; snapshot unchanged (trailing stop signal)                                                                                                                 | –                                                                                                |
| 14  | `idle`             | `ERROR`                      | source ∈ {adapter, mock}                                  | `error`            | lastOutcome = {kind: error, at: e.timestamp, source}; no operation to abort                                                                                      | – (manual_override when source = manual)                                                         |
| 15  | `listening`        | `USER_SPEAKING`              | –                                                         | `listening`        | userSpeaking = true (no-op when already true)                                                                                                                    | –                                                                                                |
| 16  | `listening`        | `USER_STOPPED_SPEAKING`      | –                                                         | `idle`             | userSpeaking = false                                                                                                                                             | –                                                                                                |
| 17  | `listening`        | `MODEL_STARTED`              | –                                                         | `thinking`         | no operation opened                                                                                                                                              | –                                                                                                |
| 18  | `listening`        | `MODEL_COMPLETED`            | –                                                         | `listening`        | no-op; snapshot unchanged                                                                                                                                        | –                                                                                                |
| 19  | `listening`        | `TOOL_REQUESTED`             | cid new (∉ active, pending, lastOutcome)                  | `tool_call`        | activeOperation = {correlationId, tool, approvalStatus: not_required, phase: proposed, startedAt: e.timestamp, source}; userSpeaking unchanged                   | – (else †)                                                                                       |
| 20  | `listening`        | `TOOL_STARTED`               | –                                                         | `listening`        | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 21  | `listening`        | `TOOL_COMPLETED`             | –                                                         | `listening`        | rejected; snapshot unchanged (never success without executing; ORB-STATE-004)                                                                                    | †                                                                                                |
| 22  | `listening`        | `TOOL_FAILED`                | –                                                         | `listening`        | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 23  | `listening`        | `APPROVAL_REQUIRED`          | –                                                         | `listening`        | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 24  | `listening`        | `APPROVAL_GRANTED`           | –                                                         | `listening`        | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 25  | `listening`        | `APPROVAL_DENIED`            | –                                                         | `listening`        | rejected; snapshot unchanged (never error; ORB-GOV-004)                                                                                                          | †                                                                                                |
| 26  | `listening`        | `ASSISTANT_SPEAKING`         | –                                                         | `speaking`         | no operation opened; userSpeaking unchanged                                                                                                                      | –                                                                                                |
| 27  | `listening`        | `ASSISTANT_STOPPED_SPEAKING` | –                                                         | `listening`        | no-op; snapshot unchanged (trailing stop signal)                                                                                                                 | –                                                                                                |
| 28  | `listening`        | `ERROR`                      | source ∈ {adapter, mock}                                  | `error`            | lastOutcome = {kind: error, at: e.timestamp, source}; no operation to abort                                                                                      | – (manual_override when source = manual)                                                         |
| 29  | `thinking`         | `USER_SPEAKING`              | –                                                         | `listening`        | userSpeaking = true (barge-in, A-08)                                                                                                                             | –                                                                                                |
| 30  | `thinking`         | `USER_STOPPED_SPEAKING`      | –                                                         | `thinking`         | userSpeaking = false (no-op when already false)                                                                                                                  | –                                                                                                |
| 31  | `thinking`         | `MODEL_STARTED`              | –                                                         | `thinking`         | no-op; snapshot unchanged                                                                                                                                        | –                                                                                                |
| 32  | `thinking`         | `MODEL_COMPLETED`            | –                                                         | `idle`             | text-only turn completion (A-07)                                                                                                                                 | –                                                                                                |
| 33  | `thinking`         | `TOOL_REQUESTED`             | cid new (∉ active, pending, lastOutcome)                  | `tool_call`        | activeOperation = {correlationId, tool, approvalStatus: not_required, phase: proposed, startedAt: e.timestamp, source}                                           | – (else †)                                                                                       |
| 34  | `thinking`         | `TOOL_STARTED`               | –                                                         | `thinking`         | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 35  | `thinking`         | `TOOL_COMPLETED`             | –                                                         | `thinking`         | rejected; snapshot unchanged (never success without executing; ORB-STATE-004)                                                                                    | †                                                                                                |
| 36  | `thinking`         | `TOOL_FAILED`                | –                                                         | `thinking`         | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 37  | `thinking`         | `APPROVAL_REQUIRED`          | –                                                         | `thinking`         | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 38  | `thinking`         | `APPROVAL_GRANTED`           | –                                                         | `thinking`         | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 39  | `thinking`         | `APPROVAL_DENIED`            | –                                                         | `thinking`         | rejected; snapshot unchanged (never error; ORB-GOV-004)                                                                                                          | †                                                                                                |
| 40  | `thinking`         | `ASSISTANT_SPEAKING`         | –                                                         | `speaking`         | no operation opened                                                                                                                                              | –                                                                                                |
| 41  | `thinking`         | `ASSISTANT_STOPPED_SPEAKING` | –                                                         | `thinking`         | no-op; snapshot unchanged (trailing stop signal)                                                                                                                 | –                                                                                                |
| 42  | `thinking`         | `ERROR`                      | source ∈ {adapter, mock}                                  | `error`            | lastOutcome = {kind: error, at: e.timestamp, source}; no operation to abort                                                                                      | – (manual_override when source = manual)                                                         |
| 43  | `tool_call`        | `USER_SPEAKING`              | –                                                         | `tool_call`        | userSpeaking = true; operation and queue unchanged                                                                                                               | –                                                                                                |
| 44  | `tool_call`        | `USER_STOPPED_SPEAKING`      | –                                                         | `tool_call`        | userSpeaking = false (no-op when already false)                                                                                                                  | –                                                                                                |
| 45  | `tool_call`        | `MODEL_STARTED`              | –                                                         | `tool_call`        | rejected; snapshot unchanged (tool lifecycle has priority)                                                                                                       | out_of_phase                                                                                     |
| 46  | `tool_call`        | `MODEL_COMPLETED`            | –                                                         | `tool_call`        | no-op; snapshot unchanged (a turn may end after TOOL_REQUESTED)                                                                                                  | –                                                                                                |
| 47  | `tool_call`        | `TOOL_REQUESTED`             | cid new (∉ active, pending, lastOutcome)                  | `tool_call`        | pendingOperations += {correlationId, tool, approvalStatus: not_required, phase: proposed, startedAt: e.timestamp, source} (FIFO tail); activeOperation unchanged | – (else †)                                                                                       |
| 48  | `tool_call`        | `TOOL_STARTED`               | matches active ∧ approvalStatus ∈ {not_required, granted} | `executing`        | activeOperation.phase = executing                                                                                                                                | – (else †)                                                                                       |
| 49  | `tool_call`        | `TOOL_COMPLETED`             | –                                                         | `tool_call`        | rejected; snapshot unchanged (never success without executing; ORB-STATE-004)                                                                                    | †                                                                                                |
| 50  | `tool_call`        | `TOOL_FAILED`                | –                                                         | `tool_call`        | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 51  | `tool_call`        | `APPROVAL_REQUIRED`          | matches active ∧ approvalStatus = not_required            | `waiting_approval` | activeOperation.approvalStatus = pending; phase = awaiting_approval                                                                                              | – (else †: out_of_phase when granted)                                                            |
| 52  | `tool_call`        | `APPROVAL_GRANTED`           | –                                                         | `tool_call`        | rejected; snapshot unchanged                                                                                                                                     | duplicate when matches active ∧ granted; out_of_phase when matches active ∧ not_required; else † |
| 53  | `tool_call`        | `APPROVAL_DENIED`            | –                                                         | `tool_call`        | rejected; snapshot unchanged (never error; ORB-GOV-004)                                                                                                          | †                                                                                                |
| 54  | `tool_call`        | `ASSISTANT_SPEAKING`         | –                                                         | `tool_call`        | no-op; snapshot unchanged (governance state kept visible; ORB-STATE-003)                                                                                         | –                                                                                                |
| 55  | `tool_call`        | `ASSISTANT_STOPPED_SPEAKING` | –                                                         | `tool_call`        | no-op; snapshot unchanged (trailing stop signal)                                                                                                                 | –                                                                                                |
| 56  | `tool_call`        | `ERROR`                      | source ∈ {adapter, mock}                                  | `error`            | lastOutcome = {kind: aborted, correlationId, tool, at: e.timestamp, source}; activeOperation = null; pendingOperations = []; approval controls disabled          | – (manual_override when source = manual)                                                         |
| 57  | `waiting_approval` | `USER_SPEAKING`              | –                                                         | `waiting_approval` | userSpeaking = true; operation and queue unchanged                                                                                                               | –                                                                                                |
| 58  | `waiting_approval` | `USER_STOPPED_SPEAKING`      | –                                                         | `waiting_approval` | userSpeaking = false (no-op when already false)                                                                                                                  | –                                                                                                |
| 59  | `waiting_approval` | `MODEL_STARTED`              | –                                                         | `waiting_approval` | rejected; snapshot unchanged (tool lifecycle has priority)                                                                                                       | out_of_phase                                                                                     |
| 60  | `waiting_approval` | `MODEL_COMPLETED`            | –                                                         | `waiting_approval` | no-op; snapshot unchanged (a turn may end after TOOL_REQUESTED)                                                                                                  | –                                                                                                |
| 61  | `waiting_approval` | `TOOL_REQUESTED`             | cid new (∉ active, pending, lastOutcome)                  | `waiting_approval` | pendingOperations += {correlationId, tool, approvalStatus: not_required, phase: proposed, startedAt: e.timestamp, source} (FIFO tail); activeOperation unchanged | – (else †)                                                                                       |
| 62  | `waiting_approval` | `TOOL_STARTED`               | –                                                         | `waiting_approval` | rejected; snapshot unchanged; ORB-GOV-002 breach surfaced in the accessible UI                                                                                   | out_of_phase when matches active, else †                                                         |
| 63  | `waiting_approval` | `TOOL_COMPLETED`             | –                                                         | `waiting_approval` | rejected; snapshot unchanged (never success without executing; ORB-STATE-004)                                                                                    | †                                                                                                |
| 64  | `waiting_approval` | `TOOL_FAILED`                | –                                                         | `waiting_approval` | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 65  | `waiting_approval` | `APPROVAL_REQUIRED`          | –                                                         | `waiting_approval` | rejected; snapshot unchanged                                                                                                                                     | duplicate when matches active, else †                                                            |
| 66  | `waiting_approval` | `APPROVAL_GRANTED`           | matches active ∧ source ∈ {adapter, mock}                 | `tool_call`        | activeOperation.approvalStatus = granted; phase = proposed (NOT executing; ORB-GOV-002)                                                                          | – (else †)                                                                                       |
| 67  | `waiting_approval` | `APPROVAL_DENIED`            | matches active ∧ source ∈ {adapter, mock}                 | `idle` ‡           | lastOutcome = {kind: denied, correlationId, tool, at: e.timestamp, source}; activeOperation = null or promoted head (‡); approval controls hidden                | – (else †)                                                                                       |
| 68  | `waiting_approval` | `ASSISTANT_SPEAKING`         | –                                                         | `waiting_approval` | no-op; snapshot unchanged (governance state kept visible; ORB-STATE-003)                                                                                         | –                                                                                                |
| 69  | `waiting_approval` | `ASSISTANT_STOPPED_SPEAKING` | –                                                         | `waiting_approval` | no-op; snapshot unchanged (trailing stop signal)                                                                                                                 | –                                                                                                |
| 70  | `waiting_approval` | `ERROR`                      | source ∈ {adapter, mock}                                  | `error`            | lastOutcome = {kind: aborted, correlationId, tool, at: e.timestamp, source}; activeOperation = null; pendingOperations = []; approval controls disabled          | – (manual_override when source = manual)                                                         |
| 71  | `executing`        | `USER_SPEAKING`              | –                                                         | `executing`        | userSpeaking = true; operation and queue unchanged                                                                                                               | –                                                                                                |
| 72  | `executing`        | `USER_STOPPED_SPEAKING`      | –                                                         | `executing`        | userSpeaking = false (no-op when already false)                                                                                                                  | –                                                                                                |
| 73  | `executing`        | `MODEL_STARTED`              | –                                                         | `executing`        | rejected; snapshot unchanged (tool lifecycle has priority)                                                                                                       | out_of_phase                                                                                     |
| 74  | `executing`        | `MODEL_COMPLETED`            | –                                                         | `executing`        | no-op; snapshot unchanged (a turn may end after TOOL_REQUESTED)                                                                                                  | –                                                                                                |
| 75  | `executing`        | `TOOL_REQUESTED`             | cid new (∉ active, pending, lastOutcome)                  | `executing`        | pendingOperations += {correlationId, tool, approvalStatus: not_required, phase: proposed, startedAt: e.timestamp, source} (FIFO tail); activeOperation unchanged | – (else †)                                                                                       |
| 76  | `executing`        | `TOOL_STARTED`               | –                                                         | `executing`        | rejected; snapshot unchanged                                                                                                                                     | duplicate when matches active, else †                                                            |
| 77  | `executing`        | `TOOL_COMPLETED`             | matches active ∧ source ∈ {adapter, mock}                 | `success` ‡        | lastOutcome = {kind: success, correlationId, tool, at: e.timestamp, source}; activeOperation = null or promoted head (‡)                                         | – (else †)                                                                                       |
| 78  | `executing`        | `TOOL_FAILED`                | matches active ∧ source ∈ {adapter, mock}                 | `error` ‡          | lastOutcome = {kind: error, correlationId, tool, at: e.timestamp, source}; activeOperation = null or promoted head (‡)                                           | – (else †)                                                                                       |
| 79  | `executing`        | `APPROVAL_REQUIRED`          | –                                                         | `executing`        | rejected; snapshot unchanged                                                                                                                                     | out_of_phase when matches active, else †                                                         |
| 80  | `executing`        | `APPROVAL_GRANTED`           | –                                                         | `executing`        | rejected; snapshot unchanged                                                                                                                                     | out_of_phase when matches active, else †                                                         |
| 81  | `executing`        | `APPROVAL_DENIED`            | –                                                         | `executing`        | rejected; snapshot unchanged (never error; ORB-GOV-004)                                                                                                          | †                                                                                                |
| 82  | `executing`        | `ASSISTANT_SPEAKING`         | –                                                         | `executing`        | no-op; snapshot unchanged (governance state kept visible; ORB-STATE-003)                                                                                         | –                                                                                                |
| 83  | `executing`        | `ASSISTANT_STOPPED_SPEAKING` | –                                                         | `executing`        | no-op; snapshot unchanged (trailing stop signal)                                                                                                                 | –                                                                                                |
| 84  | `executing`        | `ERROR`                      | source ∈ {adapter, mock}                                  | `error`            | lastOutcome = {kind: aborted, correlationId, tool, at: e.timestamp, source}; activeOperation = null; pendingOperations = []; approval controls disabled          | – (manual_override when source = manual)                                                         |
| 85  | `success`          | `USER_SPEAKING`              | –                                                         | `listening`        | userSpeaking = true; lastOutcome retained                                                                                                                        | –                                                                                                |
| 86  | `success`          | `USER_STOPPED_SPEAKING`      | –                                                         | `success`          | userSpeaking = false (no-op when already false)                                                                                                                  | –                                                                                                |
| 87  | `success`          | `MODEL_STARTED`              | –                                                         | `thinking`         | no operation opened; lastOutcome retained                                                                                                                        | –                                                                                                |
| 88  | `success`          | `MODEL_COMPLETED`            | –                                                         | `success`          | no-op; snapshot unchanged                                                                                                                                        | –                                                                                                |
| 89  | `success`          | `TOOL_REQUESTED`             | cid new (∉ active, pending, lastOutcome)                  | `tool_call`        | activeOperation = {correlationId, tool, approvalStatus: not_required, phase: proposed, startedAt: e.timestamp, source}; lastOutcome retained                     | – (else †)                                                                                       |
| 90  | `success`          | `TOOL_STARTED`               | –                                                         | `success`          | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 91  | `success`          | `TOOL_COMPLETED`             | –                                                         | `success`          | rejected; snapshot unchanged (never success without executing; ORB-STATE-004)                                                                                    | †                                                                                                |
| 92  | `success`          | `TOOL_FAILED`                | –                                                         | `success`          | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 93  | `success`          | `APPROVAL_REQUIRED`          | –                                                         | `success`          | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 94  | `success`          | `APPROVAL_GRANTED`           | –                                                         | `success`          | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 95  | `success`          | `APPROVAL_DENIED`            | –                                                         | `success`          | rejected; snapshot unchanged (never error; ORB-GOV-004)                                                                                                          | †                                                                                                |
| 96  | `success`          | `ASSISTANT_SPEAKING`         | –                                                         | `speaking`         | no operation opened; lastOutcome retained                                                                                                                        | –                                                                                                |
| 97  | `success`          | `ASSISTANT_STOPPED_SPEAKING` | –                                                         | `success`          | no-op; snapshot unchanged (trailing stop signal)                                                                                                                 | –                                                                                                |
| 98  | `success`          | `ERROR`                      | source ∈ {adapter, mock}                                  | `error`            | lastOutcome = {kind: error, at: e.timestamp, source}; no operation to abort                                                                                      | – (manual_override when source = manual)                                                         |
| 99  | `error`            | `USER_SPEAKING`              | –                                                         | `listening`        | userSpeaking = true; lastOutcome retained                                                                                                                        | –                                                                                                |
| 100 | `error`            | `USER_STOPPED_SPEAKING`      | –                                                         | `error`            | userSpeaking = false (no-op when already false)                                                                                                                  | –                                                                                                |
| 101 | `error`            | `MODEL_STARTED`              | –                                                         | `thinking`         | no operation opened; lastOutcome retained                                                                                                                        | –                                                                                                |
| 102 | `error`            | `MODEL_COMPLETED`            | –                                                         | `error`            | no-op; snapshot unchanged                                                                                                                                        | –                                                                                                |
| 103 | `error`            | `TOOL_REQUESTED`             | cid new (∉ active, pending, lastOutcome)                  | `tool_call`        | activeOperation = {correlationId, tool, approvalStatus: not_required, phase: proposed, startedAt: e.timestamp, source}; lastOutcome retained                     | – (else †)                                                                                       |
| 104 | `error`            | `TOOL_STARTED`               | –                                                         | `error`            | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 105 | `error`            | `TOOL_COMPLETED`             | –                                                         | `error`            | rejected; snapshot unchanged (never success without executing; ORB-STATE-004)                                                                                    | †                                                                                                |
| 106 | `error`            | `TOOL_FAILED`                | –                                                         | `error`            | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 107 | `error`            | `APPROVAL_REQUIRED`          | –                                                         | `error`            | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 108 | `error`            | `APPROVAL_GRANTED`           | –                                                         | `error`            | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 109 | `error`            | `APPROVAL_DENIED`            | –                                                         | `error`            | rejected; snapshot unchanged (never error; ORB-GOV-004)                                                                                                          | †                                                                                                |
| 110 | `error`            | `ASSISTANT_SPEAKING`         | –                                                         | `speaking`         | no operation opened; lastOutcome retained                                                                                                                        | –                                                                                                |
| 111 | `error`            | `ASSISTANT_STOPPED_SPEAKING` | –                                                         | `error`            | no-op; snapshot unchanged (trailing stop signal)                                                                                                                 | –                                                                                                |
| 112 | `error`            | `ERROR`                      | source ∈ {adapter, mock}                                  | `error`            | lastOutcome = {kind: error, at: e.timestamp, source} (refreshed); state unchanged                                                                                | – (manual_override when source = manual)                                                         |
| 113 | `speaking`         | `USER_SPEAKING`              | –                                                         | `listening`        | userSpeaking = true (barge-in interrupts speech)                                                                                                                 | –                                                                                                |
| 114 | `speaking`         | `USER_STOPPED_SPEAKING`      | –                                                         | `speaking`         | userSpeaking = false (no-op when already false)                                                                                                                  | –                                                                                                |
| 115 | `speaking`         | `MODEL_STARTED`              | –                                                         | `thinking`         | no operation opened                                                                                                                                              | –                                                                                                |
| 116 | `speaking`         | `MODEL_COMPLETED`            | –                                                         | `speaking`         | no-op; snapshot unchanged (speech continues until ASSISTANT_STOPPED_SPEAKING)                                                                                    | –                                                                                                |
| 117 | `speaking`         | `TOOL_REQUESTED`             | cid new (∉ active, pending, lastOutcome)                  | `tool_call`        | activeOperation = {correlationId, tool, approvalStatus: not_required, phase: proposed, startedAt: e.timestamp, source}; speech representation dropped            | – (else †)                                                                                       |
| 118 | `speaking`         | `TOOL_STARTED`               | –                                                         | `speaking`         | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 119 | `speaking`         | `TOOL_COMPLETED`             | –                                                         | `speaking`         | rejected; snapshot unchanged (never success without executing; ORB-STATE-004)                                                                                    | †                                                                                                |
| 120 | `speaking`         | `TOOL_FAILED`                | –                                                         | `speaking`         | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 121 | `speaking`         | `APPROVAL_REQUIRED`          | –                                                         | `speaking`         | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 122 | `speaking`         | `APPROVAL_GRANTED`           | –                                                         | `speaking`         | rejected; snapshot unchanged                                                                                                                                     | †                                                                                                |
| 123 | `speaking`         | `APPROVAL_DENIED`            | –                                                         | `speaking`         | rejected; snapshot unchanged (never error; ORB-GOV-004)                                                                                                          | †                                                                                                |
| 124 | `speaking`         | `ASSISTANT_SPEAKING`         | –                                                         | `speaking`         | no-op; snapshot unchanged                                                                                                                                        | –                                                                                                |
| 125 | `speaking`         | `ASSISTANT_STOPPED_SPEAKING` | –                                                         | `idle`             | no operation opened; `userSpeaking` unchanged; lastOutcome retained                                                                                              | –                                                                                                |
| 126 | `speaking`         | `ERROR`                      | source ∈ {adapter, mock}                                  | `error`            | lastOutcome = {kind: error, at: e.timestamp, source}; no operation to abort                                                                                      | – (manual_override when source = manual)                                                         |

Table-driven test: `tests/unit/engine/state/transitions.table.test.ts` iterates a JSON export of this table (`tests/fixtures/state/transitions.json`, 126 entries) and asserts next state, effects and anomaly per row; the fixture is regenerated from this appendix and diffed in CI so the table and the code cannot drift silently (ORB-STATE-007).

## Appendix B — Requirement alias table

All 0.1.0 IDs stay stable (§28 rule 3). Where two IDs state the same obligation, the **primary** is the one tests cite first; the alias is listed in the same `req()` call so both count as covered. Coverage is credited only to IDs explicitly tagged in the passing test. The alias table does not automatically satisfy a second wave or substitute for that wave's acceptance evidence.

| Primary        | Alias                                                                             | Shared obligation                                | Test reference                            |
| -------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| ORB-STATE-004  | ORB-GOV-003                                                                       | `success` only after authoritative success       | `req('ORB-STATE-004', 'ORB-GOV-003')`     |
| ORB-SEC-001    | ORB-ADAPTER-003                                                                   | provider secrets never in client bundles         | `req('ORB-SEC-001', 'ORB-ADAPTER-003')`   |
| ORB-GOV-005    | ORB-SEC-003                                                                       | visual state is not authorization / approval     | `req('ORB-GOV-005', 'ORB-SEC-003')`       |
| ORB-RENDER-004 | ORB-FORM-006                                                                      | formation change / morph preserves the renderer  | `req('ORB-RENDER-004', 'ORB-FORM-006')`   |
| ORB-EVENT-003  | ORB-ADAPTER-004                                                                   | provider events normalized before the controller | `req('ORB-EVENT-003', 'ORB-ADAPTER-004')` |
| ORB-ARCH-001   | §4 "MUST NOT couple the Orb Engine directly to provider SDKs" (no ID, Appendix D) | engine never imports a provider SDK              | `req('ORB-ARCH-001')`                     |

Related but **not** aliases (kept as separate obligations with separate tests): ORB-EVENT-005 (client dedupe) vs ORB-SEC-007 (server replay protection); ORB-STATE-003 vs ORB-GOV-001 (distinct states vs distinct phases); ORB-A11Y-001 vs ORB-A11Y-006 (textual equivalents vs live region required even without WebGL); ORB-POINTER-002 vs ORB-AUDIO-004 (different input surfaces); ORB-TOOLVIS-002 vs ORB-SEC-002 (registry vs execution policy).

## Appendix C — FormationId registry and OrbVisualState units

### C.1 Built-in `FormationId`s (`BUILT_IN_FORMATIONS`)

| FormationId        | Level  | Default for state                                    | Notes                                                                                |
| ------------------ | ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `sphere`           | MUST   | `idle`                                               | also the base of the "orb waveform" (sphere + audio displacement)                    |
| `rings`            | MUST   | `listening`                                          | concentric rings, audio-reactive radius                                              |
| `neural`           | MUST   | `thinking`                                           | §8 "neural cloud"; no claim about model internals (§1)                               |
| `polyhedron`       | MUST   | `tool_call` (unless a tool visual is registered)     | fallback for `gate` and `generic-tool` when absent                                   |
| `network`          | MUST   | `executing`                                          | connection lines enabled via `connectionDensity`                                     |
| `face`             | MUST   | `speaking`                                           | produced by the trusted SVG pipeline from `assets/formations/face.svg` (ORB-SVG-005) |
| `gate`             | SHOULD | `waiting_approval`                                   | §8 "gate → approval"                                                                 |
| `generic-tool`     | SHOULD | `tool_call` with unregistered tool (ORB-TOOLVIS-001) | —                                                                                    |
| `aisac`            | SHOULD | —                                                    | from `assets/formations/aisac.svg`                                                   |
| `explosion`        | SHOULD | —                                                    | transient; playground and `error` variants                                           |
| `collapse`         | SHOULD | `success`                                            | settle target before the cosmetic return to `sphere` (ORB-STATE-008)                 |
| `error-distortion` | SHOULD | `error`                                              | —                                                                                    |

Rules: ids are lowercase kebab-case, ≤ 32 chars; custom ids registered via `registerFormation` MUST NOT shadow a built-in; §16 examples `radar`, `data-grid`, `code-network` are not built-ins. Registry lookup of an unknown id returns `Result { ok: false, error: FormationError('unknown_formation') }`, never throws in the render loop.

### C.2 `OrbVisualState` units

| Field               | Type / unit                                  | Range                      | Reduced-motion value (ORB-A11Y-007) |
| ------------------- | -------------------------------------------- | -------------------------- | ----------------------------------- |
| `formation`         | `FormationId`                                | registry                   | unchanged (still switches)          |
| `rotationSpeed`     | rad/s around the Y axis                      | 0–2                        | 0                                   |
| `turbulence`        | dimensionless noise amplitude                | 0–1                        | 0                                   |
| `pulseStrength`     | dimensionless radial pulse amplitude         | 0–1                        | 0                                   |
| `connectionDensity` | fraction of the pre-computed edge list drawn | 0–1                        | unchanged                           |
| `particleScale`     | multiplier over preset point size            | 0.25–4, 1 = preset default | unchanged                           |
| `morphDurationMs`   | milliseconds                                 | 0–10 000                   | 0                                   |

### C.3 Shader uniforms driven by `OrbVisualState`, pointer and audio

`uTime, uMorphProgress, uRotationSpeed, uTurbulence, uPulseStrength, uParticleScale, uMotionScale, uPointerPos, uPointerRadius, uPointerStrength, uPointerMode, uAudioUser, uAudioAssistant, uAudioBands` (`UniformName`). `uMotionScale ∈ {0, 1}` multiplies every animated term (ORB-A11Y-007).

## Appendix D — Statements deliberately not given IDs

| 0.1.0 location                                                                   | Why no ID                                                                                  | Traced to                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 core principle ("The AI/application determines what is happening…")           | product principle; every enforceable consequence has an ID                                 | ORB-ARCH-004, ORB-GOV-005, ORB-SEC-003, ORB-AUDIO-004, ORB-POINTER-002                                                                                                                                                 |
| §3 Goals 1–10                                                                    | umbrella statements; each is evidenced by section IDs                                      | 1→RENDER-001..003/PERF-001; 2→FORM-001/003/009; 3→STATE-001/007; 4→EVENT-003; 5→GOV-001..004; 6→DEMO-001; 7→ARCH-001/002; 8→POINTER-001..004/AUDIO-001..005; 9→PLAY-001; 10→API-003                                    |
| §4 Non-goals                                                                     | restatements of existing MUST NOTs                                                         | reasoning claims→docs review (README/CONTRIBUTING wording); timing→ARCH-004/MORPH-004/DEMO-004; authorization→GOV-005; remote GPU→RENDER-001 (client WebGL); provider for demo→DEMO-001/SEC-006; SDK coupling→ARCH-001 |
| §5 architecture diagram                                                          | informative; boundaries are ORB-ARCH-001..005 + `.dependency-cruiser.cjs`                  | ORB-ARCH-001..005, ORB-API-003                                                                                                                                                                                         |
| §6 reference stack table, "Direct Three.js MAY be used"                          | tooling choice; deviations recorded in ADR-0001/0002, not tested                           | ADR-0001, ADR-0002                                                                                                                                                                                                     |
| §12 `mix(currentPosition, targetPosition, morphProgress)`; §13 and §18 pipelines | conceptual illustrations; the enforceable parts are the MORPH/SVG/AUDIO IDs                | ORB-MORPH-001..004, ORB-SVG-001..006, ORB-AUDIO-001..005                                                                                                                                                               |
| §20 "A fresh clone MUST run without provider credentials."                       | same obligation as ORB-DEMO-001                                                            | ORB-DEMO-001 (E2E with network blocked)                                                                                                                                                                                |
| §25 repository structure                                                         | layout, not behaviour; roots kept, slices inside (`specs/SPEC-implementation-waves.md` §4) | ADR-0003, `.dependency-cruiser.cjs`                                                                                                                                                                                    |
| §26 acceptance bullets (16)                                                      | release checklist, each bullet mapped to IDs in `specs/TRACEABILITY.md`                    | Wave 8 gate                                                                                                                                                                                                            |
| §27 milestones                                                                   | scheduling input only; wave order differs (Wave 1 semantic core before pointer)            | `specs/SPEC-implementation-waves.md`                                                                                                                                                                                   |
| §28 rules 1–10                                                                   | process rules enforced by CI tooling (`req-coverage`, PR template), not by product tests   | Wave 0 slices 0.5/0.7                                                                                                                                                                                                  |
| §29 definition                                                                   | prose                                                                                      | —                                                                                                                                                                                                                      |

## Appendix E — Adopted clarification decisions

| #    | Ambiguity in 0.1.0 (quote / gap)                                                                                                    | Decision (normative text for 0.2.0)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Affected IDs                                            | Lands in SPEC.md                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A-01 | §7/§14/§15 define 6 of 126 (state, event) pairs; "State transitions MUST be deterministic" is untestable without the rest.          | Appendix A is the full 9 × 14 table. Barge-in: `USER_SPEAKING` moves `idle/thinking/success/error/speaking → listening`, governance states stay and set `userSpeaking`. `MODEL_STARTED` in governance states is `out_of_phase`. `TOOL_STARTED` moves `tool_call → executing` only with `approvalStatus ∈ {not_required, granted}`; in `waiting_approval` it is rejected with an anomaly. `ERROR` from any state → `error`, aborting the active operation and clearing the queue. `success`/`error` persist until the next event. | ORB-STATE-001, 003, 004, 007; ORB-GOV-002               | Appendix A; ORB-STATE-007                                                           |
| A-02 | ORB-DEMO-002 ("identifiable as simulated") and ORB-STATE-004 ("authoritative") have no carrier in `OrbEvent`.                       | `source: 'adapter' \| 'mock' \| 'manual'` on every event; authoritative = `TOOL_COMPLETED/TOOL_FAILED/APPROVAL_*` with `source ∈ {adapter, mock}` for the active `correlationId`; manual never opens/closes an operation; UI labels "Simulated"/"(manual)".                                                                                                                                                                                                                                                                      | ORB-EVENT-008; ORB-GOV-008; ORB-DEMO-002; ORB-API-004   | §14 code block + ORB-EVENT-008; §15 ORB-GOV-008                                     |
| A-03 | §20 shows `success → speaking → idle` but nothing says who moves the orb after `success`/`error`, or when.                          | Semantic persistence: no controller timer; the visual settle (`collapse → sphere` after `settleMs`) is cosmetic and Scheduler-driven; the mock/demo script emits the next event.                                                                                                                                                                                                                                                                                                                                                 | ORB-STATE-008; ORB-STATE-001                            | §7 ORB-STATE-008                                                                    |
| A-04 | `OrbState` is scalar; parallel tool calls (e.g. provider `parallel_tool_calls`) are unaddressed.                                    | Single `activeOperation` + FIFO `pendingOperations`; both on the snapshot; promotion on closure; queue cleared by `ERROR`. Multi-operation display is a post-V1 candidate (§27 "richer governance visualization").                                                                                                                                                                                                                                                                                                               | ORB-GOV-009; ORB-STATE-005                              | §15 ORB-GOV-009                                                                     |
| A-05 | Neither ordering (timestamp vs arrival) nor out-of-order handling (`TOOL_COMPLETED` before `TOOL_STARTED`) is defined.              | Arrival order; timestamps for logging/metrics only; out-of-phase lifecycle events rejected, snapshot unchanged, one `orb.bus.rejected` log with anomaly code.                                                                                                                                                                                                                                                                                                                                                                    | ORB-EVENT-009; ORB-EVENT-001; ORB-EVENT-005             | §14 ORB-EVENT-009                                                                   |
| A-06 | "`APPROVAL_DENIED` terminates the proposed action" names no resulting state.                                                        | → `idle` (or next pending op → `tool_call`); `lastOutcome.kind = 'denied'`; never `error`; live region "Action denied: <tool>".                                                                                                                                                                                                                                                                                                                                                                                                  | ORB-GOV-004, 007                                        | §15 ORB-GOV-007                                                                     |
| A-07 | `MODEL_COMPLETED` with no tool call and no speech has no target state.                                                              | `thinking → idle`; `MODEL_COMPLETED` in any other state is an accepted no-op (turns commonly end after `TOOL_REQUESTED` or during speech).                                                                                                                                                                                                                                                                                                                                                                                       | ORB-STATE-007                                           | Appendix A rows `MODEL_COMPLETED`                                                   |
| A-08 | Barge-in (`USER_SPEAKING` while thinking/executing) undefined; ORB-STATE-003 requires governance states to stay visible.            | Hybrid: interrupts `thinking` and `speaking`; governance states keep their state and set `userSpeaking = true` (UI appends "(user speaking)"); `USER_STOPPED_SPEAKING` clears the flag.                                                                                                                                                                                                                                                                                                                                          | ORB-STATE-003, 007                                      | Appendix A rows `USER_SPEAKING`/`USER_STOPPED_SPEAKING`; `OrbSnapshot.userSpeaking` |
| A-09 | `ERROR` while `waiting_approval`: is the pending approval cancelled?                                                                | Yes: → `error`, operation closed with `lastOutcome.kind = 'aborted'`, approval controls disabled, later `APPROVAL_*`/`TOOL_*` for that `correlationId` rejected (`duplicate`/`unknown_correlation`). Distinct from `TOOL_FAILED` (operation-level).                                                                                                                                                                                                                                                                              | ORB-GOV-009; ORB-STATE-007                              | Appendix A rows `ERROR`                                                             |
| A-10 | State between `APPROVAL_GRANTED` and `TOOL_STARTED` is unnamed (ORB-GOV-002 needs both).                                            | `tool_call` with `activeOperation.approvalStatus = 'granted'`, phase `proposed`; the visual layer MAY vary the `tool_call` look by `approvalStatus`; the accessible UI shows "approved, awaiting execution".                                                                                                                                                                                                                                                                                                                     | ORB-GOV-002; ORB-STATE-003                              | `ApprovalStatus` type in §15; Appendix A row 66                                     |
| A-11 | `orb.setState('thinking')` (§22) bypasses ORB-STATE-001 / ORB-GOV-003 / ORB-PLAY-002.                                               | `setState` = manual provenance: visible state only, `manual_override` anomaly, no operation, no `lastOutcome`, "(manual)" label.                                                                                                                                                                                                                                                                                                                                                                                                 | ORB-API-004; ORB-PLAY-002; ORB-GOV-003                  | §22 ORB-API-004                                                                     |
| A-12 | UI must offer keyboard Approve/Deny (ORB-A11Y-002) but `AgentAdapter` has no command path and ORB-GOV-005 forbids local grants.     | `OrbEngine.onApprovalDecision(cb)` + optional `AgentAdapter.respondToApproval(decision)`; clicking never changes the snapshot; the authoritative `APPROVAL_*` returns through the adapter.                                                                                                                                                                                                                                                                                                                                       | ORB-GOV-010; ORB-GOV-005; ORB-A11Y-002; ORB-ADAPTER-007 | §15 ORB-GOV-010; §17 interface                                                      |
| A-13 | Three vocabularies for formation names (§8 "neural cloud, gate, face/orb waveform"; §11 IDs; §16 `radar, data-grid, code-network`). | `FormationId` registry in Appendix C.1: §11 IDs are canonical; `gate` and `generic-tool` added as SHOULD; §16 names are examples resolved to `generic-tool` unless registered; "orb waveform" = `sphere` + audio displacement.                                                                                                                                                                                                                                                                                                   | ORB-FORM-009, 010; ORB-VISUAL-002; ORB-TOOLVIS-003      | §8/§11 text; Appendix C                                                             |
| A-14 | Whether the reference OpenAI adapter implies a server that executes real tools is unstated (ORB-ADAPTER-002 vs ORB-SEC-007).        | Reference gateway ships with a **mock tool executor**; real tool execution is out of V1 scope unless the host app provides an executor; OpenAI via Responses API streaming (Realtime deferred). U-1/U-2 defaults accepted on 2026-09-14.                                                                                                                                                                                                                                                                                         | ORB-ADAPTER-002; ORB-SEC-002, 006, 007, 008             | §17 note under ORB-ADAPTER-002; §24 ORB-SEC-008                                     |
| A-15 | ORB-A11Y-004 "preserve semantic state visibility" under reduced motion is undefined; conflicts with ORB-PERF-004 pointer feedback.  | `uMotionScale = 0`: instant formation change, no rotation/turbulence/pulse/pointer/audio displacement, text always present; ORB-PERF-004 is tested with reduced motion off.                                                                                                                                                                                                                                                                                                                                                      | ORB-A11Y-003, 004, 007; ORB-PERF-004                    | §23 ORB-A11Y-007                                                                    |
| A-16 | Does changing particle count "recreate the renderer" (ORB-RENDER-004)?                                                              | No: buffers reallocate, particles placed instantly, context/renderer/canvas preserved; "renderer" defined as that triple.                                                                                                                                                                                                                                                                                                                                                                                                        | ORB-RENDER-003, 004, 008; ORB-FORM-006                  | §9 ORB-RENDER-008                                                                   |
| A-17 | "Deterministic sampling" (ORB-FORM-005) has no seed source.                                                                         | `seed = prng.fork(formationId)`; engine seed configurable (`seed` option / `?seed=`); byte-identical output for equal `(input, N, seed)`.                                                                                                                                                                                                                                                                                                                                                                                        | ORB-FORM-005, 011                                       | §11 ORB-FORM-011                                                                    |
| A-18 | "Sanitized or parsed as inert geometry" (ORB-SVG-002) sets no resource limits or parsing strategy.                                  | Inert hand-written tokenizer (no DOM), limits ≤ 2 MiB / 5 000 elements / 200 000 path commands / 200 000 points, no DOCTYPE/entities, 2 s Worker timeout.                                                                                                                                                                                                                                                                                                                                                                        | ORB-SVG-002, 006; ORB-SEC-005; ORB-FORM-007             | §13 ORB-SVG-006                                                                     |
