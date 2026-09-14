const PURE_CONTEXTS = [
  { name: "events", path: "events/", extraRuntime: "|node_modules/.pnpm/zod@|(^|/)zod$" },
  { name: "formations", path: "formations/", extraRuntime: "" },
  { name: "pointer-domain", path: "pointer/domain/", extraRuntime: "" },
  { name: "audio-domain", path: "audio/domain/", extraRuntime: "" },
  { name: "engine-state", path: "engine/state/", extraRuntime: "" },
  { name: "engine-visual-policy", path: "engine/visual-policy/", extraRuntime: "" },
  { name: "engine-morph", path: "engine/morph/", extraRuntime: "" },
  { name: "engine-quality", path: "engine/quality/", extraRuntime: "" },
];

const pureDomainRules = PURE_CONTEXTS.flatMap(({ name, path, extraRuntime }) => [
  {
    name: `${name}-runtime-imports-only-core-and-context`,
    comment: "Pure domains may use core and their own runtime context.",
    severity: "error",
    from: { path: `(^|/)${path}` },
    to: {
      pathNot: `(^|/)(core/|${path})${extraRuntime}`,
      dependencyTypesNot: ["type-only"],
    },
  },
  {
    name: `${name}-type-imports-use-declared-contracts`,
    comment: "Cross-context pure-domain imports are type-only and contract-scoped.",
    severity: "error",
    from: { path: `(^|/)${path}` },
    to: {
      pathNot: `(^|/)(core/|${path}|events/|formations/domain/|engine/ports/)`,
      dependencyTypes: ["type-only"],
    },
  },
]);

const PROVIDER_PACKAGE_NAMES = [
  "openai",
  "ai",
  "cohere-ai",
  "groq-sdk",
  "ollama",
  "langchain",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@google/genai",
  "@ai-sdk/openai",
  "@ai-sdk/anthropic",
  "@ai-sdk/google",
  "@langchain/core",
  "@langchain/openai",
  "@mistralai/client",
];
const PROVIDER_PACKAGE_PATH = PROVIDER_PACKAGE_NAMES.flatMap((name) => [
  `(^|/)${name}(/|$)`,
  `(^|/)node_modules/${name}(/|$)`,
]);

const UI_PACKAGE_PATH = [
  "node_modules/.pnpm/(react|react-dom|next|zustand)@",
  "node_modules/.pnpm/@react-three+[^/]+@",
  "(^|/)(react|react-dom|next|zustand)$",
  "(^|/)@react-three/[^/]+$",
];

const THREE_PACKAGE_PATH = ["node_modules/.pnpm/three@", "(^|/)three$", "(^|/)shaders/"];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "core-is-leaf",
      comment: "The core kernel has no dependencies outside core.",
      severity: "error",
      from: { path: "(^|/)core/" },
      to: { pathNot: "(^|/)core/" },
    },
    ...pureDomainRules,
    {
      name: "render-owns-three",
      comment: "Three.js is isolated behind the renderer boundary; W0 smoke is temporary.",
      severity: "error",
      from: { pathNot: "(^|/)(engine/render/|app/smoke/)" },
      to: { path: THREE_PACKAGE_PATH },
    },
    {
      name: "engine-no-ui",
      severity: "error",
      from: { path: "(^|/)engine/" },
      to: { path: UI_PACKAGE_PATH },
    },
    {
      name: "engine-no-adapters",
      severity: "error",
      from: { path: "(^|/)engine/" },
      to: { path: "(^|/)adapters/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "engine-type-imports-only-public-adapter",
      severity: "error",
      from: { path: "(^|/)engine/" },
      to: { path: "(^|/)adapters/(?!AgentAdapter\\.ts$)", dependencyTypes: ["type-only"] },
    },
    {
      name: "no-provider-sdk-outside-adapter-server",
      comment: "Provider SDKs are adapter implementation details.",
      severity: "error",
      from: { pathNot: "(^|/)adapters/[^/]+/server/" },
      to: { path: PROVIDER_PACKAGE_PATH },
    },
    ...["openai", "anthropic", "google", "mistralai", "langchain"].map((provider) => ({
      name: `adapter-${provider}-server-isolation`,
      comment: "An adapter server may only import its own provider server boundary.",
      severity: "error",
      from: { path: `(^|/)adapters/${provider}/server/` },
      to: { path: `(^|/)adapters/(?!${provider}/server/)[^/]+/server/` },
    })),
    {
      name: "adapter-server-only-from-api",
      severity: "error",
      from: { pathNot: "(^|/)(app/api/|adapters/[^/]+/server/)" },
      to: { path: "(^|/)adapters/[^/]+/server/" },
    },
    {
      name: "presentation-uses-public-surfaces",
      comment: "Presentation imports bounded contexts through their index files.",
      severity: "error",
      from: { path: "(^|/)(app|components)/", pathNot: "(^|/)app/(smoke|api)/" },
      to: {
        path: "(^|/)(engine|adapters|formations)/(?!index\\.ts$).+|(^|/)(core|events|shaders|pointer|audio)/",
      },
    },
    {
      name: "api-uses-public-surfaces",
      comment: "API routes may reach adapter server implementations and public indexes only.",
      severity: "error",
      from: { path: "(^|/)app/api/" },
      to: {
        path: "(^|/)(engine|formations)/(?!index\\.ts$).+|(^|/)adapters/(?!index\\.ts$)(?![^/]+/server/).+|(^|/)core/(?!index\\.ts$).+|(^|/)(events|shaders|pointer|audio)/",
      },
    },
    {
      name: "smoke-uses-public-surfaces",
      comment: "The W0 smoke may import core/index and Three.js, but not private context modules.",
      severity: "error",
      from: { path: "(^|/)app/smoke/" },
      to: {
        path: "(^|/)(engine|adapters|formations)/(?!index\\.ts$).+|(^|/)core/(?!index\\.ts$).+|(^|/)(events|shaders|pointer|audio)/",
      },
    },
    {
      name: "src-never-imports-tests",
      severity: "error",
      from: { pathNot: "(^|/)tests/" },
      to: { path: "(^|/)tests/" },
    },
    {
      name: "no-orphans",
      severity: "warn",
      from: { orphan: true, pathNot: "(^|/)(app|components|tests|scripts)/" },
      to: {},
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    doNotFollow: { path: ["node_modules"] },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
    },
    reporterOptions: {
      dot: { collapsePattern: "^node_modules/" },
    },
  },
};
