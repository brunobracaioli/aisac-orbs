# AISAC Orbs — Specification

**Status:** Draft  
**Version:** 0.1.0  
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

| Layer | Technology |
|---|---|
| Application | Next.js |
| Language | TypeScript |
| Rendering | Three.js |
| React integration | React Three Fiber |
| GPU effects | GLSL / `ShaderMaterial` |
| State | Zustand or equivalent |
| Audio | Web Audio API |
| Styling | Tailwind CSS |
| Unit tests | Vitest |
| E2E | Playwright |

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

Suggested defaults: sphere → idle; rings → listening; neural cloud → thinking; polyhedron → tool call; gate → approval; network → executing; face/orb waveform → speaking.

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

## 10. Performance

| Preset | Target particles |
|---|---:|
| Mobile low | 3,000 |
| Mobile default | 5,000 |
| Desktop default | 15,000 |
| Desktop high | 30,000 |
| Desktop ultra | 50,000+ when supported |

- **ORB-PERF-001** — Desktop SHOULD target 60 FPS.
- **ORB-PERF-002** — Mobile SHOULD target 30–60 FPS.
- **ORB-PERF-003** — Adaptive quality SHOULD react to sustained frame degradation.
- **ORB-PERF-004** — Pointer feedback SHOULD appear within 50 ms when hardware permits.
- **ORB-PERF-005** — Particle count, connections, shader complexity, and post-processing SHOULD degrade independently.

## 11. Formation system

```ts
export type Formation = Float32Array;
```

For `N` particles, a 3D formation SHOULD expose `N × 3` target coordinates.

V1 MUST include `sphere`, `rings`, `neural`, `polyhedron`, `network`, and `face`.

V1 SHOULD include `aisac`, `explosion`, `collapse`, and `error-distortion`.

- **ORB-FORM-001** — Engine MUST support morphing between formations.
- **ORB-FORM-002** — Morph duration MUST be configurable.
- **ORB-FORM-003** — Custom SVG formations MUST be supported.
- **ORB-FORM-004** — Imported coordinates MUST be normalized.
- **ORB-FORM-005** — Point-count mismatch MUST use deterministic sampling/downsampling.
- **ORB-FORM-006** — Morphing MUST preserve the running renderer.
- **ORB-FORM-007** — Formation assets MUST NOT execute arbitrary code.

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

The initial face formation SHOULD use this mechanism.

## 14. Event model

```ts
export interface OrbEvent<T = Record<string, unknown>> {
  type: OrbEventType;
  timestamp: number;
  id?: string;
  correlationId?: string;
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

## 16. Tool visual registry

```ts
registerToolVisual({ tool: "web_search", formation: "radar" });
registerToolVisual({ tool: "database_query", formation: "data-grid" });
registerToolVisual({ tool: "execute_code", formation: "code-network" });
```

Unknown tools MUST fall back to a generic tool visual. Visual mappings MUST NOT modify execution policy.

## 17. Provider adapters

```ts
export interface AgentAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(callback: (event: OrbEvent) => void): () => void;
}
```

- **ORB-ADAPTER-001** — A mock adapter MUST exist.
- **ORB-ADAPTER-002** — Reference project SHOULD include an OpenAI adapter.
- **ORB-ADAPTER-003** — Provider secrets MUST NOT ship in browser source.
- **ORB-ADAPTER-004** — Provider events MUST normalize into `OrbEvent`.
- **ORB-ADAPTER-005** — Disconnect MUST release owned listeners/resources.
- **ORB-ADAPTER-006** — Rendering MUST remain safe if provider connectivity fails.

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

## 19. Pointer interaction

```ts
export interface PointerForceConfig {
  radius: number;
  strength: number;
  mode: "repel" | "attract" | "wave";
}
```

Displaced particles MUST return toward their active formation. Pointer interaction MUST NOT mutate semantic state. Touch SHOULD be supported.

## 20. Demo mode

A fresh clone MUST run without provider credentials.

```text
idle → listening → thinking → tool_call
→ waiting_approval? → executing → success → speaking → idle
```

- **ORB-DEMO-001** — Credential-free demo MUST exist.
- **ORB-DEMO-002** — Simulated events MUST be identifiable as simulated where ambiguity could mislead.
- **ORB-DEMO-003** — Demo SHOULD expose `Run AI Sequence`.
- **ORB-DEMO-004** — Demo timing MUST NOT become authoritative execution logic.

## 21. Developer playground

The playground SHOULD expose state, formation, particle count, quality, turbulence, rotation, pulse, connection density, morph duration, pointer forces, audio reactivity, and mock lifecycle events.

Playground controls MUST NOT bypass production governance.

## 22. Public engine API

```ts
const orb = new OrbEngine({ container, particles: 15000 });

orb.setState("thinking");
orb.morphTo("face", { duration: 1200 });

orb.emit({
  type: "TOOL_STARTED",
  timestamp: Date.now(),
  correlationId: "tool-123",
  metadata: { tool: "web_search" }
});
```

Custom formations SHOULD support `registerFormation(...)`. The architecture SHOULD permit later extraction into `@aisac/orbs` or equivalent.

## 23. Accessibility

Particles MUST NOT be the sole semantic state indicator.

- **ORB-A11Y-001** — States MUST have accessible textual equivalents.
- **ORB-A11Y-002** — Approval controls MUST be keyboard accessible.
- **ORB-A11Y-003** — `prefers-reduced-motion` MUST be respected.
- **ORB-A11Y-004** — Reduced-motion mode MUST preserve semantic state visibility.
- **ORB-A11Y-005** — Critical success/error information MUST NOT rely only on color.

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
