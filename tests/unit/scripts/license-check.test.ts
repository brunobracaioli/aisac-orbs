import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkLicenses } from "../../../scripts/license-check";

async function materializeFixture(name: string): Promise<string> {
  const source = path.resolve("tests/fixtures/licenses", name);
  const target = await mkdtemp(path.join(os.tmpdir(), "aisac-license-fixture-"));
  // Fixture paths are local test data, not request input.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (existsSync(path.join(source, "package.json"))) {
    await cp(path.join(source, "package.json"), path.join(target, "package.json"));
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (
      entry.name === "packages" ||
      entry.name === "nested-packages" ||
      entry.name === "package.json"
    )
      continue;
    await cp(path.join(source, entry.name), path.join(target, entry.name), { recursive: true });
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await mkdir(path.join(target, "node_modules"), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  for (const entry of await readdir(path.join(source, "packages"), { withFileTypes: true })) {
    await cp(
      path.join(source, "packages", entry.name),
      path.join(target, "node_modules", entry.name),
      {
        recursive: true,
      },
    );
  }
  // The optional nested fixture is a checked-in test path, never request input.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (existsSync(path.join(source, "nested-packages"))) {
    await cp(
      path.join(source, "nested-packages", "holder", "versioned-package"),
      path.join(target, "node_modules", "holder", "node_modules", "versioned-package"),
      { recursive: true },
    );
  }
  return target;
}

async function checkFixture(name: string) {
  const target = await materializeFixture(name);
  try {
    return await checkLicenses(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

describe("license check", () => {
  it("fails on a GPL dependency", async () => {
    const findings = await checkFixture("gpl");
    expect(findings).toEqual([
      expect.objectContaining({ name: "bad-package", license: "GPL-3.0" }),
    ]);
  });

  it("passes on an allow-listed dependency", async () => {
    await expect(checkFixture("allowed")).resolves.toEqual([]);
  });

  it("accepts a dual-license expression when one allowed option is selected", async () => {
    await expect(checkFixture("dual")).resolves.toEqual([]);
  });

  it("rejects a conjunctive expression containing a disallowed license", async () => {
    const findings = await checkFixture("conjunct");
    expect(findings).toEqual([
      expect.objectContaining({ name: "conjunct-package", license: "MIT AND GPL-3.0" }),
    ]);
  });

  it("rejects malformed and empty license metadata instead of treating it as covered", async () => {
    await expect(checkFixture("malformed")).resolves.toEqual([
      expect.objectContaining({ name: "malformed-package", license: "MIT$$" }),
    ]);
    await expect(checkFixture("empty")).resolves.toEqual([
      expect.objectContaining({ name: "empty-package", license: "UNKNOWN" }),
    ]);
  });

  it("requires an exact package approval with a valid preserved license hash and notice", async () => {
    const approved = await checkFixture("approved");
    expect(approved).toEqual([]);

    const unrelated = await checkFixture("unrelated");
    expect(unrelated).toEqual([
      expect.objectContaining({ name: "other-package", license: "BlueOak-1.0.0" }),
    ]);

    await expect(checkFixture("approved-bad-hash")).resolves.toEqual([
      expect.objectContaining({ name: "approved-package", license: "BlueOak-1.0.0" }),
    ]);
    await expect(checkFixture("approved-bad-version")).resolves.toEqual([
      expect.objectContaining({ name: "approved-package", version: "1.0.1" }),
    ]);

    await expect(checkFixture("approved-modified-installed")).resolves.toEqual([
      expect.objectContaining({ name: "approved-package", license: "BlueOak-1.0.0" }),
    ]);
  });

  it("follows the nearest installed dependency when two versions exist", async () => {
    await expect(checkFixture("two-version")).resolves.toEqual([]);
  });
});
