# ADR-0002: Pure semantic reducer with a presentation store bridge

Status: accepted
Date: 2026-09-14
Decision basis: maintainer approval of implementation plan 1.1.0 and W0 §8.

## Context

Governance must be deterministic, independent of animation and testable without the browser. The proposed Appendix A defines all 126 state/event pairs. A UI store must not become an alternative authority for approval or execution.

## Decision

Implement the pure function `transition(snapshot, event, ctx)`, where context supplies time and a pure semantic visual-default resolver. The controller validates events, invokes the reducer in arrival order, logs results and notifies subscribers. Effects, clock reads, adapter commands and renderer writes remain outside the reducer.

The controller retains a semantic snapshot. Manual `setState` projects a display state without changing the operation ledger, outcome or the semantic snapshot used by later transitions. Applied visual overrides, motion preferences, pointer/audio input and cosmetic settle are separate from both semantic state and `OrbSnapshot.visual` defaults.

React consumes the controller's subscribe/getSnapshot contract through a presentation bridge in `components/store`. Zustand may implement that bridge; it is never imported by the engine. An explicit reducer is preferred here over XState or a global Redux store because the normative transition table and narrow subscription contract already define the state machinery.

## Consequences

Table tests and property tests must check transitions and invariants independently of React or WebGL. Rejected and no-op events preserve snapshot identity. Manual projection, approval command delivery and applied visual state require their own tests. UI store updates do not authorize actions.
