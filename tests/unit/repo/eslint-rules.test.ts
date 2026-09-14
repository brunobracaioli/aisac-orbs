import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({
  overrideConfigFile: "eslint.config.mjs",
  cwd: process.cwd(),
  ignore: false,
});

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (
    result?.messages.map((message) => message.ruleId).filter((id): id is string => id !== null) ??
    []
  );
}

describe("repository lint boundaries", () => {
  it("determinism boundary rejects Math.random in engine code", async () => {
    await expect(
      ruleIds("export const value = Math.random();", "engine/invalid.ts"),
    ).resolves.toContain("no-restricted-properties");
  });

  it("clock boundary rejects wall-clock reads in engine code", async () => {
    await expect(ruleIds("export const now = Date.now();", "engine/invalid.ts")).resolves.toContain(
      "no-restricted-properties",
    );
    await expect(
      ruleIds("export const now = performance.now();", "engine/invalid.ts"),
    ).resolves.toContain("no-restricted-properties");
  });

  it("ORB-SEC-001 rejects direct environment access outside the env module", async () => {
    await expect(
      ruleIds("export const value = process.env.SECRET;", "components/invalid.tsx"),
    ).resolves.toContain("no-restricted-syntax");
  });

  it("ORB-DEMO-004 rejects unmanaged timers in event code", async () => {
    await expect(
      ruleIds("setTimeout(() => undefined, 10);", "events/invalid.ts"),
    ).resolves.toContain("no-restricted-globals");
  });

  it("keeps render animation frames legal while retaining timer bans", async () => {
    await expect(
      ruleIds("setTimeout(() => undefined, 10);", "engine/render/invalid.ts"),
    ).resolves.toContain("no-restricted-globals");
    await expect(
      ruleIds("requestAnimationFrame(() => undefined);", "engine/render/invalid.ts"),
    ).resolves.not.toContain("no-restricted-globals");
  });

  it("rejects floating promises", async () => {
    await expect(ruleIds("Promise.resolve(1);", "engine/invalid.ts")).resolves.toContain(
      "@typescript-eslint/no-floating-promises",
    );
  });

  it("ORB-DEMO-004 rejects unmanaged animation frames in event code", async () => {
    await expect(
      ruleIds("requestAnimationFrame(() => undefined);", "events/invalid.ts"),
    ).resolves.toContain("no-restricted-globals");
  });

  it("ORB-SEC-004 rejects dynamic code evaluation", async () => {
    await expect(
      ruleIds("const run = new Function('return 1');", "components/invalid.tsx"),
    ).resolves.toContain("no-new-func");
  });

  it("ORB-SEC-004 rejects raw HTML injection in JSX", async () => {
    const code = "export const view = <div dangerouslySetInnerHTML={{ __html: input }} />;";

    await expect(ruleIds(code, "components/invalid.tsx")).resolves.toContain("react/no-danger");
  });

  it("ORB-SEC-004 rejects innerHTML assignment", async () => {
    await expect(
      ruleIds("element.innerHTML = value;", "components/invalid.tsx"),
    ).resolves.toContain("no-restricted-syntax");
  });
});
