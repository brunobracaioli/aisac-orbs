export interface Prng {
  next(): number;
  int(maxExclusive: number): number;
  fork(label: string): Prng;
}

/** FNV-1a over UTF-16 code units, yielding a stable uint32 hash in every JS host. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function toSeed(value: number): number {
  return Number.isFinite(value) ? value >>> 0 : 0;
}

class Mulberry32 implements Prng {
  private state: number;

  public constructor(private readonly rootSeed: number) {
    this.state = rootSeed;
  }

  public next(): number {
    let value = (this.state + 0x6d2b79f5) >>> 0;
    this.state = value;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  public int(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("maxExclusive must be a positive safe integer");
    }
    return Math.floor(this.next() * maxExclusive);
  }

  public fork(label: string): Prng {
    return new Mulberry32(fnv1a32(`${this.rootSeed}:${label}`));
  }
}

export function createPrng(seed: number): Prng {
  return new Mulberry32(toSeed(seed));
}
