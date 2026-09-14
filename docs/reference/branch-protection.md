# Branch protection

## Observed state

Read-only GitHub API verification on 2026-09-14 found that `brunobracaioli/aisac-orbs` is public and `main` is not protected (`GET /repos/brunobracaioli/aisac-orbs/branches/main/protection`: HTTP 404, “Branch not protected”). Secret scanning and push protection are enabled. Private vulnerability reporting is disabled (`GET /repos/brunobracaioli/aisac-orbs/private-vulnerability-reporting`: `enabled: false`).

No repository administration setting has been changed by this implementation run.

## Required G0 configuration

The approved plan requires pull requests for `main`, one approving review, green blocking checks for stages 1–11, no force pushes and no branch deletion. CODEOWNERS must cover specification, boundary, security, provider and workflow changes. Required check names must match the implemented GitHub Actions jobs; those names and the proposed configuration are recorded when CI integration is ready.

The concrete, unapplied configuration is [.github/rulesets/main.json](../../.github/rulesets/main.json). It targets `refs/heads/main`, requires an approving code-owner review and resolved review threads, dismisses stale approvals, requires the named CI checks, forbids deletion and non-fast-forward updates, and has no bypass actors. Setup must also be required so a setup failure cannot be hidden by skipped dependent jobs.

The CodeQL rule selects `alerts_threshold: errors` and `security_alerts_threshold: high_or_higher`. GitHub requires code-scanning results for both the candidate and the base before this rule can be enforced. Run the bootstrap analysis on the reviewed baseline before activation and verify the actual check names. See the [GitHub ruleset API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset).

Enable private vulnerability reporting before publishing a SECURITY.md that points contributors to that channel. Keep fork workflows on `pull_request`, with no production/provider secrets and default `contents: read` permissions.

## Acceptance evidence

Status: pending. G0 cannot be marked complete from local test results. Record the applied protection API response, reviewed PR and successful hosted checks here after the corresponding authorized actions complete.
