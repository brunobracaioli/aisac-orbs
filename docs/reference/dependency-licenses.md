# Dependency license review

Date: 2026-09-14
Scope: W0 implementation dependency review, plan 1.2.0
Reviewer: primary implementation agent, within the approved implementation scope

## Decision

Keep the baseline license allow-list. Add the two package-specific approvals below to `specs/dependency-license-approvals.json`, validated by the license checker. An approval matches the exact package name, version, declared license and installed license-file SHA-256. Missing attribution or preserved license files, unknown licenses, changed versions and changed license text remain failures requiring review.

These approvals apply to the installed toolchain dependencies. They do not change the Apache-2.0 license for AISAC Orbs source or approve arbitrary packages under the same licenses. Future dependency changes are checked again.

| Package                     | Dependency path                                                       | Declared license | Installed license file | Installed license SHA-256                                          |
| --------------------------- | --------------------------------------------------------------------- | ---------------- | ---------------------- | ------------------------------------------------------------------ |
| `caniuse-lite@1.0.30001810` | `next@16.3.4` → browser compatibility data                            | `CC-BY-4.0`      | `LICENSE`              | `fd3a263fe19ed8faa9068b43abaebafc02c77897b0c6fc09abc04bb592e5f16e` |
| `minimatch@10.2.6`          | `@typescript-eslint/typescript-estree@8.70.0` → file pattern matching | `BlueOak-1.0.0`  | `LICENSE.md`           | `2c7c5d22ed5a8ee968c64757710979afcd77438c48b4a265b94e615babd8a901` |

## Review evidence and notices

The installed caniuse-lite package identifies its license as CC-BY-4.0. The upstream browser-support data permits reuse under that license; attribution, a license link and a statement of modifications must accompany redistribution. AISAC Orbs preserves the installed license text, attributes the data and package in `NOTICE`, and makes no modifications to the installed package. See [Can I Use attribution and data license](https://caniuse.com/ciu/about), [caniuse-lite's license](https://github.com/browserslist/caniuse-lite/blob/main/LICENSE), and [CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/).

The installed minimatch package identifies its license as BlueOak-1.0.0. The license grants use and modification permissions with a notice requirement; redistributed copies must retain the license text or its canonical link. AISAC Orbs preserves the installed text and records the package attribution in `NOTICE`. See [minimatch's license](https://github.com/isaacs/minimatch/blob/main/LICENSE.md) and the [Blue Oak Model License](https://blueoakcouncil.org/license/1.0.0).

The preserved copies are [caniuse-lite LICENSE](../licenses/caniuse-lite-1.0.30001810-LICENSE.txt) and [minimatch LICENSE](../licenses/minimatch-10.2.6-LICENSE.md). Keep third-party notices and these files in distributions. The release audit in W8 must inventory the dependencies and notices actually redistributed; this W0 review does not substitute for that artifact review.

## Optional image optimizer

The installed Next.js package declares `sharp` as optional. Its native libvips distribution introduces `LGPL-3.0-or-later`, outside the approved policy. AISAC Orbs renders particles and parses SVG geometry; its approved scope does not use the Next.js raster-image optimization service. Remove only the `next@16.3.4` → `sharp` optional edge through a scoped pnpm override and set `images.unoptimized: true`. Do not disable all optional dependencies: the framework compiler and test tools still need their platform binaries. The pinned Next.js server implementation returns 404 for its image optimizer when this setting is enabled.

Verify a fresh frozen install, absence of reachable sharp/libvips in the dependency graph, the full license scan, production build and browser smoke. Enabling raster-image optimization later requires its own dependency/license review. This decision changes no orb feature or normative product requirement. See [pnpm dependency overrides](https://pnpm.io/10.x/settings#overrides) and [Next.js image configuration](https://nextjs.org/docs/app/api-reference/components/image#unoptimized).

## Checker acceptance

- Exact approved package, version, license and license hash pass with existing attribution and preserved text.
- A changed version, license, license file or missing notice/copy fails.
- A different package using one of these licenses fails unless separately approved.
- Malformed or empty SPDX expressions fail. Allowed alternatives in valid SPDX `OR` expressions are handled explicitly; `AND` requires every obligation to be accepted.
- Missing required installed dependencies and malformed manifests fail; absent optional dependencies for another platform are recorded separately.
