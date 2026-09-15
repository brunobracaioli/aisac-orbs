/** A monotonic-ish source of wall-clock milliseconds supplied by the host. */
export interface Clock {
  now(): number;
}

/** The only wall-clock access used by the kernel. All domain code receives a Clock. */
export const systemClock: Clock = Object.freeze({
  now: (): number => Date.now(),
});
