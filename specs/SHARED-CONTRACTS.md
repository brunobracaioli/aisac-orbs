# Shared contract register

**Status:** approved for implementation with plan 1.1.0 on 2026-09-14; adopted locally in W0 §4.8.
**Normative baseline:** `../SPEC.md` 0.2.0. Merge and wave-gate evidence are recorded separately in `IMPLEMENTATION-STATUS.md`.

This register replaces references to transient planning inputs named `SHARED_CONTRACTS` and `WAVE_ASSIGNMENT`. It identifies the checked-in owner of each declaration; snippets in other waves are excerpts or explicitly additive extensions, not competing definitions. `WAVE_ASSIGNMENT` means the wave ownership tables (§3), summarized in the [master plan](SPEC-implementation-waves.md#11-requirement-coverage-summary). The [amendments proposal](SPEC-amendments-proposal.md) owns proposed requirement wording and Appendix A.

## Contract owners

| Contract                                                                              | Declaration / owning slice                                            | Integration rule                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Clock`, `Scheduler`, `Prng`, `Logger`, `Result`, `EasingId`, limits and IDs          | [W0 §4.2](waves/wave-00-foundation.md)                                | Later waves import the kernel declarations; they do not redefine them.                                                                                                                                                |
| `OrbEvent`, `NormalizedOrbEvent`, `EmitResult`, validation                            | [W1 §4.1–4.2](waves/wave-01-semantic-core.md) and amendment §2        | Raw `source` is optional for compatibility; normalized `source` is required. Event/correlation IDs use `core.ID_PATTERN`, 1–128 permitted characters; approval idempotency keys have a separate transport constraint. |
| `OrbSnapshot`, `TransitionContext`, `transition`                                      | W1 §4.3 and amendment Appendix A                                      | The reducer is pure over `(snapshot, event, ctx)`; `ctx.now` and a pure semantic-default resolver are explicit inputs. Logging, clock reads and renderer writes belong to the controller/bus.                         |
| `RendererPort`, `ParticleBufferPort`, `FrameTimeSource`, capability and quality types | [W2 §4.2–4.3](waves/wave-02-particle-renderer.md)                     | Freeze the type-only port declarations before W1/W2 branch in parallel. W1 may land these declarations with a fake; no import of a Three.js implementation is required.                                               |
| `FormationId`, `FormationDefinition`, `FormationError`, `MorphHandle`, `MorphOutcome` | [W3 §4.1 and §4.4](waves/wave-03-formations-and-morphing.md)          | W6 adds source-resolution error codes and Worker handling; built-in coordinates and morph completion keep the same shape.                                                                                             |
| `AgentAdapter`, `ApprovalDecision`                                                    | W1 §4.6 and amendment §2                                              | W7 implements the same interface; subscription precedes connect and all asynchronous cleanup failures are handled.                                                                                                    |
| `OrbEngine`, `OrbEngineOptions`, public exports                                       | [W4 §4.2](waves/wave-04-integrated-demo.md) plus the W2 §4.4 controls | W4 freezes the union of previously introduced public members. W5/W6 fulfill reserved capabilities; actual API additions still follow SPEC §28 and ADR-0011.                                                           |
| `PointerForceConfig`, `AudioFeatures`, `AudioSource`                                  | [W5 §4.1 and §4.3](waves/wave-05-pointer-and-audio.md)                | Freeze type-only signatures for the W4 facade. W4 stubs validate/store configuration; they do not imply implemented pointer/audio behavior.                                                                           |
| `FormationSource`, SVG Worker protocol                                                | [W6 §4.1–4.2](waves/wave-06-custom-svg-formations.md)                 | Freeze the source union before W4; until W6, SVG/URL variants reject with `unsupported_source`.                                                                                                                       |
| Agent gateway HTTP/SSE contract                                                       | [W7 §4.1](waves/wave-07-provider-gateway.md)                          | Create `docs/reference/openapi/agent-gateway.yaml` before handlers. `stream`, `turns` and `approvals` are all part of the contract.                                                                                   |

Type-only handoffs are implementation deliverables, not files already present. Parallel work starts only after both tracks agree on the same declarations. Until W4, each wave snapshots its own additions; it must not replace the other track's exports with a smaller list.

## Semantic state, manual display and rendered visuals

The controller retains an internal semantic snapshot satisfying Appendix A. `setState` creates a manual display projection for `getSnapshot()`/subscribers without passing that projection to `transition`. Subsequent events are reduced against the retained semantic snapshot, so a manual `success` during execution cannot block the real `TOOL_COMPLETED`. An accepted snapshot-changing event replaces the manual projection; rejected events and accepted no-ops preserve it. Approval controls always use the retained operation, and manual state never grants permission.

`OrbSnapshot.visual` records semantic state defaults. Tool registrations, host visual overrides, motion preference, cosmetic settle, pointer and audio resolve into the separate applied visual layer. They never rewrite the semantic snapshot. A manual display projection may show its manually selected state's default visual, with `provenance: 'manual'`; its operation, queue and outcome remain those of the retained semantic snapshot. Tests compare the appropriate layer rather than requiring manual `setState` to leave the entire public snapshot unchanged.

## Adapter and approval decisions

Only one adapter may be attached. A second attachment is rejected until the previous one is detached; it never silently replaces an active governed operation. The controller and facade follow the same rule. The adapter boundary forces `source = adapter.simulated ? 'mock' : 'adapter'`. In a real-provider session with a mock executor, `metadata.simulated: true` additionally labels the tool result as simulated; the live-provider badge does not erase that distinction.

`decideApproval` is the public decision ingress. The controller helper constructs the same command for text-only UI. One pending decision per active correlation is submitted at a time. The adapter's `respondToApproval`, when present, owns delivery; `onApprovalDecision` listeners are then observers. Without that method the host listener owns delivery. Both paths never forward the same decision independently. Controls do not change the semantic snapshot. Concurrent attempts and retries must be covered by the Wave 1 and Wave 7 decision-channel tests.

Mock sequences and raw playground events are allowed only in the explicitly simulated session. Visual callbacks cannot manufacture authoritative events, and a playground connected to a real adapter cannot inject mock governance into that live session.

## Gate interpretation

- An ownership row records a planned obligation; a test pathname records planned verification. Neither is passing evidence.
- Requirement tooling records the first normative keyword as the declared level and also checks for embedded MUST/MUST NOT clauses. Those clauses are blocking even in a SHOULD/MAY-led requirement. Informative ORB-MORPH-001 stays informative.
- At each gate, waivers may cover only later, unfinished waves. A current or previously closed wave's obligation cannot be waived by a broad pattern. Required E2E evidence is a blocking check, and aliases count only when a passing test explicitly references both IDs.
- Local checks, GitHub CI, real-device/visual review and publication are separate evidence categories. The real-provider acceptance in W7 and publication in W8 require their session-specific authorization; planning defaults are not authorization to incur cost or publish.
- Whole-wave gates apply at wave closure. A slice PR may legitimately precede tests or files introduced by later slices. The first scaffold reports the current SPEC version; 0.2.0 is adopted only in the reviewed amendment slice.

## Reconciliation before code

The [planning review](PLAN-REVIEW.md) records the corrections and remaining maintainer decisions. If implementation discovers a conflict with these owners, update the proposed contract or SPEC first and add a focused acceptance case. Do not resolve it by weakening a test, inventing a replacement type in a downstream wave, or claiming a later capability is already implemented.
