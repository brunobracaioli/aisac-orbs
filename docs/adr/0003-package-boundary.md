# ADR-0003: One package with executable module boundaries

Status: accepted
Date: 2026-09-14
Decision basis: maintainer approval of implementation plan 1.1.0, U-5 and W0 §8.

## Context

The project initially has one deployable application and a future reusable engine. A monorepo would add packaging work before a second deployable exists. Unchecked relative imports would make future extraction costly.

## Decision

Use one pnpm package on Node.js 22 with exact dependency pins, a committed lockfile, disabled implicit lifecycle scripts and a seven-day minimum dependency release age. Required native/browser installation steps are explicit and documented. Package scripts are added when their real implementation exists.

Keep SPEC §25 context roots. `core/` is the shared leaf kernel. Contexts communicate through public contracts; presentation uses the engine, adapter and formation public indexes. Provider SDKs belong only in `adapters/<provider>/server/`, reached by API composition code. Dependency-cruiser and negative fixtures enforce the detailed W0 §4.3 rules, including type-only provider imports.

The temporary W0 smoke page may import Three.js and the kernel directly. Both exceptions expire when the real particle renderer arrives in W2. Before V1, W8 rehearses extracting the engine and its permitted dependencies into a package with `engine/index.ts` as its only public entry.

## Consequences

All contexts share one dependency installation and toolchain. Boundary checks are mandatory despite sharing a package. Future extraction must preserve API and SPEC version metadata. Dependency install-script exceptions and urgent release-age overrides require explicit documentation and targeted verification; they are not silently enabled globally.

W0's dependency review excludes Next.js's optional `sharp` image optimizer with an exact parent-package override and disables that unused service in Next.js configuration. The orb has no raster-image optimization requirement. Other optional platform binaries remain enabled. Package-specific license approvals and preserved notices are recorded in [dependency-licenses.md](../reference/dependency-licenses.md).
