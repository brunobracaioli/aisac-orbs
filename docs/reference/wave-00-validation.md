# Wave 0 validation record

Date: 2026-09-14
Status: local acceptance passed; hosted G0 evidence pending
Normative SPEC: 0.2.0
Implementation plan: 1.2.0 (maintainer-approved baseline 1.1.0)

## Source and environment

The primary exported only files selected by `git ls-files -co --exclude-standard` into a new disposable Git repository. The successful snapshot contained 215 files; SHA-256 comparisons found no source differences against the working checkout before recording these results. This catches tests that depend on ignored local fixture files. The source manifest is stored locally in `reports/acceptance-snapshot.json`.

Environment: Node 22.22.2, pnpm 10.18.2, Next.js 16.3.4, Playwright 1.63.0 with its explicitly installed Chromium, Gitleaks 8.24.2. Browser cache and package store were in task-specific `/tmp` directories. This is clean-source acceptance on the available Linux environment, not a claim about a newly provisioned operating system or a physical reference GPU.

## Executed commands

Both commands exited 0 in `/tmp/aisac-orbs-acceptance-4mhjg_0i`:

```sh
CI=true pnpm --config.store-dir=/tmp/aisac-orbs-pnpm-store install --frozen-lockfile
env -i PATH="/tmp:$PATH" CI=true NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/aisac-orbs-browsers pnpm ci:local
```

The second command runs all locally reproducible stages in order and stops on failure. Its E2E step reuses the production build that passed the bundle scan. No provider credentials or real-provider calls were used.

| Check                          | Result                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Frozen install                 | 351 packages installed from the locked graph; no resolution changes                                  |
| Formatting and lint            | Passed; zero lint errors or warnings in the successful aggregate                                     |
| Strict TypeScript              | Passed                                                                                               |
| Architecture                   | Zero errors; three expected orphan warnings for generated/configuration files                        |
| Unit/property tests            | 82 passed, 0 failed, 15 test files; fast-check seed 20260914 and 200 runs in CI mode                 |
| Global measured coverage       | 92.99% lines, 85.71% branches                                                                        |
| Core coverage                  | 94.02% lines, 88.04% branches                                                                        |
| Production build               | Passed; page routes rendered dynamically for CSP nonces                                              |
| Browser bundle scan            | 11 browser artifacts scanned; passed                                                                 |
| Playwright                     | 4 passed, 0 failed, 0 flaky; 2 intentional opposite-project skips                                    |
| Required W0 coverage           | ORB-ARCH-001 and ORB-ARCH-002 covered; zero policy errors                                            |
| All requirement rows           | 114: 8 with passing test evidence, 105 future-wave waivers, 1 informative                            |
| Dependency licenses            | Passed with two exact package approvals and preserved notices; unused optional sharp/libvips removed |
| Dependency vulnerability audit | No known vulnerabilities found at execution time                                                     |
| Secrets                        | History and nonignored working tree scanned; no leaks found                                          |

The browser checks prove seeded 2,000-point rendering under SwiftShader, the text fallback with WebGL disabled, full CSP/header values and unique nonces, no CSP violations, and 404 behavior including the disabled image optimizer. They do not establish physical-device FPS or human visual acceptance for future formations.

Reports were copied into the working checkout: `reports/vitest.json`, `reports/playwright.json`, `reports/req-coverage.json`, `reports/req-coverage.md` and coverage artifacts. The browser report started at 23:01:28 UTC and ran for about 4.7 seconds; that is local duration, not a hosted CI budget measurement.

## Additional hook verification

The actual workflow hook step was executed in a disposable Git repository with the pinned Gitleaks and installed Lefthook. A harmless `README.txt` commit passed. The generated synthetic assignment was independently identified as `generic-api-key` in the scanner's JSON report, and its staged commit was rejected by the installed hook. No real credential was used.

The initial all-zero project-key fixture was not recognized and correctly caused the acceptance check to fail. Only the fixture and its verification were corrected; scanning policy was not relaxed. The final workflow/hook changes passed focused CI/hygiene/PRNG tests (15 passed), lint and formatting after the aggregate run.

## Pending hosted evidence

- Reviewed PR and successful GitHub Actions checks for the candidate.
- CodeQL results on both candidate and base, with high-or-higher security alerts blocked by the configured ruleset.
- Integration on `main`, main-branch CI, and activation/verification of [.github/rulesets/main.json](../../.github/rulesets/main.json).
- Activation/verification of private vulnerability reporting before declaring that channel active.
- Recorded hosted CI timing samples and the budget review described in [ci-budget.md](ci-budget.md).

These items remain required for G0. Local success does not close the gate or start W1/W2 automatically.
