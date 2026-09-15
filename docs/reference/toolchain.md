# Toolchain reference

This repository targets Node `>=22 <23` and records exact dependency versions in
`package.json` and `pnpm-lock.yaml`. The local checkout used Node `22.22.2` and
pnpm `10.18.2`.

The local pnpm wrapper resolves through a Windows installation and its default
store is read-only in the managed workspace. Use an explicit writable store for
reproducible installation:

```sh
pnpm --config.store-dir=/tmp/aisac-orbs-pnpm-store install --frozen-lockfile
```

The repository sets `minimum-release-age=10080` in `.npmrc`. The following
registry timestamps were checked on 2026-09-14; every selected package was
published at least seven days before that check.

| Package                               |       Exact version | Registry release timestamp                          |
| ------------------------------------- | ------------------: | --------------------------------------------------- |
| `next`                                |            `16.3.4` | 2026-08-31T20:00:51.381Z                            |
| `react`, `react-dom`                  |            `19.0.8` | 2026-07-21T15:43:22.261Z / 15:43:34.326Z            |
| `three`                               |           `0.185.1` | 2026-07-01T14:04:30.373Z                            |
| `zod`                                 |             `4.5.4` | 2026-08-29T17:55:42.775Z                            |
| `dependency-cruiser`                  |            `18.2.0` | 2026-08-10T18:01:17.747Z                            |
| `typescript`                          |             `5.9.2` | 2025-07-31T17:54:06.216Z                            |
| `typescript-eslint`                   |            `8.70.0` | 2026-09-07T18:18:09.654Z                            |
| `eslint`, `@eslint/js`                |            `9.39.5` | 2026-07-10T20:41:47.507Z / 20:16:17.272Z            |
| `eslint-plugin-react`                 |            `7.37.5` | 2025-04-03T20:01:15.958Z                            |
| `eslint-plugin-security`              |             `4.0.1` | 2026-06-12T03:14:50.159Z                            |
| `prettier`                            |             `3.9.6` | 2026-07-21T05:51:53.987Z                            |
| `vitest`, `@vitest/coverage-v8`       |             `5.0.0` | 2026-09-03T12:24:30.312Z / 12:21:54.737Z            |
| `vite`                                |             `8.2.2` | 2026-08-20T04:14:39.107Z                            |
| `@playwright/test`                    |            `1.63.0` | 2026-09-04T22:44:00.304Z                            |
| `tailwindcss`, `@tailwindcss/postcss` |             `4.3.3` | 2026-07-16T12:03:35.267Z / 12:03:56.054Z            |
| `postcss`                             |            `8.5.28` | 2026-09-03T15:13:59.819Z                            |
| `tsx`                                 |           `4.23.13` | 2026-08-30T00:46:16.265Z                            |
| `fast-check`                          |             `4.9.0` | 2026-07-08T21:33:03.026Z                            |
| `js-yaml`                             |             `4.3.2` | 2026-08-26T20:42:48.747Z                            |
| `lefthook`                            |            `2.1.12` | 2026-08-28T10:24:30.060Z                            |
| `@types/node`                         |           `22.20.1` | 2026-07-08T06:48:07.602Z                            |
| `@types/react`, `@types/react-dom`    | `19.2.18`, `19.2.7` | 2026-07-30T21:54:03.456Z / 2026-09-03T11:04:47.516Z |
| `@types/three`                        |           `0.185.4` | 2026-08-04T20:04:52.689Z                            |

`ignore-scripts=true` is intentional. Playwright browser installation is an
explicit CI/setup step, so dependency installation does not execute package
postinstall hooks.
