export const LIMITS = Object.freeze({
  metadataStringMax: 120,
  logStringMax: 120,
  eventDedupeWindow: 512,
  particlesMin: 100,
  particlesHardMax: 200_000,
  svgBytesMax: 2_097_152,
  svgElementsMax: 5_000,
  svgPathCommandsMax: 200_000,
  svgSampledPointsMax: 200_000,
  svgParseTimeoutMs: 2_000,
} as const);
