# CI timing budget

Target PR wall clock: at most 15 minutes. Target E2E stage: at most 4 minutes. Target CodeQL stage: at most 8 minutes, running alongside independent jobs.

The first successful hosted sample is [CI run 34908184281](https://github.com/brunobracaioli/aisac-orbs/actions/runs/34908184281), on commit `63a9a4009df769c9c427a0e41442286182bd708c`. It ran from 23:17:34 to 23:21:06 UTC on 2026-09-14: 212 seconds of wall clock, with 46 seconds in the E2E job. The parallel [CodeQL run](https://github.com/brunobracaioli/aisac-orbs/actions/runs/34908184309) took 63 seconds. These observations are below the stated budgets; one sample does not establish a distribution. The prior CI run failed on the hook fixture's missing `rg` utility and is excluded from the successful-run sample.

| Evidence             | Successful samples | First observation | p50 / p95 |
| -------------------- | ------------------ | ----------------- | --------- |
| Hosted PR wall clock | 1                  | 212 s             | Pending   |
| Hosted E2E           | 1                  | 46 s              | Pending   |
| Hosted CodeQL        | 1                  | 63 s              | Pending   |

## Pre-G2 measurement plan

Collect at least ten successful hosted runs before G2, recording run URLs, per-stage durations and wall clock; then compute p50 and p95. Use the next implementation PR/main runs first. If fewer than ten exist at the G2 review, dispatch the remaining measurement runs with an explicit trusted baseline SHA. The primary implementation review owns collection and the maintainer reviews the resulting budget. This is the documented pre-G2 plan submitted for W0 G0 criterion 11; ten-run performance evidence is not yet available.

If the measured budget is exceeded, record the concrete bottleneck and mitigation before G2. Local elapsed times remain separate and do not count toward the hosted sample. Do not substitute estimated timings for measurements.
