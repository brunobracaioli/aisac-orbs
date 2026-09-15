# specs/ — SPEC-driven implementation plan

`SPEC.md` (repository root) is the normative source of truth. This folder holds the plan that implements it, one shippable **wave** at a time, plus the traceability matrix.

**Current state (2026-09-14):** the maintainer approved implementation after the review in [PLAN-REVIEW.md](PLAN-REVIEW.md). Wave 0 is being integrated and verified locally. `SPEC.md` is 0.2.0 with 114 generated requirement IDs; plan 1.2.0 records the implementation clarifications. No wave gate is closed. See [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) for actual results and pending hosted evidence.

## What lives here

| Path                                                                 | Purpose                                                                                                                                                                                       | Maintained by                                 |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `SPEC-implementation-waves.md`                                       | Master plan: principles, bounded contexts, wave overview, dependency graph, cross-cutting concerns, risks, ADR index, coverage summary, V1 definition of done, open decisions, change control | maintainer (PR + version bump)                |
| `waves/wave-00-foundation.md` … `waves/wave-08-release-hardening.md` | One spec per wave: owned requirement IDs, vertical slices, TypeScript contracts, acceptance criteria, STRIDE delta, tests, deliverables, exit criteria (gate)                                 | the wave's implementers                       |
| `SPEC-amendments-proposal.md`                                        | Amendments that take `SPEC.md` 0.1.0 → 0.2.0: stable IDs for every normative clause, ambiguity decisions A-01…A-18, Appendix A transition table                                               | applied in Wave 0, slice 0.8                  |
| `TRACEABILITY.md`                                                    | Matrix ORB-* → owning wave → tests / manual evidence. Hand-maintained with the wave files until Wave 0 lands the generator; generated and verified in CI afterwards                           | `scripts/req-coverage.ts` (Wave 0, slice 0.5) |
| `SHARED-CONTRACTS.md`                                                | Contract owners, type-only handoffs and reconciled integration rules                                                                                                                          | plan review, then owning slice PRs            |
| `PLAN-REVIEW.md`                                                     | Recovery evidence, corrections, validation and implementation entry gate                                                                                                                      | maintainer review                             |
| `IMPLEMENTATION-STATUS.md`                                           | Current units, verified local results and pending external gate evidence                                                                                                                      | primary implementation review                 |
| `requirement-ids.lock`                                               | Canonical list of requirement IDs; generates the `ReqId` type used by tests (created in Wave 0)                                                                                               | `pnpm spec:ids`                               |
| `requirements.overrides.yaml`                                        | Provisional IDs, manual-verification evidence, time-boxed waivers (created in Wave 0)                                                                                                         | reviewed per PR                               |

## Wave map

| Wave | Slug                      | SPEC §27                      | Gate    | Depends on |
| ---- | ------------------------- | ----------------------------- | ------- | ---------- |
| 0    | `foundation`              | V0.0                          | G0      | —          |
| 1    | `semantic-core`           | V0.4 + V0.5                   | G1      | W0         |
| 2    | `particle-renderer`       | V0.1                          | G2      | W0         |
| 3    | `formations-and-morphing` | V0.2 (+ trusted half of V0.8) | G3      | W2         |
| 4    | `integrated-demo`         | V0.6                          | G4      | W1, W3     |
| 5    | `pointer-and-audio`       | V0.3 + V0.7                   | G5      | W4         |
| 6    | `custom-svg-formations`   | V0.8                          | G6      | W4         |
| 7    | `provider-gateway`        | V0.9                          | G7      | W4         |
| 8    | `release-hardening`       | V1.0                          | G8 = V1 | W5, W6, W7 |

W1 and W2 can run concurrently after the shared type-only handoff; so can W5, W6 and W7. A wave closes only when its gate is green.

## How to read it

1. Read `SPEC.md` once, end to end.
2. Read the master plan §2–§6 (purpose, principles, folder layout, wave overview, dependency graph).
3. Open the wave file you are implementing. Its §3 lists the requirement IDs you own; its §4 slices are the units of PRs; its §10 exit criteria are the gate.
4. Check `TRACEABILITY.md` for planned ownership and verification paths. Actual passing evidence is generated in `reports/req-coverage.json` and summarized in `IMPLEMENTATION-STATUS.md`; the master plan §11 identifies neighbouring owners.
5. Before touching a public surface (routes, `engine/index.ts`, SVG import), read the wave's §6 STRIDE delta and the master plan §8.1.

## Rules of the road

- A PR implements a slice, links it, and updates the wave file in the same PR.
- Every requirement ID is owned by exactly one wave; a wave that touches another wave's ID says so.
- No new normative behaviour without a stable ID (`SPEC.md` §28 rule 3): open a `spec-change` PR first.
- Tests reference IDs: Vitest `${req('ORB-XXX-NNN')}` titles, Playwright `tag: ['@ORB-XXX-NNN']`. `pnpm req:coverage` fails CI on an uncovered MUST.
- Type, module and folder names come from the master plan §4; a wave may add names, never rename them.
- Plan changes bump the master plan version (§14 of the master plan); open decisions U-1…U-5 live in its §13.
