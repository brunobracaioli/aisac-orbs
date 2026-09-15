# Architecture decisions

Use the [template](0000-template.md) for decisions affecting boundaries, contracts, dependency choices or operational behavior. Record context, decision and consequences; keep the status explicit. Accepted decisions are changed through a new ADR that supersedes the old one.

| ADR                                           | Decision                                           | Status   |
| --------------------------------------------- | -------------------------------------------------- | -------- |
| [0001](0001-engine-shape.md)                  | Framework-independent engine and thin React host   | Accepted |
| [0002](0002-state-management.md)              | Pure semantic reducer and presentation bridge      | Accepted |
| [0003](0003-package-boundary.md)              | One package with executable boundaries             | Accepted |
| [0004](0004-determinism-and-webgl-testing.md) | Deterministic inputs and production browser checks | Accepted |

The implementation plan reserves ADR-0005–0018 for later waves. An accepted architecture choice does not imply its implementation or acceptance tests are complete.
