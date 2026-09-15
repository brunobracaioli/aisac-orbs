import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EASINGS, EASING_INDEX, ease, type EasingId } from "../../../core/easing";

const ids = Object.keys(EASINGS) as EasingId[];

describe("easing", () => {
  it("exposes the five shared functions and shader indices", () => {
    expect(ids).toEqual([
      "linear",
      "easeInOutCubic",
      "easeOutCubic",
      "easeInOutSine",
      "smoothstep",
    ]);
    expect(EASING_INDEX).toEqual({
      linear: 0,
      easeInOutCubic: 1,
      easeOutCubic: 2,
      easeInOutSine: 3,
      smoothstep: 4,
    });
  });

  it.each(ids)("clamps and is monotone: %s", (id) => {
    expect(ease(id, -1)).toBe(0);
    expect(ease(id, 2)).toBe(1);
    expect(ease(id, Number.NaN)).toBe(0);
    let previous = 0;
    for (let index = 0; index <= 1000; index += 1) {
      const value = ease(id, index / 1000);
      expect(value).toBeGreaterThanOrEqual(previous - Number.EPSILON);
      previous = value;
    }
    expect(ease(id, 0)).toBe(0);
    expect(ease(id, 1)).toBe(1);
  });

  it("preserves monotonicity for arbitrary finite samples", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ids),
        fc.integer({ min: -10_000, max: 10_000 }),
        fc.integer({ min: -10_000, max: 10_000 }),
        (id, left, right) => {
          const lower = Math.min(left, right) / 10_000;
          const upper = Math.max(left, right) / 10_000;
          expect(ease(id, lower)).toBeLessThanOrEqual(ease(id, upper) + Number.EPSILON);
          expect(ease(id, lower)).toBeGreaterThanOrEqual(0);
          expect(ease(id, upper)).toBeLessThanOrEqual(1);
        },
      ),
    );
  });
});
