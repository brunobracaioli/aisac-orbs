import * as fc from "fast-check";

const DEFAULT_SEED = 20260914;
const MIN_SEED = -2_147_483_648;
const MAX_SEED = 2_147_483_647;

export interface FastCheckConfig {
  readonly numRuns: number;
  readonly seed: number;
}

export interface FastCheckEnvironment {
  CI?: string;
  FC_SEED?: string;
}

const runtimeEnvironment: FastCheckEnvironment = {};
if (process.env.CI !== undefined) {
  runtimeEnvironment.CI = process.env.CI;
}
if (process.env.FC_SEED !== undefined) {
  runtimeEnvironment.FC_SEED = process.env.FC_SEED;
}

export function readFastCheckConfig(
  environment: FastCheckEnvironment = runtimeEnvironment,
): FastCheckConfig {
  const rawSeed = environment.FC_SEED;
  const seed = rawSeed === undefined ? DEFAULT_SEED : Number(rawSeed);
  if (!Number.isSafeInteger(seed) || seed < MIN_SEED || seed > MAX_SEED) {
    throw new Error(`FC_SEED must be an integer between ${MIN_SEED} and ${MAX_SEED}.`);
  }

  return {
    numRuns: environment.CI ? 200 : 50,
    seed,
  };
}

const config = readFastCheckConfig();
fc.configureGlobal(config);
process.stderr.write(`[fast-check] seed=${config.seed} numRuns=${config.numRuns}\n`);
