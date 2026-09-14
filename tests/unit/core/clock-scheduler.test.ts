import { afterEach, describe, expect, it, vi } from "vitest";
import { systemClock } from "../../../core/clock";
import { systemScheduler } from "../../../core/scheduler";
import { FakeClock } from "../../support/fakes/fakeClock";
import { FakeScheduler } from "../../support/fakes/fakeScheduler";

describe("injected clock and scheduler fakes", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires due callbacks in deadline then insertion order", () => {
    const clock = new FakeClock(100);
    const scheduler = new FakeScheduler(clock);
    const calls: string[] = [];
    scheduler.schedule(() => calls.push("late"), 20);
    scheduler.schedule(() => calls.push("first"), 10);
    scheduler.schedule(() => calls.push("second"), 10);
    scheduler.advance(9);
    expect(calls).toEqual([]);
    scheduler.advance(1);
    expect(calls).toEqual(["first", "second"]);
    scheduler.advance(10);
    expect(calls).toEqual(["first", "second", "late"]);
  });

  it("cancels idempotently and supports callbacks scheduled during a flush", () => {
    const scheduler = new FakeScheduler();
    const calls: string[] = [];
    const cancel = scheduler.schedule(() => calls.push("cancelled"), 1);
    cancel();
    cancel();
    scheduler.schedule(() => {
      calls.push("outer");
      scheduler.schedule(() => calls.push("inner"), 0);
    }, 1);
    scheduler.advance(1);
    expect(calls).toEqual(["outer", "inner"]);
    expect(scheduler.pendingCount).toBe(0);
  });

  it("walks intermediate deadlines when advancing over nested work", () => {
    const scheduler = new FakeScheduler();
    const calls: string[] = [];
    scheduler.schedule(() => {
      calls.push(`outer@${scheduler.clock.now()}`);
      scheduler.schedule(() => calls.push(`inner@${scheduler.clock.now()}`), 10);
    }, 10);
    scheduler.advance(20);
    expect(calls).toEqual(["outer@10", "inner@20"]);
    expect(scheduler.clock.now()).toBe(20);
  });

  it("provides a cancellable system scheduler without real waiting", () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const cancel = systemScheduler.schedule(() => calls.push("cancelled"), 10);
    cancel();
    cancel();
    systemScheduler.schedule(() => calls.push("fired"), 10);
    vi.advanceTimersByTime(10);
    expect(calls).toEqual(["fired"]);
    expect(() => systemScheduler.schedule(() => undefined, -1)).toThrow(RangeError);
    expect(systemClock.now()).toBeTypeOf("number");
  });
});
