# CI timing budget

Target PR wall clock: at most 15 minutes. Target E2E stage: at most 4 minutes. Target CodeQL stage: at most 8 minutes, running alongside independent jobs.

No hosted timing sample has been collected yet. After CI integration, record at least 10 successful runs of the candidate workflow with run URLs, per-stage durations and wall clock; compute p50 and p95 from those observations. Local elapsed times may be recorded separately and do not count toward the hosted sample.

| Evidence             | Sample count | p50 | p95 | Status  |
| -------------------- | ------------ | --- | --- | ------- |
| Hosted PR wall clock | 0            | —   | —   | Pending |
| Hosted E2E           | 0            | —   | —   | Pending |
| Hosted CodeQL        | 0            | —   | —   | Pending |

If the initial budget is exceeded, record the concrete bottleneck and a mitigation plan before G2 as allowed by W0 G0 criterion 11. Do not substitute estimated timings for measurements.
