export interface Scheduler {
  schedule(fn: () => void, delayMs: number): () => void;
}

/**
 * Schedules work without exposing timer handles to domain code.
 * The returned cancellation function is safe to call any number of times.
 */
export const systemScheduler: Scheduler = Object.freeze({
  schedule(fn: () => void, delayMs: number): () => void {
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new RangeError("delayMs must be a finite non-negative number");
    }

    let active = true;
    const handle = setTimeout(() => {
      if (!active) return;
      active = false;
      fn();
    }, delayMs);

    return (): void => {
      if (!active) return;
      active = false;
      clearTimeout(handle);
    };
  },
});
