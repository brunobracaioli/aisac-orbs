import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { cruise } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

import type { IConfiguration } from "dependency-cruiser";
import { req } from "../../support/req";

const require = createRequire(import.meta.url);
const configuration = require("../../../.dependency-cruiser.cjs") as IConfiguration;
const fixtureRoot = resolve("tests/fixtures/arch/violations");

interface BoundaryViolation {
  readonly rule: {
    readonly name: string;
    readonly severity: string;
  };
}

async function cruisePaths(paths: string[]): Promise<BoundaryViolation[]> {
  const result = await cruise(paths, {
    ruleSet: configuration,
    validate: true,
  });

  if (typeof result.output === "string") {
    throw new Error(result.output);
  }

  return result.output.summary.violations as BoundaryViolation[];
}

const sourceRoots = [
  "app",
  "components",
  "core",
  "events",
  "engine",
  "formations",
  "shaders",
  "pointer",
  "audio",
  "adapters",
  "scripts",
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- values are a fixed allow-list of repository roots.
].filter((root) => existsSync(root));

describe("dependency boundaries", () => {
  it(`${req("ORB-ARCH-001", "ORB-ARCH-002")} keeps the repository free of error-level boundary violations`, async () => {
    const violations = await cruisePaths(sourceRoots);

    expect(violations.filter((violation) => violation.rule.severity === "error")).toEqual([]);
  });

  it(`${req("ORB-ARCH-001", "ORB-ARCH-002")} proves the seeded forbidden boundaries are active`, async () => {
    const violations = await cruisePaths([fixtureRoot]);
    const names = violations.map((violation) => violation.rule.name);

    expect(names).toContain("core-is-leaf");
    expect(names).toContain("engine-no-ui");
    expect(names).toContain("engine-type-imports-only-public-adapter");
    expect(names.filter((name) => name === "no-provider-sdk-outside-adapter-server")).toHaveLength(
      8,
    );
    expect(names).toContain("adapter-server-only-from-api");
    expect(names).toContain("adapter-openai-server-isolation");
    expect(names).toContain("presentation-uses-public-surfaces");
    expect(names).toContain("events-runtime-imports-only-core-and-context");
    expect(names).toContain("render-owns-three");
    expect(names).not.toContain("api-uses-public-surfaces");
  });

  it(`${req("ORB-ARCH-001", "ORB-ARCH-002")} preserves declared type-only, smoke, and same-provider exceptions`, async () => {
    const violations = await cruisePaths([
      resolve(fixtureRoot, "events/type-allowed.ts"),
      resolve(fixtureRoot, "app/smoke/allowed.ts"),
      resolve(fixtureRoot, "app/smoke/three.ts"),
      resolve(fixtureRoot, "adapters/openai/server/same.ts"),
      resolve(fixtureRoot, "engine/type-adapter-allowed.ts"),
      resolve(fixtureRoot, "formations/type-allowed.ts"),
    ]);

    expect(violations.filter((violation) => violation.rule.severity === "error")).toEqual([]);
  });

  it(`${req("ORB-ARCH-001")} keeps the temporary smoke Three.js exception explicit until Wave 2`, () => {
    const source = JSON.stringify(configuration);
    const rendererPath = resolve("engine/render/ParticleSystem.impl.ts");

    expect(source).toContain("app/smoke/");
    expect(source).toContain("engine/render/");
    if (existsSync(rendererPath)) {
      expect(source).not.toContain("app/smoke/");
      expect(source).not.toContain("app/smoke/points/SmokePoints.tsx");
    }
  });
});
