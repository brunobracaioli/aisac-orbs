import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path: string): Promise<string> {
  // The helper is called only with repository-relative paths listed in this test.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFile(path, "utf8");
}

describe("open-source repository hygiene", () => {
  it("keeps the required policy and contribution files present", async () => {
    const required = [
      "LICENSE",
      "NOTICE",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "CHANGELOG.md",
      "CODE_OF_CONDUCT.md",
      ".gitleaks.toml",
      "lefthook.yml",
      ".github/CODEOWNERS",
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".github/ISSUE_TEMPLATE/config.yml",
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      ".github/ISSUE_TEMPLATE/feature_request.yml",
      ".github/ISSUE_TEMPLATE/spec_change.yml",
      ".github/dependabot.yml",
      ".github/rulesets/main.json",
      "docs/adr/README.md",
      "docs/adr/0000-template.md",
      "docs/adr/0001-engine-shape.md",
      "docs/adr/0002-state-management.md",
      "docs/adr/0003-package-boundary.md",
      "docs/adr/0004-determinism-and-webgl-testing.md",
      "docs/security/threats/README.md",
      "docs/tutorials/README.md",
      "docs/how-to/README.md",
      "docs/reference/README.md",
      "docs/explanation/README.md",
    ];
    await Promise.all(required.map((path) => access(path)));
  });

  it("matches the package and root specification versions", async () => {
    const packageJson = JSON.parse(await source("package.json")) as {
      specVersion?: string;
      scripts?: Record<string, string>;
    };
    const specVersion = /^\*\*Version:\*\*\s+(.+?)\s*$/m.exec(await source("SPEC.md"))?.[1];
    expect(packageJson.specVersion).toBe(specVersion);
    expect(await source("LICENSE")).toContain("Apache License");
    expect(await source("LICENSE")).toContain("Version 2.0");
    expect(await source("README.md")).toContain("SPEC.md");
    expect(await source("README.md")).toContain("specs/");
    expect(packageJson.scripts?.dev).toBeTruthy();
    const readme = await source("README.md");
    const documentedCommands = [...readme.matchAll(/^(?:pnpm|npm run)\s+([a-z][a-z0-9:_-]*)/gim)]
      .map((match) => match[1])
      .filter((command): command is string => command !== undefined && command !== "install");
    for (const command of documentedCommands) {
      expect(packageJson.scripts?.[command]).toBeTruthy();
    }
  });

  it("encodes DCO, spec-driven review, and deterministic test rules", async () => {
    const contributing = await source("CONTRIBUTING.md");
    expect(contributing).toContain("git commit -s");
    expect(contributing).toContain("pnpm spec:ids");
    expect(contributing).toContain("Do not use sleeps");
    const pullRequest = await source(".github/PULL_REQUEST_TEMPLATE.md");
    for (const phrase of [
      "Requirement IDs touched",
      "SPEC.md",
      "pnpm spec:ids",
      "Tests reference",
      "spec-change",
      "Intentional deviations",
      "threat model",
      "No secrets",
      "signed off",
    ]) {
      expect(pullRequest).toContain(phrase);
    }
  });

  it("keeps disclosure and changelog status honest", async () => {
    const security = await source("SECURITY.md");
    expect(security).toContain("GitHub private vulnerability reporting");
    expect(security.toLowerCase()).toContain("do not publish vulnerability details");
    expect(security).toContain("docs/reference/branch-protection.md");
    expect(security).toContain("90 days");
    expect(await source("CHANGELOG.md")).toMatch(/^## \[Unreleased\]/m);
    expect(await source("CHANGELOG.md")).toMatch(/^### Added/m);
    expect(await source("CHANGELOG.md")).toMatch(/^### Changed/m);
    expect(await source("CHANGELOG.md")).toMatch(/^### Security/m);
    expect(await source("CHANGELOG.md")).toMatch(/^### Spec/m);
  });
});
