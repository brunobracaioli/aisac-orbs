# ADR-0001: Framework-independent engine with a thin React host

Status: accepted
Date: 2026-09-14
Decision basis: maintainer approval of implementation plan 1.1.0 and W0 §8.

## Context

SPEC §22 describes an imperative `OrbEngine`, while §6 includes React Three Fiber in the reference stack. The engine must remain reusable outside Next.js, preserve its renderer when state or particle count changes, and expose accessible state when WebGL is unavailable.

## Decision

`OrbEngine` is the imperative composition root. Its renderer implementation owns the Three.js renderer, scene, geometry and injected frame source. React mounts a thin `OrbCanvas` host, manages its container and subscribes to public snapshots. React Three Fiber is optional host integration and does not own the engine's state or renderer lifetime.

Semantic state is available without a renderer. `RendererPort`, `ParticleBufferPort` and `FrameTimeSource` isolate graphics and timing from semantic application code. Public operations enter through `engine/index.ts`. Source modules under `engine/` cannot import React, Next.js, Zustand or provider SDKs.

## Consequences

Renderer disposal, canvas resize and StrictMode mount/unmount behavior require explicit tests. WebGL context loss can fall back to semantic HTML without discarding governance state. Consumers can embed the engine outside React; the host must unsubscribe and dispose resources on teardown.

W1 and W2 agree on the type-only port handoff before concurrent implementation. This decision selects the shape; it is not evidence that those ports or rendering are implemented.
