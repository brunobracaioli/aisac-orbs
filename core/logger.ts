import type { Clock } from "./clock";
import { LIMITS } from "./limits";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogSink = (line: string) => void;

export interface Logger {
  readonly droppedLines: number;
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

const SECRET_KEY_PARTS = [
  "token",
  "secret",
  "key",
  "password",
  "authorization",
  "cookie",
  "email",
  "phone",
] as const;
const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACTED = "[redacted]";
const CIRCULAR = "[circular]";

function isValidEventName(event: string): boolean {
  const segments = event.split(".");
  if (segments.length < 3 || segments[0] !== "orb") return false;
  return segments.slice(1).every((segment) => {
    if (segment.length === 0 || segment.charCodeAt(0) < 97 || segment.charCodeAt(0) > 122) {
      return false;
    }
    return [...segment].every((character) => {
      const code = character.charCodeAt(0);
      return (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || character === "_";
    });
  });
}

function truncate(value: string): string {
  if (Array.from(value).length <= LIMITS.logStringMax) return value;
  return `${Array.from(value).slice(0, LIMITS.logStringMax).join("")}…`;
}

function sanitize(value: unknown, key: string | undefined, seen: WeakSet<object>): unknown {
  if (key !== undefined && SECRET_KEY_PARTS.some((part) => key.toLowerCase().includes(part))) {
    return REDACTED;
  }
  if (typeof value === "string") return truncate(value);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return truncate(value.toString());
  if (value instanceof Error) {
    return { name: truncate(value.name), message: truncate(value.message) };
  }
  if (typeof value === "undefined") return undefined;
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;
  if (typeof value !== "object") return "[unserializable]";
  if (seen.has(value)) return CIRCULAR;
  seen.add(value);
  const objectValue = value as Record<string, unknown>;

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, undefined, seen));
  }

  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  let keys: string[];
  try {
    keys = Object.keys(objectValue);
  } catch {
    return "[unserializable]";
  }
  for (const childKey of keys) {
    try {
      const childValue = objectValue[childKey];
      const safeValue = sanitize(childValue, childKey, seen);
      if (safeValue !== undefined) {
        Object.defineProperty(result, childKey, {
          configurable: true,
          enumerable: true,
          value: safeValue,
          writable: true,
        });
      }
    } catch {
      Object.defineProperty(result, childKey, {
        configurable: true,
        enumerable: true,
        value: "[unserializable]",
        writable: true,
      });
    }
  }
  return result;
}

interface LoggerState {
  droppedLines: number;
}

function mergeFields(
  parent: Record<string, unknown>,
  child: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const source of [parent, child]) {
    let keys: string[];
    try {
      keys = Object.keys(source);
    } catch {
      continue;
    }
    for (const key of keys) {
      try {
        Object.defineProperty(merged, key, {
          configurable: true,
          enumerable: true,
          value: source[key],
          writable: true,
        });
      } catch {
        Object.defineProperty(merged, key, {
          configurable: true,
          enumerable: true,
          value: "[unserializable]",
          writable: true,
        });
      }
    }
  }
  return merged;
}

function makeLogger(
  opts: { sink: LogSink; clock: Clock; level: LogLevel; fields: Record<string, unknown> },
  state: LoggerState,
): Logger {
  const write = (level: LogLevel, event: string, fields?: Record<string, unknown>): void => {
    if (LEVELS[level] < LEVELS[opts.level]) return;
    if (!isValidEventName(event)) {
      write("error", "orb.logger.bad_event", { invalidEvent: event });
      return;
    }

    let timestamp: number;
    try {
      timestamp = opts.clock.now();
    } catch {
      timestamp = 0;
    }
    const safeFields = sanitize(mergeFields(opts.fields, fields ?? {}), undefined, new WeakSet());
    const lineObject = {
      ...(safeFields && typeof safeFields === "object" && !Array.isArray(safeFields)
        ? safeFields
        : {}),
      ts: timestamp,
      level,
      event,
    };
    try {
      opts.sink(JSON.stringify(lineObject));
    } catch {
      state.droppedLines += 1;
    }
  };

  return {
    get droppedLines(): number {
      return state.droppedLines;
    },
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
    child: (fields) => makeLogger({ ...opts, fields: mergeFields(opts.fields, fields) }, state),
  };
}

export function createLogger(opts: {
  sink?: LogSink;
  clock: Clock;
  level?: LogLevel;
  fields?: Record<string, unknown>;
}): Logger {
  return makeLogger(
    {
      // The default remains a structured JSON line for host observability.
      sink: opts.sink ?? ((line) => console.info(line)),
      clock: opts.clock,
      level: opts.level ?? "info",
      fields: opts.fields ?? {},
    },
    { droppedLines: 0 },
  );
}
