# Wave 1 — Semantic core: events, state machine, governance, mock adapter, accessible UI

| Field                     | Value                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**                | proposed                                                                                                                                                                                                                                                                             |
| **Milestones (SPEC §27)** | V0.4 State machine · V0.5 Event bus · semantic half of V0.6 (the rendered governed demo page lands in Wave 4)                                                                                                                                                                        |
| **Depends on**            | Wave 0 (core kernel `core/`, `tests/support/req.ts`, `scripts/req-coverage.ts`, `.dependency-cruiser.cjs`, security headers, SPEC.md 0.2.0 merged)                                                                                                                                   |
| **Spec version**          | SPEC.md 0.2.0 = 0.1.0 + `specs/SPEC-amendments-proposal.md`; decisions A-01 … A-13 and the text side of A-15 are implemented here                                                                                                                                                    |
| **Gate**                  | G1 — all 126 state×event cells pass a table-driven test; fast-check invariants hold over 10 000 runs; the text-only orb page passes axe with 0 violations and a keyboard-only approval flow; `pnpm req:coverage` shows every Wave 1 MUST covered; Wave 1 modules import zero `three` |
| **Estimated size**        | L — pure TypeScript with no GPU, but it is the semantic truth every later wave renders; the transition table, provenance rules and the approval channel are the highest-ranked delivery risk (analyze_risk risk 1, surfaces b, d, e)                                                 |

## 1. Objective

At the end of Wave 1 the complete provider-independent semantic runtime exists in pure TypeScript with zero Three.js dependency: a closed `OrbEvent` model with Zod validation and metadata sanitisation, an `EventBus` that validates, deduplicates and rejects out-of-phase events without ever throwing, a pure `transition()` function implementing all 126 cells of Appendix A with governance guards, a visual-policy layer mapping every `OrbState` to an `OrbVisualState`, an `OrbController` wiring bus → state → visual policy → `RendererPort` (a `NullRenderer` in this wave), a `MockAdapter` driven by an injected `Scheduler`/`Clock`, and an accessible HTML-only UI (live region, active-operation panel, keyboard Approve/Deny, Simulated and manual badges). A stakeholder can open `/text-orb` in a browser with no WebGL and no credentials, press **Run AI Sequence**, approve or deny the simulated `web_search` tool with the keyboard only, and read every state, tool, approval status and outcome as text. Property tests prove governance cannot be bypassed by event ordering, replay, manual `setState` or UI clicks.

## 2. Scope

### 2.1 In scope

- `events/`: `OrbEventType` (closed 14), `OrbEvent` shape (ORB-EVENT-006), `OrbEventSource`, `OrbEventMetadata`, `orbEventSchema`, sanitiser, correlation helpers, `EmitResult`.
- `engine/bus/` + `engine/EventBus.ts`: validate → dedupe (LRU 512 by `id`) → reduce → dispatch; re-entrant calls rejected synchronously; structured rejection logs.
- `engine/state/` + `engine/StateMachine.ts`: `OrbSnapshot`, `ActiveOperation`, FIFO pending queue, `transition()` implementing Appendix A (ORB-STATE-007), governance guards, table-driven and property tests.
- `engine/visual-policy/`: `STATE_VISUAL_DEFAULTS`, tool visual registry with `generic-tool` fallback, motion preference resolver, `resolveVisualState`.
- `engine/OrbController.ts` + `engine/ports/RendererPort.ts` (interface verbatim from SHARED_CONTRACTS) + `engine/ports/NullRenderer.ts`; manual `setState` with `manual_override` anomaly; approval decision channel.
- `adapters/AgentAdapter.ts`, `adapters/mock/` with four scripts (governed, denied, error, speech), `respondToApproval`, `disconnect()` releasing every timer and listener.
- `components/store/orbStore.ts` (Zustand vanilla store over `OrbController.subscribe`) and `components/a11y/` (`StateAnnouncer`, `ActiveOperationPanel`, `ApprovalControls`, `ProvenanceBadge`).
- `app/text-orb/page.tsx`: dev-only text orb page (no canvas) proving ORB-ARCH-005 and ORB-A11Y-006.
- ADR-0005 (event provenance & authoritative semantics), ADR-0006 (approval decision channel).

### 2.2 Out of scope (deferred)

- Any Three.js code, `ParticleSystem`, quality presets, `OrbEngine` class → Wave 2 / Wave 4.
- Formation generators, `FormationManager`, morphing, `uploadTargets` calls with real buffers → Wave 3 (this wave only resolves `visual.formation` ids).
- The public demo page `/`, `Run AI Sequence` on the rendered orb, mobile preset, cosmetic settle timer (ORB-STATE-008 timer half) → Wave 4 (ORB-DEMO-001/003/006, ORB-API-001/004).
- Playground panels → Wave 4 (ORB-PLAY-001/002); pointer and audio → Wave 5; SVG → Wave 3 / Wave 6.
- Server gateway, OpenAI adapter, replay protection on endpoints (ORB-SEC-007), `source: 'adapter'` trust boundary at the server → Wave 7.

## 3. Requirements owned by this wave

Every ID listed here is owned by this wave and must be fully satisfied and verified before the gate closes. These are planned obligations; no test evidence is implied. Shared declaration owners and integration rules are in `specs/SHARED-CONTRACTS.md`.

| ID              | Level    | Summary                                                                                                                                                                                                                                  | Slice         | Verification                                                                                                      |
| --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| ORB-ARCH-003    | MUST     | "State Controller MUST consume normalized `OrbEvent` objects." (§5)                                                                                                                                                                      | 4.2, 4.5      | unit + arch (controller accepts only `NormalizedOrbEvent`; adapter callback type is `OrbEvent`)                   |
| ORB-ARCH-005    | MUST     | "Semantic HTML/UI MUST remain separable from WebGL rendering." (§5)                                                                                                                                                                      | 4.7, 4.8      | arch (`components/a11y/**` never imports `three`, `engine/render`, `OrbEngine`) + e2e (`/text-orb` has no canvas) |
| ORB-STATE-001   | MUST     | "State transitions MUST be deterministic from normalized events." (§7)                                                                                                                                                                   | 4.3           | unit + property (same sequence twice → identical trace)                                                           |
| ORB-STATE-002   | MUST     | "Every state MUST define a default visual configuration." (§7)                                                                                                                                                                           | 4.4           | unit (all 9 states, all 7 fields, finite, in range)                                                               |
| ORB-STATE-003   | MUST     | "`tool_call`, `waiting_approval`, and `executing` MUST remain distinct." (§7)                                                                                                                                                            | 4.3, 4.4, 4.7 | unit (pairwise distinct states, visuals and labels)                                                               |
| ORB-STATE-004   | MUST     | "`success` MUST only follow authoritative success." (§7; alias ORB-GOV-003)                                                                                                                                                              | 4.3           | property (I5, I6) + table row 77                                                                                  |
| ORB-STATE-005   | SHOULD   | "Active-operation metadata SHOULD be retained for accessible UI." (§7)                                                                                                                                                                   | 4.3, 4.7      | unit (snapshot exposes `activeOperation` through `waiting_approval`/`executing`)                                  |
| ORB-STATE-006   | MUST     | `OrbState` is exactly the closed 9-member set; exhaustive `switch` compiles without default (amend. §3.1)                                                                                                                                | 4.3           | unit + typecheck (`satisfies Record<OrbState, …>`)                                                                |
| ORB-STATE-007   | MUST     | Transitions follow Appendix A exhaustively; rejected/no-op pairs return the snapshot unchanged (amend. §3.1)                                                                                                                             | 4.3           | unit (126-row fixture diffed in CI)                                                                               |
| ORB-STATE-008   | MUST     | `success`/`error` persist until the next accepted event; no controller timer changes `state`; settle is cosmetic (amend. §3.1)                                                                                                           | 4.3, 4.5      | unit (fake scheduler advanced 60 s → state unchanged)                                                             |
| ORB-VISUAL-001  | MUST     | Every `OrbState` resolves to an `OrbVisualState` with Appendix C.2 units; resolution is pure, never reads provenance (amend. §3.2)                                                                                                       | 4.4           | unit + property                                                                                                   |
| ORB-VISUAL-002  | SHOULD   | `STATE_VISUAL_DEFAULTS` map idle→sphere … speaking→face; hosts may override without changing semantics (amend. §3.2)                                                                                                                     | 4.4           | unit                                                                                                              |
| ORB-EVENT-001   | MUST     | "Events MUST contain timestamps." (§14)                                                                                                                                                                                                  | 4.1           | unit (schema rejects missing/NaN/negative/non-integer)                                                            |
| ORB-EVENT-002   | SHOULD   | "Events SHOULD support correlation IDs." (§14)                                                                                                                                                                                           | 4.1, 4.3      | unit (correlation matching helpers)                                                                               |
| ORB-EVENT-003   | MUST     | "Provider-native events MUST be normalized before State Controller." (§14; alias ORB-ADAPTER-004)                                                                                                                                        | 4.1, 4.2      | unit (bus rejects non-schema input; `reduce` receives only `NormalizedOrbEvent`)                                  |
| ORB-EVENT-004   | MUST     | "Metadata MUST be treated as untrusted presentation data unless validated." (§14)                                                                                                                                                        | 4.1, 4.7      | unit (allow-list, caps, prototype keys dropped) + e2e                                                             |
| ORB-EVENT-005   | SHOULD   | "Execution events SHOULD be idempotently handled when IDs permit." (§14)                                                                                                                                                                 | 4.2, 4.3      | unit + property (same `id` → no-op; phase duplicates rejected)                                                    |
| ORB-EVENT-006   | MUST     | `OrbEvent` shape with optional `source`, validated at `EventBus.emit` with `orbEventSchema`; invalid → `{ accepted: false, reason: 'invalid' }`, never throws into the caller or render loop; `timestamp` is Unix epoch ms (amend. §3.7) | 4.1, 4.2      | unit + property (malformed payloads never throw)                                                                  |
| ORB-EVENT-007   | MUST     | `OrbEventType` is the closed set of 14; other types rejected with `unknown_type` and logged (amend. §3.7)                                                                                                                                | 4.1, 4.2      | unit                                                                                                              |
| ORB-EVENT-008   | MUST     | Every event carries `source ∈ {adapter, mock, manual}`; mock → `mock`, `setState` → `manual`; snapshot exposes `provenance`; UI labels it (amend. §3.7)                                                                                  | 4.1, 4.5, 4.7 | unit + e2e                                                                                                        |
| ORB-EVENT-009   | MUST     | Events processed in arrival order; timestamps never reorder; out-of-phase → rejected, snapshot unchanged, logged `orb.bus.rejected`; dedupe by `id` over LRU 512 (amend. §3.7)                                                           | 4.2, 4.3      | unit + property (timestamp permutation invariance)                                                                |
| ORB-GOV-001     | MUST     | "Proposal and execution MUST be separate phases." (§15)                                                                                                                                                                                  | 4.3           | unit (`phase` transitions proposed → awaiting_approval → executing)                                               |
| ORB-GOV-002     | MUST NOT | "Approval-required actions MUST NOT enter `executing` before approval and authoritative execution start." (§15)                                                                                                                          | 4.3           | property (I3) + rows 48, 62, 66                                                                                   |
| ORB-GOV-003     | MUST     | "`success` MUST only follow authoritative successful execution." (§15; alias of ORB-STATE-004)                                                                                                                                           | 4.3           | property (I6)                                                                                                     |
| ORB-GOV-004     | MUST     | "Approval denial MUST be a governance outcome, not tool failure." (§15)                                                                                                                                                                  | 4.3, 4.7      | unit + property (`APPROVAL_DENIED` never yields `error`; `lastOutcome.kind === 'denied'`)                         |
| ORB-GOV-005     | MUST NOT | "Visual state alone MUST NOT grant approval." (§15; alias ORB-SEC-003)                                                                                                                                                                   | 4.5, 4.7      | unit (click → `ApprovalDecision` only; snapshot identity unchanged) + e2e                                         |
| ORB-GOV-006     | SHOULD   | "Accessible UI SHOULD identify the active tool/action." (§15)                                                                                                                                                                            | 4.7           | unit (RTL) + e2e                                                                                                  |
| ORB-GOV-007     | MUST     | `APPROVAL_DENIED` closes with `lastOutcome.kind = 'denied'`, moves to `idle` (or `tool_call` on promotion), never `error`; UI announces "Action denied: <tool>" (amend. §3.8)                                                            | 4.3, 4.7      | unit + e2e                                                                                                        |
| ORB-GOV-008     | MUST     | Authoritative = `source ∈ {adapter, mock}` and `correlationId` matches active; only such `TOOL_COMPLETED`/`TOOL_FAILED`/`APPROVAL_*` advance or close; `manual` ones rejected `manual_override` (amend. §3.8)                            | 4.3           | unit + property                                                                                                   |
| ORB-GOV-009     | MUST     | Exactly one `activeOperation` + FIFO `pendingOperations`; closure promotes the head to `tool_call`; `ERROR` aborts and clears; unknown correlation rejected (amend. §3.8)                                                                | 4.3           | unit + property (I1, I2)                                                                                          |
| ORB-GOV-010     | MUST     | Approval decisions travel UI → application via `onApprovalDecision`/`respondToApproval`; activating a control never changes the snapshot; controls enabled only while `approvalStatus === 'pending'` (amend. §3.8)                       | 4.5, 4.7      | unit + e2e                                                                                                        |
| ORB-TOOLVIS-001 | MUST     | Unregistered tool → `generic-tool` formation (fallback `polyhedron`); registration never affects `OrbSnapshot` (amend. §3.9)                                                                                                             | 4.4           | unit                                                                                                              |
| ORB-TOOLVIS-002 | MUST NOT | Visual mappings never modify execution policy or approval requirements; pure registry write (amend. §3.9)                                                                                                                                | 4.4           | unit (trace identical before/after registration)                                                                  |
| ORB-TOOLVIS-003 | SHOULD   | `registerToolVisual({ tool, formation })`; unregistered formation → `generic-tool` + `orb.visual.unregistered_formation` once (amend. §3.9)                                                                                              | 4.4           | unit                                                                                                              |
| ORB-ADAPTER-001 | MUST     | "A mock adapter MUST exist." (§17)                                                                                                                                                                                                       | 4.6           | unit                                                                                                              |
| ORB-ADAPTER-005 | MUST     | "Disconnect MUST release owned listeners/resources." (§17)                                                                                                                                                                               | 4.6           | unit (fake scheduler: 0 pending cancels; `listeners.size === 0`)                                                  |
| ORB-ADAPTER-007 | MUST     | `AgentAdapter { name; simulated; connect; disconnect; subscribe; respondToApproval? }`; mock `simulated === true`, events `source: 'mock'`; delivery in received order (amend. §3.10)                                                    | 4.6           | unit + typecheck                                                                                                  |
| ORB-DEMO-002    | MUST     | "Simulated events MUST be identifiable as simulated where ambiguity could mislead." (§20)                                                                                                                                                | 4.6, 4.7      | unit + e2e (badge + prefixed outcome announcements)                                                               |
| ORB-DEMO-004    | MUST NOT | "Demo timing MUST NOT become authoritative execution logic." (§20)                                                                                                                                                                       | 4.5, 4.6      | unit (delays 0 vs scripted → identical trace) + arch (no timers in `engine/**`, `events/**`)                      |
| ORB-A11Y-001    | MUST     | "States MUST have accessible textual equivalents." (§23)                                                                                                                                                                                 | 4.7           | unit (9 unique labels) + e2e                                                                                      |
| ORB-A11Y-002    | MUST     | "Approval controls MUST be keyboard accessible." (§23)                                                                                                                                                                                   | 4.7, 4.8      | e2e (Tab/Enter/Space, visible focus)                                                                              |
| ORB-A11Y-005    | MUST NOT | "Critical success/error information MUST NOT rely only on color." (§23)                                                                                                                                                                  | 4.7           | unit (icon `aria-hidden` + word present) + e2e                                                                    |
| ORB-A11Y-006    | MUST NOT | Particles never the sole indicator: `role="status"` live region announces every accepted change and renders without WebGL (amend. §3.16)                                                                                                 | 4.7, 4.8      | unit + e2e (`/text-orb` has no canvas, live region SSR-rendered)                                                  |
| ORB-SEC-003     | MUST NOT | "Visual state MUST NOT constitute authorization." (§24; alias of ORB-GOV-005)                                                                                                                                                            | 4.5           | unit                                                                                                              |
| ORB-SEC-004     | MUST     | "Untrusted labels/metadata MUST be safely rendered." (§24)                                                                                                                                                                               | 4.1, 4.7      | unit (RTL: text nodes only, `react/no-danger` lint) + e2e                                                         |

Requirements touched but owned elsewhere: ORB-ARCH-004 (Wave 4 — this wave already makes the type system forbid a renderer callback from becoming an `OrbEvent`), ORB-DEMO-001 / ORB-DEMO-003 (Wave 4 — `/text-orb` is a dev route, not the public demo; the `Run AI Sequence` control is prototyped here and moved to `/` in Wave 4), ORB-DEMO-006 (Wave 4 — the governed script with approval-required default is authored here), ORB-API-004 (Wave 4 — `setState` semantics implemented on the controller here, exposed on `OrbEngine` there), ORB-A11Y-007 (Wave 4 — integrated behavior; Wave 2 supplies `uMotionScale`), ORB-SEC-007 (Wave 7 — client dedupe here is not replay protection).

## 4. Vertical slices

### 4.1 Event model — bounded context `events`

**Objective.** A closed, validated, sanitised event vocabulary that is the only thing the controller ever sees.

**Contracts.**

```ts
// events/domain/OrbEventType.ts
export const ORB_EVENT_TYPES = [
  "USER_SPEAKING",
  "USER_STOPPED_SPEAKING",
  "MODEL_STARTED",
  "MODEL_COMPLETED",
  "TOOL_REQUESTED",
  "TOOL_STARTED",
  "TOOL_COMPLETED",
  "TOOL_FAILED",
  "APPROVAL_REQUIRED",
  "APPROVAL_GRANTED",
  "APPROVAL_DENIED",
  "ASSISTANT_SPEAKING",
  "ASSISTANT_STOPPED_SPEAKING",
  "ERROR",
] as const; // ORB-EVENT-007
export type OrbEventType = (typeof ORB_EVENT_TYPES)[number];
export const LIFECYCLE_EVENT_TYPES = [
  "TOOL_REQUESTED",
  "TOOL_STARTED",
  "TOOL_COMPLETED",
  "TOOL_FAILED",
  "APPROVAL_REQUIRED",
  "APPROVAL_GRANTED",
  "APPROVAL_DENIED",
] as const; // Appendix A G1
export const AUTHORITATIVE_EVENT_TYPES = [
  "TOOL_COMPLETED",
  "TOOL_FAILED",
  "APPROVAL_GRANTED",
  "APPROVAL_DENIED",
] as const; // ORB-GOV-008
export function isLifecycleEvent(type: OrbEventType): boolean;
export function isAuthoritativeEvent(type: OrbEventType): boolean;

// events/domain/OrbEvent.ts  (verbatim SHARED_CONTRACTS)
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
}
export type NormalizedOrbEvent = OrbEvent<OrbEventMetadata> & { readonly source: OrbEventSource }; // schema output: source defaulted, metadata sanitised
export type EmitResult =
  | { accepted: true; deduplicated: boolean }
  | { accepted: false; reason: "invalid" | "duplicate" | "out_of_phase" | "unknown_type" };

// events/domain/schema.ts
// Reuse ID_PATTERN from core/ids.ts for id and correlationId (1–128); do not redeclare it here.
export const orbEventMetadataSchema: ZodType<OrbEventMetadata>; // z.object({ tool: toolId.optional(), label: printable(120).optional(), reason: printable(120).optional(), simulated: z.boolean().optional() }).strip()
export const orbEventSchema: ZodType<OrbEvent<OrbEventMetadata>>; // z.object({ type: z.enum(ORB_EVENT_TYPES), timestamp: z.number().int().nonnegative().finite(), id: z.string().regex(ID_PATTERN).optional(), correlationId: same, source: z.enum(['adapter','mock','manual']).default('adapter'), metadata: z.unknown().optional() }).strict(); sanitize raw metadata, then validate the sanitized result against orbEventMetadataSchema
export interface EventValidationError {
  code: "unknown_type" | "invalid";
  issues: ReadonlyArray<{ path: string; message: string }>;
}
export function validateOrbEvent(raw: unknown): Result<NormalizedOrbEvent, EventValidationError>; // never throws; MAX_EVENT_BYTES (4096, core/limits) checked on UTF-8 wire bytes or safely serialized object bytes; cyclic/non-serializable inputs return invalid

// events/domain/sanitize.ts
export const TOOL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
export const MAX_LABEL_CHARS = 120;
export function sanitizeToolId(raw: unknown): string | undefined; // pattern match or undefined (never partial)
export function sanitizeLabel(raw: unknown): string | undefined; // NFC; strips C0/C1 controls, U+200B–U+200F, U+202A–U+202E, U+2066–U+2069, U+FEFF; collapses whitespace; truncates to at most 120 code points including the final '…'
export function sanitizeMetadata(raw: unknown, source: OrbEventSource): OrbEventMetadata; // allow-list copy onto a fresh object literal; '__proto__' | 'constructor' | 'prototype' never copied; source==='mock' forces simulated=true

// events/domain/correlation.ts
export type CorrelationMatch = "active" | "pending" | "last" | "none";
export function classifyCorrelation(
  correlationId: string | undefined,
  snapshot: OrbSnapshot,
): CorrelationMatch;
export function matchesActive(event: OrbEvent, snapshot: OrbSnapshot): boolean;

// events/index.ts — re-exports the types above, validateOrbEvent, sanitize*, classifyCorrelation. Nothing else.
```

**Behavior.** `validateOrbEvent` runs in this order: byte cap → known type → structural envelope schema → source default → sanitize raw metadata → validate sanitized metadata. Unknown types return `unknown_type`; all other invalid inputs return `invalid`. `timestamp` is Unix epoch milliseconds, integer, ≥ 0; it is never used for ordering (ORB-EVENT-009). `metadata` is presentation data: only the four allow-listed keys survive; `tool` failing `TOOL_ID_PATTERN` becomes `undefined` (the UI shows "unknown tool"), never a truncated identifier. `metadata.simulated` never upgrades or downgrades provenance; provenance is `source` only (A-02).

**Edge cases.**

- `type: 'tool_completed'` (case mismatch) → `unknown_type`; no normalisation of casing (§28 rule 8).
- `timestamp: Date.now() / 1000` non-integer → `invalid`; `timestamp: -1` → `invalid`; `timestamp: 1e18` → accepted (finite) — future timestamps are informational.
- `id` longer than 128 or containing whitespace → `invalid` (the whole event, not a stripped id).
- `metadata: { tool: 'web_search', __proto__: { polluted: true } }` → tool kept, prototype key absent, `Object.getPrototypeOf(result.metadata) === Object.prototype`, `({}).polluted === undefined`.
- Direct `sanitizeLabel` input of 10 000 chars with RTL override → 120 code points, no U+202E, ends with `…`.
- `source: 'server'` → `invalid` (closed enum; the server-side `origin` concept is Wave 7's and is mapped to `'adapter'` before the client).
- Event JSON > 4 096 UTF-8 bytes → `invalid` before metadata processing. A 10 000-character label is tested directly against the sanitizer, not accepted as a wire event.

**Acceptance criteria.**

- Given a payload with every field valid, When `validateOrbEvent` runs, Then `ok === true`, `source === 'adapter'`, metadata keys ⊆ {tool,label,reason,simulated}. — ORB-EVENT-001, ORB-EVENT-003, ORB-EVENT-004, ORB-EVENT-006 — `tests/unit/events/schema.test.ts`
- Given `{ type: 'MODEL_STARTED' }` without `timestamp`, When validated, Then `ok === false`, `code === 'invalid'`, issue path `timestamp`. — ORB-EVENT-001, ORB-EVENT-006 — `tests/unit/events/schema.test.ts`
- Given `type: 'REASONING_STEP'`, When validated, Then `code === 'unknown_type'`. — ORB-EVENT-007 — `tests/unit/events/schema.test.ts`
- Given arbitrary `fc.anything()` inputs (1 000 runs), When validated, Then the function never throws and any `ok` result satisfies the schema round-trip. — ORB-EVENT-003, ORB-SEC-004 — `tests/unit/events/schema.property.test.ts`
- Given metadata with prototype-polluting keys, control characters and a 10 000-char label, When sanitised, Then the outputs match the edge cases above. — ORB-EVENT-004, ORB-SEC-004 — `tests/unit/events/sanitize.test.ts`
- Given `source: 'mock'` and `metadata.simulated: false`, When sanitised, Then `simulated === true`. — ORB-EVENT-008, ORB-DEMO-002 — `tests/unit/events/sanitize.test.ts`

**Observability.** None directly (pure). Validation failures are logged by the bus (4.2) as `orb.bus.rejected` with `{ reason, type?: string ≤ 32 chars, issuePaths }`; never the payload.

### 4.2 EventBus — bounded context `engine/bus`

**Objective.** The single ingress: everything that reaches the controller has been validated, deduplicated and accepted in arrival order; callers never receive an exception.

**Contracts.**

```ts
// engine/bus/idempotency.ts
export interface IdempotencyStore {
  has(id: string): boolean;
  remember(id: string): void;
  readonly size: number;
  clear(): void;
}
export const DEFAULT_DEDUPE_CAPACITY = 512; // ORB-EVENT-009
export function createLruIdempotencyStore(capacity?: number): IdempotencyStore; // Map insertion-order LRU; remember() of a known id refreshes recency; evicts oldest beyond capacity

// engine/bus/EventBus.impl.ts
export type BusListener = (event: NormalizedOrbEvent, result: TransitionResult) => void;
export interface EventBusOptions {
  clock: Clock;
  logger: Logger;
  reduce: (event: NormalizedOrbEvent) => TransitionResult;
  dedupeCapacity?: number;
}
export interface EventBus {
  emit(raw: unknown): EmitResult;
  subscribe(listener: BusListener): () => void;
  dispose(): void;
}
export function createEventBus(options: EventBusOptions): EventBus;

// engine/EventBus.ts — SPEC §25 entry file: export { createEventBus } and the types above; no logic.
```

**Behavior.** `emit(raw)` pipeline, synchronous: (1) `validateOrbEvent` → `unknown_type` / `invalid`; (2) if `id` present and `store.has(id)` → refresh recency with `store.remember(id)`, then return `{ accepted: true, deduplicated: true }`, no reduce, no dispatch, log `orb.bus.deduplicated`; (3) `reduce(event)`; if `result.anomaly` → map per Appendix A G4: `out_of_phase` and `unknown_correlation` → `'out_of_phase'`, `duplicate` → `'duplicate'`, `manual_override` → `'invalid'`; log `orb.bus.rejected`; return; (4) `store.remember(id)` only for accepted events with an `id` (rejected events are not remembered, so a later in-phase replay with the same id is processed once); (5) dispatch `(event, result)` to listeners in subscription order; a listener that throws is caught, logged as `orb.bus.listener_error` and the loop continues; (6) return `{ accepted: true, deduplicated: false }`. Re-entrancy: an `emit` inside a listener or `reduce` returns `{ accepted: false, reason: 'invalid' }` synchronously, does not reduce or queue that event, and logs `orb.bus.reentrant`. This preserves a truthful synchronous `EmitResult`; callers emit follow-up events after dispatch returns. Non-reentrant acceptance order remains arrival order. `dispose()` clears listeners and the store; later `emit` returns `'invalid'`.

**Edge cases.**

- Same `id`, different payload → second is `deduplicated: true` (id wins; documented as "when IDs permit").
- No `id`: never deduplicated by the bus; phase rules in 4.3 still reject a second `TOOL_STARTED` for the same active operation (`duplicate`).
- 513th distinct id evicts the first; replaying the first is then processed by phase rules only.
- `emit` called after `dispose` → `{ accepted: false, reason: 'invalid' }`, no throw.
- Listener throws → other listeners still receive the event; `EmitResult` unaffected.

**Acceptance criteria.**

- Given a valid event with `id: 'e1'` emitted twice, When both are emitted, Then results are `{accepted:true,deduplicated:false}` then `{accepted:true,deduplicated:true}` and `reduce` was called once. — ORB-EVENT-005, ORB-EVENT-009 — `tests/unit/engine/bus/event-bus.test.ts`
- Given malformed payloads (`null`, a string, a cyclic object, an event with `timestamp: 'now'`), When `emit` is called for each, Then every call returns `{ accepted: false, reason: 'invalid' }` (or `'unknown_type'`), nothing throws, `reduce` is never called and the snapshot is identity-equal. — ORB-EVENT-006, ORB-EVENT-003 — `tests/unit/engine/bus/event-bus.test.ts`
- Given a listener that throws, When an event is emitted, Then `emit` returns accepted, the second listener is called, and `orb.bus.listener_error` is logged once. — ORB-EVENT-003 — `tests/unit/engine/bus/event-bus.test.ts`
- Given a listener that emits B while A is dispatched, When A is emitted, Then B returns invalid, A completes normally, no nested reduction occurs, and a later top-level emit of B succeeds in phase. — ORB-EVENT-009 — `tests/unit/engine/bus/event-bus.test.ts`
- Given 600 accepted events with distinct ids, When id #1 is replayed, Then `store.size === 512` and the replay reaches `reduce`. — ORB-EVENT-005 — `tests/unit/engine/bus/idempotency.test.ts`
- Given `reduce` returns anomaly `manual_override`, When emitted, Then result is `{accepted:false, reason:'invalid'}` and `orb.bus.rejected` carries `anomaly: 'manual_override'`. — ORB-GOV-008 — `tests/unit/engine/bus/event-bus.test.ts`

**Observability.** `orb.bus.rejected` (warn: `{ reason, anomaly?, type, state, correlationId? }`), `orb.bus.deduplicated` (info: `{ type, id, correlationId? }`), `orb.bus.listener_error` (error: `{ type, errorName }`), `orb.bus.reentrant` (warn: `{ type }`). Counters exposed on `bus.stats()` are not part of the contract.

### 4.3 State machine and governance — bounded context `engine/state`

**Objective.** A pure, exhaustively specified reducer over `(OrbSnapshot, NormalizedOrbEvent)` implementing Appendix A, with governance that cannot be short-circuited.

**Contracts.**

```ts
// engine/state/snapshot.ts (types verbatim SHARED_CONTRACTS)
export type OrbState =
  | "idle"
  | "listening"
  | "thinking"
  | "tool_call"
  | "waiting_approval"
  | "executing"
  | "success"
  | "error"
  | "speaking"; // ORB-STATE-006
export const ORB_STATES: ReadonlyArray<OrbState>; // 9, in this order
export const GOVERNANCE_STATES = ["tool_call", "waiting_approval", "executing"] as const;
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
export function createInitialSnapshot(now: number, visual: OrbVisualState): OrbSnapshot; // state 'idle', everything null/empty/false, provenance null
export const MAX_PENDING_OPERATIONS = 32; // core/limits; overflow → TOOL_REQUESTED rejected out_of_phase (D mitigation)

// engine/state/transitions.ts
export interface TransitionResult {
  snapshot: OrbSnapshot;
  anomaly?: {
    code: "out_of_phase" | "unknown_correlation" | "duplicate" | "manual_override";
    message: string;
  };
}
export interface TransitionContext {
  now: number;
  resolveVisual: (state: OrbState, op: ActiveOperation | null) => OrbVisualState;
}
export function transition(
  snapshot: OrbSnapshot,
  event: NormalizedOrbEvent,
  ctx: TransitionContext,
): TransitionResult; // PURE; Appendix A is normative
export interface TransitionRowSpec {
  state: OrbState;
  type: OrbEventType;
  guard: string;
  next: OrbState | "same";
  kind: "accepted" | "noop" | "rejected";
  anomaly?: string;
}
export function describeTransitionTable(): ReadonlyArray<TransitionRowSpec>; // 126 rows; exported ONLY for the fixture diff test

// engine/state/governance.ts
export function isAuthoritative(event: NormalizedOrbEvent, snapshot: OrbSnapshot): boolean; // ORB-GOV-008: source ∈ {adapter,mock} ∧ matchesActive
export function canEnterExecuting(op: ActiveOperation): boolean; // approvalStatus ∈ {not_required, granted}  (ORB-GOV-002)
export function isManualLifecycle(event: NormalizedOrbEvent): boolean; // G3
export function closeOperation(
  snapshot: OrbSnapshot,
  outcome: LastOutcome,
  terminal: OrbState,
): {
  state: OrbState;
  activeOperation: ActiveOperation | null;
  pendingOperations: ReadonlyArray<ActiveOperation>;
}; // G5 promotion ‡
export function abortAll(
  snapshot: OrbSnapshot,
  at: number,
  source: OrbEventSource,
): Pick<OrbSnapshot, "activeOperation" | "pendingOperations" | "lastOutcome">; // ERROR rows

// engine/state/activeOperation.ts
export function openOperation(event: NormalizedOrbEvent): ActiveOperation; // tool = sanitized tool ?? 'unknown'; approvalStatus not_required; phase proposed; startedAt = event.timestamp
export function enqueueOperation(
  queue: ReadonlyArray<ActiveOperation>,
  op: ActiveOperation,
): ReadonlyArray<ActiveOperation>; // FIFO tail, new array
export function promoteHead(queue: ReadonlyArray<ActiveOperation>): {
  head: ActiveOperation | null;
  rest: ReadonlyArray<ActiveOperation>;
};

// engine/StateMachine.ts — SPEC §25 entry: export { transition, describeTransitionTable, createInitialSnapshot, ORB_STATES, GOVERNANCE_STATES } and types.
```

**Behavior.** Rules G1–G7 of Appendix A apply verbatim. The compact grid below is derived from decision A-01; the full normative 126-row table with effects and anomaly codes lives in `specs/SPEC-amendments-proposal.md` Appendix A (ORB-STATE-007) and is exported as `tests/fixtures/state/transitions.json`. Cell = next state; `=` = accepted, state unchanged, snapshot effect only (flag or queue); `–` = no-op, snapshot object returned unchanged; `–†` = rejected with an anomaly per G4, snapshot unchanged, `orb.bus.rejected` logged.

| State ⟍ Event    | USER_SPEAKING | USER_STOPPED_SPEAKING | MODEL_STARTED | MODEL_COMPLETED | TOOL_REQUESTED | TOOL_STARTED | TOOL_COMPLETED | TOOL_FAILED | APPROVAL_REQUIRED | APPROVAL_GRANTED | APPROVAL_DENIED | ASSISTANT_SPEAKING | ASSISTANT_STOPPED_SPEAKING | ERROR  |
| ---------------- | ------------- | --------------------- | ------------- | --------------- | -------------- | ------------ | -------------- | ----------- | ----------------- | ---------------- | --------------- | ------------------ | -------------------------- | ------ |
| idle             | listening     | =ᶠ                    | thinking      | –               | tool_call¹     | –†           | –†             | –†          | –†                | –†               | –†              | speaking           | –                          | error⁴ |
| listening        | =ᶠ            | idle                  | thinking      | –               | tool_call¹     | –†           | –†             | –†          | –†                | –†               | –†              | speaking           | –                          | error⁴ |
| thinking         | listening⁵    | =ᶠ                    | –             | idle⁶           | tool_call¹     | –†           | –†             | –†          | –†                | –†               | –†              | speaking           | –                          | error⁴ |
| tool_call        | =ᶠ            | =ᶠ                    | –†            | –               | =²             | executing³   | –†             | –†          | waiting_approval⁷ | –†               | –†              | –                  | –                          | error⁸ |
| waiting_approval | =ᶠ            | =ᶠ                    | –†            | –               | =²             | –†           | –†             | –†          | –†                | tool_call⁹       | idle¹⁰          | –                  | –                          | error⁸ |
| executing        | =ᶠ            | =ᶠ                    | –†            | –               | =²             | –†           | success¹¹      | error¹¹     | –†                | –†               | –†              | –                  | –                          | error⁸ |
| success          | listening     | =ᶠ                    | thinking      | –               | tool_call¹     | –†           | –†             | –†          | –†                | –†               | –†              | speaking           | –                          | error⁴ |
| error            | listening     | =ᶠ                    | thinking      | –               | tool_call¹     | –†           | –†             | –†          | –†                | –†               | –†              | speaking           | –                          | error⁴ |
| speaking         | listening⁵    | =ᶠ                    | thinking      | –               | tool_call¹     | –†           | –†             | –†          | –†                | –†               | –†              | –                  | idle                       | error⁴ |

Footnotes (guards): ᶠ `userSpeaking` set true/false, no-op when already equal (I7). ¹ `correlationId` present and new (∉ active, pending, `lastOutcome.correlationId`): opens `activeOperation {approvalStatus: not_required, phase: proposed}`; otherwise `–†`. ² same guard as ¹ but appended to `pendingOperations` tail (FIFO, cap `MAX_PENDING_OPERATIONS`); active unchanged. ³ matches active ∧ `approvalStatus ∈ {not_required, granted}` → `phase = executing`; otherwise `–†` (`out_of_phase` when it matches active with `pending`). ⁴ `source ∈ {adapter, mock}` → `lastOutcome {kind: error}`; no operation exists in these states; `source: 'manual'` → `–†` `manual_override`; in `error` the outcome is refreshed and state stays `error`. ⁵ barge-in (A-08): user speech interrupts thinking/speaking; governance states only set the flag. ⁶ text-only turn completion (A-07). ⁷ matches active ∧ `approvalStatus = not_required` → `pending`, `phase = awaiting_approval`; otherwise `–†`. ⁸ `source ∈ {adapter, mock}` → `lastOutcome {kind: aborted, correlationId, tool}`, active = null, queue cleared (A-09); `manual` → `–†`. ⁹ authoritative (matches active ∧ `source ∈ {adapter, mock}`) → `approvalStatus = granted`, `phase = proposed`, state `tool_call` — never `executing` (ORB-GOV-002, A-10); otherwise `–†`. ¹⁰ authoritative → `lastOutcome {kind: denied}` (ORB-GOV-004/007), then ‡: `tool_call` with the promoted queue head when the queue is non-empty, else `idle`. ¹¹ authoritative → `lastOutcome {kind: success | error}`, then ‡ as in ¹⁰ (`tool_call` on promotion instead of `success`/`error`). Every accepted snapshot-changing row also sets `provenance = event.source`, `updatedAt = ctx.now`, `visual = ctx.resolveVisual(state, activeOperation)` (semantic defaults only) and, on a state change, `previousState` (G6).

Property invariants (fast-check, `fc.array(arbNormalizedEvent, {maxLength: 200})` from the initial snapshot, 10 000 runs, seed printed on failure):

- I1 `activeOperation !== null ⇔ state ∈ GOVERNANCE_STATES`.
- I2 `pendingOperations.length > 0 ⇒ activeOperation !== null`; `pendingOperations.length ≤ MAX_PENDING_OPERATIONS`.
- I3 never `executing` for an operation unless `phase === 'executing'` and `approvalStatus ∈ {not_required, granted}`; for every operation that ever had `approvalStatus === 'pending'`, the first `executing` index is preceded, for the same `correlationId`, by an accepted authoritative `APPROVAL_GRANTED` and then an accepted `TOOL_STARTED` (ORB-GOV-002).
- I4 `state === 'waiting_approval' ⇒ approvalStatus === 'pending'`.
- I5 `state === 'success' ⇒ lastOutcome.kind === 'success'`; `state === 'error' ⇒ lastOutcome.kind ∈ {error, aborted}`.
- I6 every transition entering `success` from a different semantic state is caused by an accepted `TOOL_COMPLETED` whose `correlationId` equals the previously active operation and whose `source ∈ {adapter, mock}` (ORB-STATE-004 / ORB-GOV-003).
- I7 `USER_SPEAKING`/`USER_STOPPED_SPEAKING` never change `state` while in a governance state; `userSpeaking` alone never changes `state`.
- I8 an accepted `APPROVAL_DENIED` never yields `error` and never writes `lastOutcome.kind ∈ {error, aborted}` (ORB-GOV-004).
- I9 determinism: the same sequence replayed from the same initial snapshot yields a deep-equal trace; permuting `timestamp` values (arrival order kept) yields the same `state` trace (ORB-STATE-001, ORB-EVENT-009).
- I10 idempotency: inserting an immediate duplicate (same `id`) of any event after itself never changes the trace beyond the original (bus-level); at the reducer level a second `TOOL_STARTED`/`APPROVAL_REQUIRED`/`APPROVAL_GRANTED` for the active operation is rejected `duplicate` (ORB-EVENT-005).
- I11 any event with `source: 'manual'` and a lifecycle or `ERROR` type is rejected `manual_override` and leaves the snapshot identity-equal (ORB-GOV-008).
- I12 rejected and no-op results return the identical snapshot object (`Object.is`).
- I13 `tool_call`, `waiting_approval`, `executing` are pairwise distinct states with pairwise distinct `visual.formation` under defaults and distinct accessible labels (ORB-STATE-003).
- I14 after `success` or `error`, advancing a fake `Scheduler` by 60 000 ms with no event leaves `state` unchanged (ORB-STATE-008; run through the controller in 4.5).

**Edge cases.**

- `TOOL_REQUESTED` reusing `lastOutcome.correlationId` → `duplicate` (a closed operation cannot reopen).
- `TOOL_REQUESTED` without `correlationId` → `unknown_correlation` (G2; open question Q-2 in the amendments).
- 33rd pending operation → `out_of_phase`, logged; queue unchanged.
- `APPROVAL_REQUIRED` for a pending (not active) operation → `out_of_phase` (Q-1: the Wave 7 gateway serialises approval-required calls until decided).
- `ERROR` while `waiting_approval` → `error`, `lastOutcome.kind = 'aborted'`, approval controls disabled (A-09); a later `APPROVAL_GRANTED` for that id → `unknown_correlation` … no, `duplicate` because the id equals `lastOutcome.correlationId` (G4 order).
- `MODEL_STARTED` in a governance state → `out_of_phase` (tool lifecycle has priority); `MODEL_COMPLETED` there → silent no-op.
- `ASSISTANT_SPEAKING` in a governance state → no-op; speech overlapping execution is not visualised (Q-3).

**Acceptance criteria.**

- Given the 126-row fixture `tests/fixtures/state/transitions.json`, When each row's `(state, event, guard-satisfying payload)` is fed to `transition`, Then `next`, `kind` and `anomaly` match the row, and `describeTransitionTable()` deep-equals the fixture (regenerate with `pnpm spec:transitions`; CI fails on diff). — ORB-STATE-007, ORB-STATE-001, ORB-STATE-006 — `tests/unit/engine/state/transitions.table.test.ts`
- Given random event sequences, When invariants I1–I13 are checked over 10 000 runs, Then no counter-example is found. — ORB-STATE-001, ORB-STATE-004, ORB-GOV-002, ORB-GOV-003, ORB-GOV-004, ORB-GOV-008, ORB-GOV-009, ORB-EVENT-005, ORB-EVENT-009 — `tests/unit/engine/state/transitions.property.test.ts`
- Given `thinking` + `TOOL_REQUESTED{cid:a}` + `APPROVAL_REQUIRED{cid:a}` + `APPROVAL_GRANTED{cid:a, source:'mock'}`, When applied, Then state is `tool_call` with `approvalStatus 'granted'`, `phase 'proposed'`, and only the following `TOOL_STARTED{cid:a}` yields `executing`. — ORB-GOV-001, ORB-GOV-002 — `tests/unit/engine/state/governance.test.ts`
- Given `waiting_approval` for `a`, When `TOOL_STARTED{cid:a}` arrives, Then rejected `out_of_phase` and the snapshot is identity-equal. — ORB-GOV-002 — `tests/unit/engine/state/governance.test.ts`
- Given `waiting_approval` for `a` with pending `b`, When `APPROVAL_DENIED{cid:a}` arrives, Then `lastOutcome.kind === 'denied'`, `activeOperation.correlationId === 'b'`, state `tool_call`. — ORB-GOV-007, ORB-GOV-009 — `tests/unit/engine/state/governance.test.ts`
- Given `executing` for `a`, When `TOOL_COMPLETED{cid:a, source:'manual'}` arrives, Then rejected `manual_override`; When `TOOL_COMPLETED{cid:'zzz', source:'adapter'}` arrives, Then rejected `unknown_correlation`. — ORB-GOV-008, ORB-STATE-004 — `tests/unit/engine/state/governance.test.ts`
- Given `executing` for `a`, When `ERROR{source:'adapter'}` arrives, Then `error`, `lastOutcome.kind === 'aborted'`, `pendingOperations.length === 0`. — ORB-GOV-009 — `tests/unit/engine/state/activeOperation.test.ts`
- Given `waiting_approval`, When the snapshot is inspected, Then `activeOperation.tool`, `correlationId`, `approvalStatus`, `phase` are present. — ORB-STATE-005 — `tests/unit/engine/state/activeOperation.test.ts`

**Observability.** Pure; logging is done by the controller with the names of G7: `orb.state.transition` (info: `{ from, to, type, correlationId?, source }`), `orb.state.noop` (only when `logNoops: true`), `orb.state.promoted` (info: `{ correlationId, queued }`), `orb.state.aborted` (warn: `{ correlationId?, cleared }`).

### 4.4 Visual policy — bounded context `engine/visual-policy`

**Objective.** Every state has a default visual configuration; tool visuals are a registry with a generic fallback; reduced motion zeroes motion without touching semantics; resolution is pure and never reads provenance.

**Contracts.**

```ts
// engine/visual-policy/stateVisuals.ts
export type FormationId = string & { readonly __brand: "FormationId" };
export function formationId(id: string): FormationId; // brand only; validated by the registry (Wave 3 owns the full registry)
export const KNOWN_FORMATION_IDS = [
  "sphere",
  "rings",
  "neural",
  "polyhedron",
  "network",
  "face",
  "gate",
  "generic-tool",
  "aisac",
  "explosion",
  "collapse",
  "error-distortion",
] as const; // = BUILT_IN_FORMATIONS (Appendix C.1)
export interface OrbVisualState {
  formation: FormationId;
  rotationSpeed: number;
  turbulence: number;
  pulseStrength: number;
  connectionDensity: number;
  particleScale: number;
  morphDurationMs: number;
}
export const STATE_VISUAL_DEFAULTS: Readonly<Record<OrbState, OrbVisualState>>; // table below; ORB-VISUAL-002
export const VISUAL_RANGES: Readonly<
  Record<Exclude<keyof OrbVisualState, "formation">, { min: number; max: number }>
>; // Appendix C.2

// engine/visual-policy/toolVisualRegistry.ts
export interface ToolVisualRegistry {
  register(input: { tool: string; formation: FormationId }): void;
  resolve(tool: string | undefined): FormationId;
  has(tool: string): boolean;
  clear(): void;
}
export function createToolVisualRegistry(opts: {
  isRegisteredFormation: (id: FormationId) => boolean;
  logger: Logger;
}): ToolVisualRegistry; // Map keyed by sanitized tool id; unknown tool → 'generic-tool' (ORB-TOOLVIS-001); unknown formation → 'generic-tool' + one warn per id (ORB-TOOLVIS-003)
export function registerToolVisual(input: { tool: string; formation: FormationId }): void; // SHARED_CONTRACTS free function bound to the default registry; never touches state (ORB-TOOLVIS-002)

// engine/visual-policy/motionPreference.ts
export type MotionPreference = "full" | "reduced";
export function applyMotionPreference(
  visual: OrbVisualState,
  pref: MotionPreference,
): OrbVisualState; // reduced → rotationSpeed 0, turbulence 0, pulseStrength 0, morphDurationMs 0; formation/connectionDensity/particleScale unchanged (ORB-A11Y-007 text side)

// engine/visual-policy/resolve.ts
export interface VisualOverrides {
  states?: Partial<Record<OrbState, Partial<OrbVisualState>>>;
}
export function resolveVisualState(
  state: OrbState,
  op: ActiveOperation | null,
  pref: MotionPreference,
  registry: ToolVisualRegistry,
  overrides?: VisualOverrides,
): OrbVisualState; // applied layer only: defaults → tool visual (tool_call only) → host override → motion preference; never used to populate the semantic snapshot
export function resolveSemanticDefaults(
  state: OrbState,
  op: ActiveOperation | null,
): OrbVisualState; // returns semantic state defaults only; no registry, host override or motion input
```

Defaults (`STATE_VISUAL_DEFAULTS`; units per Appendix C.2):

| State            | formation                                                 | rotationSpeed | turbulence | pulseStrength | connectionDensity | particleScale | morphDurationMs |
| ---------------- | --------------------------------------------------------- | ------------- | ---------- | ------------- | ----------------- | ------------- | --------------- |
| idle             | sphere                                                    | 0.15          | 0.05       | 0.10          | 0                 | 1             | 1200            |
| listening        | rings                                                     | 0.25          | 0.10       | 0.35          | 0                 | 1             | 900             |
| thinking         | neural                                                    | 0.40          | 0.35       | 0.20          | 0.15              | 1             | 900             |
| tool_call        | polyhedron (or registered tool visual, else generic-tool) | 0.30          | 0.15       | 0.25          | 0.10              | 1             | 700             |
| waiting_approval | gate                                                      | 0.05          | 0.05       | 0.50          | 0                 | 1.1           | 700             |
| executing        | network                                                   | 0.50          | 0.25       | 0.30          | 0.60              | 1             | 700             |
| success          | collapse                                                  | 0.10          | 0.05       | 0.60          | 0                 | 1.2           | 600             |
| error            | error-distortion                                          | 0.05          | 0.60       | 0.40          | 0                 | 0.9           | 500             |
| speaking         | face                                                      | 0.10          | 0.10       | 0.45          | 0                 | 1             | 1000            |

**Behavior.** `resolveVisualState` is referentially transparent: `(state, op?.tool, pref, registry contents, overrides)` fully determine the output; `provenance`, `lastOutcome` and timers are not inputs. In `tool_call` the formation is `registry.resolve(op.tool)`; with `op === null` (impossible by I1, guarded anyway) it is `polyhedron`. In `waiting_approval` and `executing` the formation is the state default (the tool visual is a `tool_call` look only; A-10). Registration of a tool visual is a registry write: it does not emit, reduce or resolve.

**Edge cases.**

- `registerToolVisual({ tool: 'web_search', formation: 'radar' })` with `radar` unregistered → `resolve('web_search') === 'generic-tool'`, `orb.visual.unregistered_formation` logged once; a later `registerFormation('radar')` (Wave 6) makes the mapping resolve without re-registration because `isRegisteredFormation` is consulted at resolve time.
- `register({ tool: 'APPROVED ✔' })` → tool id fails `TOOL_ID_PATTERN` → ignored, warn `orb.visual.invalid_tool_id`.
- Override sets `rotationSpeed: 99` → clamped to `VISUAL_RANGES.max` (2) with `orb.visual.clamped` once.
- `pref: 'reduced'` + `waiting_approval` → `gate`, `morphDurationMs 0`, `pulseStrength 0`.

**Acceptance criteria.**

- Given every `OrbState`, When `STATE_VISUAL_DEFAULTS[state]` is read, Then all 7 fields exist, numbers are finite and within `VISUAL_RANGES`, `formation ∈ KNOWN_FORMATION_IDS`, and the map matches Appendix C.1. — ORB-STATE-002, ORB-VISUAL-001, ORB-VISUAL-002 — `tests/unit/engine/visual-policy/stateVisuals.test.ts`
- Given the three governance states, When resolved with defaults, Then formations are pairwise distinct. — ORB-STATE-003 — `tests/unit/engine/visual-policy/stateVisuals.test.ts`
- Given no registration, When `resolve('database_query')`, Then `'generic-tool'`; Given `register({tool:'database_query', formation:'polyhedron'})`, Then `'polyhedron'`. — ORB-TOOLVIS-001, ORB-TOOLVIS-003 — `tests/unit/engine/visual-policy/toolVisualRegistry.test.ts`
- Given a random event sequence, When run with and without 20 random tool registrations, Then the `OrbSnapshot` traces (minus `visual.formation`) are deep-equal. — ORB-TOOLVIS-002 — `tests/unit/engine/visual-policy/toolVisualRegistry.property.test.ts`
- Given any state and `pref: 'reduced'`, When resolved, Then `rotationSpeed === turbulence === pulseStrength === morphDurationMs === 0` and `formation` equals the `'full'` result. — ORB-VISUAL-001 — `tests/unit/engine/visual-policy/motionPreference.test.ts`

**Observability.** `orb.visual.unregistered_formation` (warn, once per formation id), `orb.visual.invalid_tool_id` (warn), `orb.visual.clamped` (warn, once per field).

### 4.5 OrbController — bounded context `engine` (application)

**Objective.** The application service that owns the snapshot, wires bus → `transition` → visual policy → `RendererPort`, exposes `subscribe(snapshot)`, records manual `setState` as provenance `'manual'`, and routes approval decisions UI → adapter without touching the snapshot.

**Contracts.**

```ts
// engine/ports/RendererPort.ts — interface verbatim SHARED_CONTRACTS (CapabilityReport, RendererPort, UniformName, FrameTimeSource). Wave 2 implements it.
// engine/ports/NullRenderer.ts
export function createNullRenderer(): RendererPort & {
  readonly calls: ReadonlyArray<{ method: keyof RendererPort; args: unknown[] }>;
}; // capabilities { webgl2:false, webgl1:false, maxPointSize:0, deviceMemoryGb:null, mobile:false, reason:'null-renderer' }; records calls; never throws

// engine/OrbController.ts
export interface OrbControllerOptions {
  clock: Clock;
  scheduler: Scheduler;
  logger: Logger;
  renderer: RendererPort;
  motionPreference?: MotionPreference;
  toolVisuals?: ToolVisualRegistry;
  visualOverrides?: VisualOverrides;
  dedupeCapacity?: number;
  logNoops?: boolean;
}
export interface AdapterStatus {
  name: string;
  simulated: boolean;
  connected: boolean;
}
export class OrbController {
  constructor(options: OrbControllerOptions);
  getSnapshot(): OrbSnapshot; // stable reference until the next accepted change (useSyncExternalStore-safe)
  emit(raw: unknown): EmitResult; // = bus.emit; the only path that can open/advance/close an operation
  setState(state: OrbState): void; // MANUAL: state + provenance 'manual' + anomaly log; never touches activeOperation/pendingOperations/lastOutcome (ORB-API-004 semantics, A-11)
  subscribe(callback: (snapshot: OrbSnapshot) => void): () => void; // called synchronously after every accepted change; not on rejections
  attachAdapter(adapter: AgentAdapter): () => void; // one adapter at a time (second attachment is rejected until the first is detached); forces source = adapter.simulated ? 'mock' : 'adapter'; calls adapter.connect(); returns detach
  getAdapterStatus(): AdapterStatus | null;
  onApprovalDecision(callback: (decision: ApprovalDecision) => void): () => void;
  submitApprovalDecision(decision: "approve" | "deny"): ApprovalDecision | null; // builds { correlationId: active.correlationId, decision, idempotencyKey: ids.create() } when approvalStatus === 'pending'; notifies callbacks; calls adapter.respondToApproval?.(); never mutates the snapshot (ORB-GOV-005/010)
  setMotionPreference(pref: MotionPreference): void; // re-resolves the applied visual layer only; the complete semantic snapshot stays unchanged
  dispose(): void; // detaches adapter, disposes bus, clears subscribers, renderer.dispose()
}
```

**Behavior.** `emit` → bus → `reduce = e => transition(semanticSnapshot, e, { now: clock.now(), resolveVisual: resolveSemanticDefaults })`; on an accepted snapshot-changing result the controller commits the new semantic snapshot and clears any manual projection; accepted no-ops and rejected results preserve both snapshots. It pushes visuals to the renderer (`setUniform('uRotationSpeed' | 'uTurbulence' | 'uPulseStrength' | 'uParticleScale', …)`, `setConnections(null, connectionDensity)`; formation targets are Wave 3's `FormationManager`), logs G7 events and notifies subscribers in order. `setState(s)` builds a separate public display projection `{ ...semanticSnapshot, state: s, previousState: snapshot.state, provenance: 'manual', visual: resolve(s, activeOperation, pref), updatedAt }`, leaving `activeOperation`, `pendingOperations`, `lastOutcome`, `userSpeaking` untouched, logs `orb.controller.manual_override` and notifies subscribers; it does not pass through the bus and does not replace `semanticSnapshot`. Future events always use the retained semantic snapshot, never the manual display projection (see `SHARED-CONTRACTS.md`). `attachAdapter` overrides `source` on every adapter event (a simulated adapter cannot claim `'adapter'`, a real one cannot claim `'mock'`) before `emit`. `submitApprovalDecision` when no pending approval → returns `null`, logs `orb.approval.ignored`. No `setTimeout`, `setInterval`, `Date.now` or `requestAnimationFrame` inside `engine/**` (lint + arch test); the only `Scheduler` use in this wave is the Wave 4 settle timer placeholder, which is not implemented here.

**Edge cases.**

- `setState('success')` from `executing` → state `success`, `lastOutcome` unchanged (still `null` or previous), `activeOperation` still `executing`-phase; the UI shows "Success (manual)"; a later authoritative `TOOL_COMPLETED` for the active id still yields `success` with `provenance 'adapter'`. Manual `success` never satisfies ORB-STATE-004 (I5 is a reducer invariant; the controller-level test asserts `lastOutcome` untouched).
- `setState('idle')` while `waiting_approval` → state `idle`, `activeOperation` retained with `approvalStatus 'pending'`; approval controls remain enabled (they key on `activeOperation`, not `state`); the announcement is "Idle (manual) — tool: web_search — approve or deny".
- `submitApprovalDecision('approve')` twice before an authoritative response → one pending command for the correlation, one idempotency key and one delivery; the second call does not independently forward. Use the same routing and duplicate-decision contract as W4 `decideApproval` (ORB-GOV-010; transport replay protection is W7).
- Adapter emits `source: 'manual'` → overridden to `'mock'`/`'adapter'` (adapters cannot inject manual provenance).
- `attachAdapter` while another is attached → rejected `adapter_already_attached`; explicit detach performs cleanup with handled async failures. Only one active adapter (risk d4).
- Subscriber throws → caught, logged `orb.controller.subscriber_error`, others still notified.

**Acceptance criteria.**

- Given a controller with `NullRenderer`, When the governed script's events are emitted in order, Then `getSnapshot().state` traces `idle, listening, idle, thinking, tool_call, waiting_approval, tool_call, executing, success, speaking, idle` and every subscriber call carries a new snapshot reference. — ORB-ARCH-003, ORB-STATE-001 — `tests/unit/engine/orb-controller.test.ts`
- Given `executing`, When `setState('success')` is called, Then `state === 'success'`, `provenance === 'manual'`, `activeOperation` identity-equal to before, `lastOutcome` unchanged, and `orb.controller.manual_override` logged. — ORB-EVENT-008, ORB-GOV-008, ORB-STATE-004 — `tests/unit/engine/orb-controller.test.ts`
- Given `waiting_approval`, When `submitApprovalDecision('approve')` is called, Then the callback receives `{ correlationId, decision:'approve', idempotencyKey }`, `adapter.respondToApproval` was called once with it, and `getSnapshot()` is identity-equal before/after. — ORB-GOV-005, ORB-SEC-003, ORB-GOV-010 — `tests/unit/engine/orb-controller.test.ts`
- Given `success`, When the fake `Scheduler` runs every pending task and the fake `Clock` advances 60 000 ms, Then `state === 'success'`. — ORB-STATE-008 — `tests/unit/engine/orb-controller.test.ts`
- Given the mock adapter with all script delays set to 0 and again with default delays, When both runs complete, Then the `state` traces are deep-equal. — ORB-DEMO-004 — `tests/integration/engine/mock-to-controller.test.ts`
- Given the source tree, When `tests/unit/arch/wave1-boundaries.test.ts` scans `engine/**`, `events/**` for `setTimeout|setInterval|Date.now|requestAnimationFrame|Math.random`, Then zero hits. — ORB-DEMO-004, ORB-STATE-001 — `tests/unit/arch/wave1-boundaries.test.ts`

**Observability.** `orb.controller.manual_override` (warn: `{ from, to }`), `orb.approval.decision` (info: `{ correlationId, decision, idempotencyKey, simulated }`), `orb.approval.ignored` (warn: `{ reason: 'no_pending_approval' }`), `orb.adapter.attached` / `orb.adapter.detached` (info: `{ name, simulated }`), `orb.controller.subscriber_error` (error). Child logger carries `correlationId` while an operation is active.

### 4.6 Mock adapter — bounded context `adapters/mock`

**Objective.** A credential-free adapter that plays governed sequences through the injected `Scheduler`/`Clock`, emits only `source: 'mock'` events, waits for a real approval decision by default, and releases everything on `disconnect()`.

**Contracts.**

```ts
// adapters/AgentAdapter.ts (verbatim SHARED_CONTRACTS)
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

// adapters/mock/scripts/index.ts
export type MockStep =
  | {
      kind: "emit";
      delayMs: number;
      event: Pick<OrbEvent<OrbEventMetadata>, "type" | "metadata"> & { correlationRef?: "op" };
    }
  | {
      kind: "waitForApproval";
      onApprove: ReadonlyArray<MockStep>;
      onDeny: ReadonlyArray<MockStep>;
    };
export interface MockScript {
  readonly name: "governed" | "denied" | "error" | "speech";
  readonly steps: ReadonlyArray<MockStep>;
  readonly tool?: string;
}
export const governedToolSequence: MockScript; // USER_SPEAKING → +900 USER_STOPPED_SPEAKING → +200 MODEL_STARTED → +1200 TOOL_REQUESTED{tool:'web_search'} → +300 APPROVAL_REQUIRED → waitForApproval{ onApprove: APPROVAL_GRANTED → +400 TOOL_STARTED → +1500 TOOL_COMPLETED → +400 ASSISTANT_SPEAKING → +2000 ASSISTANT_STOPPED_SPEAKING; onDeny: APPROVAL_DENIED → +400 ASSISTANT_SPEAKING → +1500 ASSISTANT_STOPPED_SPEAKING }
export const deniedSequence: MockScript; // same head; waitForApproval replaced by APPROVAL_DENIED after +800 (scripted denial, for CI without a click)
export const errorSequence: MockScript; // … TOOL_STARTED → +1200 TOOL_FAILED{reason:'simulated failure'} → ASSISTANT_SPEAKING → ASSISTANT_STOPPED_SPEAKING
export const speechSequence: MockScript; // MODEL_STARTED → +600 MODEL_COMPLETED → +200 ASSISTANT_SPEAKING → +1800 ASSISTANT_STOPPED_SPEAKING

// adapters/mock/MockAdapter.ts
export interface MockAdapterOptions {
  scheduler: Scheduler;
  clock: Clock;
  script?: MockScript;
  requireApproval?: boolean /* default true */;
  autoApproveAfterMs?: number;
  logger?: Logger;
  prng?: Prng;
}
export interface MockAdapter extends AgentAdapter {
  readonly simulated: true;
  run(script?: MockScript): Promise<void>;
  stop(): void;
  readonly running: boolean;
  respondToApproval(decision: ApprovalDecision): Promise<void>;
}
export function createMockAdapter(options: MockAdapterOptions): MockAdapter;

// adapters/index.ts — export type { AgentAdapter, ApprovalDecision }; export { createMockAdapter, governedToolSequence, deniedSequence, errorSequence, speechSequence }.
```

**Behavior.** `connect()` marks connected (idempotent); `run(script)` (default `governedToolSequence`) schedules step 0 via `scheduler.schedule`; each `emit` step builds `{ type, timestamp: clock.now(), id: 'mock-<runSeq>-<stepIndex>', correlationId: 'mock-op-<runSeq>' for lifecycle steps, source: 'mock', metadata: { ...step.metadata, simulated: true } }` and delivers to subscribers in subscription order, then schedules the next step. `waitForApproval`: with `requireApproval: false` the adapter continues on `onApprove` after 0 ms (still emitting `APPROVAL_REQUIRED` + `APPROVAL_GRANTED`, both `source: 'mock'`, ORB-DEMO-006); with `autoApproveAfterMs` it schedules the approve branch; otherwise it parks until `respondToApproval` — `approve` → `onApprove`, `deny` → `onDeny`; a decision whose `correlationId` is not the parked operation, or a second decision, is ignored with `orb.mock.decision_ignored`. `disconnect()`/`stop()` cancel every scheduled task (cancel functions are tracked in a `Set`), drop the parked approval, clear subscribers (`disconnect` only), set `running = false`; both idempotent. Script timing never reaches the controller: the adapter has no reference to it (ORB-DEMO-004).

**Edge cases.**

- `run()` while running → rejects with `MockAdapterError('already_running')`; `stop()` then `run()` starts a new `runSeq` (fresh ids and correlationId).
- `respondToApproval` before `APPROVAL_REQUIRED` was emitted → ignored, logged.
- `disconnect()` mid-`waitForApproval` → no further events; `respondToApproval` afterwards resolves with no effect.
- Subscriber throws → logged `orb.mock.listener_error`, script continues.
- `clock` frozen (tests): all events share a timestamp; the controller does not care (ORB-EVENT-009).

**Acceptance criteria.**

- Given a fake `Scheduler` and `Clock`, When the governed script runs and `respondToApproval({decision:'approve'})` is called at the parked step, Then the delivered types are exactly the 11 governed events in order, every event has `source === 'mock'`, `metadata.simulated === true`, integer `timestamp`, and lifecycle events share one `correlationId`. — ORB-ADAPTER-001, ORB-ADAPTER-007, ORB-DEMO-002, ORB-EVENT-001 — `tests/unit/adapters/mock-adapter.test.ts`
- Given the parked approval, When `respondToApproval({decision:'deny'})`, Then `APPROVAL_DENIED` follows and no `TOOL_STARTED` is ever delivered. — ORB-GOV-004, ORB-ADAPTER-007 — `tests/unit/adapters/mock-adapter.test.ts`
- Given a running script, When `disconnect()` is called, Then the fake scheduler has 0 pending tasks, `subscribers.size === 0`, and advancing the scheduler delivers nothing. — ORB-ADAPTER-005 — `tests/unit/adapters/mock-adapter.test.ts`
- Given `requireApproval: false`, When the script runs, Then `APPROVAL_REQUIRED` and `APPROVAL_GRANTED` are still delivered with `source 'mock'`. — ORB-ADAPTER-007 (ORB-DEMO-006 touched) — `tests/unit/adapters/mock-adapter.test.ts`
- Given the adapter attached to a controller, When the governed script runs to completion, Then the snapshot trace equals the one in 4.5 and the a11y announcements list (4.7, pure `announce`) matches the golden file. — ORB-EVENT-003, ORB-ARCH-003 — `tests/integration/engine/mock-to-controller.test.ts`

**Observability.** `orb.mock.run_started` (info: `{ script, runSeq, requireApproval }`), `orb.mock.step` (info: `{ runSeq, index, type, correlationId? }`), `orb.mock.parked_for_approval` (info), `orb.mock.decision_ignored` (warn: `{ reason }`), `orb.mock.stopped` (info: `{ cancelled }`), `orb.mock.listener_error` (error).

### 4.7 Accessible UI — bounded context `components/a11y` + `components/store`

**Objective.** The semantic mirror of the controller: an HTML-only, screen-reader-first surface that announces every accepted change, identifies the active tool, offers keyboard Approve/Deny that only submit decisions, and labels simulated and manual provenance with icon + text.

**Contracts.**

```ts
// components/store/orbStore.ts (zustand/vanilla + useSyncExternalStore; imports only engine/index.ts and adapters/index.ts types)
export interface Announcement {
  seq: number;
  text: string;
  politeness: "polite" | "assertive";
  at: number;
}
export interface OrbStoreState {
  snapshot: OrbSnapshot;
  adapter: AdapterStatus | null;
  announcements: ReadonlyArray<Announcement>;
  lastEmit: EmitResult | null;
}
export const MAX_ANNOUNCEMENTS = 20;
export function announce(
  prev: OrbSnapshot | null,
  next: OrbSnapshot,
  ctx: { simulated: boolean },
): Announcement | null; // PURE; null when nothing accessible changed
export function createOrbStore(controller: OrbController): StoreApi<OrbStoreState>; // subscribes controller.subscribe; appends announce() results
export function useOrbStore<T>(
  store: StoreApi<OrbStoreState>,
  selector: (s: OrbStoreState) => T,
): T;

// components/a11y/labels.ts
export const STATE_LABELS: Readonly<Record<OrbState, string>>; // idle 'Idle', listening 'Listening', thinking 'Thinking', tool_call 'Tool requested', waiting_approval 'Awaiting approval', executing 'Executing', success 'Success', error 'Error', speaking 'Speaking'
export const OUTCOME_LABELS: Readonly<Record<LastOutcome["kind"], { icon: string; word: string }>>; // success {✓,'Success'}, error {✕,'Error'}, denied {⊘,'Denied'}, aborted {⚠,'Aborted'}
export function formatAnnouncement(next: OrbSnapshot, ctx: { simulated: boolean }): string;
export function displayTool(op: ActiveOperation | LastOutcome | null): string; // sanitized tool id or 'unknown tool'; never metadata.label

// components/a11y/StateAnnouncer.tsx   props { store }
// components/a11y/ActiveOperationPanel.tsx   props { store }
// components/a11y/ApprovalControls.tsx   props { store; controller }   (calls controller.submitApprovalDecision only)
// components/a11y/ProvenanceBadge.tsx   props { store }
// components/a11y/index.ts — exports the four components + labels
```

**Behavior — accessible UI contract.**

| Element                    | Role / attributes                                                                                                                                                                                                             | Rule                                                                                                                                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StateAnnouncer` container | `<section aria-labelledby="orb-status-heading">` with `<h2 id="orb-status-heading">Orb status</h2>`; inside, `<div role="status" aria-live="polite" aria-atomic="false" aria-relevant="additions">`                           | SSR-rendered with the initial announcement "Idle"; one `<p data-announcement data-seq>` appended per accepted change (ORB-A11Y-006); oldest removed beyond `MAX_ANNOUNCEMENTS`; no debouncing                                                   |
| Assertive channel          | `<div role="alert">` sibling, text replaced (`aria-atomic="true"`)                                                                                                                                                            | used only for entering `waiting_approval` ("Approval required: <tool>. Use Approve or Deny."), `error` and `aborted` outcomes; the same text is also appended to the polite log so the history stays complete                                   |
| Current state line         | `<p data-testid="orb-state">` (not live)                                                                                                                                                                                      | `${STATE_LABELS[state]}${provenance === 'manual' ? ' (manual)' : ''}`; readable, never announced twice                                                                                                                                          |
| `ActiveOperationPanel`     | `<dl>` with `<dt>Tool</dt><dd data-testid="op-tool">`, `<dt>Correlation</dt>`, `<dt>Approval</dt><dd data-testid="op-approval">`, `<dt>Phase</dt>`                                                                            | renders while `activeOperation !== null` (ORB-STATE-005, ORB-GOV-006); tool as `<code>` text node from `displayTool`; approval status words: "not required", "pending", "granted", "denied"                                                     |
| Pending queue              | `<ol aria-label="Queued tool requests">`                                                                                                                                                                                      | one `<li>` per pending operation: tool + "queued"                                                                                                                                                                                               |
| `ApprovalControls`         | `<div role="group" aria-labelledby="approval-heading">`; `<button type="button" data-testid="approve">Approve <tool></button>`, `<button type="button" data-testid="deny">Deny <tool></button>`; `aria-describedby="op-tool"` | `disabled` unless `activeOperation?.approvalStatus === 'pending'` (ORB-GOV-010); native buttons → Enter/Space (ORB-A11Y-002); `:focus-visible` outline ≥ 2 px, never `outline: none`; focus is not stolen when they enable; Escape does nothing |
| Outcome                    | `<p data-testid="orb-outcome">` `<span aria-hidden="true">✓</span> Success: web_search completed`                                                                                                                             | icon + word + tool, never colour alone (ORB-A11Y-005); Tailwind colour classes are additive                                                                                                                                                     |
| `ProvenanceBadge`          | `<span data-testid="badge-simulated"><span aria-hidden="true">◌</span> Simulated</span>`; `<span data-testid="badge-manual">(manual)</span>`                                                                                  | Simulated shown whenever `adapter?.simulated === true` or `snapshot.provenance === 'mock'` (ORB-DEMO-002, ORB-EVENT-008); manual shown when `provenance === 'manual'`; both text + icon                                                         |
| Focus order (`/text-orb`)  | h1 → Run AI Sequence → Require approval (switch) → Script select → Stop → current state → operation panel → Approve → Deny → announcement log                                                                                 | asserted in e2e; every interactive element reachable by Tab; no positive `tabindex`                                                                                                                                                             |
| Metadata rendering         | all metadata reaches the DOM only through `displayTool`/`sanitizeLabel` as React text children                                                                                                                                | `react/no-danger` lint error; no `innerHTML`; labels never placed inside `data-testid="orb-state"` or the outcome word (ORB-SEC-004, risk b2)                                                                                                   |

`announce(prev, next)` text rules: state change → `STATE_LABELS[next.state]` + `' (manual)'` when `provenance === 'manual'` + ` — tool: ${displayTool(op)}` when an operation is active + ` — approve or deny` when `approvalStatus === 'pending'` + ` — approved` when `granted` and state is `tool_call`; outcome change (`lastOutcome` identity changed) → `${OUTCOME_LABELS.word}: ${tool} ${verb}` with verbs `completed` / `failed` / `denied` ("Action denied: <tool>", A-06) / `aborted`; when `ctx.simulated` or `next.provenance === 'mock'` the outcome text is prefixed `Simulated — ` (ORB-DEMO-002). Flag-only changes (`userSpeaking`) produce "User speaking" / "User stopped speaking" (polite). Rejected events never announce (the store never sees them).

**Edge cases.**

- Two accepted changes in one macrotask → two `<p>` appended (append semantics survive React batching; each is a distinct node).
- `metadata.tool = '<img src=x onerror=alert(1)>'` → `displayTool` returns "unknown tool"; DOM contains no `img`; `window.__pwned` undefined.
- `metadata.tool = 'APPROVED'` (valid id) → shows `Tool: APPROVED` inside `<code>` only; the state text stays "Awaiting approval"; the outcome word never derives from metadata.
- WebGL absent / canvas hidden → this UI is unaffected by construction (no renderer dependency).
- Store created before the controller has an adapter → `Simulated` badge hidden until `attachAdapter` (then shown immediately, before any event).

**Acceptance criteria.**

- Given the store with each of the 9 states, When `StateAnnouncer` renders, Then `STATE_LABELS` are non-empty and pairwise unique and the current-state line matches. — ORB-A11Y-001, ORB-STATE-003 — `tests/unit/components/a11y/StateAnnouncer.test.tsx`
- Given `provenance 'manual'`, When rendered, Then the state line ends with "(manual)"; Given `adapter.simulated`, Then `badge-simulated` is present with the word "Simulated". — ORB-EVENT-008, ORB-DEMO-002 — `tests/unit/components/a11y/ProvenanceBadge.test.tsx`
- Given `waiting_approval`, When rendered, Then Approve/Deny are enabled, labelled "Approve web_search"/"Deny web_search"; Given `executing`, Then both are `disabled`. — ORB-GOV-010, ORB-A11Y-002 — `tests/unit/components/a11y/ApprovalControls.test.tsx`
- Given `waiting_approval`, When Approve is clicked, Then `controller.submitApprovalDecision` was called with `'approve'` and `controller.getSnapshot()` is identity-equal. — ORB-GOV-005, ORB-SEC-003 — `tests/unit/components/a11y/ApprovalControls.test.tsx`
- Given `lastOutcome.kind` ∈ {success, error, denied, aborted}, When rendered, Then the outcome contains the word and an `aria-hidden` icon; a denied outcome reads "Action denied: web_search" and never contains "Error"/"failed". — ORB-A11Y-005, ORB-GOV-004, ORB-GOV-007 — `tests/unit/components/a11y/outcome.test.tsx`
- Given the metadata fixtures (script tag, RTL override, 10 000 chars, `__proto__`), When `ActiveOperationPanel` renders, Then `container.innerHTML` contains only escaped text, no `<img>`/`<script>` element, `window.__pwned` undefined. — ORB-SEC-004, ORB-EVENT-004 — `tests/unit/components/a11y/metadata-rendering.test.tsx`
- Given the governed trace from 4.5, When `announce` is folded over it, Then the announcement texts equal `tests/fixtures/a11y/governed-announcements.json`. — ORB-A11Y-006, ORB-GOV-006 — `tests/unit/components/store/announce.test.ts`

**Observability.** `orb.a11y.announced` (info in dev builds only: `{ seq, politeness, state }`; text is not logged).

### 4.8 Text-only orb page — bounded context `app` (presentation, dev route)

**Objective.** Prove ORB-ARCH-005 and ORB-A11Y-006 end-to-end: a page with no canvas, no `three`, no network, where the mock adapter drives the controller and the accessible UI is the whole interface.

**Contracts.**

```ts
// app/text-orb/page.tsx  (server component shell; renders <TextOrbClient/>; excluded from the production sitemap; returns 404 in production unless NEXT_PUBLIC_ORB_TEXT_PAGE=on — read in app/, never in engine/)
// components/a11y/TextOrbClient.tsx ('use client')
//   - constructs OrbController({ clock: systemClock, scheduler: timeoutScheduler, logger, renderer: createNullRenderer(), motionPreference: matchMedia('(prefers-reduced-motion: reduce)') ? 'reduced' : 'full' })
//   - createMockAdapter({ scheduler, clock, requireApproval }) → controller.attachAdapter
//   - controls: <button data-testid="run-sequence">Run AI Sequence</button>, <label><input type="checkbox" role="switch" data-testid="require-approval" defaultChecked/> Require approval</label>, <select data-testid="script">governed|denied|error|speech</select>, <button data-testid="stop">Stop</button>
//   - query params honoured: ?sequencer=manual (exposes window.__orbDebug.sequencer.step()), ?script=<name>, ?requireApproval=0
//   - window.__orbDebug = { getSnapshot, announcements, sequencer } in dev builds only (read-only)
```

**Behavior.** `Run AI Sequence` calls `adapter.run(selectedScript)`; `Require approval` toggles `requireApproval` for the next run (label states the current value); with `?sequencer=manual` the page injects a `Scheduler` whose tasks only execute on `window.__orbDebug.sequencer.step()` so E2E never sleeps. The page contains no `<canvas>` and never imports `engine/render/**`, `engine/OrbEngine`, or `three` (dependency-cruiser rule `a11y-no-webgl`, arch test).

**Edge cases.**

- JavaScript disabled → the SSR HTML still contains the live region with "Idle", the heading and disabled controls (progressive, ORB-A11Y-006).
- `prefers-reduced-motion: reduce` → `motionPreference 'reduced'`; the text UI is unchanged (nothing animates here); `__orbDebug.getSnapshot().visual.morphDurationMs === 0`.
- Production build without the env flag → 404; the route never ships publicly by accident (the public demo is Wave 4's `/`).

**Acceptance criteria.**

- Given `/text-orb?sequencer=manual`, When the page loads, Then `document.querySelector('canvas') === null`, `[role=status]` exists in the initial HTML (`request.get` + parse) with text "Idle", and axe (WCAG 2.1 AA tags) reports 0 violations before and after the full governed run. — ORB-ARCH-005, ORB-A11Y-006, ORB-A11Y-001 — `tests/e2e/text-orb.a11y.spec.ts` (`tag: ['@ORB-ARCH-005','@ORB-A11Y-006','@ORB-A11Y-001']`)
- Given the page, When the user presses Tab from the document start, Then focus visits Run AI Sequence → Require approval → Script → Stop → Approve → Deny in that order, each with a computed `outline-style !== 'none'` when focused. — ORB-A11Y-002 — `tests/e2e/text-orb.keyboard.spec.ts`
- Given Run AI Sequence activated with Enter and the sequencer stepped to `waiting_approval`, When Space is pressed on Approve, Then the status log gains "Executing — tool: web_search — approved" … "Simulated — Success: web_search completed" and `[data-testid=orb-state]` reads "Success". — ORB-A11Y-002, ORB-GOV-010, ORB-DEMO-002, ORB-GOV-001 — `tests/e2e/text-orb.governance.spec.ts`
- Given the same run, When Deny is activated instead, Then the alert/log reads "Simulated — Action denied: web_search", the state line reads "Idle", and no text "Error" or "failed" appears. — ORB-GOV-004, ORB-GOV-007 — `tests/e2e/text-orb.governance.spec.ts`
- Given the `error` script, When run to completion, Then the outcome reads "Simulated — Error: web_search failed" with the `✕` icon `aria-hidden` and the word present. — ORB-A11Y-005 — `tests/e2e/text-orb.governance.spec.ts`
- Given `page.route('**/*', abort)` for every non-same-origin request, When the governed run completes, Then no aborted request was recorded. — ORB-DEMO-002 (ORB-DEMO-001 touched) — `tests/e2e/text-orb.governance.spec.ts`

**Observability.** Page-level only: `orb.page.text_orb.loaded` (info: `{ sequencer, script, requireApproval }`).

## 5. Parallel tracks

- **Track A (events + bus):** 4.1 → 4.2. One contributor; unblocks everything.
- **Track B (state + visual policy):** 4.3 and 4.4 can start from the SHARED_CONTRACTS types on day one, with the 126-row fixture authored first (test-first); they meet Track A at `EventBusOptions.reduce`.
- **Track C (mock adapter):** 4.6 depends only on `events/` types and `core/`; runs in parallel with B.
- **Track D (controller):** 4.5 integrates A + B + C; starts once `transition` signatures are stable (day 2–3).
- **Track E (UI):** 4.7 can be built against a hand-written `OrbSnapshot` fixture set and `announce()` golden files before the controller exists; 4.8 integrates D + E.
- Integration point: `tests/integration/engine/mock-to-controller.test.ts` (Node, no browser) then `tests/e2e/text-orb.*.spec.ts`.
- Wave 2 (renderer) runs concurrently with the whole wave; the only shared file is `engine/ports/RendererPort.ts`, frozen from SHARED_CONTRACTS in the first Wave 1 PR.

## 6. Threat model delta (STRIDE)

Threat model file: `docs/security/threats/semantic-core.md` (this wave).

| Surface                                              | S   | T   | R   | I   | D   | E   | Mitigation                                                                                                                                                                                                                                                                                                                                      | Req IDs                                            |
| ---------------------------------------------------- | --- | --- | --- | --- | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `EventBus.emit` ingress (host `orb.emit`, adapters)  | ✓   | ✓   | –   | ✓   | ✓   | ✓   | Zod strict schema, closed type set, 4 096-byte cap, id/correlation patterns; arrival-order processing with out-of-phase rejection; LRU dedupe; lifecycle events need `correlationId`; `source` defaulted and overridden per adapter; rejected events logged without payloads; re-entrant emits rejected synchronously, with no nested reduction | ORB-EVENT-001/003/004/005/007/008/009, ORB-GOV-009 |
| Metadata → accessible UI                             | ✓   | ✓   | –   | ✓   | ✓   | –   | Allow-list sanitiser (tool id pattern, 120-char printable labels, bidi/zero-width stripped, prototype keys dropped); React text nodes only; `react/no-danger` + `innerHTML` lint bans; state/outcome words derive only from enums; tool shown in a separate `<code>` field prefixed "Tool:"                                                     | ORB-EVENT-004, ORB-SEC-004, ORB-A11Y-001/005       |
| Approve/Deny controls + `onApprovalDecision` channel | ✓   | –   | ✓   | –   | –   | ✓   | Activation only builds an `ApprovalDecision` with a fresh `idempotencyKey` and forwards it; snapshot never changes until the authoritative `APPROVAL_*` returns through the adapter; controls enabled only while `approvalStatus === 'pending'`; decision logged with correlationId; clickjacking covered by Wave 0 `frame-ancestors 'none'`    | ORB-GOV-005/010, ORB-SEC-003, ORB-A11Y-002         |
| Manual `setState` channel                            | ✓   | –   | ✓   | –   | –   | ✓   | Provenance `'manual'` recorded and labelled "(manual)"; never opens/advances/closes an operation or writes `lastOutcome`; anomaly `manual_override` logged; manual lifecycle events rejected by the reducer                                                                                                                                     | ORB-EVENT-008, ORB-GOV-008, ORB-STATE-004          |
| Mock adapter / simulated events                      | ✓   | –   | –   | –   | ✓   | –   | `simulated: true`, `source` forced to `'mock'`, `metadata.simulated` forced true; persistent "Simulated" badge and prefixed outcome announcements; every timer tracked and cancelled on `disconnect()`; single active adapter                                                                                                                   | ORB-DEMO-002, ORB-ADAPTER-005/007                  |
| Pending-operation queue                              | –   | –   | –   | –   | ✓   | –   | `MAX_PENDING_OPERATIONS = 32`; overflow rejected `out_of_phase` and logged                                                                                                                                                                                                                                                                      | ORB-GOV-009                                        |
| Live-region announcements                            | –   | –   | –   | –   | ✓   | –   | Log capped at 20 nodes; rejected events never announce; adapters cannot bypass the bus                                                                                                                                                                                                                                                          | ORB-A11Y-006                                       |
| Structured logs                                      | –   | –   | –   | ✓   | –   | –   | Log only `type`, `state`, `correlationId`, anomaly codes; never `metadata`, labels, or payloads; no PII by construction                                                                                                                                                                                                                         | observability rules                                |

## 7. Tests

| Test (name references requirement IDs)                                                                                                                                                    | Type         | Req IDs                                                       | File                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `req('ORB-EVENT-001','ORB-EVENT-003','ORB-EVENT-004','ORB-EVENT-006') accepts a valid event and rejects missing or non-integer timestamps`                                                | unit         | ORB-EVENT-001, ORB-EVENT-003, ORB-EVENT-004, ORB-EVENT-006    | `tests/unit/events/schema.test.ts`                                    |
| `req('ORB-EVENT-007') rejects types outside the closed set with unknown_type`                                                                                                             | unit         | ORB-EVENT-007                                                 | `tests/unit/events/schema.test.ts`                                    |
| `req('ORB-EVENT-003','ORB-SEC-004') validateOrbEvent never throws for arbitrary input`                                                                                                    | property     | ORB-EVENT-003, ORB-SEC-004                                    | `tests/unit/events/schema.property.test.ts`                           |
| `req('ORB-EVENT-004','ORB-SEC-004') sanitizer drops unknown and prototype keys, strips controls and bidi, caps labels at 120`                                                             | unit         | ORB-EVENT-004, ORB-SEC-004                                    | `tests/unit/events/sanitize.test.ts`                                  |
| `req('ORB-EVENT-002','ORB-GOV-009') correlation helpers distinguish active, pending, last and unknown IDs; missing lifecycle correlation is rejected`                                     | unit         | ORB-EVENT-002, ORB-GOV-009                                    | `tests/unit/events/correlation.test.ts`                               |
| `req('ORB-EVENT-008','ORB-DEMO-002') source mock forces metadata.simulated true`                                                                                                          | unit         | ORB-EVENT-008, ORB-DEMO-002                                   | `tests/unit/events/sanitize.test.ts`                                  |
| `req('ORB-EVENT-005','ORB-EVENT-009') duplicate id is deduplicated and reduce runs once`                                                                                                  | unit         | ORB-EVENT-005, ORB-EVENT-009                                  | `tests/unit/engine/bus/event-bus.test.ts`                             |
| `req('ORB-EVENT-006','ORB-EVENT-009') re-entrant emits return invalid; top-level calls preserve arrival order`                                                                            | unit         | ORB-EVENT-009                                                 | `tests/unit/engine/bus/event-bus.test.ts`                             |
| `req('ORB-EVENT-006','ORB-EVENT-003') emit never throws and returns invalid for malformed payloads`                                                                                       | unit         | ORB-EVENT-006, ORB-EVENT-003                                  | `tests/unit/engine/bus/event-bus.test.ts`                             |
| `req('ORB-GOV-008') manual_override anomaly maps to reason invalid`                                                                                                                       | unit         | ORB-GOV-008                                                   | `tests/unit/engine/bus/event-bus.test.ts`                             |
| `req('ORB-EVENT-005') LRU store evicts beyond 512 and refreshes recency`                                                                                                                  | unit         | ORB-EVENT-005                                                 | `tests/unit/engine/bus/idempotency.test.ts`                           |
| `req('ORB-STATE-007','ORB-STATE-001','ORB-STATE-006') every one of the 126 fixture rows matches transition()`                                                                             | unit (table) | ORB-STATE-007, ORB-STATE-001, ORB-STATE-006                   | `tests/unit/engine/state/transitions.table.test.ts`                   |
| `req('ORB-STATE-001','ORB-STATE-004','ORB-GOV-002','ORB-GOV-003','ORB-GOV-004','ORB-GOV-008','ORB-GOV-009','ORB-EVENT-005','ORB-EVENT-009') invariants I1–I13 hold over random sequences` | property     | as listed                                                     | `tests/unit/engine/state/transitions.property.test.ts`                |
| `req('ORB-GOV-001','ORB-GOV-002') granted approval enters tool_call and only TOOL_STARTED enters executing`                                                                               | unit         | ORB-GOV-001, ORB-GOV-002                                      | `tests/unit/engine/state/governance.test.ts`                          |
| `req('ORB-GOV-007','ORB-GOV-009') denial closes with lastOutcome denied and promotes the queue head`                                                                                      | unit         | ORB-GOV-007, ORB-GOV-009                                      | `tests/unit/engine/state/governance.test.ts`                          |
| `req('ORB-GOV-008','ORB-STATE-004') manual and unknown-correlation completions are rejected`                                                                                              | unit         | ORB-GOV-008, ORB-STATE-004                                    | `tests/unit/engine/state/governance.test.ts`                          |
| `req('ORB-GOV-009','ORB-STATE-005') ERROR aborts the active operation and clears the queue; snapshot retains operation metadata until then`                                               | unit         | ORB-GOV-009, ORB-STATE-005                                    | `tests/unit/engine/state/activeOperation.test.ts`                     |
| `req('ORB-STATE-002','ORB-VISUAL-001','ORB-VISUAL-002','ORB-STATE-003') defaults are complete, in range and distinct for governance states`                                               | unit         | ORB-STATE-002, ORB-VISUAL-001, ORB-VISUAL-002, ORB-STATE-003  | `tests/unit/engine/visual-policy/stateVisuals.test.ts`                |
| `req('ORB-TOOLVIS-001','ORB-TOOLVIS-003') unknown tool and unregistered formation resolve to generic-tool`                                                                                | unit         | ORB-TOOLVIS-001, ORB-TOOLVIS-003                              | `tests/unit/engine/visual-policy/toolVisualRegistry.test.ts`          |
| `req('ORB-TOOLVIS-002') tool visual registration never changes the semantic trace`                                                                                                        | property     | ORB-TOOLVIS-002                                               | `tests/unit/engine/visual-policy/toolVisualRegistry.property.test.ts` |
| `req('ORB-VISUAL-001') reduced motion zeroes motion fields and keeps formation`                                                                                                           | unit         | ORB-VISUAL-001                                                | `tests/unit/engine/visual-policy/motionPreference.test.ts`            |
| `req('ORB-ARCH-003','ORB-STATE-001') controller traces the governed sequence deterministically`                                                                                           | unit         | ORB-ARCH-003, ORB-STATE-001                                   | `tests/unit/engine/orb-controller.test.ts`                            |
| `req('ORB-EVENT-008','ORB-GOV-008','ORB-STATE-004') setState is manual provenance and never touches operations or lastOutcome`                                                            | unit         | ORB-EVENT-008, ORB-GOV-008, ORB-STATE-004                     | `tests/unit/engine/orb-controller.test.ts`                            |
| `req('ORB-GOV-005','ORB-SEC-003','ORB-GOV-010') submitApprovalDecision forwards a decision and leaves the snapshot identity-equal`                                                        | unit         | ORB-GOV-005, ORB-SEC-003, ORB-GOV-010                         | `tests/unit/engine/orb-controller.test.ts`                            |
| `req('ORB-STATE-008') success persists for 60 s of scheduler time without events`                                                                                                         | unit         | ORB-STATE-008                                                 | `tests/unit/engine/orb-controller.test.ts`                            |
| `req('ORB-DEMO-004','ORB-STATE-001') engine and events contain no timers, Date.now or Math.random`                                                                                        | arch         | ORB-DEMO-004, ORB-STATE-001                                   | `tests/unit/arch/wave1-boundaries.test.ts`                            |
| `req('ORB-ARCH-005','ORB-ARCH-003') components/a11y and engine/state import no three, render or OrbEngine modules`                                                                        | arch         | ORB-ARCH-005, ORB-ARCH-003                                    | `tests/unit/arch/wave1-boundaries.test.ts`                            |
| `req('ORB-ADAPTER-001','ORB-ADAPTER-007','ORB-DEMO-002','ORB-EVENT-001') governed script emits 11 ordered mock events with simulated metadata`                                            | unit         | ORB-ADAPTER-001, ORB-ADAPTER-007, ORB-DEMO-002, ORB-EVENT-001 | `tests/unit/adapters/mock-adapter.test.ts`                            |
| `req('ORB-GOV-004','ORB-ADAPTER-007') deny decision emits APPROVAL_DENIED and never TOOL_STARTED`                                                                                         | unit         | ORB-GOV-004, ORB-ADAPTER-007                                  | `tests/unit/adapters/mock-adapter.test.ts`                            |
| `req('ORB-ADAPTER-005') disconnect cancels every scheduled task and clears subscribers`                                                                                                   | unit         | ORB-ADAPTER-005                                               | `tests/unit/adapters/mock-adapter.test.ts`                            |
| `req('ORB-EVENT-003','ORB-ARCH-003','ORB-DEMO-004') mock adapter drives the controller to the golden trace regardless of delays`                                                          | integration  | ORB-EVENT-003, ORB-ARCH-003, ORB-DEMO-004                     | `tests/integration/engine/mock-to-controller.test.ts`                 |
| `req('ORB-A11Y-001','ORB-STATE-003') every state has a unique non-empty label`                                                                                                            | unit (RTL)   | ORB-A11Y-001, ORB-STATE-003                                   | `tests/unit/components/a11y/StateAnnouncer.test.tsx`                  |
| `req('ORB-EVENT-008','ORB-DEMO-002') manual and Simulated badges render icon plus text`                                                                                                   | unit (RTL)   | ORB-EVENT-008, ORB-DEMO-002                                   | `tests/unit/components/a11y/ProvenanceBadge.test.tsx`                 |
| `req('ORB-GOV-010','ORB-A11Y-002','ORB-GOV-005','ORB-SEC-003') approval buttons enable only when pending and only submit decisions`                                                       | unit (RTL)   | ORB-GOV-010, ORB-A11Y-002, ORB-GOV-005, ORB-SEC-003           | `tests/unit/components/a11y/ApprovalControls.test.tsx`                |
| `req('ORB-A11Y-005','ORB-GOV-004','ORB-GOV-007') outcomes render word plus aria-hidden icon; denial never reads as error`                                                                 | unit (RTL)   | ORB-A11Y-005, ORB-GOV-004, ORB-GOV-007                        | `tests/unit/components/a11y/outcome.test.tsx`                         |
| `req('ORB-SEC-004','ORB-EVENT-004') hostile metadata renders as escaped text only`                                                                                                        | unit (RTL)   | ORB-SEC-004, ORB-EVENT-004                                    | `tests/unit/components/a11y/metadata-rendering.test.tsx`              |
| `req('ORB-A11Y-006','ORB-GOV-006') announce() over the governed trace matches the golden announcements`                                                                                   | unit         | ORB-A11Y-006, ORB-GOV-006                                     | `tests/unit/components/store/announce.test.ts`                        |
| `text-orb has no canvas, SSR live region, axe 0 violations` `{ tag: ['@ORB-ARCH-005','@ORB-A11Y-006','@ORB-A11Y-001'] }`                                                                  | e2e          | ORB-ARCH-005, ORB-A11Y-006, ORB-A11Y-001                      | `tests/e2e/text-orb.a11y.spec.ts`                                     |
| `tab order reaches Approve and Deny with visible focus` `{ tag: ['@ORB-A11Y-002'] }`                                                                                                      | e2e          | ORB-A11Y-002                                                  | `tests/e2e/text-orb.keyboard.spec.ts`                                 |
| `keyboard approve path reaches Simulated success; deny path reads Action denied` `{ tag: ['@ORB-A11Y-002','@ORB-GOV-010','@ORB-DEMO-002','@ORB-GOV-001','@ORB-GOV-004','@ORB-GOV-007'] }` | e2e          | as tagged                                                     | `tests/e2e/text-orb.governance.spec.ts`                               |
| `error script renders icon plus word; no external requests during a run` `{ tag: ['@ORB-A11Y-005','@ORB-DEMO-002'] }`                                                                     | e2e          | ORB-A11Y-005, ORB-DEMO-002                                    | `tests/e2e/text-orb.governance.spec.ts`                               |

CI: all unit/property/arch/integration tests run in stage 4 (Vitest, Node, jsdom for RTL); fast-check `numRuns` 10 000 for `transitions.property` in CI (200 locally), seed from `FC_SEED`; E2E in stage 7 against `next build && next start` with `NEXT_PUBLIC_ORB_TEXT_PAGE=on`, Chromium headless, `?sequencer=manual` (no wall-clock waits, no `waitForTimeout`); `--disable-webgl` irrelevant (no canvas). Golden fixtures: `tests/fixtures/state/transitions.json` (generated by `pnpm spec:transitions` from `describeTransitionTable()`, diffed against the Appendix A export), `tests/fixtures/a11y/governed-announcements.json`. Manual: screen-reader announcement quality (NVDA + Firefox, VoiceOver + Safari) recorded in `docs/reference/manual-verification.md` (ORB-A11Y-001/002/006 UX only; structure is automated). Mutation testing (Stryker) on `engine/state/**` and `engine/OrbController.ts` recommended before G1, threshold ≥ 85 % mutation score, non-blocking.

## 8. ADRs to record

- ADR-0005 — Event provenance and authoritative semantics: context — SPEC 0.1.0 never defines "authoritative" and `setState` can fake `success`; options — (a) trust every event equally, (b) `source` field on `OrbEvent` with `adapter | mock | manual` and authority = `source ∈ {adapter, mock}` ∧ matching active `correlationId`, (c) separate signed channel for authoritative events; recommendation — (b), with adapters overriding `source` at attach time and the reducer rejecting manual lifecycle events (`manual_override`); (c) deferred to the Wave 7 gateway, where the server derives `source: 'adapter'` from its own executor.
- ADR-0006 — Approval decision channel: context — ORB-A11Y-002 requires keyboard Approve/Deny but `AgentAdapter` (0.1.0) has no command path and ORB-GOV-005 forbids visual state from granting approval; options — (a) UI mutates the snapshot to `granted` optimistically, (b) UI emits `APPROVAL_GRANTED` itself, (c) UI → `OrbController.submitApprovalDecision` → `onApprovalDecision` callbacks + optional `AgentAdapter.respondToApproval`, with the authoritative `APPROVAL_*` event always returning through the adapter; recommendation — (c); decisions carry an `idempotencyKey` so the Wave 7 endpoint can dedupe (ORB-SEC-007).

## 9. Deliverables

- `events/domain/{OrbEvent.ts, OrbEventType.ts, schema.ts, sanitize.ts, correlation.ts}`, `events/index.ts`
- `engine/EventBus.ts`, `engine/bus/{EventBus.impl.ts, idempotency.ts}`
- `engine/StateMachine.ts`, `engine/state/{transitions.ts, governance.ts, activeOperation.ts, snapshot.ts}`
- `engine/visual-policy/{stateVisuals.ts, toolVisualRegistry.ts, motionPreference.ts, resolve.ts}`
- `engine/OrbController.ts`, `engine/ports/{RendererPort.ts, NullRenderer.ts}`, `engine/index.ts` (exports: `OrbController`, `createEventBus`, `transition`, `createInitialSnapshot`, `STATE_VISUAL_DEFAULTS`, `registerToolVisual`, `createToolVisualRegistry`, `createNullRenderer`, all types)
- `core/limits.ts` additions: `MAX_EVENT_BYTES`, `MAX_LABEL_CHARS`, `MAX_PENDING_OPERATIONS`, `DEFAULT_DEDUPE_CAPACITY`, `MAX_BUS_QUEUE`, `MAX_ANNOUNCEMENTS`
- `adapters/AgentAdapter.ts`, `adapters/mock/MockAdapter.ts`, `adapters/mock/scripts/{index.ts, governedToolSequence.ts, deniedSequence.ts, errorSequence.ts, speechSequence.ts}`, `adapters/index.ts`
- `components/store/orbStore.ts`, `components/a11y/{StateAnnouncer.tsx, ActiveOperationPanel.tsx, ApprovalControls.tsx, ProvenanceBadge.tsx, TextOrbClient.tsx, labels.ts, index.ts}`
- `app/text-orb/page.tsx`
- `.dependency-cruiser.cjs` additions: `a11y-no-webgl` (`components/a11y/** ↛ three, engine/render/**, engine/OrbEngine`), `engine-state-pure` (`engine/state/**, events/** ↛ anything outside core/, events/, engine/state`), `adapters-no-engine` (`adapters/** ↛ engine/**`)
- `tests/support/fakes/{FakeScheduler.ts, FakeClock.ts, MemoryLogger.ts}`, `tests/support/arbitraries/orbEvent.ts`; fixtures `tests/fixtures/state/transitions.json`, `tests/fixtures/a11y/governed-announcements.json`, `tests/fixtures/metadata/hostile.json`; all test files of §7
- `scripts/spec-transitions.ts` (`pnpm spec:transitions`: regenerates the fixture from `describeTransitionTable()` and diffs it against the Appendix A export)
- `docs/adr/ADR-0005-event-provenance.md`, `docs/adr/ADR-0006-approval-decision-channel.md`, `docs/security/threats/semantic-core.md`, `docs/explanation/why-governance-states.md`, `docs/reference/state-machine.md` (rendered grid + link to Appendix A)
- `specs/TRACEABILITY.md` rows for every ID in §3

## 10. Exit criteria (Gate G1)

1. `tests/unit/engine/state/transitions.table.test.ts` green over all 126 rows and `pnpm spec:transitions --check` reports no diff between `describeTransitionTable()`, the fixture and Appendix A.
2. `tests/unit/engine/state/transitions.property.test.ts` green with `numRuns = 10 000` in CI for invariants I1–I13; `tests/unit/engine/orb-controller.test.ts` proves I14.
3. `tests/e2e/text-orb.a11y.spec.ts`: axe 0 violations (WCAG 2.1 AA tags) before and after a governed run; `canvas` absent; live region present in server HTML.
4. `tests/e2e/text-orb.keyboard.spec.ts` and `tests/e2e/text-orb.governance.spec.ts` green: approve and deny paths driven only by Tab/Enter/Space; "Simulated" badge visible; denial never renders "Error".
5. `pnpm req:coverage` reports every MUST in §3 covered by ≥ 1 passing unit/integration test, and every user-observable MUST (ORB-GOV-004/005/007/010, ORB-A11Y-001/002/005/006, ORB-DEMO-002, ORB-SEC-004, ORB-ARCH-005) by ≥ 1 passing E2E test; SHOULDs ≥ 70 %.
6. `pnpm arch` and `tests/unit/arch/wave1-boundaries.test.ts` green: zero imports of `three` from `events/**`, `engine/state/**`, `engine/bus/**`, `engine/visual-policy/**`, `engine/OrbController.ts`, `adapters/**`, `components/a11y/**`, `components/store/**`; zero timers/`Date.now`/`Math.random` in `engine/**` and `events/**`.
7. Vitest coverage ≥ 95 % lines / 90 % branches on `engine/state/**`, `engine/bus/**`, `events/**` (stricter than the global 90/85 because this is the semantic truth).
8. `tests/unit/components/a11y/metadata-rendering.test.tsx` green against `tests/fixtures/metadata/hostile.json` (≥ 12 fixtures incl. script, img/onerror, RTL override, zero-width, 10 000 chars, `__proto__`, null bytes).
9. ADR-0005 and ADR-0006 merged with `Status: accepted`; `docs/security/threats/semantic-core.md` merged.
10. `engine/index.ts` export list snapshot committed (`tests/unit/engine/public-surface.test.ts`) as the baseline Wave 4 freezes.
11. CI stages 1–11 (Wave 0) green on the merge commit.

## 11. Risks, spikes and open questions

- Risk: Appendix A rows drift from code during implementation → mitigation: fixture-first (write `transitions.json` from the appendix before `transition()`), `pnpm spec:transitions --check` in CI → owner: maintainer (spec-amendment on any disagreement, §28 rule 7).
- Risk: queued approval-required operations get stuck (amendments Q-1: the promoted head is `not_required` while the backend waits) → spike (½ day): property-test the alternative "pending entries record `approvalStatus: 'pending'` when an `APPROVAL_REQUIRED` for a pending id arrives, so promotion enters `waiting_approval`"; until decided, `APPROVAL_REQUIRED` for a pending id is rejected `out_of_phase` (this wave) and the Wave 7 gateway serialises approval-required calls → decision owner: spec-amendment.
- Risk: lifecycle events without `correlationId` from real providers (Q-2) → kept strict here; Wave 7 normaliser must synthesise ids from `tool_call.id`; revisit only with evidence → owner: Wave 7 / spec-amendment.
- Risk: `Logger` has no `debug()` while Appendix A G7 says no-ops log at debug → this wave uses `logNoops: true` (info) in tests only; open question: add `debug()` to the `core/logger` contract in a Wave 0 follow-up or amend G7 to "counter only" → owner: ADR-0001 addendum / spec-amendment.
- Risk: React batching merges announcements → mitigated by append-per-change nodes (`aria-relevant="additions"`); spike (2 h): confirm NVDA/VoiceOver read each appended `<p>` when two arrive within 100 ms; if not, add a 50 ms serialisation queue in `StateAnnouncer` (never dropping, only spacing) → owner: maintainer, recorded in `docs/reference/manual-verification.md`.
- Risk: `MAX_PENDING_OPERATIONS = 32` is a new limit not in SPEC 0.2.0 → add as informative text under ORB-GOV-009 or as `core/limits` documentation; no MUST weakened → owner: spec-amendment (next revision).
- Open question: does `OrbController` remain a public export of `engine/index.ts` after Wave 4's `OrbEngine` facade, or become internal (affects ADR-0011 and ORB-API-001)? Default here: exported, marked `@internal` in TSDoc → owner: Wave 4 / ADR-0011.
- Open question: `ASSISTANT_SPEAKING` during governance states is invisible (Q-3); if voice UX needs it, an `assistantSpeaking` flag is a 0.3.0 snapshot field, not a state → owner: user / spec-amendment.
- Open question: should `TextOrbClient` and `/text-orb` survive to V1.0 as a documented "no-WebGL fallback demo" (useful for ORB-RENDER-006 UX) or be deleted once Wave 4's `/` has the headless fallback? Default: keep behind the env flag → owner: Wave 8 docs.
- Open question: `metadata.reason` is sanitised but not displayed anywhere in this wave; Wave 4 may show it in the outcome panel; confirm it is presentation-only and never influences `lastOutcome.kind` (it does not in this wave) → owner: Wave 4.

## 12. Playground and demo controls introduced

No `/playground` panel is added (Wave 4). The dev route `/text-orb` introduces: **Run AI Sequence** (button), **Require approval** (switch, default on), **Script** (select: governed / denied / error / speech), **Stop** (button), **Approve** / **Deny** (keyboard-accessible, enabled only while an approval is pending), the read-only current state line, active-operation panel, pending queue list, outcome line, Simulated / (manual) badges, and the announcement log. Debug hooks (dev builds only): `?sequencer=manual`, `?script=<name>`, `?requireApproval=0`, `window.__orbDebug.{getSnapshot, announcements, sequencer.step}`. Every control goes through `OrbController.emit`/`submitApprovalDecision`; none can emit `source: 'adapter'` or write the snapshot directly (ORB-PLAY-002 semantics, owned by Wave 4).
