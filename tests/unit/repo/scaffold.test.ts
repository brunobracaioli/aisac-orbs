import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("W0 scaffold contract", () => {
  it("keeps the package tied to the current root specification", async () => {
    const [packageSource, specSource] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("SPEC.md", "utf8"),
    ]);
    const packageJson = JSON.parse(packageSource) as {
      name?: string;
      specVersion?: string;
      engines?: { node?: string };
    };
    const specVersion = /^\*\*Version:\*\*\s+(.+?)\s*$/m.exec(specSource)?.[1];

    expect(packageJson.name).toBe("aisac-orbs");
    expect(packageJson.specVersion).toBe(specVersion);
    expect(packageJson.engines?.node).toBe(">=22 <23");
  });

  it("rejects a public secret-like environment variable at the env boundary", async () => {
    const previous = process.env.NEXT_PUBLIC_TOKEN;
    process.env.NEXT_PUBLIC_TOKEN = "should-never-be-public";
    vi.resetModules();

    try {
      await expect(import("../../../app/_lib/env")).rejects.toThrow(
        "Public environment variable name is not allowed: NEXT_PUBLIC_TOKEN",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_TOKEN;
      } else {
        process.env.NEXT_PUBLIC_TOKEN = previous;
      }
    }
  });
});
