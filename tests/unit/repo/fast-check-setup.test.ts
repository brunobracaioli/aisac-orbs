import { describe, expect, it } from "vitest";

import { readFastCheckConfig } from "../../support/fast-check-setup";

describe("fast-check configuration", () => {
  it("uses a deterministic local seed and 50 runs by default", () => {
    expect(readFastCheckConfig({})).toEqual({ numRuns: 50, seed: 20260914 });
  });

  it("uses the CI run budget and accepts an explicit replay seed", () => {
    expect(readFastCheckConfig({ CI: "1", FC_SEED: "42" })).toEqual({ numRuns: 200, seed: 42 });
  });

  it("rejects malformed or unsafe replay seeds", () => {
    expect(() => readFastCheckConfig({ FC_SEED: "not-a-seed" })).toThrow(
      "FC_SEED must be an integer",
    );
    expect(() => readFastCheckConfig({ FC_SEED: "2147483648" })).toThrow(
      "FC_SEED must be an integer",
    );
  });
});
