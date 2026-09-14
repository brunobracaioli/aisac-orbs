import type { Prng } from "./prng";

export const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

export function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export function createIdFactory(prng: Prng, prefix: string): () => string {
  if (!isId(prefix) || prefix.length > 119) {
    throw new RangeError("prefix must be a valid identifier and leave room for the suffix");
  }
  return (): string => `${prefix}-${prng.int(0x1_0000_0000).toString(16).padStart(8, "0")}`;
}

export function randomId(): string {
  return globalThis.crypto.randomUUID();
}
