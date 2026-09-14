import { readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

async function workflow(name: string): Promise<string> {
  // The helper is called only with checked-in workflow filenames from this test.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFile(`.github/workflows/${name}`, "utf8");
}

function jobBlock(source: string, jobId: string): string {
  const escaped = jobId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = source.match(
    // The job ID comes from the fixed list of checked-in workflow jobs below.
    // eslint-disable-next-line security/detect-non-literal-regexp
    new RegExp(`^  ${escaped}:\\n([\\s\\S]*?)(?=^  [A-Za-z0-9_-]+:\\n|(?![\\s\\S]))`, "m"),
  );
  if (!block?.[1]) throw new Error(`missing workflow job: ${jobId}`);
  return block[1];
}

describe("CI contracts", () => {
  it("pins every GitHub Action to a verified commit SHA", async () => {
    const files = await readdir(".github/workflows");
    const workflows = await Promise.all(
      files.filter((file) => file.endsWith(".yml")).map((file) => workflow(file)),
    );
    const actionRefs = workflows.flatMap((content) => [
      ...content.matchAll(/uses:\s*([^\s#]+)@([^\s#]+)/g),
    ]);
    expect(actionRefs.length).toBeGreaterThan(0);
    for (const match of actionRefs) expect(match[2]).toMatch(/^[0-9a-f]{40}$/);
    expect(workflows.join("\n")).not.toContain("pull_request_target");
  });

  it("defines all blocking Wave 0 stages with read-only defaults", async () => {
    const ci = await workflow("ci.yml");
    for (const stage of [
      "stage-00-setup",
      "stage-01-lint-format",
      "stage-02-typecheck",
      "stage-03-architecture",
      "stage-04-unit-integration",
      "stage-05-build",
      "stage-06-bundle-secret-scan",
      "stage-07-e2e",
      "stage-08-req-coverage",
      "stage-10-sca-license",
      "stage-11-secrets",
    ]) {
      expect(ci).toContain(`name: ${stage}`);
    }
    expect(await workflow("codeql.yml")).toContain("stage-09-sast-codeql");
    expect(ci).toContain("permissions:\n  contents: read");
    expect(ci).toContain("pull_request:");
    expect(ci).toContain("push:\n    branches: [main]");
    expect(ci).toContain("workflow_dispatch:");
    expect(ci).toContain("pnpm install --frozen-lockfile");
    expect(ci).toContain("pnpm exec playwright install --with-deps chromium");
  });

  it("keeps builds scrubbed, coverage evidence complete, and secrets pinned", async () => {
    const ci = await workflow("ci.yml");
    const build = jobBlock(ci, "build");
    const scan = jobBlock(ci, "bundle-secret-scan");
    const e2e = jobBlock(ci, "e2e");
    const reqCoverage = jobBlock(ci, "req-coverage");
    const secrets = jobBlock(ci, "secrets");
    expect(build).toMatch(/outputs:[\s\S]*canary:/);
    expect(build).toContain('env -i HOME="$HOME" PATH="$PATH" CI=true');
    expect(build).toContain("sk-canary-$(openssl rand -hex 16)");
    expect(scan).toMatch(/needs:\s+build/);
    expect(scan).toContain("name: next-build");
    expect(scan).toContain("ORB_BUNDLE_CANARY");
    expect(e2e).toMatch(/needs:\s+\[build, bundle-secret-scan\]/);
    expect(e2e).toContain("ORB_E2E_REUSE_BUILD=1");
    expect(e2e).toContain("name: next-build");
    expect(e2e).toContain("playwright-diagnostics");
    expect(e2e).toContain("test-results");
    expect(e2e).toContain("playwright-report");
    expect(reqCoverage).toMatch(/needs:\s+\[unit, e2e\]/);
    expect(reqCoverage).toContain("fetch-depth: 0");
    expect(reqCoverage).toContain("BASE_SHA:");
    expect(reqCoverage).toContain("github.event_name == 'push' && github.event.before");
    expect(ci).toContain("baseline_sha:");
    expect(reqCoverage).toContain('git rev-parse --verify "$BASE_SHA^{commit}"');
    expect(reqCoverage).toContain('git show "$BASE_SHA:specs/requirement-ids.lock"');
    expect(reqCoverage).toContain("GITHUB_PR_LABELS:");
    expect(reqCoverage).toContain("--reports-only --gate wave-00-foundation --check-lock");
    expect(reqCoverage).toContain("--baseline-lock");
    expect(reqCoverage).not.toContain("specs/requirement-ids.baseline.lock");
    expect(reqCoverage).toContain("$RUNNER_TEMP/aisac-orbs-req-baseline");
    expect(secrets).toContain("pnpm scan:secrets");
    expect(await readFile("scripts/scan-secrets-working-tree.sh", "utf8")).toContain(
      "git ls-files -co --exclude-standard",
    );
    expect(secrets).toContain("printf 'clean fixture\\n'");
    expect(secrets).toContain('"RuleID": "generic-api-key"');
    expect(secrets).toContain("scanner_report");
    expect(secrets).toContain('lefthook" install');
    expect(secrets).toContain('git -C "$fixture_repo" commit');
    expect(ci).toContain("if: always()");
    expect(ci).toContain("if: failure()");
    expect(ci).toContain("fa0500f6b7e41d28791ebc680f5dd9899cd42b58629218a5f041efa899151a8e");
    const codeql = await workflow("codeql.yml");
    expect(codeql).toContain("high-severity alerts");
    expect(codeql).toContain("not evidence");
  });

  it("makes deferred nightly and weekly checks explicit skips", async () => {
    expect(await workflow("nightly.yml")).toContain("PERF PROBE SKIPPED");
    expect(await workflow("weekly.yml")).toContain("CROSS-BROWSER SMOKE SKIPPED");
  });

  it("publishes a reviewable but unapplied main branch protection ruleset", () => {
    const ruleset = JSON.parse(readFileSync(".github/rulesets/main.json", "utf8")) as {
      enforcement?: string;
      conditions?: { ref_name?: { include?: string[] } };
      bypass_actors?: unknown[];
      rules?: Array<{
        type?: string;
        parameters?: {
          code_scanning_tools?: unknown[];
          required_status_checks?: Array<{ context?: string }>;
        };
      }>;
    };
    expect(ruleset.enforcement).toBe("active");
    expect(ruleset.conditions?.ref_name?.include).toEqual(["refs/heads/main"]);
    expect(ruleset.bypass_actors).toEqual([]);
    expect(ruleset.rules?.some((rule) => rule.type === "deletion")).toBe(true);
    expect(ruleset.rules?.some((rule) => rule.type === "non_fast_forward")).toBe(true);
    const requiredStatuses = ruleset.rules?.find((rule) => rule.type === "required_status_checks");
    expect(
      requiredStatuses?.parameters?.required_status_checks?.map((check) => check.context),
    ).toEqual([
      "stage-00-setup",
      "stage-01-lint-format",
      "stage-02-typecheck",
      "stage-03-architecture",
      "stage-04-unit-integration",
      "stage-05-build",
      "stage-06-bundle-secret-scan",
      "stage-07-e2e",
      "stage-08-req-coverage",
      "stage-09-sast-codeql",
      "stage-10-sca-license",
      "stage-11-secrets",
    ]);
    const scanning = ruleset.rules?.find((rule) => rule.type === "code_scanning");
    expect(scanning?.parameters?.code_scanning_tools).toEqual([
      {
        tool: "CodeQL",
        alerts_threshold: "errors",
        security_alerts_threshold: "high_or_higher",
      },
    ]);
  });
});
