import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createPrng, fnv1a32 } from "../../../core/prng";
import { req } from "../../support/req";

describe("mulberry32", () => {
  it(`${req("ORB-FORM-011")} W0 Prng mechanism matches the documented seed-42 vector`, () => {
    const prng = createPrng(42);
    expect(
      [prng.next(), prng.next(), prng.next()].map((value) => Math.floor(value * 2 ** 32)),
    ).toEqual([2_581_720_956, 1_925_393_290, 3_661_312_704]);
    expect(fnv1a32("42:sphere")).toBe(3_217_160_774);
  });

  it(`${req("ORB-FORM-011")} W0 Prng mechanism forks independently of parent consumption`, () => {
    const untouched = createPrng(42).fork("sphere");
    const consumed = createPrng(42);
    consumed.next();
    consumed.next();
    const forked = consumed.fork("sphere");
    expect([untouched.next(), untouched.next()]).toEqual([forked.next(), forked.next()]);
  });

  it("rejects invalid integer bounds and produces bounded integers", () => {
    const prng = createPrng(1);
    expect(() => prng.int(0)).toThrow(RangeError);
    expect(() => prng.int(-1)).toThrow(RangeError);
    expect(() => prng.int(1.5)).toThrow(RangeError);
    for (let index = 0; index < 100; index += 1) expect(prng.int(7)).toBeGreaterThanOrEqual(0);
  });

  it("coerces non-finite seeds to the documented zero seed", () => {
    const fromNaN = createPrng(Number.NaN);
    const fromZero = createPrng(0);
    expect(fromNaN.next()).toBe(fromZero.next());
    expect(createPrng(Number.POSITIVE_INFINITY).next()).toBe(createPrng(0).next());
  });

  it("keeps generated values in their documented ranges for arbitrary seeds", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 100_000 }), (seed, maxExclusive) => {
        const prng = createPrng(seed);
        const value = prng.next();
        const bounded = prng.int(maxExclusive);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
        expect(bounded).toBeGreaterThanOrEqual(0);
        expect(bounded).toBeLessThan(maxExclusive);
      }),
    );
  });

  it(`${req("ORB-FORM-011")} W0 Prng mechanism keeps fork streams independent of arbitrary parent consumption`, () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.string(),
        fc.integer({ min: 0, max: 20 }),
        (seed, label, draws) => {
          const untouched = createPrng(seed).fork(label);
          const consumed = createPrng(seed);
          for (let index = 0; index < draws; index += 1) consumed.next();
          const forked = consumed.fork(label);
          expect(forked.next()).toBe(untouched.next());
          expect(forked.next()).toBe(untouched.next());
        },
      ),
    );
  });
});
