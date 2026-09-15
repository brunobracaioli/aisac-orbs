import type { Clock } from "../../../core/clock";

export class FakeClock implements Clock {
  public constructor(private currentMs = 0) {
    if (!Number.isFinite(currentMs)) throw new RangeError("initial time must be finite");
  }

  public now(): number {
    return this.currentMs;
  }

  public advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new RangeError("advance must be finite and non-negative");
    }
    this.currentMs += milliseconds;
  }

  public set(milliseconds: number): void {
    if (!Number.isFinite(milliseconds)) throw new RangeError("time must be finite");
    this.currentMs = milliseconds;
  }
}
