import { describe, expect, it } from "vitest";
import { createIdFactory, ID_PATTERN, isId, randomId } from "../../../core/ids";
import { LIMITS } from "../../../core/limits";
import { createPrng } from "../../../core/prng";
import { err, isErr, isOk, ok } from "../../../core/result";

describe("result, identifiers, and limits", () => {
  it("constructs discriminated results", () => {
    expect(isOk(ok(3))).toBe(true);
    expect(isErr(err("failure"))).toBe(true);
    expect(ok(3)).toEqual({ ok: true, value: 3 });
    expect(err("failure")).toEqual({ ok: false, error: "failure" });
  });

  it("validates IDs and creates deterministic eight-digit suffixes", () => {
    expect(isId("tool:123" as unknown)).toBe(true);
    expect(isId("" as unknown)).toBe(false);
    expect(isId("bad value" as unknown)).toBe(false);
    expect(ID_PATTERN.test("a".repeat(128))).toBe(true);
    const first = createIdFactory(createPrng(42), "mock");
    const second = createIdFactory(createPrng(42), "mock");
    expect([first(), first()]).toEqual([second(), second()]);
    expect(first()).toMatch(/^mock-[0-9a-f]{8}$/);
    expect(randomId()).toMatch(ID_PATTERN);
    expect(() => createIdFactory(createPrng(1), "bad prefix with spaces")).toThrow(RangeError);
  });

  it("keeps the shared limits immutable", () => {
    expect(LIMITS.metadataStringMax).toBe(120);
    expect(Object.isFrozen(LIMITS)).toBe(true);
  });
});
