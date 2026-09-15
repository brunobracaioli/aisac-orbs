# Contributing to AISAC Orbs

AISAC Orbs follows spec-driven development. Before changing behavior, read
[`SPEC.md`](SPEC.md), the owning wave under [`specs/waves`](specs/waves), and
the shared contract register in [`specs/SHARED-CONTRACTS.md`](specs/SHARED-CONTRACTS.md).

## Local setup

Use Node.js 22 and pnpm. The repository pins the package manager and uses a
frozen lockfile in CI.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm lefthook install
pnpm dev
```

Run the checks that apply to your change before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The complete local gate is `pnpm ci:local` once all Wave 0 scripts are
available. It uses a scrubbed build environment and never requires provider
credentials.

## Pull requests

- Use a focused branch such as `feat/formation-morph` or `fix/logger-redaction`.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, and similar).
- Sign commits with the Developer Certificate of Origin: `git commit -s`.
- Keep changes small enough to review and describe the observable behavior.
- Do not include provider credentials, personal data, generated secrets, or
  unrelated formatting changes.

Every pull request should complete the checklist in
`.github/PULL_REQUEST_TEMPLATE.md`. Changes to a normative requirement need a
stable requirement ID and the corresponding spec update in the same pull
request. Tests should identify the requirement they prove with `req()` or an
explicit Playwright tag. Do not use sleeps or real provider calls in tests.

## Adding requirements and ADRs

Add or amend the requirement in `SPEC.md` and run:

```bash
pnpm spec:ids
```

The generated requirement union and lock file belong in the same pull request.
An intentional deviation needs a reason, issue reference, and time-boxed entry
in `specs/requirements.overrides.yaml`. Architectural decisions use the
Michael Nygard format from `docs/adr/0000-template.md` and are indexed in
`docs/adr/README.md`.

## Tests and determinism

Domain and application logic must have deterministic unit tests. Use the
injected `Clock`, `Scheduler`, and `Prng`; do not call `Date.now()`, timer
globals, or `Math.random()` from domain code. When a property test fails,
record its seed (`FC_SEED`) and the smallest reproducer. Keep the test pyramid
weighted toward unit tests and use E2E only for critical browser behavior.

## Security reports

Do not report a vulnerability in a public issue and do not include secrets in
an issue or pull request. See [`SECURITY.md`](SECURITY.md) for the current
disclosure status. Gitleaks is run by the pre-commit hook and in CI; a local
fixture must use the documented `sk-canary-` allow-list only.
