# Implementation status

**Updated:** 2026-09-14
**Approved plan baseline:** 1.1.0; scoped implementation amendments recorded in 1.2.0
**Current wave:** W0 — foundation
**Current unit:** hosted G0 verification and maintainer review
**Normative baseline:** SPEC.md 0.2.0, adopted locally in W0 §4.8; merge pending

## Authorization and scope

The maintainer approved implementation on 2026-09-14 with “Now, can you implement the project?” after reviewing the planning completion report. This authorizes implementation and verification of the project described by plan 1.1.0, including its proposed amendment and default choices. The primary agent owns architecture, specification changes, coordination and final review. The `coder` agent owns code, tests and targeted fixes.

The accepted defaults are U-1 mock tool execution, U-2 Responses streaming, U-3 SVG upload in the gated playground, U-4 DCO sign-off and U-5 a single package with enforced boundaries. The approved amendment includes the ORB-FORM-008 coordinate-layout clarification. SPEC 0.2.0 is adopted in §4.8 after baseline tooling is verified, before tests use its new requirement IDs.

Provider spending, deployment, release publication and repository administration retain the explicit gates in the approved plan. Local evidence, hosted CI, maintainer review and device/visual acceptance are recorded separately.

## Verified starting point

- Checkout: `main` at `18f07fd` (`first commit`), tracking `origin/main`.
- Tracked files: `SPEC.md` and `README.md`; planning documents are local and untracked.
- No existing application, package manifest, test suite or CI configuration.
- Node.js 22.22.2 is available. The pre-existing `pnpm` command resolves outside this Linux checkout and must be verified before use.
- The planning review is recorded in [PLAN-REVIEW.md](PLAN-REVIEW.md). Its 114 requirement assignments are planned verification references, not passing runtime evidence.

## Units and evidence

| Unit                                | Status                                 | Evidence                                                                                                                                                                                |
| ----------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W0 §4.1 scaffold/toolchain          | Implemented and validated locally      | Frozen install, formatting, lint, strict TypeScript and production build passed from a clean source snapshot.                                                                           |
| W0 §4.5 requirement tooling         | Implemented and validated locally      | Strict YAML/CLI validation, trusted baseline comparison, runtime report accounting, negative tests and read-only deterministic generation pass.                                         |
| W0 §4.8 amendment adoption          | Applied and validated locally          | SPEC/package/lock 0.2.0, 114 unique IDs, 126 transition rows; all 73 baseline requirement sentences and levels preserved.                                                               |
| W0 §4.2 kernel                      | Implemented and validated locally      | Injected time, chronological fake scheduler, seeded PRNG, defensive logger and easing properties; core coverage 94.02% lines / 88.04% branches.                                         |
| W0 §4.3 architecture guard          | Implemented and validated locally      | Positive/negative boundary fixtures; zero errors. Three configured orphan warnings concern dynamically loaded config/generated files. Both W0-owned requirements have passing evidence. |
| W0 §4.6 security / §4.4 WebGL spike | Implemented and validated locally      | Production CSP and fallback; 4 browser cases pass, 2 opposite-project cases are intentionally skipped. Bundle, dependency-license, vulnerability and secret scans pass.                 |
| W0 §4.7 hygiene / CI integration    | Implemented; hosted validation pending | Policy files, ADRs, workflows and unapplied main ruleset exist. Installed hook accepts a clean commit and rejects the verified synthetic secret fixture.                                |
| W1–W8                               | Pending                                | Dependency gates and respective acceptance criteria apply.                                                                                                                              |

**G0 is not closed.** Local acceptance passed; hosted CI, maintainer review, main-branch integration and repository protections still need their concrete evidence. Code of conduct uses a minimal public request to arrange a private reporting channel until a dedicated address is supplied.

## Final local validation

The primary copied 215 nonignored source files into a clean disposable Git repository and verified every source hash against the working checkout. The frozen install and complete `ci:local` command passed with `CI=true` and a scrubbed environment. Results: 82/82 unit/property tests across 15 files; 4 browser cases passed with 2 intentional project-specific skips; zero requirement-coverage policy errors; no known dependency vulnerabilities; no secrets found.

The requirement report has 114 rows: 8 have passing test evidence, 105 carry explicit future-wave waivers and one is informative. This does not mean eight complete product requirements have been independently certified: several are W0 mechanisms touching later-wave requirements. The two requirements owned by W0, ORB-ARCH-001/002, have passing boundary evidence; later waves remain unfinished.

The initial clean CI run exposed two fixture tests that inherited CI lock policy without providing fixture baselines. Those tests were corrected without relaxing production checks, a CI missing-baseline regression was added, and unique temporary directories now prevent cross-run contamination. The subsequent full run passed. An additional installed-hook check exposed an invalid all-zero synthetic fixture; it was replaced with a deterministic signature identified by the pinned scanner, and both clean acceptance and secret rejection were verified. The final hook/workflow changes received focused CI/hygiene validation after the aggregate run.

See [the W0 validation record](../docs/reference/wave-00-validation.md) for commands, limits and remaining hosted evidence. Local aggregate reports are under `reports/`; they are generated artifacts, not committed passing-test claims.

## Continuity

The manager confirmed the planning-recovery workloop state and read its canonical `STATE.md`. That prior run has checkpoint sequence 0 and no actor NOTES capsule. Its persisted planning review and the current Git state were used for recovery. The runtime rejected `rehydration_complete` without capsule fields and rejected a repository-local NOTES path. A fresh `W0-foundation` binding succeeded with the runtime's default NOTES location; the manager opened atomic unit `w0-scaffold`. The missing prior capsule is recorded rather than represented as a validated checkpoint.

Native worker actor allocation was unavailable in this runtime. Workers were instructed not to mutate the shared manager identity; their collaboration handoffs were reconciled by the primary.

Next action: prepare the reviewed W0 PR, run hosted checks, and present the concrete merge/protection changes for maintainer review before closing G0 or starting dependent waves.
