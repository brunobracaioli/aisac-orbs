import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const BROWSER_EXTENSIONS = new Set([".js", ".css", ".map"]);
const PUBLIC_SECRET_NAME = /^NEXT_PUBLIC_.*(?:KEY|SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL)/i;
const SECRET_NAME =
  /(?:API_KEY|AUTH_TOKEN|CLIENT_SECRET|CREDENTIAL|KEY|PASSWORD|PRIVATE|SECRET|TOKEN)/i;

const SECRET_PATTERNS: readonly RegExp[] = [
  /sk-canary-[a-f0-9]{16}/gi,
  /sk-[A-Za-z0-9-]{20,}/g,
  /sk-proj-[A-Za-z0-9_-]+/g,
  /sk-ant-[A-Za-z0-9_-]+/g,
  /AIza[0-9A-Za-z_-]{35}/g,
];

function isSelectedSecretName(name: string): boolean {
  return name === "ORB_BUNDLE_CANARY" || SECRET_NAME.test(name);
}

export interface BundleSecretViolation {
  readonly file: string;
  readonly offset: number;
  readonly reason: string;
}

export interface BundleScanOptions {
  readonly buildDir?: string;
  readonly environment?: NodeJS.ProcessEnv;
}

export interface BundleScanResult {
  readonly files: readonly string[];
  readonly reachableFiles: readonly string[];
  readonly violations: readonly BundleSecretViolation[];
}

async function walk(directory: string): Promise<string[]> {
  let entries;
  try {
    // The scan root is supplied by CI or a test fixture and never comes from a request.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else if (BROWSER_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

async function walkFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    // The build directory is local CI output, never request input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

/**
 * Browser artifacts are deliberately rooted at `.next/static`. Server page
 * bundles under `.next/server` never enter this set, even when they contain
 * strings that look like credentials. Client reference manifests describe
 * how those browser chunks are reached; the static directory is the complete
 * delivery boundary and therefore remains the scan boundary.
 */
export async function discoverBrowserArtifacts(buildDir = ".next"): Promise<string[]> {
  const staticDirectory = path.join(buildDir, "static");
  return (await walk(staticDirectory)).sort();
}

/** Reads client-reference manifests as data; no server bundle is evaluated. */
export async function discoverReachableBrowserFiles(buildDir = ".next"): Promise<string[]> {
  const serverDirectory = path.join(buildDir, "server");
  const manifests = (await walkFiles(serverDirectory)).filter((file) =>
    file.endsWith("client-reference-manifest.js"),
  );
  const references = new Set<string>();
  for (const manifest of manifests) {
    // `manifest` is generated build metadata. Only static URL strings are extracted.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const source = await readFile(manifest, "utf8");
    const pattern = /["']((?:\/_next\/)?static\/[^"']+\.(?:js|css|map))["']/g;
    let match = pattern.exec(source);
    while (match !== null) {
      const relative = match[1];
      if (relative !== undefined) {
        references.add(path.join(buildDir, relative.replace(/^\/_next\//, "")));
      }
      match = pattern.exec(source);
    }
  }
  return [...references].sort();
}

function extractJsonObject(source: string, marker: string): string | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = source.indexOf("{", markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}" && --depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  return null;
}

const FORBIDDEN_CLIENT_MODULE =
  /app[/\\]_lib[/\\]env(?:\.|[/\\])|adapters[/\\][^/\\]+[/\\]server(?:[/\\]|\.)|server-only(?:[/\\]|\.)/;

export async function discoverClientReachabilityViolations(
  buildDir = ".next",
): Promise<BundleSecretViolation[]> {
  const serverDirectory = path.join(buildDir, "server");
  const manifests = (await walkFiles(serverDirectory)).filter((file) =>
    file.endsWith("client-reference-manifest.js"),
  );
  const violations: BundleSecretViolation[] = [];
  for (const manifest of manifests) {
    // Manifest content is parsed as JSON data after the generated assignment; it is never executed.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const source = await readFile(manifest, "utf8");
    const json =
      extractJsonObject(source, '"clientModules":') ?? extractJsonObject(source, "clientModules:");
    if (json === null) continue;
    let clientModules: Record<string, unknown>;
    try {
      clientModules = JSON.parse(json) as Record<string, unknown>;
    } catch {
      violations.push({
        file: manifest,
        offset: source.indexOf('"clientModules":'),
        reason: "invalid client reference manifest",
      });
      continue;
    }
    for (const modulePath of Object.keys(clientModules)) {
      if (FORBIDDEN_CLIENT_MODULE.test(modulePath)) {
        violations.push({
          file: manifest,
          offset: source.indexOf(modulePath),
          reason: `server-only module is client-reachable: ${modulePath}`,
        });
      }
    }
  }
  return violations;
}

async function hasStaticBuild(buildDir: string): Promise<boolean> {
  try {
    // `buildDir` is the local build output selected by the caller, never request input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return (await stat(path.join(buildDir, "static"))).isDirectory();
  } catch {
    return false;
  }
}

function findPatternMatches(text: string, pattern: RegExp): number[] {
  pattern.lastIndex = 0;
  const offsets: number[] = [];
  let match = pattern.exec(text);
  while (match !== null) {
    offsets.push(match.index);
    match = pattern.exec(text);
  }
  pattern.lastIndex = 0;
  return offsets;
}

function escapedPattern(value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // The input is escaped before construction; this regex searches one selected env value.
  // eslint-disable-next-line security/detect-non-literal-regexp
  return new RegExp(escaped, "g");
}

function selectedEnvironmentSecrets(environment: NodeJS.ProcessEnv): BundleSecretViolation[] {
  const violations: BundleSecretViolation[] = [];
  for (const name of Object.keys(environment)) {
    if (!isSelectedSecretName(name)) {
      continue;
    }
    if (PUBLIC_SECRET_NAME.test(name)) {
      violations.push({
        file: "<environment>",
        offset: 0,
        reason: `public secret-like name ${name}`,
      });
    }
  }
  return violations;
}

export async function scanBundle(options: BundleScanOptions = {}): Promise<BundleScanResult> {
  const buildDir = options.buildDir ?? ".next";
  const environment = options.environment ?? process.env;
  const files = await discoverBrowserArtifacts(buildDir);
  const reachableFiles = await discoverReachableBrowserFiles(buildDir);
  const violations = [
    ...selectedEnvironmentSecrets(environment),
    ...(await discoverClientReachabilityViolations(buildDir)),
  ];
  if (!(await hasStaticBuild(buildDir))) {
    violations.push({
      file: path.join(buildDir, "static"),
      offset: 0,
      reason: "browser build directory is missing",
    });
  } else if (files.length === 0) {
    violations.push({
      file: path.join(buildDir, "static"),
      offset: 0,
      reason: "browser build directory is empty",
    });
  }
  const seen = new Set(violations.map((violation) => `${violation.file}:${violation.offset}`));
  const selectedValues: Array<[string, string]> = Object.entries(environment).flatMap(
    ([name, value]) =>
      value !== undefined &&
      value.length >= 8 &&
      isSelectedSecretName(name) &&
      !PUBLIC_SECRET_NAME.test(name)
        ? [[name, value]]
        : [],
  );

  for (const file of files) {
    // `file` comes exclusively from discoverBrowserArtifacts under `.next/static`.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const text = await readFile(file, "utf8");
    for (const pattern of SECRET_PATTERNS) {
      for (const offset of findPatternMatches(text, pattern)) {
        const key = `${file}:${offset}`;
        if (!seen.has(key)) {
          seen.add(key);
          violations.push({ file, offset, reason: "credential-shaped value" });
        }
      }
    }
    for (const [name, value] of selectedValues) {
      for (const offset of findPatternMatches(text, escapedPattern(value))) {
        const key = `${file}:${offset}`;
        if (!seen.has(key)) {
          seen.add(key);
          violations.push({ file, offset, reason: `selected secret ${name}` });
        }
      }
    }
  }

  return { files, reachableFiles, violations };
}

async function main(): Promise<void> {
  const buildDirArgumentIndex = process.argv.indexOf("--build-dir");
  const buildDir =
    buildDirArgumentIndex >= 0 ? (process.argv[buildDirArgumentIndex + 1] ?? ".next") : ".next";
  const result = await scanBundle({ buildDir });
  if (result.violations.length > 0) {
    for (const violation of result.violations) {
      console.error(
        `Bundle secret scan failed: ${violation.file}:${violation.offset} (${violation.reason})`,
      );
    }
    process.exitCode = 1;
    return;
  }
  console.info(`Bundle secret scan passed: ${result.files.length} browser artifacts inspected.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
