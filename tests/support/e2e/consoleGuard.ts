import type { ConsoleMessage, Page } from "@playwright/test";

const ALLOWED_ERROR = /^THREE\.WebGLRenderer:/;

export interface ConsoleGuard {
  readonly errors: readonly string[];
  assertClean(): void;
}

export interface ConsoleGuardOptions {
  readonly allowExpectedNavigation404?: boolean;
}

function messageText(message: ConsoleMessage): string {
  return message.text();
}

export function installConsoleGuard(page: Page, options: ConsoleGuardOptions = {}): ConsoleGuard {
  const errors: string[] = [];
  page.on("console", (message) => {
    const text = messageText(message);
    const expected404 =
      options.allowExpectedNavigation404 === true &&
      text === "Failed to load resource: the server responded with a status of 404 (Not Found)";
    if (message.type() === "error" && !ALLOWED_ERROR.test(text) && !expected404) {
      errors.push(text);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  return {
    errors,
    assertClean() {
      if (errors.length > 0) {
        throw new Error(`Unexpected browser errors:\n${errors.join("\n")}`);
      }
    },
  };
}
