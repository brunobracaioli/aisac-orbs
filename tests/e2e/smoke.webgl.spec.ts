import { expect, test } from "@playwright/test";

import { installConsoleGuard } from "../support/e2e/consoleGuard";
import { tags } from "../support/req";

interface OrbDebugSmoke {
  readonly kind: "smoke";
  readonly frames: number;
  readonly contextCreated: boolean;
  readonly glErrors: number;
  readonly rendererInfo: string;
  readonly fallback: boolean;
  readonly particleCount: 2_000;
}

declare global {
  interface Window {
    readonly __orbDebug?: OrbDebugSmoke;
    readonly __orbCspViolations?: string[];
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.defineProperty(window, "__orbCspViolations", {
      configurable: true,
      get: () => violations,
    });
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
    });
  });
});

test(`${tags("ORB-RENDER-001").join(" ")} renders 2,000 seeded points under SwiftShader`, async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-swiftshader", "SwiftShader project only");
  const guard = installConsoleGuard(page);
  const response = await page.goto("/smoke/points?debug=1&seed=1");
  expect(response?.status()).toBe(200);
  await expect
    .poll(async () => await page.evaluate(() => window.__orbDebug?.frames ?? 0), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

  const debug = await page.evaluate(() => window.__orbDebug);
  expect(debug?.kind).toBe("smoke");
  expect(debug?.contextCreated).toBe(true);
  expect(debug?.glErrors).toBe(0);
  expect(debug?.particleCount).toBe(2_000);
  expect(debug?.rendererInfo).toBeTruthy();
  expect(await page.evaluate(() => window.__orbCspViolations ?? [])).toEqual([]);
  guard.assertClean();
});

test(`${tags("ORB-RENDER-006").join(" ")} exposes a text fallback when WebGL is disabled`, async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-nowebgl", "no-WebGL project only");
  const guard = installConsoleGuard(page);
  const response = await page.goto("/smoke/points?debug=1&seed=1");
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("fallback")).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => await page.evaluate(() => window.__orbDebug?.fallback ?? false), {
      timeout: 15_000,
    })
    .toBe(true);
  expect(await page.evaluate(() => window.__orbCspViolations ?? [])).toEqual([]);
  guard.assertClean();
});
