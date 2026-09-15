import type { Clock } from "../../../core/clock";
import type { Scheduler } from "../../../core/scheduler";
import { FakeClock } from "./fakeClock";

interface Task {
  readonly id: number;
  readonly dueAt: number;
  readonly order: number;
  readonly fn: () => void;
  cancelled: boolean;
}

export class FakeScheduler implements Scheduler {
  private nextId = 1;
  private readonly tasks: Task[] = [];
  public readonly clock: FakeClock;

  public constructor(clock = new FakeClock()) {
    this.clock = clock;
  }

  public schedule(fn: () => void, delayMs: number): () => void {
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new RangeError("delayMs must be a finite non-negative number");
    }
    const task: Task = {
      id: this.nextId,
      dueAt: this.clock.now() + delayMs,
      order: this.nextId,
      fn,
      cancelled: false,
    };
    this.nextId += 1;
    this.tasks.push(task);
    return (): void => {
      task.cancelled = true;
    };
  }

  public advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new RangeError("advance must be finite and non-negative");
    }
    const target = this.clock.now() + milliseconds;
    while (true) {
      const next = this.tasks
        .filter((task) => !task.cancelled && task.dueAt <= target)
        .sort((left, right) => left.dueAt - right.dueAt || left.order - right.order)[0];
      if (!next) break;
      this.clock.set(next.dueAt);
      this.flushDue();
    }
    this.clock.set(target);
  }

  public runAll(): void {
    while (true) {
      const next = this.tasks
        .filter((task) => !task.cancelled)
        .sort((left, right) => left.dueAt - right.dueAt || left.order - right.order)[0];
      if (!next) return;
      if (next.dueAt > this.clock.now()) this.clock.set(next.dueAt);
      this.flushDue();
    }
  }

  public get pendingCount(): number {
    return this.tasks.filter((task) => !task.cancelled).length;
  }

  private flushDue(): void {
    while (true) {
      const due = this.tasks
        .filter((task) => !task.cancelled && task.dueAt <= this.clock.now())
        .sort((left, right) => left.dueAt - right.dueAt || left.order - right.order)[0];
      if (!due) return;
      due.cancelled = true;
      due.fn();
    }
  }
}

export type { Clock };
