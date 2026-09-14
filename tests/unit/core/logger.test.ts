import { describe, expect, it, vi } from "vitest";
import { createLogger } from "../../../core/logger";
import { FakeClock } from "../../support/fakes/fakeClock";
import { MemorySink } from "../../support/fakes/memorySink";

describe("structured logger", () => {
  it("redacts nested secret and PII keys, truncates strings, and merges child fields", () => {
    const sink = new MemorySink();
    const logger = createLogger({ sink: sink.write, clock: new FakeClock(1234) });
    logger.child({ correlationId: "c1", service: "core" }).info("orb.test.event", {
      token: "abc",
      nested: { email: "person@example.com", label: "x".repeat(300) },
    });

    const line = JSON.parse(sink.lines[0] ?? "null") as Record<string, unknown>;
    expect(line).toMatchObject({
      ts: 1234,
      level: "info",
      event: "orb.test.event",
      correlationId: "c1",
    });
    expect(line.token).toBe("[redacted]");
    expect((line.nested as { email: string }).email).toBe("[redacted]");
    expect((line.nested as { label: string }).label).toHaveLength(121);
  });

  it("drops malformed events and survives sink failures", () => {
    const lines: string[] = [];
    const logger = createLogger({
      clock: new FakeClock(),
      sink: (line) => {
        lines.push(line);
        throw new Error("sink unavailable");
      },
    });
    logger.info("invalid");
    logger.info("orb.valid.event");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? "null")).toMatchObject({ event: "orb.logger.bad_event" });
    expect(logger.droppedLines).toBe(2);
  });

  it("filters below-level records and serializes errors without stacks", () => {
    const sink = new MemorySink();
    const logger = createLogger({ sink: sink.write, clock: new FakeClock(), level: "warn" });
    logger.info("orb.filtered.event");
    logger.error("orb.failure.event", { error: new Error("boom") });
    expect(sink.lines).toHaveLength(1);
    const parsed = JSON.parse(sink.lines[0] ?? "null") as { error: Record<string, unknown> };
    expect(parsed.error).toEqual({ name: "Error", message: "boom" });
  });

  it("uses a structured default sink and absorbs hostile field objects", () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = createLogger({ clock: new FakeClock(9) });
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "__proto__", { enumerable: true, value: "safe" });
    Object.defineProperty(hostile, "throws", {
      enumerable: true,
      get: () => {
        throw new Error("getter failed");
      },
    });
    expect(() => logger.info("orb.hostile.fields", hostile)).not.toThrow();
    expect(consoleInfo).toHaveBeenCalledOnce();
    const line = JSON.parse(String(consoleInfo.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(line.__proto__).toBe("safe");
    expect(line.throws).toBe("[unserializable]");
    consoleInfo.mockRestore();
  });
});
