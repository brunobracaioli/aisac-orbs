import "server-only";

import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ORB_SMOKE_ROUTES: z.enum(["0", "1"]).default("0"),
  ORB_BUNDLE_CANARY: z.string().min(16).optional(),
});

const publicNamePattern = /^NEXT_PUBLIC_/;
const publicSecretNamePattern = /(KEY|SECRET|TOKEN)/i;

function pickPublic(source: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [name, value] of Object.entries(source)) {
    if (!publicNamePattern.test(name)) {
      continue;
    }

    if (publicSecretNamePattern.test(name)) {
      throw new Error(`Public environment variable name is not allowed: ${name}`);
    }

    if (value !== undefined) {
      result[name] = value;
    }
  }

  return result;
}

const clientSchema = z.object({
  NEXT_PUBLIC_ORB_SEED: z.coerce.number().int().nonnegative().default(1),
});

export const env = {
  server: serverSchema.parse(process.env),
  client: clientSchema.parse(pickPublic(process.env)),
} as const;
