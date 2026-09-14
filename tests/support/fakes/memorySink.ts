import type { LogSink } from "../../../core/logger";

export class MemorySink {
  public readonly lines: string[] = [];

  public write: LogSink = (line): void => {
    this.lines.push(line);
  };

  public clear(): void {
    this.lines.length = 0;
  }
}

export function createMemorySink(): MemorySink {
  return new MemorySink();
}
