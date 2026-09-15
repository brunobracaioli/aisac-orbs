import path from "node:path";

import { describe, expect, it } from "vitest";

import { req } from "../../support/req";
import { scanBundle } from "../../../scripts/bundle-secret-scan";

describe("bundle secret scan", () => {
  it(`${req("ORB-SEC-001")} scans browser-delivered JavaScript and ignores server bundles`, async () => {
    const clean = await scanBundle({
      buildDir: path.resolve("tests/fixtures/bundle/clean-build"),
      environment: { NODE_ENV: "test", PATH: "/usr/bin", FLAG: "0" },
    });
    expect(clean.violations).toEqual([]);

    const reachable = await scanBundle({
      buildDir: path.resolve("tests/fixtures/bundle/reachable-build"),
      environment: { NODE_ENV: "test" },
    });
    expect(reachable.violations).toHaveLength(1);
    expect(reachable.reachableFiles).toEqual([
      path.resolve("tests/fixtures/bundle/reachable-build/static/chunks/client.css"),
    ]);
    expect(reachable.violations[0]?.reason).toContain("server-only module is client-reachable");
  });

  it(`${req("ORB-SEC-001")} reports a canary with file and offset without the value`, async () => {
    const result = await scanBundle({
      buildDir: path.resolve("tests/fixtures/bundle/secret-build"),
      environment: { NODE_ENV: "test" },
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.file).toContain("secret.js");
    expect(result.violations[0]?.offset).toBeGreaterThan(0);
    expect(JSON.stringify(result.violations)).not.toContain("deadbeef");
  });

  it(`${req("ORB-SEC-001")} rejects public secret-like environment names`, async () => {
    const result = await scanBundle({
      buildDir: path.resolve("tests/fixtures/bundle/clean-build"),
      environment: { NODE_ENV: "test", NEXT_PUBLIC_API_KEY: "public-value-that-must-fail" },
    });
    expect(result.violations[0]?.file).toBe("<environment>");
    expect(result.violations[0]?.reason).toContain("NEXT_PUBLIC_API_KEY");
  });

  it("fails closed when the production browser build is missing", async () => {
    const result = await scanBundle({
      buildDir: path.resolve("tests/fixtures/bundle/missing-build"),
    });
    expect(result.violations[0]?.reason).toContain("missing");
  });
});
