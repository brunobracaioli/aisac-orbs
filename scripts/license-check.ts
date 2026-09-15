import { readFile, readdir, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

export const ALLOWED_LICENSES = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "0BSD",
  "CC0-1.0",
  "Unlicense",
  "MPL-2.0",
  "Python-2.0",
]);

export interface LicenseFinding {
  readonly file: string;
  readonly name: string;
  readonly version: string;
  readonly license: string;
}

interface PackageManifest {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly license?: unknown;
  readonly licenses?: unknown;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

interface LicenseApproval {
  readonly package: string;
  readonly version: string;
  readonly license: string;
  readonly licenseFile: string;
  readonly licenseSha256: string;
  readonly installedLicenseFile: string;
  readonly noticeFile: string;
}

function licenseNames(manifest: PackageManifest): string[] {
  if (typeof manifest.license === "string") {
    return manifest.license.trim().length > 0 ? [manifest.license] : ["UNKNOWN"];
  }
  if (manifest.license !== null && typeof manifest.license === "object") {
    const type = (manifest.license as { type?: unknown }).type;
    if (typeof type === "string") {
      return [type];
    }
  }
  if (Array.isArray(manifest.licenses)) {
    const names = manifest.licenses.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (
        entry !== null &&
        typeof entry === "object" &&
        typeof (entry as { type?: unknown }).type === "string"
      ) {
        return [(entry as { type: string }).type];
      }
      return [];
    });
    return names.length > 0 ? names : ["UNKNOWN"];
  }
  return ["UNKNOWN"];
}

function dependencyNames(
  manifest: PackageManifest,
  root: boolean,
): {
  required: string[];
  optional: string[];
} {
  const optionalPeers = new Set(
    Object.entries(manifest.peerDependenciesMeta ?? {})
      .filter(([, metadata]) => metadata.optional === true)
      .map(([name]) => name),
  );
  return {
    required: Object.keys({
      ...manifest.dependencies,
      ...Object.fromEntries(
        Object.entries(manifest.peerDependencies ?? {}).filter(
          ([name]) => !optionalPeers.has(name),
        ),
      ),
      ...(root ? manifest.devDependencies : {}),
    }),
    optional: [...Object.keys(manifest.optionalDependencies ?? {}), ...optionalPeers],
  };
}

function evaluateSpdxExpression(expression: string): boolean {
  const tokens: string[] = [];
  let cursor = 0;
  while (cursor < expression.length) {
    const character = expression[cursor];
    if (character !== undefined && /\s/.test(character)) {
      cursor += 1;
      continue;
    }
    if (character === "(" || character === ")") {
      tokens.push(character);
      cursor += 1;
      continue;
    }
    const match = /^[A-Za-z0-9.-]+/.exec(expression.slice(cursor));
    if (match === null) return false;
    tokens.push(match[0]);
    cursor += match[0].length;
  }
  if (tokens.length === 0) return false;
  let position = 0;

  const parsePrimary = (): boolean => {
    const token = tokens[position++];
    // SPDX operators are policy syntax, not secret material.
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token === "(") {
      const value = parseOr();
      if (tokens[position++] !== ")") return false;
      return value;
    }
    if (
      token === undefined ||
      token === "AND" ||
      token === "OR" ||
      token === "WITH" ||
      token === ")"
    ) {
      return false;
    }
    if (tokens[position] === "WITH") {
      position += 2;
      return false;
    }
    return ALLOWED_LICENSES.has(token);
  };

  const parseAnd = (): boolean => {
    let value = parsePrimary();
    while (tokens[position] === "AND") {
      position += 1;
      value = parsePrimary() && value;
    }
    return value;
  };

  const parseOr = (): boolean => {
    let value = parseAnd();
    while (tokens[position] === "OR") {
      position += 1;
      value = parseAnd() || value;
    }
    return value;
  };

  const result = parseOr();
  return result && position === tokens.length;
}

async function readManifest(file: string): Promise<PackageManifest | null> {
  try {
    // `file` comes from the bounded package graph walk.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return JSON.parse(await readFile(file, "utf8")) as PackageManifest;
  } catch {
    return null;
  }
}

async function readApprovals(root: string): Promise<LicenseApproval[]> {
  const file = path.resolve(root, "specs/dependency-license-approvals.json");
  try {
    // Approval metadata is a local checked-in file.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const parsed = JSON.parse(await readFile(file, "utf8")) as {
      version?: unknown;
      approvals?: unknown;
    };
    if (
      Object.keys(parsed).sort().join(",") !== "approvals,version" ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.approvals)
    )
      throw new Error("invalid approvals");
    return parsed.approvals.map((approval) => {
      if (approval === null || typeof approval !== "object") throw new Error("invalid approval");
      const candidate = approval as Partial<LicenseApproval>;
      const keys = Object.keys(candidate).sort().join(",");
      if (
        keys !==
          "installedLicenseFile,license,licenseFile,licenseSha256,noticeFile,package,version" ||
        typeof candidate.package !== "string" ||
        typeof candidate.version !== "string" ||
        typeof candidate.license !== "string" ||
        typeof candidate.licenseFile !== "string" ||
        typeof candidate.installedLicenseFile !== "string" ||
        !/^[a-f0-9]{64}$/.test(candidate.licenseSha256 ?? "") ||
        typeof candidate.noticeFile !== "string"
      ) {
        throw new Error("invalid approval");
      }
      return candidate as LicenseApproval;
    });
  } catch {
    // A missing approval file is valid for fixtures with only allow-listed licenses.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(file)) return [];
    throw new Error("invalid approvals manifest");
  }
}

async function approvalIsValid(
  root: string,
  packageFile: string,
  approval: LicenseApproval,
): Promise<boolean> {
  const rootPath = path.resolve(root);
  const resolveInsideRoot = (relative: string): string | null => {
    const resolved = path.resolve(rootPath, relative);
    const relativeToRoot = path.relative(rootPath, resolved);
    return relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot) ? null : resolved;
  };
  const licenseFile = resolveInsideRoot(approval.licenseFile);
  const noticeFile = resolveInsideRoot(approval.noticeFile);
  const installedLicenseFile = path.resolve(
    path.dirname(packageFile),
    approval.installedLicenseFile,
  );
  if (licenseFile === null || noticeFile === null) return false;
  try {
    // Approval files were resolved and bounded to the checked-out repository above.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const licenseBytes = await readFile(licenseFile);
    const hash = createHash("sha256").update(licenseBytes).digest("hex");
    // The comparison checks integrity metadata, not a secret or credential.
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (hash !== approval.licenseSha256) return false;
    // The package manifest was resolved from the installed dependency graph; this is its own license file.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const installedLicenseBytes = await readFile(installedLicenseFile);
    const installedHash = createHash("sha256").update(installedLicenseBytes).digest("hex");
    if (installedHash !== approval.licenseSha256) return false;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const notice = await readFile(noticeFile, "utf8");
    return notice.includes(`${approval.package} ${approval.version}`);
  } catch {
    return false;
  }
}

interface PackageGraph {
  readonly files: string[];
  readonly missing: string[];
}

async function packageFiles(root: string): Promise<PackageGraph> {
  const rootDirectory = path.resolve(root);
  const rootPackage = path.join(rootDirectory, "package.json");
  const rootManifest = await readManifest(rootPackage);
  if (rootManifest === null) {
    let entries;
    try {
      // Fixture mode scans only immediate package roots; it never walks arbitrary repository files.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      entries = await readdir(path.join(rootDirectory, "node_modules"), { withFileTypes: true });
    } catch {
      return { files: [], missing: [] };
    }
    return {
      files: entries
        .filter((entry) => entry.isDirectory() && entry.name !== ".pnpm")
        .flatMap((entry) => [path.join(rootDirectory, "node_modules", entry.name, "package.json")]),
      missing: [],
    };
  }

  const files: string[] = [];
  const missing: string[] = [];
  const visited = new Set<string>();
  const resolveManifest = async (name: string, from: string): Promise<string | null> => {
    const requireFromPackage = createRequire(path.join(from, "package.json"));
    try {
      return requireFromPackage.resolve(`${name}/package.json`, { paths: [from] });
    } catch {
      const searchPaths = requireFromPackage.resolve.paths?.(name) ?? [];
      for (const searchPath of searchPaths) {
        const candidate = path.join(searchPath, name, "package.json");
        // Search paths are the resolver's nearest ancestor node_modules locations.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (existsSync(candidate)) return candidate;
      }
      return null;
    }
  };

  const visit = async (file: string, rootPackageVisit: boolean): Promise<void> => {
    let normalized: string;
    try {
      // The path is a dependency manifest discovered from the checked-out graph.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      normalized = await realpath(file);
    } catch {
      return;
    }
    if (visited.has(normalized)) return;
    visited.add(normalized);
    files.push(normalized);
    const manifest = await readManifest(normalized);
    if (manifest === null) return;
    const packageRoot = path.dirname(normalized);
    const dependencies = dependencyNames(manifest, rootPackageVisit);
    for (const dependency of dependencies.required) {
      const dependencyFile = await resolveManifest(dependency, packageRoot);
      if (dependencyFile !== null) {
        await visit(dependencyFile, false);
      } else {
        missing.push(`${nameOf(manifest)} -> ${dependency}`);
      }
    }
    for (const dependency of dependencies.optional) {
      const dependencyFile = await resolveManifest(dependency, packageRoot);
      if (dependencyFile !== null) await visit(dependencyFile, false);
    }
  };

  await visit(rootPackage, true);
  return { files, missing };
}

function nameOf(manifest: PackageManifest): string {
  return typeof manifest.name === "string" ? manifest.name : "<unnamed package>";
}

export async function checkLicenses(root = "."): Promise<LicenseFinding[]> {
  const graph = await packageFiles(root);
  let approvals: LicenseApproval[];
  try {
    approvals = await readApprovals(root);
  } catch {
    return [
      {
        file: path.resolve(root, "specs/dependency-license-approvals.json"),
        name: "<invalid approvals>",
        version: "unknown",
        license: "UNKNOWN",
      },
    ];
  }
  if (graph.files.length === 0) {
    return [
      {
        file: path.join(root, "package.json"),
        name: "<missing package graph>",
        version: "unknown",
        license: "UNKNOWN",
      },
    ];
  }
  const findings: LicenseFinding[] = graph.missing.map((dependency) => ({
    file: path.resolve(root, "package.json"),
    name: dependency,
    version: "missing",
    license: "UNKNOWN",
  }));
  for (const file of graph.files) {
    const manifest = await readManifest(file);
    if (manifest === null) {
      findings.push({ file, name: "<invalid manifest>", version: "unknown", license: "UNKNOWN" });
      continue;
    }
    const name = typeof manifest.name === "string" ? manifest.name : "<unnamed package>";
    const version = typeof manifest.version === "string" ? manifest.version : "unknown";
    for (const license of licenseNames(manifest)) {
      if (!evaluateSpdxExpression(license)) {
        const approval = approvals.find(
          (candidate) =>
            candidate.package === name &&
            candidate.version === version &&
            candidate.license === license,
        );
        if (approval !== undefined && (await approvalIsValid(root, file, approval))) continue;
        findings.push({ file, name, version, license });
      }
    }
  }
  return findings;
}

async function main(): Promise<void> {
  const rootArgumentIndex = process.argv.indexOf("--root");
  const root = rootArgumentIndex >= 0 ? (process.argv[rootArgumentIndex + 1] ?? ".") : ".";
  const findings = await checkLicenses(root);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(
        `License check failed: ${finding.name}@${finding.version} ${finding.license} (${finding.file})`,
      );
    }
    process.exitCode = 1;
    return;
  }
  console.info("License check passed: all package manifests use the allow-list.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
