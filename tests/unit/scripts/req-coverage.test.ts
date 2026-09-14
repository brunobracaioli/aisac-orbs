/* eslint-disable security/detect-non-literal-fs-filename -- tests use controlled fixture and temporary paths. */
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeCoverage,
  extractReportEvidence,
  mergeRequirements,
  parseLock,
  parseOverrides,
  parseSpec,
  renderGeneratedTypes,
  renderLock,
  type Overrides,
} from "../../../scripts/req-coverage";

const fixture = (name: string): string => resolve("tests/fixtures/spec", name);
const emptyOverrides: Overrides = { provisional: [], manual: [], waivers: [] };
const createdTempRoots: string[] = [];
const tempRoot = (prefix: string): string => {
  const root = mkdtempSync(join(tmpdir(), prefix));
  createdTempRoots.push(root);
  return root;
};

afterEach(() => {
  for (const root of createdTempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("requirement coverage tooling", () => {
  it("parses the baseline fixture and preserves mixed MUST semantics", () => {
    const parsed = parseSpec(readFileSync(fixture("spec-0.1.0.md"), "utf8"));
    expect(parsed.version).toBe("0.1.0");
    expect(parsed.requirements).toHaveLength(5);
    expect(parsed.requirements.find((item) => item.id === "ORB-TEST-002")).toMatchObject({
      declaredLevel: "should",
      effectiveLevel: "must",
    });
    expect(parsed.requirements.find((item) => item.id === "ORB-TEST-004")).toMatchObject({
      declaredLevel: "informative",
      effectiveLevel: "informative",
    });
  });

  it("extracts only passing evidence from Vitest and Playwright JSON shapes", () => {
    const vitest = JSON.parse(readFileSync(fixture("reports/vitest.json"), "utf8")) as unknown;
    const playwright = JSON.parse(
      readFileSync(fixture("reports/playwright.json"), "utf8"),
    ) as unknown;
    const evidence = extractReportEvidence(vitest, playwright);
    expect(
      evidence.filter((item) => item.id === "ORB-TEST-001" && item.status === "passed"),
    ).toHaveLength(2);
    expect(
      evidence.find((item) => item.id === "ORB-TEST-002" && item.kind === "unit")?.status,
    ).toBe("failed");
    expect(evidence.find((item) => item.id === "ORB-TEST-002" && item.kind === "e2e")?.status).toBe(
      "skipped",
    );
    expect(evidence.some((item) => item.id === "ORB-TEST-003" && item.status === "passed")).toBe(
      false,
    );
    expect(evidence.some((item) => item.id === "ORB-NOPE-999")).toBe(true);
    const expectedFailure = extractReportEvidence(
      {},
      {
        tests: [
          {
            title: "expected failure",
            tags: ["@ORB-TEST-001"],
            expectedStatus: "failed",
            status: "expected",
            results: [{ status: "failed" }],
          },
        ],
      },
    );
    expect(expectedFailure[0]?.status).toBe("failed");
    const untaggedAlias = extractReportEvidence(
      {},
      {
        tests: [
          {
            title: "ORB-TEST-001 and ORB-TEST-002",
            tags: ["@ORB-TEST-001"],
            expectedStatus: "passed",
            status: "expected",
            results: [{ status: "passed" }],
          },
        ],
      },
    );
    expect(untaggedAlias.map((item) => item.id)).toEqual(["ORB-TEST-001"]);
  });

  it("fails uncovered and unknown IDs, including a failed MUST", () => {
    const requirements = parseSpec(readFileSync(fixture("spec-0.1.0.md"), "utf8")).requirements;
    const evidence = extractReportEvidence(
      JSON.parse(readFileSync(fixture("reports/vitest.json"), "utf8")) as unknown,
      {},
    );
    const report = analyzeCoverage(requirements, emptyOverrides, evidence, { today: "2026-09-14" });
    expect(report.unknown).toContain("ORB-NOPE-999");
    expect(report.errors).toContain("failing MUST: ORB-TEST-002");
    expect(report.errors).toContain("uncovered MUST: ORB-TEST-003");
  });

  it("rejects expired waivers and current or completed wave waivers", () => {
    const requirements = parseSpec(readFileSync(fixture("spec-0.1.0.md"), "utf8")).requirements;
    const expired = parseOverrides(readFileSync(fixture("overrides-expired.yaml"), "utf8"));
    expect(analyzeCoverage(requirements, expired, [], { today: "2026-09-14" }).errors).toContain(
      "expired waiver for ORB-TEST-001",
    );
    const current = parseOverrides(readFileSync(fixture("overrides-future.yaml"), "utf8"));
    const report = analyzeCoverage(requirements, current, [], {
      today: "2026-09-14",
      gateWave: "wave-00-foundation",
      waveDir: fixture("waves"),
    });
    expect(report.errors).toContain(
      "waiver cannot cover current or completed wave requirement ORB-TEST-001",
    );
  });

  it("validates override entries with a strict schema", () => {
    expect(() =>
      parseOverrides(readFileSync(fixture("overrides-unknown-field.yaml"), "utf8")),
    ).toThrow(/schema validation failed/);
    expect(() =>
      parseOverrides(readFileSync(fixture("overrides-duplicate-key.yaml"), "utf8")),
    ).toThrow(/YAML parse failed/);
  });

  it("keeps generated IDs and lock output deterministic", () => {
    const parsed = parseSpec(
      readFileSync("tests/fixtures/spec/baseline/SPEC-0.1.0.baseline.md", "utf8"),
    );
    const firstTypes = renderGeneratedTypes(mergeRequirements(parsed.requirements, emptyOverrides));
    const secondTypes = renderGeneratedTypes(
      mergeRequirements(parsed.requirements, emptyOverrides),
    );
    const firstLock = renderLock(parsed.version, parsed.requirements);
    expect(firstTypes).toBe(secondTypes);
    expect(parseLock(firstLock).entries.size).toBe(73);
    expect(firstLock).toBe(renderLock(parsed.version, parsed.requirements));
  });

  it("keeps all baseline IDs represented in the versioned baseline lock", () => {
    const parsed = parseSpec(
      readFileSync("tests/fixtures/spec/baseline/SPEC-0.1.0.baseline.md", "utf8"),
    );
    const checkedIn = parseLock(
      readFileSync("tests/fixtures/spec/baseline/requirement-ids.lock", "utf8"),
    );
    expect(checkedIn.entries.size).toBe(73);
    expect([...checkedIn.entries.keys()].sort()).toEqual(
      parsed.requirements.map((item) => item.id).sort(),
    );
  });

  it("allows metadata generation without runtime reports or coverage failures", () => {
    const requirements = parseSpec(readFileSync(fixture("spec-0.1.0.md"), "utf8")).requirements;
    const report = analyzeCoverage(requirements, emptyOverrides, [], { metadataOnly: true });
    expect(report.errors).toEqual([]);
    expect(
      report.rows.every((row) => row.status === "uncovered" || row.status === "informative"),
    ).toBe(true);
  });

  it("reports a SHOULD threshold as a warning without turning it into a policy failure", () => {
    const requirements = parseSpec(readFileSync(fixture("spec-0.1.0.md"), "utf8")).requirements;
    const report = analyzeCoverage(requirements, emptyOverrides, [], {
      shouldThreshold: 70,
      metadataOnly: true,
    });
    expect(report.warnings.some((warning) => warning.includes("SHOULD coverage"))).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("accepts only current manual evidence files for known IDs", () => {
    const requirements = parseSpec(readFileSync(fixture("spec-0.1.0.md"), "utf8")).requirements;
    const valid: Overrides = {
      provisional: [],
      waivers: [],
      manual: [
        {
          id: "ORB-TEST-001",
          verification: "manual",
          evidence: "SPEC.md",
          reviewedAt: "2026-09-14",
          issue: "tests/unit/scripts/req-coverage.test.ts",
        },
      ],
    };
    expect(
      analyzeCoverage(requirements, valid, [], { today: "2026-09-14" }).rows.find(
        (row) => row.id === "ORB-TEST-001",
      )?.status,
    ).toBe("manual");
    const unknown: Overrides = { ...valid, manual: [{ ...valid.manual[0]!, id: "ORB-NOPE-999" }] };
    expect(analyzeCoverage(requirements, unknown, [], { today: "2026-09-14" }).errors).toContain(
      "manual evidence references unknown requirement ID: ORB-NOPE-999",
    );
  });

  it("keeps metadata CLI generation and --check read-only", () => {
    const root = tempRoot("aisac-orbs-req-");
    const typesPath = resolve(root, "requirement-ids.ts");
    const lockPath = resolve(root, "requirement-ids.lock");
    const cli = resolve("scripts/req-coverage.ts");
    const tsx = resolve("node_modules/tsx/dist/cli.mjs");
    const common = [
      "--spec",
      fixture("spec-0.1.0.md"),
      "--overrides",
      fixture("overrides-future.yaml"),
      "--types",
      typesPath,
      "--lock",
      lockPath,
    ];
    const localEnv = { ...process.env, CI: "false" };
    execFileSync(process.execPath, [tsx, cli, ...common, "--emit-types", "--write-lock"], {
      cwd: process.cwd(),
      stdio: "pipe",
      env: localEnv,
    });
    expect(existsSync(typesPath)).toBe(true);
    expect(existsSync(lockPath)).toBe(true);
    const before = statSync(typesPath).mtimeMs;
    execFileSync(process.execPath, [tsx, cli, ...common, "--check"], {
      cwd: process.cwd(),
      stdio: "pipe",
      env: localEnv,
    });
    expect(statSync(typesPath).mtimeMs).toBe(before);
    const checkJson = resolve(root, "check.json");
    const checkMd = resolve(root, "check.md");
    let checkExit = 0;
    try {
      execFileSync(
        process.execPath,
        [tsx, cli, ...common, "--check", "--reports-only", "--json", checkJson, "--md", checkMd],
        { cwd: process.cwd(), stdio: "pipe", env: localEnv },
      );
    } catch (error) {
      checkExit =
        typeof error === "object" && error && "status" in error && typeof error.status === "number"
          ? error.status
          : -1;
    }
    expect(checkExit).toBe(0);
    expect(existsSync(checkJson)).toBe(false);
    expect(existsSync(checkMd)).toBe(false);
  });

  it("enforces the CI baseline-lock policy for first-time generation", () => {
    const root = tempRoot("aisac-orbs-req-ci-missing-");
    const typesPath = resolve(root, "requirement-ids.ts");
    const lockPath = resolve(root, "requirement-ids.lock");
    const cli = resolve("scripts/req-coverage.ts");
    const tsx = resolve("node_modules/tsx/dist/cli.mjs");
    let exitCode = 0;
    try {
      execFileSync(
        process.execPath,
        [
          tsx,
          cli,
          "--spec",
          fixture("spec-0.1.0.md"),
          "--overrides",
          fixture("overrides-future.yaml"),
          "--types",
          typesPath,
          "--lock",
          lockPath,
          "--emit-types",
          "--write-lock",
        ],
        { cwd: process.cwd(), stdio: "pipe", env: { ...process.env, CI: "true" } },
      );
    } catch (error) {
      exitCode =
        typeof error === "object" && error && "status" in error && typeof error.status === "number"
          ? error.status
          : -1;
    }
    expect(exitCode).toBe(2);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("emits traceability Markdown with real line breaks", () => {
    const root = tempRoot("aisac-orbs-req-trace-");
    const tracePath = resolve(root, "traceability.md");
    const cli = resolve("scripts/req-coverage.ts");
    const tsx = resolve("node_modules/tsx/dist/cli.mjs");
    execFileSync(
      process.execPath,
      [
        tsx,
        cli,
        "--spec",
        fixture("spec-0.1.0.md"),
        "--overrides",
        fixture("overrides-future.yaml"),
        "--lock",
        fixture("requirement-ids.lock"),
        "--emit-traceability",
        "--traceability",
        tracePath,
      ],
      { cwd: process.cwd(), stdio: "pipe", env: { ...process.env, CI: "true" } },
    );
    const trace = readFileSync(tracePath, "utf8");
    expect(trace.split("\n")).toContain("| ORB-TEST-001 | must | 1. State |");
    expect(trace).not.toContain("\\n");
  });

  it("fails a silent lock downgrade without spec-change evidence", () => {
    const root = tempRoot("aisac-orbs-req-downgrade-");
    const lockPath = resolve(root, "requirement-ids.lock");
    writeFileSync(lockPath, "spec-version: 0.2.1\nORB-TEST-001 must 00000000\n", "utf8");
    const cli = resolve("scripts/req-coverage.ts");
    const tsx = resolve("node_modules/tsx/dist/cli.mjs");
    let exitCode = 0;
    try {
      execFileSync(
        process.execPath,
        [
          tsx,
          cli,
          "--spec",
          fixture("spec-downgrade.md"),
          "--lock",
          lockPath,
          "--check-lock",
          "--reports-only",
        ],
        { cwd: process.cwd(), stdio: "pipe" },
      );
    } catch (error) {
      exitCode =
        typeof error === "object" && error && "status" in error && typeof error.status === "number"
          ? error.status
          : -1;
    }
    expect(exitCode).toBe(1);
  });

  it("checks a trusted baseline lock even when the worktree lock was regenerated", () => {
    const root = tempRoot("aisac-orbs-req-baseline-");
    const baselinePath = resolve(root, "baseline.lock");
    const currentPath = resolve(root, "current.lock");
    writeFileSync(baselinePath, "spec-version: 0.2.1\nORB-TEST-001 must 00000000\n", "utf8");
    writeFileSync(currentPath, "spec-version: 0.2.1\nORB-TEST-001 should 11111111\n", "utf8");
    const cli = resolve("scripts/req-coverage.ts");
    const tsx = resolve("node_modules/tsx/dist/cli.mjs");
    let exitCode = 0;
    try {
      execFileSync(
        process.execPath,
        [
          tsx,
          cli,
          "--spec",
          fixture("spec-downgrade.md"),
          "--lock",
          currentPath,
          "--baseline-lock",
          baselinePath,
          "--check-lock",
          "--reports-only",
        ],
        { cwd: process.cwd(), stdio: "pipe" },
      );
    } catch (error) {
      exitCode =
        typeof error === "object" && error && "status" in error && typeof error.status === "number"
          ? error.status
          : -1;
    }
    expect(exitCode).toBe(1);
  });

  it("rejects unknown options and missing option values", () => {
    const cli = resolve("scripts/req-coverage.ts");
    const tsx = resolve("node_modules/tsx/dist/cli.mjs");
    for (const args of [["--gat", "wave-00-foundation"], ["--gate"]]) {
      let exitCode = 0;
      try {
        execFileSync(process.execPath, [tsx, cli, ...args], { cwd: process.cwd(), stdio: "pipe" });
      } catch (error) {
        exitCode =
          typeof error === "object" &&
          error &&
          "status" in error &&
          typeof error.status === "number"
            ? error.status
            : -1;
      }
      expect(exitCode).toBe(2);
    }
  });

  it("requires E2E evidence for a current gate even in reports-only mode", () => {
    const requirement = parseSpec(
      "**Version:** 0.1.0\n\n## 1. Render\n\n- **ORB-RENDER-006** — Fallback MUST be visible.",
    ).requirements;
    const report = analyzeCoverage(requirement, emptyOverrides, [], {
      reportsOnly: true,
      gateWave: "wave-00-foundation",
      waveDir: fixture("waves"),
      today: "2026-09-14",
      playwrightReportPresent: false,
    });
    expect(report.errors.some((error) => error.includes("required E2E evidence missing"))).toBe(
      true,
    );
    expect(report.errors).toContain("required E2E report is missing");
  });
});
