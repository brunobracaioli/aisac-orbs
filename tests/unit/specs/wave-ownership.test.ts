import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mergeRequirements,
  parseLock,
  parseSpec,
  readWaveOwnership,
  type Overrides,
} from "../../../scripts/req-coverage";

const emptyOverrides: Overrides = { provisional: [], manual: [], waivers: [] };

describe("SPEC and wave ownership", () => {
  it("assigns every adopted requirement to exactly one wave", () => {
    const requirements = mergeRequirements(
      parseSpec(readFileSync("SPEC.md", "utf8")).requirements,
      emptyOverrides,
    );
    const ownership = readWaveOwnership("specs/waves");
    const counts = new Map<string, number>();
    for (const entry of ownership) counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
    expect(requirements).toHaveLength(114);
    expect(ownership).toHaveLength(114);
    expect(requirements.every((item) => counts.get(item.id) === 1)).toBe(true);
    expect(ownership.every((entry) => requirements.some((item) => item.id === entry.id))).toBe(
      true,
    );
  });

  it("preserves all baseline IDs and lock entries through the 0.2.0 adoption", () => {
    const baseline = parseSpec(
      readFileSync("tests/fixtures/spec/baseline/SPEC-0.1.0.baseline.md", "utf8"),
    );
    const adopted = parseSpec(readFileSync("SPEC.md", "utf8"));
    const baselineLock = parseLock(
      readFileSync("tests/fixtures/spec/baseline/requirement-ids.lock", "utf8"),
    );
    const adoptedIds = new Set(adopted.requirements.map((item) => item.id));
    expect(baseline.requirements).toHaveLength(73);
    expect(baselineLock.entries.size).toBe(73);
    expect(baseline.requirements.every((item) => adoptedIds.has(item.id))).toBe(true);
    expect([...baselineLock.entries.keys()].sort()).toEqual(
      baseline.requirements.map((item) => item.id).sort(),
    );
    expect(adopted.requirements).toHaveLength(114);
  });
});
