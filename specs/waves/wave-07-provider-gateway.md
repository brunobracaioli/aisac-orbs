# Wave 7 — Server-side agent gateway and OpenAI adapter

| Field                     | Value                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                | proposed                                                                                                                                                                                                            |
| **Milestones (SPEC §27)** | V0.9 Provider adapter                                                                                                                                                                                               |
| **Depends on**            | Wave 0 (CI, security headers, env hygiene, dependency-cruiser), Wave 1 (`events/`, `AgentAdapter`, governance, a11y UI), Wave 4 (`OrbEngine.attachAdapter` / `onApprovalDecision`, demo page)                       |
| **Spec version**          | SPEC.md 0.2.0 (0.1.0 + amendments A-01, A-02, A-04, A-06, A-09, A-12, A-14; user decisions U-1, U-2 assumed at their defaults) — see `specs/SPEC-amendments-proposal.md`                                            |
| **Gate**                  | G7 — a fake-provider E2E drives the orb through request → approval → execution → result with zero secrets in the browser bundle, replayed approvals rejected with 409, and the engine unaffected by a killed stream |
| **Estimated size**        | L — three new server surfaces (SSE stream, turns, approvals) plus a provider integration, a browser transport and a fake-provider E2E harness; no engine changes                                                    |

## 1. Objective

After this wave the reference project can be connected to a real AI provider without changing anything in `engine/` or `events/`: a server-side Next.js gateway (`app/api/agent/*`) holds the provider key, streams normalized `OrbEvent`s to the browser over SSE, evaluates a server-side tool policy, executes tools through a mock executor by default (U-1), and accepts approval decisions through an idempotent, replay-protected endpoint. A stakeholder can run `ORB_ADAPTER=openai pnpm dev` with a key and watch the orb go through the governed lifecycle driven by actual provider events; a stakeholder without a key gets exactly the Wave 4 mock demo, and CI proves both with a fake provider server and a bundle secret scan.

## 2. Scope

### 2.1 In scope

- `app/api/agent/stream` (GET, SSE), `app/api/agent/turns` (POST) and `app/api/agent/approvals` (POST) route handlers with a pluggable auth hook, session binding, CSRF/origin checks, rate limits, idempotency, audit logging and timeouts.
- OpenAI Responses API streaming integration (U-2) in `adapters/openai/server/`, a pure provider→`OrbEvent` normalizer with recorded fixtures, a server-side tool policy table and a `MockToolExecutor`.
- Browser `OpenAIAdapter` implementing `AgentAdapter` over `EventSource` + `fetch`, with reconnection, `Last-Event-ID` resume and `respondToApproval`.
- Adapter selection by server-side env, public demo defaulting to mock, bundle secret scan with canary values, `docs/how-to/connect-openai.md`, `docs/security/threats/gateway.md`, `docs/reference/openapi/agent-gateway.yaml`, ADR-0013, ADR-0014.
- Fake OpenAI provider server for E2E (no real key, loopback only).

### 2.2 Out of scope (deferred)

- Real tool execution (host executor hooks) → only if U-1 flips; see §11.
- OpenAI Realtime API / voice transport → only if U-2 flips; affects Wave 5 assistant audio source.
- Multi-instance session store (Redis/KV), user accounts, per-user quotas → host application concern; documented in ADR-0013 consequences.
- Additional provider adapters (Anthropic, Gemini, LangGraph…) → post-V1 (SPEC §27 future candidates).
- Playground gateway knobs beyond read-only status → Wave 8 (ORB-PLAY-001).

## 3. Requirements owned by this wave

Every ID listed here is owned by this wave and must be fully satisfied and verified before the gate closes. These are planned obligations; no test evidence is implied. Shared declaration owners and integration rules are in `specs/SHARED-CONTRACTS.md`.

| ID              | Level    | Summary                                                                                                                                       | Slice    | Verification                      |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------- |
| ORB-ADAPTER-002 | SHOULD   | Reference project SHOULD include an OpenAI adapter.                                                                                           | 4.2, 4.3 | integration + e2e                 |
| ORB-ADAPTER-003 | MUST NOT | Provider secrets MUST NOT ship in browser source.                                                                                             | 4.4      | build scan + arch test            |
| ORB-ADAPTER-004 | MUST     | Provider events MUST normalize into `OrbEvent`.                                                                                               | 4.2      | unit (fixture-total mapping)      |
| ORB-ADAPTER-006 | MUST     | Rendering MUST remain safe if provider connectivity fails.                                                                                    | 4.3      | integration + e2e (killed server) |
| ORB-SEC-001     | MUST NOT | Secret provider keys MUST NOT be embedded in client bundles.                                                                                  | 4.4      | build scan + lint                 |
| ORB-SEC-002     | MUST     | Tool execution MUST remain behind application-defined policy/authorization.                                                                   | 4.2      | unit + integration                |
| ORB-SEC-006     | MUST     | Public demo MUST use mock data unless explicitly connected to a real backend.                                                                 | 4.4      | e2e + review                      |
| ORB-SEC-007     | SHOULD   | Approval/execution endpoints SHOULD protect against replay and duplicate execution.                                                           | 4.1      | integration                       |
| ORB-SEC-008     | MUST     | Browser → server-side application/API → AI provider/tools topology (§24 diagram made normative): the browser never calls a provider directly. | 4.1, 4.3 | arch test + e2e                   |

Requirements touched but owned elsewhere: ORB-ADAPTER-005 (Wave 1 — `OpenAIAdapter.disconnect()` releases `EventSource`, aborts fetches, clears timers), ORB-GOV-002 / ORB-GOV-003 (Wave 1 — the gateway orchestrator enforces the same guards server-side: no execution before granted approval, `TOOL_COMPLETED` only from an executor result), ORB-ARCH-002 (Wave 0 — provider SDK confined to `adapters/openai/server/**`), ORB-EVENT-003 / ORB-EVENT-005 / ORB-EVENT-008 (Wave 1 — every stream event is a validated `OrbEvent` with `source: 'adapter'` and a stable `id`), ORB-DEMO-002 (Wave 1 — mock-executor tool events carry `metadata.simulated: true`), ORB-GOV-007 / ORB-GOV-008 (Wave 1 — server auto-deny is a governance outcome; authoritative events only from the adapter).

## 4. Vertical slices

### 4.1 Gateway core — bounded context `agent-gateway` (`app/api/agent/`)

**Objective.** Route handlers that bind a browser session to a server-side event log, stream `OrbEvent`s over SSE with resume, accept turn and approval commands with auth → authz → limits → validation → use-case ordering, and audit everything without PII.

**Contracts.**

```ts
// app/api/agent/_lib/env.ts            import 'server-only'
export const gatewayEnvSchema = z
  .object({
    ORB_ADAPTER: z.enum(["mock", "openai"]).default("mock"),
    ORB_TOOL_EXECUTOR: z.enum(["mock"]).default("mock"), // U-1: 'host' is added only if the decision flips
    OPENAI_API_KEY: z.string().min(20).optional(),
    OPENAI_MODEL: z.string().min(1).optional(),
    OPENAI_BASE_URL: z.string().url().optional(), // https + host allowlist (4.2); loopback only with the flag below
    ORB_PROVIDER_ALLOW_LOOPBACK: z.enum(["0", "1"]).default("0"), // test harness only; boot warn when '1'
    ORB_GATEWAY_SESSION_SECRET: z.string().min(32).optional(), // HMAC-SHA256 key for the session cookie
    ORB_GATEWAY_ALLOWED_ORIGINS: z.string().optional(), // comma list; default = request origin only
    ORB_GATEWAY_TURN_DAILY_CAP: z.coerce.number().int().positive().default(200),
    ORB_GATEWAY_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    ORB_E2E: z.enum(["0", "1"]).default("0"), // test harness only: executor latency 0; ignored when NODE_ENV=production
  })
  .superRefine((e, ctx) => {
    /* ORB_ADAPTER=openai ⇒ OPENAI_API_KEY, OPENAI_MODEL, ORB_GATEWAY_SESSION_SECRET required */
  });
export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;
export function loadGatewayEnv(
  source: Record<string, string | undefined>,
): Result<GatewayEnv, { missing: string[]; invalid: string[] }>;

// app/api/agent/_lib/gateway.ts
export interface GatewayAuth {
  authenticate(
    req: Request,
    session: GatewaySession | null,
  ): Promise<Result<Principal, AuthFailure>>;
}
export interface Principal {
  readonly sessionId: string;
}
export type AuthFailure = {
  status: 401 | 403;
  code: "no_session" | "csrf" | "origin" | "forbidden";
};
export interface GatewayDeps {
  env: GatewayEnv;
  clock: Clock;
  scheduler: Scheduler;
  prng: Prng;
  logger: Logger;
  auth: GatewayAuth; // default: sameOriginSessionAuth (cookie + X-Orb-Csrf + Origin/Sec-Fetch-Site)
  sessions: SessionStore;
  limiter: RateLimiter;
  idempotency: IdempotencyStore;
  provider: ProviderStreamFactory | null; // null when ORB_ADAPTER=mock → every route answers 503 gateway_disabled
  policy: ToolPolicy;
  executor: ToolExecutor;
}
export interface AgentGateway {
  stream(req: Request): Promise<Response>;
  turns(req: Request): Promise<Response>;
  approvals(req: Request): Promise<Response>;
}
export function createAgentGateway(deps: GatewayDeps): AgentGateway;
// app/api/agent/{stream,turns,approvals}/route.ts: export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
// each file is one line of delegation to the singleton gateway built from process.env (server-only).

// app/api/agent/_lib/session.ts
export interface GatewaySession {
  readonly id: string;
  readonly csrfToken: string;
  readonly createdAt: number;
  expiresAt: number;
  activeTurn: TurnRecord | null;
  approvals: Map<string, ApprovalRecord>;
  log: EventLog;
  streams: number;
}
export interface EventLog {
  append(frame: StreamFrame): number /* seq */;
  since(seq: number): ReadonlyArray<StreamFrame> | null /* null = gap */;
  readonly capacity: 256;
}
export interface SessionStore {
  create(now: number): GatewaySession;
  get(id: string, now: number): GatewaySession | null;
  sweep(now: number): number;
}
export const SESSION_TTL_MS = 3_600_000;
export const SESSION_COOKIE = "orb_session"; // HttpOnly; SameSite=Lax; Path=/api/agent; Secure unless http://localhost

// app/api/agent/_lib/domain/approval.ts   (pure)
export type GatewayApprovalStatus = "pending" | "granted" | "denied" | "expired";
export interface ApprovalRecord {
  correlationId: string;
  tool: string;
  nonce: string;
  status: GatewayApprovalStatus;
  createdAt: number;
  expiresAt: number;
  decidedAt: number | null;
  decidedBy: "client" | "policy" | "timeout" | null;
}
export interface ApprovalCommand {
  correlationId: string;
  decision: "approve" | "deny";
  nonce: string;
  now: number;
}
export type ApprovalError =
  | { code: "not_found" }
  | { code: "already_decided"; status: GatewayApprovalStatus }
  | { code: "expired" }
  | { code: "nonce_mismatch" };
export function decideApproval(
  record: ApprovalRecord | null,
  cmd: ApprovalCommand,
): Result<ApprovalRecord, ApprovalError>;
export const APPROVAL_TTL_MS = 300_000;

// app/api/agent/_lib/idempotency.ts
export interface IdempotencyStore {
  begin(
    sessionId: string,
    key: string,
    bodyHash: string,
    now: number,
  ): { kind: "new" } | { kind: "replayed"; sameBody: boolean };
  complete(sessionId: string, key: string, now: number): void;
}
export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const IDEMPOTENCY_TTL_MS = 600_000;

// app/api/agent/_lib/rateLimit.ts
export type RateScope =
  | "stream_open_ip"
  | "stream_concurrent_ip"
  | "turn_session"
  | "turn_ip"
  | "turn_daily_global"
  | "approval_session"
  | "approval_ip";
export const RATE_LIMITS: Readonly<
  Record<RateScope, { capacity: number; refillPerMinute: number } | { concurrent: number }>
> = {
  stream_open_ip: { capacity: 5, refillPerMinute: 5 },
  stream_concurrent_ip: { concurrent: 2 },
  turn_session: { capacity: 10, refillPerMinute: 10 },
  turn_ip: { capacity: 30, refillPerMinute: 30 },
  turn_daily_global: { capacity: 200 /* env */, refillPerMinute: 0 },
  approval_session: { capacity: 30, refillPerMinute: 30 },
  approval_ip: { capacity: 60, refillPerMinute: 60 },
};
export interface RateLimiter {
  take(
    scope: RateScope,
    key: string,
    now: number,
  ): { ok: true } | { ok: false; retryAfterMs: number };
  release(scope: "stream_concurrent_ip", key: string): void;
}

// app/api/agent/_lib/sse.ts
export type StreamFrame =
  | { event: "orb"; seq: number; data: OrbEvent<OrbEventMetadata> }
  | {
      event: "gateway";
      seq: number;
      data:
        | { kind: "approval_challenge"; correlationId: string; nonce: string; expiresAt: number }
        | { kind: "turn_ended"; correlationId: string };
    }
  | {
      event: "gateway";
      seq: null;
      data:
        | {
            kind: "ready";
            protocol: 1;
            csrfToken: string;
            adapter: "openai";
            executor: "mock";
            resumed: boolean;
          }
        | { kind: "resync" };
    }
  | { event: "heartbeat"; seq: null; data: { ts: number } };
export function encodeFrame(frame: StreamFrame): string; // `id:` line only when seq !== null; `retry: 3000` sent once after ready
export const HEARTBEAT_MS = 15_000;
export const STREAM_MAX_LIFETIME_MS = 1_800_000;
```

**Environment variables (server-only; read once at boot through `loadGatewayEnv`, never through `process.env` elsewhere; `.env.example` lists names only).**

| Variable                          | Required when        | Default                     | Purpose / constraint                                                                                                 |
| --------------------------------- | -------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ORB_ADAPTER`                     | never                | `mock`                      | `mock` → gateway routes answer 503 `gateway_disabled`, demo is Wave 4 mock (ORB-SEC-006); `openai` → gateway enabled |
| `OPENAI_API_KEY`                  | `ORB_ADAPTER=openai` | —                           | Provider bearer key; only `adapters/openai/server/provider.ts` reads it; canary value injected in the CI bundle scan |
| `OPENAI_MODEL`                    | `ORB_ADAPTER=openai` | —                           | Model name sent to the Responses API; logged as a plain label                                                        |
| `OPENAI_BASE_URL`                 | never                | `https://api.openai.com/v1` | Must pass `validateBaseUrl`: https, host allowlist, no private/link-local address, no redirects (c7 SSRF)            |
| `ORB_PROVIDER_ALLOW_LOOPBACK`     | never                | `0`                         | `1` allows `http://127.0.0.1:*` base URLs for the fake provider E2E only; boot warning when set                      |
| `ORB_GATEWAY_SESSION_SECRET`      | `ORB_ADAPTER=openai` | —                           | ≥ 32 chars; HMAC-SHA256 key for the `orb_session` cookie; rotation invalidates sessions                              |
| `ORB_GATEWAY_ALLOWED_ORIGINS`     | never                | request origin              | Comma list of additional `Origin` values accepted on POST (embedding hosts)                                          |
| `ORB_GATEWAY_TURN_DAILY_CAP`      | never                | `200`                       | Global daily turn budget (cost DoS, c6); 429 `rate_limited` when exhausted                                           |
| `ORB_GATEWAY_PROVIDER_TIMEOUT_MS` | never                | `60000`                     | Abort a provider round after this many ms → `ERROR{reason:'provider_timeout'}`                                       |
| `ORB_TOOL_EXECUTOR`               | never                | `mock`                      | Only accepted value under U-1; `host` is added only if U-1 flips (ADR-0014)                                          |
| `ORB_E2E`                         | never                | unset                       | `1` sets mock-executor latency to 0 and fake-provider frame spacing; ignored in production builds                    |

No variable above may be prefixed `NEXT_PUBLIC_`; the Wave 0 lint rule rejects any `NEXT_PUBLIC_*` name matching `/KEY|SECRET|TOKEN|PASSWORD/i`.

**Route table (normative; mirrored in `docs/reference/openapi/agent-gateway.yaml`).**

| Method | Path                   | Request headers                                                                      | Body (zod)                                                                                | Success                                                                                                                            | Errors                                                                                                                                                         |
| ------ | ---------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/agent/stream`    | `Cookie: orb_session` (optional; issued if absent), `Last-Event-ID` (optional, uint) | —                                                                                         | 200 `text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `Set-Cookie` when issued | 403 `origin`, 429 `rate_limited` (+`Retry-After`), 503 `gateway_disabled`                                                                                      |
| POST   | `/api/agent/turns`     | `Cookie`, `X-Orb-Csrf`, `Idempotency-Key`, `Content-Type: application/json`          | `{ input: string(1..4000) }`                                                              | 202 `{ correlationId }`                                                                                                            | 400 `invalid_body`/`invalid_idempotency_key`, 401 `no_session`, 403 `csrf`/`origin`, 409 `turn_active`/`replayed`, 413 `payload_too_large` (> 8 KiB), 429, 503 |
| POST   | `/api/agent/approvals` | `Cookie`, `X-Orb-Csrf`, `Idempotency-Key`, `Content-Type: application/json`          | `{ correlationId: string(1..128), decision: 'approve' \| 'deny', nonce: string(32 hex) }` | 200 `{ correlationId, decision, status: 'granted' \| 'denied' }`                                                                   | 400, 401, 403 `csrf`/`origin`/`nonce_mismatch`, 404 `not_found`, 409 `already_decided`/`replayed`, 410 `expired`, 413, 429, 503                                |

Error body is always `{ code: string; message: string; retryAfterMs?: number }` with a fixed message per code; provider details never appear (c10). All responses carry the Wave 0 security headers; `Cache-Control: no-store` on every JSON response.

**SSE wire format.**

```text
: connected
event: gateway
data: {"kind":"ready","protocol":1,"csrfToken":"<32 hex>","adapter":"openai","executor":"mock","resumed":false}
retry: 3000

id: 17
event: orb
data: {"type":"TOOL_REQUESTED","timestamp":1757800000123,"id":"t_01J9...-4","correlationId":"call_8x...","source":"adapter","metadata":{"tool":"database_query"}}

id: 18
event: gateway
data: {"kind":"approval_challenge","correlationId":"call_8x...","nonce":"<32 hex>","expiresAt":1757800300123}

id: 19
event: orb
data: {"type":"APPROVAL_REQUIRED","timestamp":1757800000130,"id":"t_01J9...-5","correlationId":"call_8x...","source":"adapter","metadata":{"tool":"database_query"}}

event: heartbeat
data: {"ts":1757800015000}
```

**Behavior.**

- Handler order on every route: per-IP rate limit → `auth.authenticate` (session cookie valid + not expired; on POST also `X-Orb-Csrf === session.csrfToken` and `Origin`/`Sec-Fetch-Site` ∈ allowed) → authz (the session owns `correlationId` / has no active turn) → per-session limit → `Idempotency-Key` + body schema → use case. Any failure short-circuits with the table's status; no state is mutated before the use case.
- `GET /stream`: without a valid cookie, create a session and set the cookie; write `ready`; if `Last-Event-ID` is present and `log.since(id)` returns frames, replay them (`resumed: true`); if it returns `null` (gap), write `{"kind":"resync"}` and, when `session.activeTurn` exists, append an `ERROR` orb event (`metadata.reason: 'stream_gap'`) and abort the turn (A-09: never leave the client believing an operation is alive). Heartbeat every `HEARTBEAT_MS`; close at `STREAM_MAX_LIFETIME_MS` (client resumes); `request.signal` abort → release concurrency slot, stop heartbeat, provider turn continues to completion so the log can be resumed.
- `POST /turns`: rejects with 409 `turn_active` while `session.activeTurn` is set (single active operation, A-04); on success creates `TurnRecord { correlationId: ids.turnId(), startedAt }` and hands it to the orchestrator (4.2). Input text is never logged (only `inputChars`).
- `POST /approvals`: idempotency `begin` → `replayed` ⇒ 409 `replayed` (same or different body; no execution); otherwise `decideApproval` → on `ok` append `APPROVAL_GRANTED` or `APPROVAL_DENIED` (`source: 'adapter'`, same `correlationId`) to the log and resume the orchestrator; `already_decided` ⇒ 409, `expired` ⇒ 410, `nonce_mismatch` ⇒ 403, `not_found` ⇒ 404. The compare-and-swap on `record.status === 'pending'` is the single point that admits execution; the orchestrator never reads the HTTP layer.
- Approval TTL: a `Scheduler` timer at `expiresAt` moves `pending → expired` and appends `APPROVAL_DENIED` with `metadata.reason: 'expired'` (`decidedBy: 'timeout'`), a governance outcome (ORB-GOV-004/007), never `TOOL_FAILED`.
- Every appended `orb` frame passes `orbEventSchema` before it is written; a frame that fails validation is dropped and logged `orb.gateway.event.invalid` (defense in depth over 4.2).
- `sessions.sweep` runs every 60 s via `Scheduler`; expired sessions drop their logs and pending approvals (expired approvals emit nothing after the session is gone).

**Edge cases.**

- Two concurrent `POST /approvals` for the same `correlationId` with different keys → exactly one 200, one 409 `already_decided`; executor `execute` called once.
- Same `Idempotency-Key` reused with a different body → 409 `replayed`; audit `orb.gateway.approval.rejected{code:'replayed'}`.
- `Last-Event-ID` non-numeric or negative → treated as absent (fresh stream), warn logged.
- Third concurrent stream from one IP → 429 with `Retry-After: 5`; existing streams unaffected.
- Cookie present but session expired/unknown → stream: new session issued; POST: 401 `no_session`.
- `ORB_ADAPTER=mock` → all three routes return 503 `gateway_disabled` without touching sessions or limits; the demo never calls them in mock mode (Wave 4 exit: works with network blocked).
- Env invalid at boot (`ORB_ADAPTER=openai` without key/model/secret) → routes return 503 `gateway_misconfigured`; `orb.gateway.env.invalid{missing:[names]}` logged once; names only, never values.
- Request body > 8 KiB → 413 before JSON parsing.

**Acceptance criteria.**

- Given a pending approval, When the same approve request is POSTed twice with the same `Idempotency-Key`, Then the second returns 409 `replayed` and `executor.execute` was called once → ORB-SEC-007, ORB-EVENT-005 · `tests/integration/gateway/approvals.route.test.ts`
- Given a pending approval, When two approve requests with different keys race, Then one 200 + one 409 `already_decided` and exactly one `TOOL_STARTED` in the log → ORB-SEC-007, ORB-GOV-002 · `tests/integration/gateway/approvals.route.test.ts`
- Given a session A, When session B POSTs a decision for A's `correlationId` with A's nonce, Then 404 `not_found` and no state change → ORB-SEC-002, ORB-SEC-007 · `tests/integration/gateway/approvals.route.test.ts`
- Given a valid cookie, When `X-Orb-Csrf` is missing or `Origin` is foreign, Then 403 before body validation → ORB-SEC-002 · `tests/integration/gateway/auth.test.ts`
- Given 6 stream opens from one IP within a minute, When the 6th arrives, Then 429 with `Retry-After` and body `retryAfterMs` → ORB-SEC-006 (cost DoS), ORB-ADAPTER-006 · `tests/integration/gateway/rateLimit.route.test.ts`
- Given a stream closed after seq 40, When reopened with `Last-Event-ID: 40`, Then frames 41..n replay in order with `resumed: true` → ORB-SEC-008, ORB-EVENT-005 · `tests/integration/gateway/stream.route.test.ts`
- Given `ORB_ADAPTER=mock`, When any gateway route is called, Then 503 `gateway_disabled` and no session cookie is set → ORB-SEC-006 · `tests/integration/gateway/disabled.test.ts`

**Observability — audit log events (structured JSON via `core/logger`, `app/api/agent/_lib/audit.ts`; no PII).**

| Event                           | Fields                                                                                                       | Level                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------- |
| `orb.gateway.session.created`   | `sessionId`                                                                                                  | info                 |
| `orb.gateway.stream.opened`     | `sessionId, resumedFrom, ipHash`                                                                             | info                 |
| `orb.gateway.stream.closed`     | `sessionId, reason ∈ {client_abort, max_lifetime, session_expired, server_shutdown}, durationMs, framesSent` | info                 |
| `orb.gateway.turn.started`      | `sessionId, correlationId, inputChars`                                                                       | info                 |
| `orb.gateway.turn.completed`    | `correlationId, durationMs, toolCalls, outcome ∈ {completed, error, aborted}`                                | info                 |
| `orb.gateway.approval.required` | `correlationId, tool, expiresAt`                                                                             | info                 |
| `orb.gateway.approval.decided`  | `correlationId, tool, decision, decidedBy ∈ {client, policy, timeout}, latencyMs, idempotencyKeyHash`        | info                 |
| `orb.gateway.approval.rejected` | `correlationId, code ∈ {replayed, already_decided, expired, nonce_mismatch, not_found}`                      | warn                 |
| `orb.gateway.rate_limited`      | `scope, keyHash, retryAfterMs`                                                                               | warn                 |
| `orb.gateway.auth.rejected`     | `code ∈ {no_session, csrf, origin, forbidden}`                                                               | warn                 |
| `orb.gateway.event.invalid`     | `type`                                                                                                       | warn                 |
| `orb.gateway.env.invalid`       | `missing[], invalid[]` (names only)                                                                          | error (once at boot) |

Field rules: `sessionId` is a 12-char hash prefix of the session id; `ipHash`/`keyHash` are salted SHA-256 prefixes (salt = session secret); `correlationId` is the provider `call_id`/turn id (opaque); prompt text, tool arguments, tool outputs, provider bodies, cookies and key material are never logged. Every event carries `correlationId` while a turn is active.

### 4.2 OpenAI provider, normalizer, tool policy and mock executor — bounded context `adapters/openai/server` + `agent-gateway`

**Objective.** Turn a Responses API stream into `OrbEvent`s through a pure, fixture-tested normalizer, and run the governed tool loop server-side: policy → approval → (mock) execution → result → provider continuation.

**Contracts.**

```ts
// adapters/openai/normalize.ts   (pure; no SDK import; frame types declared locally and narrowed with zod)
export interface NormalizerState {
  turnId: string;
  responseId: string | null;
  speaking: boolean;
  pendingCalls: ReadonlyArray<{ callId: string; name: string; argsJson: string }>;
  seq: number;
}
export type NormalizeEffect =
  | { kind: "tool_arguments_ready"; callId: string; name: string; argsJson: string }
  | { kind: "response_completed"; responseId: string; pendingCalls: number }
  | { kind: "response_ended_abnormally"; category: "failed" | "incomplete" | "error" };
export interface NormalizeResult {
  state: NormalizerState;
  events: ReadonlyArray<OrbEvent<OrbEventMetadata>>;
  effects: ReadonlyArray<NormalizeEffect>;
  ignored: { reason: "not_semantic" | "unknown_frame" | "malformed"; type: string } | null;
}
export function createNormalizerState(turnId: string): NormalizerState;
export function normalizeFrame(
  state: NormalizerState,
  frame: unknown,
  now: number,
): NormalizeResult; // never throws
export const NORMALIZATION_TABLE: ReadonlyArray<{
  frameType: string;
  result: OrbEventType | "IGNORED" | "EFFECT";
}>; // the table below, exported so the fixture test can assert totality

// adapters/openai/server/provider.ts   import 'server-only'; the ONLY module importing the `openai` SDK (pinned exact version)
export interface ProviderTurnRequest {
  turnId: string;
  model: string;
  input: string | null;
  previousResponseId: string | null;
  toolOutputs: ReadonlyArray<{ callId: string; output: string }>;
  tools: ReadonlyArray<ToolDefinition>;
  signal: AbortSignal;
}
export interface ProviderStream {
  frames(): AsyncIterable<unknown>;
}
export interface ProviderStreamFactory {
  open(req: ProviderTurnRequest): Promise<ProviderStream>;
}
export function createOpenAIProvider(opts: {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  logger: Logger;
}): ProviderStreamFactory;
export function validateBaseUrl(
  url: string,
  allowLoopback: boolean,
): Result<URL, "not_https" | "host_not_allowed" | "private_address">; // allowlist: api.openai.com; loopback only with flag

// app/api/agent/_lib/tools/policy.ts
export interface ToolDefinition<A = unknown> {
  name: string;
  description: string;
  requiresApproval: boolean;
  args: ZodType<A>;
}
export type PolicyVerdict =
  | { kind: "allow"; tool: ToolDefinition; args: unknown; requiresApproval: boolean }
  | { kind: "deny"; reason: "unknown_tool" | "invalid_args" | "budget_exhausted" };
export interface ToolPolicy {
  list(): ReadonlyArray<ToolDefinition>;
  evaluate(name: string, rawArgsJson: string, callsSoFar: number): PolicyVerdict;
}
export const MAX_TOOL_CALLS_PER_TURN = 5;

// app/api/agent/_lib/tools/executor.ts
export interface ToolExecutor {
  readonly kind: "mock";
  execute(call: {
    correlationId: string;
    tool: ToolDefinition;
    args: unknown;
    signal: AbortSignal;
  }): Promise<ToolResult>;
} // U-1: 'host' kind only if flipped
export type ToolResult =
  | { ok: true; output: string /* ≤ 8 KiB */; simulated: boolean }
  | { ok: false; error: "tool_error" | "timeout" | "aborted"; simulated: boolean };
export function createMockToolExecutor(deps: {
  clock: Clock;
  scheduler: Scheduler;
  prng: Prng;
  latencyMs?: number; /* default 400 */
}): ToolExecutor; // deterministic canned outputs from tests/fixtures/tools/*.json

// adapters/openai/server/streamOrchestrator.ts
export interface TurnOrchestrator {
  run(turn: TurnRecord, session: GatewaySession): Promise<void>;
  onApprovalDecided(correlationId: string, status: "granted" | "denied"): void;
  abort(reason: "stream_gap" | "session_expired"): void;
}
export function createTurnOrchestrator(
  deps: Pick<
    GatewayDeps,
    "provider" | "policy" | "executor" | "clock" | "scheduler" | "logger" | "env"
  > & { publish: (session: GatewaySession, frame: StreamFrame) => void },
): TurnOrchestrator;
```

**Provider → OrbEvent normalization table (Responses API streaming; U-2).** `correlationId` = `turnId` unless stated; `timestamp` = injected `now` at normalization; `id` = `${turnId}-${seq}`; `source: 'adapter'`.

| Provider frame `type`                                             | Result                                       | correlationId / metadata                                                   | Notes                                                                                                          |
| ----------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `response.created`                                                | `MODEL_STARTED`                              | turnId                                                                     | also records `responseId`                                                                                      |
| `response.in_progress`, `response.queued`                         | IGNORED (`not_semantic`)                     |                                                                            |                                                                                                                |
| `response.output_item.added` with `item.type === 'function_call'` | `TOOL_REQUESTED`                             | `item.call_id`; `metadata.tool = item.name` (≤ 64 chars, else `'unknown'`) | proposal phase (ORB-GOV-001)                                                                                   |
| `response.output_item.added` other item types                     | IGNORED                                      |                                                                            |                                                                                                                |
| `response.function_call_arguments.delta`                          | IGNORED (buffered in `pendingCalls`)         |                                                                            |                                                                                                                |
| `response.function_call_arguments.done`                           | EFFECT `tool_arguments_ready`                | `call_id`                                                                  | orchestrator applies policy (below)                                                                            |
| `response.output_item.done`                                       | IGNORED                                      |                                                                            |                                                                                                                |
| `response.content_part.added` / `.done`                           | IGNORED                                      |                                                                            |                                                                                                                |
| `response.output_text.delta`                                      | no OrbEvent                                  | text stays in the application output channel                               | text alone does not announce assistant speech                                                                  |
| `response.output_text.done`                                       | no OrbEvent                                  | application text output completed                                          | `MODEL_COMPLETED` remains the semantic turn-completion event                                                   |
| `response.refusal.delta` / `.done`                                | as `output_text.delta` / `.done`             | `metadata.label: 'refusal'`                                                |                                                                                                                |
| `response.reasoning_summary_*`, `response.reasoning.*`            | IGNORED                                      |                                                                            | never surfaced (SPEC §1: no hidden-reasoning claims)                                                           |
| `response.audio.*`, `response.output_audio.*`                     | IGNORED                                      |                                                                            | Realtime/audio deferred (U-2)                                                                                  |
| `response.completed`                                              | EFFECT `response_completed`                  |                                                                            | orchestrator emits `MODEL_COMPLETED` only when `pendingCalls === 0` (avoids out-of-phase noise in `tool_call`) |
| `response.failed`                                                 | `ERROR` + EFFECT `response_ended_abnormally` | turnId; `metadata.reason: 'provider_failed'`                               |                                                                                                                |
| `response.incomplete`                                             | `ERROR` + EFFECT                             | `metadata.reason: 'incomplete'`                                            |                                                                                                                |
| `error` (stream-level)                                            | `ERROR` + EFFECT                             | `metadata.reason: 'provider_error'`                                        | provider message never copied                                                                                  |
| any other `type`                                                  | IGNORED (`unknown_frame`)                    |                                                                            | warn `orb.gateway.provider.unknown_frame{type}`                                                                |
| unparsable frame                                                  | IGNORED (`malformed`)                        |                                                                            | warn; never throws                                                                                             |

Gateway-derived events (never from provider frames, never from client input — c8): `APPROVAL_REQUIRED`, `APPROVAL_GRANTED`, `APPROVAL_DENIED`, `TOOL_STARTED`, `TOOL_COMPLETED`, `TOOL_FAILED`. `USER_SPEAKING` / `USER_STOPPED_SPEAKING` are not produced under U-2 default.

**Tool policy table (`app/api/agent/_lib/tools/registry.ts`; advertised to the model as `tools`).**

| Tool             | requiresApproval | Args schema (zod)                                               | Mock executor output                                         | SPEC §16 mapping                                            |
| ---------------- | ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `web_search`     | false            | `{ query: string(1..256) }`                                     | 3 canned results from `tests/fixtures/tools/web_search.json` | radar → resolves to `generic-tool` unless registered (A-13) |
| `get_time`       | false            | `{ timezone?: string(1..64) }`                                  | ISO string from injected `Clock`                             | generic-tool                                                |
| `database_query` | true             | `{ sql: string(1..1024) }`                                      | canned 2-row table; SQL never executed                       | data-grid → generic-tool                                    |
| `execute_code`   | true             | `{ language: 'javascript' \| 'python'; code: string(1..4096) }` | `"mock executor: code was not executed"`                     | code-network → generic-tool                                 |
| anything else    | —                | —                                                               | policy `deny(unknown_tool)`                                  | —                                                           |

Visual mappings live client-side only and cannot alter this table (ORB-TOOLVIS-002).

**Behavior (orchestrator loop).**

1. `provider.open({ input, tools: policy.list(), previousResponseId: null })`; for each frame: `normalizeFrame` → process candidate events/effects; serialize tool proposals and their approval/execution lifecycle before publishing `orb` frames.
2. `tool_arguments_ready` → `policy.evaluate(name, argsJson, callsSoFar)`:
   - `deny` → publish `APPROVAL_REQUIRED` then `APPROVAL_DENIED` (`metadata.reason: 'policy_denied'`, `decidedBy: 'policy'`), audit `orb.gateway.tool.policy_denied{reason}`; tool output to the model: `{"error":"tool not permitted"}`.
   - `allow` + `requiresApproval` → create `ApprovalRecord{pending}`, publish `gateway:approval_challenge` **then** `APPROVAL_REQUIRED`; wait for `onApprovalDecided` or TTL.
   - `allow` + not required, or `granted` → publish `TOOL_STARTED` (`metadata.tool`, `label: 'mock executor'`, `simulated: executor.kind === 'mock'`) → `executor.execute` (30 s timeout via `AbortSignal`) → `TOOL_COMPLETED` (ok) or `TOOL_FAILED` (`metadata.reason: result.error`) with the same `simulated` flag.
   - `denied` (client or timeout) → tool output to the model: `{"error":"approval denied"}`; no `TOOL_*` event (ORB-GOV-004).
3. `response_completed` with pending calls resolved → `provider.open({ input: null, previousResponseId, toolOutputs })` → loop continues (`MODEL_STARTED` again from `response.created`: `success`/`idle` → `thinking` per A-01).
4. `response_completed` with no pending calls → publish `MODEL_COMPLETED` (text output does not emit speech events), `gateway:turn_ended`, clear `activeTurn`.
5. `response_ended_abnormally`, provider timeout (`ORB_GATEWAY_PROVIDER_TIMEOUT_MS`), or `abort()` → `ERROR` already published or published now with `reason ∈ {'provider_timeout','stream_gap','session_expired'}`, pending approvals → `expired` silently (state already `error`), `activeTurn` cleared.

- Provider HTTP 401/403 → `orb.gateway.provider.error{category:'misconfigured'}` + `ERROR{reason:'provider_unavailable'}`; 429 → `reason:'provider_rate_limited'`; network → `'provider_unavailable'`.
- `MAX_TOOL_CALLS_PER_TURN` exceeded → `deny(budget_exhausted)`; the turn still completes normally.
- Parallel tool calls in one response are processed sequentially in arrival order (A-04 single active operation); the normalizer may produce candidate proposals, but the orchestrator buffers them and publishes each `TOOL_REQUESTED` only after the prior call closes. It must not blindly publish all normalized proposal candidates before this serialization step.

**Edge cases.**

- `function_call_arguments.done` for an unknown `call_id` → ignored, warn `orb.gateway.provider.orphan_call`.
- Executor throws → treated as `{ ok: false, error: 'tool_error' }` → `TOOL_FAILED`; never crashes the stream.
- Approval granted after the turn was aborted (`stream_gap`) → the record is `expired`; POST returns 410; nothing executes.
- `OPENAI_BASE_URL=http://127.0.0.1:4571/v1` without `ORB_PROVIDER_ALLOW_LOOPBACK=1` → boot error `host_not_allowed`; with the flag → allowed + boot warn; `https://169.254.169.254` → `private_address` always.

**Acceptance criteria.**

- Given every fixture in `tests/fixtures/provider/openai/*.jsonl`, When each frame is normalized, Then every frame `type` appears in `NORMALIZATION_TABLE`, every emitted event passes `orbEventSchema`, has a finite `timestamp` from the injected clock and `source: 'adapter'` → ORB-ADAPTER-004, ORB-EVENT-003 · `tests/unit/adapters/openai/normalize.test.ts`
- Given a `database_query` call, When arguments complete, Then the log shows `TOOL_REQUESTED → approval_challenge → APPROVAL_REQUIRED` and `executor.execute` is not called until `onApprovalDecided('granted')` → ORB-SEC-002, ORB-GOV-002 · `tests/integration/gateway/orchestrator.test.ts`
- Given a denied approval, When the turn continues, Then no `TOOL_STARTED`/`TOOL_FAILED` is published and the provider receives `function_call_output` `{"error":"approval denied"}` → ORB-GOV-004, ORB-SEC-002 · `tests/integration/gateway/orchestrator.test.ts`
- Given an unknown tool name, When policy evaluates, Then `APPROVAL_REQUIRED`+`APPROVAL_DENIED{reason:'policy_denied'}` and no executor call → ORB-SEC-002 · `tests/unit/gateway/toolPolicy.test.ts`
- Given the mock executor returns `ok:false`, When the result is published, Then `TOOL_FAILED` with `simulated: true`, never `TOOL_COMPLETED` → ORB-GOV-003, ORB-DEMO-002 · `tests/integration/gateway/orchestrator.test.ts`
- Given `response.failed`, When normalized, Then one `ERROR` with `reason:'provider_failed'` and no provider text in metadata → ORB-ADAPTER-004, ORB-ADAPTER-006 · `tests/unit/adapters/openai/normalize.test.ts`

**Observability.** `orb.gateway.tool.requested{correlationId, tool, requiresApproval}`, `orb.gateway.tool.policy_denied{correlationId, tool, reason}`, `orb.gateway.tool.started{correlationId, tool, executor}`, `orb.gateway.tool.completed{correlationId, tool, durationMs, outputBytes}`, `orb.gateway.tool.failed{correlationId, tool, error}`, `orb.gateway.provider.request{correlationId, model, round}`, `orb.gateway.provider.error{correlationId, category, status}`, `orb.gateway.provider.unknown_frame{type}`. Metric counters: `gateway_turns_total{outcome}`, `gateway_tool_calls_total{tool,verdict}`, `gateway_provider_latency_ms` (first-frame). Correlation ID propagated to the provider request as `X-Client-Request-Id`.

### 4.3 Browser adapter — bounded context `adapters/openai` (client half)

**Objective.** `OpenAIAdapter` implements `AgentAdapter` over `EventSource` + `fetch`, delivering validated `OrbEvent`s to the engine, routing approval decisions to the endpoint with the nonce it received, reconnecting with resume, and releasing everything on `disconnect()`.

**Contracts.**

```ts
// adapters/openai/sseTransport.ts
export interface EventSourceLike {
  readonly readyState: 0 | 1 | 2;
  addEventListener(type: string, cb: (e: { data: string; lastEventId: string }) => void): void;
  close(): void;
  onerror: ((e: unknown) => void) | null;
}
export interface SseTransportOptions {
  url: string;
  eventSourceFactory: (url: string) => EventSourceLike;
  clock: Clock;
  scheduler: Scheduler;
  watchdogMs?: number /* default 45_000 */;
  reconnect?: { maxAttempts: number; baseDelayMs: number }; /* default 3, 1000, exponential */
}
export interface SseTransport {
  open(): void;
  close(): void;
  onFrame(cb: (frame: StreamFrame) => void): () => void;
  onStatus(cb: (s: ConnectionStatus) => void): () => void;
  readonly lastEventId: string | null;
}
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

// adapters/openai/OpenAIAdapter.ts   (re-exported by adapters/openai.ts; client-safe; imports only events/, core/, adapters/openai/sseTransport)
export interface OpenAIAdapterOptions {
  baseUrl?: string /* '/api/agent' */;
  eventSourceFactory?: (url: string) => EventSourceLike;
  fetchImpl?: typeof fetch;
  clock: Clock;
  scheduler: Scheduler;
  prng: Prng;
  logger?: Logger;
}
export class OpenAIAdapter implements AgentAdapter {
  readonly name = "openai";
  readonly simulated = false;
  readonly status: ConnectionStatus;
  connect(): Promise<void>; // resolves on `ready`; rejects with AdapterError{code:'gateway_disabled'|'network'|'rate_limited'} after maxAttempts
  disconnect(): Promise<void>; // idempotent: close EventSource, abort in-flight fetches, cancel timers, clear subscribers and nonce map
  subscribe(cb: (event: OrbEvent) => void): () => void;
  respondToApproval(decision: ApprovalDecision): Promise<void>; // looks up nonce by correlationId; POST /approvals; 409/410 resolve (already decided), 4xx/5xx else reject AdapterError
  startTurn(input: string): Promise<{ correlationId: string }>; // added method (not in AgentAdapter); POST /turns with a fresh Idempotency-Key from prng
  onStatus(cb: (s: ConnectionStatus) => void): () => void; // added method for the UI status text
}
export type AdapterError = {
  code:
    "gateway_disabled" | "network" | "rate_limited" | "csrf" | "no_session" | "invalid" | "unknown";
  retryAfterMs?: number;
};
```

**Behavior.**

- `orb` frames: parse → `orbEventSchema.safeParse` → deliver to subscribers only if valid (invalid → `orb.adapter.invalid_event` warn); `id` preserved for EventBus dedupe.
- `gateway:approval_challenge` → store `nonce` by `correlationId` (bounded map, 64 entries, evicted on decision/expiry); `gateway:ready` → store `csrfToken`, set status `connected`; `gateway:resync` → clear nonce map; `gateway:turn_ended` → clear `turnInFlight`.
- Reconnect: browser `EventSource` auto-reconnect is used (server `retry: 3000`); the watchdog closes and reopens the source when no frame (including heartbeat) arrives for `watchdogMs`. After `maxAttempts` consecutive failures or a non-retryable status (403/503) the adapter sets `disconnected` and, **only if a turn is in flight**, delivers a locally built `ERROR{ source:'adapter', metadata:{ reason:'connection_lost' } }` so the controller aborts the active operation (A-09) instead of freezing in `executing`; when idle it delivers nothing.
- `respondToApproval` is the only client → server governance message; it never delivers an `APPROVAL_*` event locally — the authoritative event arrives through the stream (ORB-GOV-005, A-12).
- Idempotency keys are generated from `prng` (deterministic in tests) and reused on fetch retry (one automatic retry on network error only).

**Edge cases.**

- `respondToApproval` for a `correlationId` without a stored nonce (e.g. after resync) → rejects `AdapterError{code:'invalid'}`; UI keeps controls enabled for the next challenge.
- `disconnect()` during a pending `connect()` → the connect promise resolves (not rejects), `status` ends `disconnected`, and no subscriber is ever called afterwards.
- `connect()` twice → second call awaits the same promise (no second `EventSource`).
- Frame larger than 64 KiB → dropped with warn (bounded memory).

**Acceptance criteria.**

- Given a fake `EventSourceLike` and fetch, When `disconnect()` runs after `connect()`, Then `close()` was called, every `AbortSignal` is aborted, `vi.getTimerCount() === 0`, subscribers are empty and a later fake frame invokes nothing → ORB-ADAPTER-005 · `tests/unit/adapters/openai/OpenAIAdapter.test.ts`
- Given a turn in flight, When the transport fails `maxAttempts` times, Then exactly one `ERROR{reason:'connection_lost'}` is delivered; Given no turn, Then none → ORB-ADAPTER-006 · `tests/unit/adapters/openai/OpenAIAdapter.test.ts`
- Given the engine attached to `OpenAIAdapter` in the headless harness, When the fake source emits an `error` and never recovers, Then the harness keeps ticking (`frames > 0`, no throw) and the snapshot stays valid → ORB-ADAPTER-006, ORB-RENDER-005 · `tests/integration/adapters/openai-harness.test.ts`
- Given a challenge for `call_1`, When `respondToApproval({correlationId:'call_1', decision:'approve', idempotencyKey})` runs, Then the POST body contains the stored nonce and header `X-Orb-Csrf` equals the `ready` token; no local `APPROVAL_GRANTED` is delivered → ORB-SEC-007, ORB-GOV-005 · `tests/unit/adapters/openai/OpenAIAdapter.test.ts`
- Given `adapters/openai.ts` and its imports, When the architecture test runs, Then no module imports `openai`, `server-only`, `process.env` or `engine/**` → ORB-ADAPTER-003, ORB-ARCH-002, ORB-SEC-008 · `tests/architecture/gateway-boundaries.test.ts`

**Observability.** Client logger: `orb.adapter.status{name, status, attempt}`, `orb.adapter.invalid_event{type}`, `orb.adapter.approval.sent{correlationId, decision, status}`, `orb.adapter.connection_lost{correlationId}`; no payloads.

### 4.4 Demo integration, secret hygiene and docs — bounded contexts `presentation` + `agent-gateway`

**Objective.** Adapter selection happens server-side from env; the public demo is mock unless `ORB_ADAPTER=openai`; CI proves no secret value or secret-like `NEXT_PUBLIC_*` name reaches client assets; contributors have a how-to and a threat model.

**Contracts.**

```ts
// adapters/index.ts
export type AdapterKind = "mock" | "openai";
export function createAdapter(
  kind: AdapterKind,
  deps: { clock: Clock; scheduler: Scheduler; prng: Prng; logger?: Logger },
): AgentAdapter; // 'openai' → OpenAIAdapter, 'mock' → MockAdapter (Wave 1)
// app/page.tsx (Server Component): const adapterKind = loadGatewayEnv(process.env).ok ? env.ORB_ADAPTER : 'mock';  → <DemoShell adapterKind={adapterKind} />  (string only; never env values)
// scripts/bundle-secret-scan.ts
export interface ScanOptions {
  assetDirs: string[] /* .next/static/** and files listed in .next/build-manifest.json */;
  canaries: string[] /* values injected at build */;
  publicNamePattern: RegExp /* /KEY|SECRET|TOKEN|PASSWORD/i over NEXT_PUBLIC_* names */;
  keyPatterns: RegExp[]; /* sk-[A-Za-z0-9_-]{20,} … */
}
export function scanBundle(opts: ScanOptions): {
  ok: boolean;
  hits: Array<{
    file: string;
    kind: "canary" | "pattern" | "public_name";
    sample: string; /* ≤ 12 chars */
  }>;
};
```

**Behavior.**

- CI job `bundle-secret-scan`: `OPENAI_API_KEY=sk-canary-<random> ORB_GATEWAY_SESSION_SECRET=canary-<random> ORB_ADAPTER=openai OPENAI_MODEL=canary pnpm build && pnpm tsx scripts/bundle-secret-scan.ts` → exit 1 on any hit. Also asserts `git grep -n 'process.env' -- ':!app/api/**' ':!adapters/openai/server/**' ':!scripts/**' ':!*.config.*'` is empty (ESLint `no-restricted-syntax` mirrors this at lint time).
- `DemoShell` (Wave 4) gains: badge text `Connected: OpenAI (live) · tools: mock executor` when `adapterKind === 'openai'`, the Wave 1 `ProvenanceBadge` shows "Simulated" on any event with `metadata.simulated === true` (mock-executor tool events), a status line bound to `adapter.onStatus` (`Connected` / `Reconnecting…` / `Disconnected (live data unavailable)`), and a labelled text input + Send button that calls `startTurn` (disabled while a turn is in flight or status ≠ `connected`).
- Approve/Deny (Wave 1 `ApprovalControls`) are wired through `OrbEngine.onApprovalDecision → adapter.respondToApproval`; unchanged otherwise.
- `docs/how-to/connect-openai.md`: env list (§4.1 schema, server-only), Vercel/Docker notes, how the mock executor works, how to plug a host `ToolExecutor` if U-1 flips, what is and is not logged.
- `docs/security/threats/gateway.md`: the §6 table expanded with the c1–c13 rows from the risk analysis and their tests.

**Edge cases.**

- `ORB_ADAPTER=openai` set but env invalid → page renders mock with a visible note "Gateway misconfigured — running mock" (no secrets, no names of missing vars in the UI; names only in server logs).
- Fake canary accidentally rendered by a Server Component prop → scan catches it (the canary is the value, not the name).

**Acceptance criteria.**

- Given the production build with canary env, When the scan runs, Then zero hits; Given a fixture dir with a planted canary, Then exit code 1 with the file path → ORB-SEC-001, ORB-ADAPTER-003 · `tests/unit/scripts/bundle-secret-scan.test.ts` + CI job
- Given a fresh clone with no env, When `/` loads with all network blocked except the page, Then the Simulated badge is visible and no request to `/api/agent/**` occurs → ORB-SEC-006, ORB-DEMO-001 · `tests/e2e/demo-default-mock.spec.ts`
- Given `ORB_ADAPTER=openai` with the fake provider, When `/` loads, Then "Connected: OpenAI (live)" is visible, `[data-testid=orb-simulated-badge]` is absent until a mock-executor tool event arrives, then "Simulated" appears next to the tool → ORB-SEC-006, ORB-DEMO-002 · `tests/e2e/openai-gateway.governance.spec.ts`

**Observability.** Build-time: scan summary `{ filesScanned, hits }` printed as JSON; runtime: `orb.demo.adapter_selected{kind}` (server log).

**Fake-provider E2E design (`tests/e2e/fixtures/fake-openai-server.ts`).**

- Process: a Node `http` server bound to `127.0.0.1:4571` (loopback only), started by the Playwright `webServer` array before `next start`. It implements exactly `POST /v1/responses` with `stream: true`; any other path → 404. It requires `Authorization: Bearer sk-test-canary-e2e`; any other value → 401, which the gateway must surface as `ERROR{reason:'provider_unavailable'}` (proves the error mapper, never the provider message).
- Scenario selection: by the `input` text of the first round, or by `previous_response_id` for continuation rounds (the server remembers which scenario a response id belongs to). Frames are replayed verbatim from `tests/fixtures/provider/openai/scenarios/<scenario>.jsonl` as `text/event-stream` with fixed 20 ms spacing (no jitter).

| Input text                    | Scenario file              | Frames replayed                                                                            | Path exercised                                                                |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `hello`                       | `text-only.jsonl`          | created → output_text deltas → completed                                                   | thinking → speaking → idle                                                    |
| `search cats`                 | `tool-no-approval.jsonl`   | created → function_call `web_search` → completed; round 2: text → completed                | tool_call → executing → success → speaking                                    |
| `query users`                 | `tool-approval.jsonl`      | created → function_call `database_query` → completed; round 2 after `function_call_output` | tool_call → waiting_approval → executing → success (Approve) or → idle (Deny) |
| `run code`                    | `tool-approval-code.jsonl` | as above with `execute_code`                                                               | same, second approval-required tool                                           |
| `two tools`                   | `parallel-tools.jsonl`     | created → two function_calls in one response → completed                                   | A-04 sequential processing, FIFO queue visible in the a11y panel              |
| `fail`                        | `response-failed.jsonl`    | created → `response.failed`                                                                | error path, `reason:'provider_failed'`                                        |
| `hang`                        | `hang.jsonl`               | created, then no further frames                                                            | `ORB_GATEWAY_PROVIDER_TIMEOUT_MS` path (test overrides to 2 000 ms)           |
| any, with cookie `chaos=kill` | scenario as chosen         | socket destroyed after the second frame                                                    | killed-provider path (`openai-gateway.disconnect.spec.ts`)                    |

- Request log: every request (method, path, headers minus `Authorization`, JSON body) is appended to `tests/e2e/.artifacts/fake-provider-requests.jsonl`. Specs read it to assert that (a) a `function_call_output` containing `"approval denied"` follows Deny, (b) exactly one `function_call_output` exists per approved call (replay proof), (c) `X-Client-Request-Id` equals the gateway turn id, (d) no request URL or body carries the session cookie or CSRF token.
- Gateway process env for the project: `ORB_ADAPTER=openai OPENAI_API_KEY=sk-test-canary-e2e OPENAI_MODEL=fake OPENAI_BASE_URL=http://127.0.0.1:4571/v1 ORB_PROVIDER_ALLOW_LOOPBACK=1 ORB_GATEWAY_SESSION_SECRET=<48 chars fixed in the config> ORB_E2E=1`; the page is opened with `?seed=1&preset=ci&adaptive=0`.
- Origin isolation: `page.route('**', r => new URL(r.request().url()).origin === baseOrigin ? r.continue() : r.abort())` in every spec of the project; a counter of aborted requests must be 0 at the end of each test (ORB-SEC-008).
- Killing: the fixture exposes `killGateway()` (SIGTERM to the `next start` child) and `killProvider()` (server `close` + destroy sockets); `openai-gateway.disconnect.spec.ts` uses both, then asserts `window.__orbDebug.frames` keeps increasing for 2 s and the status line reads `Disconnected (live data unavailable)`.
- Determinism: fixed frame spacing, mock executor latency 0 under `ORB_E2E=1`, seeded engine PRNG, no `waitForTimeout`; assertions poll `window.__orbDebug.getSnapshot().state` and the a11y status text.

## 5. Parallel tracks

- Track A (server): 4.1 gateway core and 4.2 provider/policy/executor can be built by two people once `StreamFrame`, `GatewaySession` and `ToolPolicy` contracts (this file) are committed as types first; 4.2's orchestrator is unit-tested against a fixture `ProviderStreamFactory` without HTTP.
- Track B (client): 4.3 adapter is built against the SSE wire format in 4.1 using a fake `EventSourceLike`; no server needed.
- Track C (hygiene/docs): 4.4 scan script, docs and the fake provider server are independent of A/B.
- Integration point: `tests/integration/gateway/*.route.test.ts` (Next.js route handlers called as functions with `new Request(...)`) joins A; `tests/e2e/openai-gateway.*.spec.ts` joins A+B+C and is the G7 gate.

## 6. Threat model delta (STRIDE)

Only surfaces introduced or changed by this wave. Mitigations land in this wave.

| Surface                                  | S   | T   | R   | I   | D   | E   | Mitigation                                                                                                                                                                                                                            | Req IDs                                |
| ---------------------------------------- | --- | --- | --- | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `GET /api/agent/stream`                  | ✓   |     |     | ✓   | ✓   |     | Session cookie HttpOnly/Secure/SameSite=Lax bound to the log; `Origin` check; per-IP open + concurrency limits, heartbeat, max lifetime; no CORS headers (same-origin readable only)                                                  | ORB-SEC-006, ORB-SEC-008               |
| `POST /api/agent/approvals`              | ✓   | ✓   | ✓   |     | ✓   | ✓   | Session + `X-Orb-Csrf` + `Origin`/`Sec-Fetch-Site`; session owns `correlationId`; single-use nonce from the challenge; CAS on `pending`; `Idempotency-Key` → 409; TTL 5 min; audit `approval.decided/rejected`; per-session/IP limits | ORB-SEC-002, ORB-SEC-007, ORB-GOV-002  |
| `POST /api/agent/turns`                  | ✓   |     | ✓   | ✓   | ✓   |     | Same auth; 4000-char input cap, 8 KiB body cap; single active turn; per-session/IP + global daily cap; input never logged                                                                                                             | ORB-SEC-006, ORB-SEC-002               |
| SSE event data (client trust)            |     | ✓   |     |     |     | ✓   | Events flow server → client only; `APPROVAL_*`/`TOOL_*` derived solely from policy/executor; client-side `orbEventSchema` re-validation; ids for dedupe                                                                               | ORB-ARCH-004, ORB-GOV-003, ORB-SEC-008 |
| Provider call (`adapters/openai/server`) | ✓   |     |     | ✓   | ✓   |     | Key only in `server-only` module; `validateBaseUrl` (https, allowlist, private-IP block, no redirects); timeout + `AbortSignal`; error mapper → enum reasons; correlation header only                                                 | ORB-SEC-001, ORB-ADAPTER-003           |
| Tool policy + mock executor              |     | ✓   |     |     |     | ✓   | Server allowlist with per-tool zod args; `requiresApproval` server-side; executor never performs real actions (U-1); `MAX_TOOL_CALLS_PER_TURN`; visual registry has no server counterpart                                             | ORB-SEC-002, ORB-TOOLVIS-002           |
| Env / build output                       |     |     |     | ✓   |     |     | Zod env with `server-only`; `NEXT_PUBLIC_*` name lint; canary bundle scan in CI; gitleaks (Wave 0)                                                                                                                                    | ORB-SEC-001, ORB-ADAPTER-003           |
| Audit/structured logs                    |     |     | ✓   | ✓   |     |     | Event list in §4.1/§4.2; hashed session/IP; no prompt, args, provider bodies or key material                                                                                                                                          | ORB-SEC-001                            |
| Demo mode switch                         | ✓   | ✓   |     |     |     | ✓   | Mode decided by server env only; client receives a string; `gateway_disabled` in mock mode; "Connected: OpenAI (live)" indicator                                                                                                      | ORB-SEC-006, ORB-DEMO-002              |

## 7. Tests

| Test (name references requirement IDs)                                                                                                                                              | Type                                                | Req IDs                                                 | File                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| `req('ORB-ADAPTER-004','ORB-EVENT-003') normalization table is total over recorded fixtures and every event passes orbEventSchema`                                                  | unit                                                | ORB-ADAPTER-004, ORB-EVENT-003                          | `tests/unit/adapters/openai/normalize.test.ts`            |
| `req('ORB-ADAPTER-004') unknown and malformed frames are IGNORED with a warn and never throw`                                                                                       | unit                                                | ORB-ADAPTER-004                                         | `tests/unit/adapters/openai/normalize.test.ts`            |
| `req('ORB-ADAPTER-006') response.failed/incomplete/error map to a single ERROR with enum reason and no provider text`                                                               | unit                                                | ORB-ADAPTER-006, ORB-ADAPTER-004                        | `tests/unit/adapters/openai/normalize.test.ts`            |
| `req('ORB-SEC-007') decideApproval is single-use: pending→granted once, then already_decided; expired and nonce_mismatch rejected`                                                  | unit + property (fast-check over command sequences) | ORB-SEC-007                                             | `tests/unit/gateway/approval.test.ts`                     |
| `req('ORB-SEC-002') tool policy denies unknown tools, invalid args and budget exhaustion; requiresApproval is read from the registry only`                                          | unit                                                | ORB-SEC-002                                             | `tests/unit/gateway/toolPolicy.test.ts`                   |
| `req('ORB-SEC-006') rate limiter token bucket with fake clock returns retryAfterMs and concurrency slots release`                                                                   | unit                                                | ORB-SEC-006                                             | `tests/unit/gateway/rateLimit.test.ts`                    |
| `req('ORB-SEC-001') gateway env schema requires key/model/secret only for openai and rejects loopback/private base URLs without the flag`                                           | unit                                                | ORB-SEC-001, ORB-ADAPTER-003                            | `tests/unit/gateway/env.test.ts`                          |
| `req('ORB-SEC-001','ORB-ADAPTER-003') bundle scan finds a planted canary and secret-like NEXT_PUBLIC name, passes a clean tree`                                                     | unit                                                | ORB-SEC-001, ORB-ADAPTER-003                            | `tests/unit/scripts/bundle-secret-scan.test.ts`           |
| `req('ORB-ADAPTER-005') disconnect closes EventSource, aborts fetches, clears timers and subscribers`                                                                               | unit                                                | ORB-ADAPTER-005                                         | `tests/unit/adapters/openai/OpenAIAdapter.test.ts`        |
| `req('ORB-ADAPTER-006') connection loss delivers ERROR only when a turn is in flight`                                                                                               | unit                                                | ORB-ADAPTER-006                                         | `tests/unit/adapters/openai/OpenAIAdapter.test.ts`        |
| `req('ORB-GOV-005','ORB-SEC-007') respondToApproval posts the challenge nonce + csrf header and never emits APPROVAL_* locally`                                                     | unit                                                | ORB-GOV-005, ORB-SEC-007                                | `tests/unit/adapters/openai/OpenAIAdapter.test.ts`        |
| `req('ORB-SEC-002','ORB-GOV-002') orchestrator never calls the executor before granted approval and publishes challenge before APPROVAL_REQUIRED`                                   | integration (fixture provider, fake clock)          | ORB-SEC-002, ORB-GOV-002                                | `tests/integration/gateway/orchestrator.test.ts`          |
| `req('ORB-GOV-003','ORB-GOV-004') TOOL_COMPLETED only from executor ok; denial and policy_denied produce no TOOL_* events`                                                          | integration                                         | ORB-GOV-003, ORB-GOV-004, ORB-DEMO-002                  | `tests/integration/gateway/orchestrator.test.ts`          |
| `req('ORB-SEC-007') approvals route: replayed Idempotency-Key → 409, concurrent decisions → one 200 one 409, cross-session → 404`                                                   | integration (route handler as function)             | ORB-SEC-007, ORB-SEC-002                                | `tests/integration/gateway/approvals.route.test.ts`       |
| `req('ORB-SEC-002') auth ordering: missing csrf/foreign origin → 403 before validation; no session → 401`                                                                           | integration                                         | ORB-SEC-002                                             | `tests/integration/gateway/auth.test.ts`                  |
| `req('ORB-SEC-006') rate limits: 6th stream open → 429 + Retry-After; daily turn cap → 429`                                                                                         | integration                                         | ORB-SEC-006                                             | `tests/integration/gateway/rateLimit.route.test.ts`       |
| `req('ORB-SEC-008','ORB-EVENT-005') stream: ready frame, heartbeat cadence, Last-Event-ID replay, gap → resync + ERROR when turn active`                                            | integration                                         | ORB-SEC-008, ORB-EVENT-005                              | `tests/integration/gateway/stream.route.test.ts`          |
| `req('ORB-SEC-006') ORB_ADAPTER=mock → 503 gateway_disabled on all routes, no cookie`                                                                                               | integration                                         | ORB-SEC-006                                             | `tests/integration/gateway/disabled.test.ts`              |
| `req('ORB-ADAPTER-006','ORB-RENDER-005') headless harness keeps ticking through adapter stream failure`                                                                             | integration                                         | ORB-ADAPTER-006                                         | `tests/integration/adapters/openai-harness.test.ts`       |
| `req('ORB-ARCH-002','ORB-SEC-008','ORB-ADAPTER-003') boundaries: openai SDK only in adapters/openai/server; server modules only from app/api; client adapter imports no server/env` | arch (dependency-cruiser + Vitest)                  | ORB-ARCH-002, ORB-SEC-008, ORB-ADAPTER-003              | `tests/architecture/gateway-boundaries.test.ts`           |
| `@ORB-SEC-006 @ORB-DEMO-001 default demo is mock and never calls /api/agent`                                                                                                        | e2e                                                 | ORB-SEC-006                                             | `tests/e2e/demo-default-mock.spec.ts`                     |
| `@ORB-ADAPTER-002 @ORB-SEC-008 @ORB-GOV-002 fake provider drives request → approval → execution → success; Deny → idle; browser never leaves origin`                                | e2e (fake provider)                                 | ORB-ADAPTER-002, ORB-SEC-008, ORB-GOV-002, ORB-DEMO-002 | `tests/e2e/openai-gateway.governance.spec.ts`             |
| `@ORB-SEC-007 approve twice via page.request → second 409; one execution in fake-provider request log`                                                                              | e2e                                                 | ORB-SEC-007                                             | `tests/e2e/openai-gateway.replay.spec.ts`                 |
| `@ORB-ADAPTER-006 killed provider socket and killed gateway → orb keeps rendering, status shows Disconnected, no pageerror`                                                         | e2e                                                 | ORB-ADAPTER-006                                         | `tests/e2e/openai-gateway.disconnect.spec.ts`             |
| `@ORB-SEC-001 production bundle contains no canary values`                                                                                                                          | integration (CI job over the real build output)     | ORB-SEC-001, ORB-ADAPTER-003                            | `scripts/bundle-secret-scan.ts` (CI `bundle-secret-scan`) |
| `ORB-ADAPTER-002 real-key smoke: one governed turn against api.openai.com recorded in the PR`                                                                                       | manual (maintainer, never in CI)                    | ORB-ADAPTER-002                                         | `docs/how-to/connect-openai.md` (checklist section)       |

CI: unit + integration in the existing Vitest job (Node env; route handlers invoked as functions; `Clock`/`Scheduler` fakes; `prng` seeded so idempotency keys and nonces are reproducible); `bundle-secret-scan` job after `build`; Playwright project `openai-gateway` (Chromium, SwiftShader, `ci` preset) alongside the Wave 4 projects. Manual: real-key smoke (`docs/how-to/connect-openai.md` checklist) recorded in the PR before G7 closes; never run in CI.

## 8. ADRs to record

- ADR-0013 — Agent gateway transport: SSE stream + POST commands. Context: browser needs server-pushed normalized events and two client commands without exposing provider credentials. Options: SSE + POST (native `EventSource`, `Last-Event-ID` resume, works on Next.js route handlers and serverless), WebSocket (bidirectional but needs a custom server, no native resume), long polling. Recommendation: SSE + POST with an in-memory per-session log (256 frames) and single-instance session store; consequence: multi-instance deployments must supply a shared `SessionStore`/`IdempotencyStore` (interfaces provided, implementation out of V1).
- ADR-0014 — Tool execution policy and mock executor (U-1). Context: SPEC requires execution behind application policy; V1 has no host application. Options: mock executor only (default), host executor hooks in V1, no server tools. Recommendation: server-side registry with `requiresApproval` + zod args, `ToolExecutor` port with `MockToolExecutor` as the only implementation, mock tool events flagged `simulated: true`; consequence: flipping U-1 adds `kind: 'host'` without changing governance flow.

## 9. Deliverables

- `app/api/agent/stream/route.ts`, `app/api/agent/turns/route.ts`, `app/api/agent/approvals/route.ts`
- `app/api/agent/_lib/{env,gateway,session,sse,idempotency,rateLimit,auth,audit,errors}.ts`, `app/api/agent/_lib/domain/approval.ts`, `app/api/agent/_lib/tools/{policy,registry,executor}.ts`
- `adapters/openai.ts`, `adapters/openai/{OpenAIAdapter,sseTransport,normalize}.ts`, `adapters/openai/server/{provider,streamOrchestrator}.ts`, `adapters/index.ts` (adds `createAdapter`)
- `app/page.tsx` (adapter selection), `components/orb/DemoShell.tsx` (live badge, status line, turn input), `components/a11y/ProvenanceBadge.tsx` (per-event `simulated`)
- `scripts/bundle-secret-scan.ts`; `.github/workflows/ci.yml` (jobs `bundle-secret-scan`, Playwright project `openai-gateway`); `.dependency-cruiser.cjs` (rules: `openai` SDK only in `adapters/openai/server/**`; that folder imported only by `app/api/**`; `app/api/**` never imports `engine/**`, `components/**`, `three`, `react`; `adapters/openai/{OpenAIAdapter,sseTransport,normalize}.ts` never import `server-only`/SDK); `eslint` rule `no-restricted-syntax` for `process.env` outside server dirs; `.env.example` (names only)
- `tests/fixtures/provider/openai/*.jsonl`, `tests/fixtures/provider/openai/scenarios/*.jsonl`, `tests/fixtures/tools/*.json`, `tests/e2e/fixtures/fake-openai-server.ts`, all test files in §7
- `docs/reference/openapi/agent-gateway.yaml` (OpenAPI 3.1, the §4.1 table), `docs/how-to/connect-openai.md`, `docs/security/threats/gateway.md`, `docs/adr/0013-agent-gateway-sse-post-transport.md`, `docs/adr/0014-tool-execution-policy-mock-executor.md`
- `specs/TRACEABILITY.md` rows for the §3 IDs; `CHANGELOG.md` entry under Unreleased

## 10. Exit criteria (Gate G7)

1. `tests/integration/gateway/approvals.route.test.ts` green: replayed key → 409, concurrent decisions → exactly one execution, cross-session → 404.
2. `tests/unit/adapters/openai/normalize.test.ts` green with the totality assertion: every fixture frame type present in `NORMALIZATION_TABLE`, 100 % of emitted events valid with injected timestamps.
3. CI job `bundle-secret-scan` green on a production build with canary values; `tests/unit/scripts/bundle-secret-scan.test.ts` proves the scan fails on a planted canary.
4. Playwright project `openai-gateway` green in CI: `openai-gateway.governance.spec.ts` shows `tool_call → waiting_approval → executing → success` (and Deny → `idle`) driven by the fake provider with no real key; browser requests never leave the origin.
5. `tests/unit/adapters/openai/OpenAIAdapter.test.ts` leak test green (`EventSource.close()` called, signals aborted, timers 0, subscribers 0).
6. `tests/integration/gateway/rateLimit.route.test.ts` green: 429 with `Retry-After` header and `retryAfterMs` body.
7. `openai-gateway.disconnect.spec.ts` green: killed provider socket and killed gateway leave `window.__orbDebug.frames` increasing, no `pageerror`, status text "Disconnected".
8. `tests/architecture/gateway-boundaries.test.ts` and dependency-cruiser green; `engine/**` unchanged in this wave (diff assertion in PR review).
9. `pnpm req:coverage` shows every §3 MUST covered by a passing test; ORB-ADAPTER-002 and ORB-SEC-007 (SHOULD) listed with their tests.
10. `docs/reference/openapi/agent-gateway.yaml` validated by `@redocly/cli lint` in CI; how-to and threat model reviewed by the maintainer; ADR-0013 and ADR-0014 accepted.
11. After explicit session-specific provider/budget authorization, manual real-key smoke recorded in the PR (screenshot + `orb.gateway.turn.completed` log line with `outcome:'completed'`).

## 11. Risks, spikes and open questions

- Risk: Responses API streaming event names drift (SDK major) → the normalizer's totality test fails loudly on new fixture types; pin SDK exact version; spike (0.5 day) at wave start to re-record fixtures from the live API with a maintainer key → owner: maintainer / ADR-0013 note.
- Risk: in-memory session/idempotency store breaks on multi-instance or serverless cold starts → documented in ADR-0013; `SessionStore`/`IdempotencyStore` are ports; the reference deployment is single instance → owner: ADR.
- Risk: SSE buffering by proxies/CDNs delays events → `X-Accel-Buffering: no`, `Cache-Control: no-transform`, 15 s heartbeat; documented in the how-to → owner: how-to.
- Risk: mapping text output to `ASSISTANT_SPEAKING` may be read as "speech" when it is text → `metadata.label: 'text'` and the a11y announcer wording "Assistant responding"; candidate spec clarification → owner: spec-amendment (open question below).
- Spike: Next.js route handler streaming on the chosen hosting (Vercel Fluid vs Node server) — verify `STREAM_MAX_LIFETIME_MS` fits the platform's function timeout; adjust default before G7 → owner: maintainer.
- Assumed user decisions: **U-1 = mock executor only** (`ToolExecutor.kind` is `'mock'`; tool events flagged `simulated: true`). If flipped: add `kind: 'host'`, `createAgentGateway({ executor })` accepts a host implementation, `simulated` becomes `false` for those events, threat model gains sandboxing/least-privilege rows, and an execution timeout policy per tool; governance flow and endpoints unchanged. **U-2 = Responses API streaming** (text; no `USER_SPEAKING`). If flipped to Realtime: server-side WebSocket to the provider, `input_audio_buffer.speech_started/stopped` → `USER_SPEAKING/USER_STOPPED_SPEAKING`, `response.audio.*` → `ASSISTANT_SPEAKING/STOPPED`, assistant audio delivered to Wave 5's `MediaElementSource`; browser transport (ADR-0013) unchanged; normalization table gains a second sheet.
- Open questions: (1) Resolved in the proposed plan: text deltas never emit `ASSISTANT_SPEAKING`; actual audio playback would own speech events in a later transport amendment. (2) `POST /api/agent/turns` is not in the WAVE_ASSIGNMENT route list but is required to start a turn without a voice channel — confirm it stays inside the ORB-SEC-008 surface rather than getting its own ID. (3) Should a policy auto-deny be represented as `APPROVAL_REQUIRED → APPROVAL_DENIED{reason:'policy_denied'}` (chosen; keeps the 14-type set closed) or does the spec owner prefer a dedicated event type in a future revision? (4) Session cookie `Path=/api/agent` vs `/` when the host app embeds the orb under a base path — how-to documents the default; decision by host.

## 12. Playground and demo controls introduced

- Demo page (`/`) when `ORB_ADAPTER=openai`: "Connected: OpenAI (live) · tools: mock executor" badge; connection status line (`Connected` / `Reconnecting…` / `Disconnected (live data unavailable)`); labelled text input + Send button (turn), disabled while a turn is in flight; Approve/Deny unchanged but now routed to the gateway; per-event "Simulated" badge on mock-executor tool events. In mock mode the page is byte-identical to Wave 4 apart from the hidden gateway status element.
- Playground (`/playground`): read-only "Gateway" panel showing adapter kind, connection status, last SSE id and active `correlationId`; no secrets, no ability to emit governance events into the gateway (the only client → server governance message remains `respondToApproval`, ORB-PLAY-002 owned by Wave 4).
