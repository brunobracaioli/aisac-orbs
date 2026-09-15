# AISAC Orbs

> **A state-aware, GPU-accelerated particle interface for AI agents.**

AISAC Orbs is an open-source visual runtime for turning observable AI-agent and application states into interactive particle formations in the browser.

Instead of hiding an agent behind a generic spinner or chat bubble, AISAC Orbs can visually represent states such as **listening, processing, tool requests, approval gates, execution, success, failure, and speech** through thousands of GPU-rendered particles.

The project is designed around one rule:

> **The AI/application determines what is happening. The Orb Engine determines how that state is represented.**

AISAC Orbs does **not** claim to visualize chain-of-thought, hidden reasoning, or literal neural activity.

---

## Why AISAC Orbs?

AI agents are becoming more autonomous, but most interfaces still communicate agent activity through text, typing indicators, and loading spinners.

AISAC Orbs explores a different interface model:

```text
LISTENING
    ↓
THINKING
    ↓
TOOL REQUEST
    ↓
APPROVAL
    ↓
EXECUTING
    ↓
RESULT
    ↓
SPEAKING
```

Each semantic state can drive a different particle formation, motion profile, shader behavior, or accessible UI state.

The goal is not decoration alone. The goal is to make **observable agent activity and governance boundaries visible**.

---

## Core features

- **GPU-accelerated particle rendering** with Three.js/WebGL
- **Particle morphing** between predefined formations
- **Custom SVG → particle formations**
- **Deterministic agent state machine**
- **Provider-independent event model**
- **Tool-call lifecycle visualization**
- **Approval/governance states**
- **Audio-reactive particles**
- **Pointer interaction**
- **Adaptive rendering quality**
- **Developer playground**
- **Credential-free demo mode**
- **Provider adapter architecture**
- **Accessible textual state representation**

---

## Visual states

The initial state model is:

```ts
type OrbState =
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

A state can map to a visual configuration such as:

| State              | Example visual                       |
| ------------------ | ------------------------------------ |
| `idle`             | Slowly rotating particle sphere      |
| `listening`        | Expanding audio-reactive rings       |
| `thinking`         | Turbulent neural-like particle cloud |
| `tool_call`        | Structured geometric formation       |
| `waiting_approval` | Stable gate-like formation           |
| `executing`        | Dynamic connected network            |
| `success`          | Stabilization / completion pulse     |
| `error`            | Distortion / fragmentation           |
| `speaking`         | Audio-reactive orb or face           |

These mappings are visual representations of application state—not representations of model internals.

---

## Architecture

AISAC Orbs deliberately separates the AI system from the visual engine.

```text
┌───────────────────────────────────────────────┐
│                  AI / AGENT                   │
│ OpenAI / Anthropic / Gemini / Local / Custom  │
└──────────────────────┬────────────────────────┘
                       │ provider events
                       ▼
┌───────────────────────────────────────────────┐
│              ADAPTER + EVENT LAYER            │
│       Provider events → normalized events     │
└──────────────────────┬────────────────────────┘
                       │ OrbEvent
                       ▼
┌───────────────────────────────────────────────┐
│                STATE CONTROLLER               │
│       deterministic lifecycle + governance    │
└──────────────────────┬────────────────────────┘
                       │ OrbState
                       ▼
┌───────────────────────────────────────────────┐
│                   ORB ENGINE                  │
│ particles / formations / shaders / audio      │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│                       UI                      │
│        WebGL canvas + accessible HTML UI      │
└───────────────────────────────────────────────┘
```

The renderer does not need to know whether an event originated from OpenAI, Anthropic, Gemini, a local model, or a custom agent.

---

## Governed agent visualization

A core design goal is to distinguish **intent from execution**.

For an action requiring approval:

```text
MODEL
  ↓
TOOL_REQUESTED
  ↓
tool_call
  ↓
APPROVAL_REQUIRED
  ↓
waiting_approval
  ↓
APPROVAL_GRANTED
  ↓
TOOL_STARTED
  ↓
executing
  ↓
TOOL_COMPLETED
  ↓
success
```

A successful animation is never authoritative by itself.

The visual system enters `success` only after the application reports an authoritative successful result.

This makes AISAC Orbs suitable for interfaces where agent autonomy and deterministic governance need to coexist.

---

## Formation system

A formation is a set of target positions for the particle population.

```ts
type Formation = Float32Array;
```

V1 targets formations such as:

```text
sphere
rings
neural
polyhedron
network
face
AISAC symbol
explosion
collapse
error distortion
```

Particles continuously interpolate toward the selected formation while shaders can add turbulence, pulse, noise, rotation, and audio-driven displacement.

Conceptually:

```glsl
vec3 position = mix(
  currentPosition,
  targetPosition,
  morphProgress
);
```

---

## Custom SVG formations

AISAC Orbs is designed to transform line art, icons, logos, and faces into particle formations.

```text
SVG
 ↓
parse geometry
 ↓
sample paths
 ↓
normalize coordinates
 ↓
map particle targets
 ↓
morph
```

Conceptual API:

```ts
await orb.registerFormation({
  name: "github",
  source: "/formations/github.svg",
});

orb.morphTo("github");
```

This makes custom visual identities possible without modifying the renderer.

---

## Event-driven API

AISAC Orbs uses normalized events instead of provider-native events.

```ts
interface OrbEvent<T = Record<string, unknown>> {
  type: OrbEventType;
  timestamp: number;
  id?: string;
  correlationId?: string;
  metadata?: T;
}
```

Example:

```ts
orb.emit({
  type: "TOOL_STARTED",
  timestamp: Date.now(),
  correlationId: "tool-123",
  metadata: {
    tool: "web_search",
  },
});
```

The state controller interprets the event and the visual engine renders the corresponding state.

---

## Provider-independent by design

Provider integrations live behind adapters.

```ts
interface AgentAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  subscribe(callback: (event: OrbEvent) => void): () => void;
}
```

Planned/reference adapters:

```text
mock
OpenAI
```

The architecture can later support:

```text
Anthropic
Gemini
local models
custom agents
agent frameworks
```

without coupling the particle renderer to those SDKs.

---

## Audio-reactive behavior

Voice activity can influence particle motion in real time.

```text
microphone / assistant audio
        ↓
Web Audio API
        ↓
AnalyserNode
        ↓
amplitude + frequency data
        ↓
shader uniforms
        ↓
particle displacement
```

Audio may control:

- particle radius;
- displacement;
- brightness;
- pulse intensity;
- wave propagation.

Audio-reactive effects remain cosmetic and do not determine semantic agent state.

---

## Pointer interaction

Particles can react to mouse and touch input through forces such as:

```text
repulsion
attraction
distortion
wave propagation
```

After interaction, displaced particles return toward their active formation.

---

## Demo mode

**No API key should be required to experience AISAC Orbs.**

The repository includes a mock lifecycle capable of demonstrating:

```text
idle
 ↓
listening
 ↓
thinking
 ↓
tool_call
 ↓
waiting_approval
 ↓
executing
 ↓
success
 ↓
speaking
 ↓
idle
```

This mode is intended for development, demos, experimentation, and evaluating the visual runtime before connecting an AI provider.

---

## Developer playground

The playground is intended to expose controls for:

```text
State
Formation
Particle count
Quality preset
Turbulence
Rotation
Pulse
Connection density
Morph duration
Pointer forces
Audio reactivity
Mock lifecycle events
```

This makes it possible to experiment with the visual language independently of an AI backend.

---

## Tech stack

| Area        | Technology            |
| ----------- | --------------------- |
| Framework   | Next.js               |
| Language    | TypeScript            |
| 3D          | Three.js              |
| React 3D    | React Three Fiber     |
| GPU effects | GLSL                  |
| State       | Zustand or equivalent |
| Audio       | Web Audio API         |
| Styling     | Tailwind CSS          |
| Unit tests  | Vitest                |
| E2E         | Playwright            |

The reference particle renderer is designed around GPU-batched primitives rather than one Three.js mesh per particle.

---

## Getting started

> **Current status:** Wave 0 foundation is being implemented against [SPEC 0.2.0](SPEC.md). The application shell and gated WebGL smoke run locally; the complete orb engine and demo are delivered by the later waves. See [implementation status](specs/IMPLEMENTATION-STATUS.md) for verified results and remaining gates.

### Requirements

- Node.js 22 (the toolchain is verified with 22.22.2)
- pnpm 10.18.2, as pinned in `package.json`
- A modern WebGL-capable browser

### Development

```bash
git clone https://github.com/brunobracaioli/aisac-orbs.git
cd aisac-orbs

pnpm install --frozen-lockfile
pnpm dev
```

Then open:

```text
http://localhost:3000
```

The current application shell requires no provider credentials. Setup and verification tools are documented in [CONTRIBUTING.md](CONTRIBUTING.md) and the [toolchain reference](docs/reference/toolchain.md).

---

## Suggested repository structure

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
├── assets/
│   └── formations/
├── specs/
├── tests/
├── SPEC.md
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## Specification-driven development

AISAC Orbs is built **spec first**.

[`SPEC.md`](./SPEC.md) is the normative source of truth for the project.

Requirements use stable identifiers such as:

```text
ORB-STATE-001
ORB-RENDER-002
ORB-FORM-003
ORB-GOV-002
ORB-SEC-001
```

The development rule is:

> **Code implements the specification. The specification does not merely document the code retroactively.**

Changes to normative behavior should update the specification and corresponding tests.

---

## Roadmap

### V0.1 — Particle renderer

GPU-rendered base particle system and quality controls.

### V0.2 — Formation engine

Procedural formations and interruption-safe particle morphing.

### V0.3 — Interaction

Pointer forces and interactive distortion.

### V0.4 — State machine

Canonical semantic states and deterministic transitions.

### V0.5 — Event bus

Normalized event-driven architecture.

### V0.6 — Governed tool lifecycle

Tool request → approval → execution → result visualization.

### V0.7 — Audio

Microphone and assistant-audio reactivity.

### V0.8 — SVG formations

Custom SVG → particle target conversion.

### V0.9 — Provider adapter

Reference provider integration while preserving renderer independence.

### V1.0 — Public release

Stable demo, documentation, tests, accessibility, mobile support, and open-source release.

Potential later work includes WebGPU, an npm package, a formation SDK, mesh/GLB sampling, and additional provider/framework adapters.

---

## Performance targets

Reference targets:

```text
Desktop default     15,000 particles
Desktop high        30,000 particles
Desktop ultra       50,000+ when supported

Mobile default       5,000 particles

Desktop              target 60 FPS
Mobile               target 30–60 FPS
```

Actual performance depends on the device, browser, formation complexity, connection rendering, shaders, and post-processing.

Adaptive quality should reduce rendering cost when sustained performance degradation is detected.

---

## Accessibility

Particle animation is never the sole representation of application state.

Semantic states should also appear through accessible HTML, for example:

```text
EXECUTING TOOL
get_server_metrics
```

The project targets:

- keyboard-accessible controls;
- textual state equivalents;
- reduced-motion support;
- non-color-only error/success communication;
- semantic separation between decorative WebGL content and application state.

---

## Security principles

AISAC Orbs is a visual runtime, not an authorization mechanism.

The implementation must preserve several boundaries:

- provider secrets remain server-side;
- visual state never constitutes approval;
- tool execution remains behind application policy;
- approval and execution are separate lifecycle phases;
- imported SVG content is treated as inert geometry;
- untrusted event metadata is safely rendered;
- success is only displayed after authoritative success.

---

## Contributing

Contributions are welcome once the initial implementation and contribution workflow are published.

Before implementing behavior, read [`SPEC.md`](./SPEC.md).

A pull request that changes normative behavior should:

1. identify the affected requirement IDs;
2. update the specification when necessary;
3. update or add tests;
4. preserve provider independence;
5. preserve the boundary between visual representation and application truth.

See `CONTRIBUTING.md` once available.

---

## Project philosophy

AI interfaces should communicate more than _“something is loading.”_

AISAC Orbs explores an interface in which users can understand whether an agent is listening, processing, proposing an action, waiting for approval, executing a tool, speaking, succeeding, or failing.

The particles are the visual language.

The application remains the source of truth.

---

## License

Target license: **Apache License 2.0**.

The final `LICENSE` file governs the released source code once included in the repository.

---

## Author

Created by **Bruno Bracaioli** as an open-source AISAC experiment exploring visual interfaces for agentic systems.

If you find the project useful, consider starring the repository and following the project for future experiments around AI agents, infrastructure, and governed agentic systems.
