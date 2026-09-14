import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";

export const ID_PATTERN = /\bORB-[A-Z0-9]+-\d{3}\b/g;
const BULLET_PATTERN = /^\s*-\s+\*\*(ORB-[A-Z0-9]+-\d{3})\*\*\s+[—-]\s+(.+?)\s*$/;
// Fixed keyword alternatives have no unbounded input or nested quantifiers.
// eslint-disable-next-line security/detect-unsafe-regex
const NORMATIVE_PATTERN = /\bMUST(?:\s+NOT)?\b|\bSHOULD\b|\bMAY\b/g;

export type RequirementLevel = "must" | "should" | "may" | "informative";
export type EvidenceKind = "unit" | "e2e";

export interface RequirementRecord {
  id: string;
  text: string;
  section: string;
  declaredLevel: RequirementLevel;
  effectiveLevel: RequirementLevel;
  source: "spec" | "provisional";
}

export interface ProvisionalRequirement {
  id: string;
  section: string;
  level: RequirementLevel;
  text: string;
  status: "provisional" | "adopted";
  issue: string;
}

export interface ManualEvidence {
  id: string;
  verification: "manual";
  evidence: string;
  reviewedAt: string;
  issue: string;
}

export interface Waiver {
  idPattern: string;
  reason: string;
  issue: string;
  waivedUntil: string;
}

export interface Overrides {
  provisional: ProvisionalRequirement[];
  manual: ManualEvidence[];
  waivers: Waiver[];
}

export interface EvidenceRecord {
  id: string;
  kind: EvidenceKind;
  title: string;
  status: "passed" | "failed" | "skipped";
}

export interface RequirementReportRow {
  id: string;
  section: string;
  level: RequirementLevel;
  declaredLevel: RequirementLevel;
  status: "covered" | "uncovered" | "waived" | "manual" | "failing" | "informative";
  unit: number;
  e2e: number;
  tests: string[];
  failures: string[];
  waiver?: string;
}

export interface CoverageReport {
  specVersion: string;
  generatedAt: string;
  totals: Record<"must" | "should" | "may" | "informative", number>;
  rows: RequirementReportRow[];
  uncovered: string[];
  unknown: string[];
  errors: string[];
  warnings: string[];
}

export interface OwnershipEntry {
  id: string;
  wave: string;
  waveNumber: number;
  status: "proposed" | "in-progress" | "done";
}

export interface CoverageOptions {
  specPath?: string;
  overridesPath?: string;
  lockPath?: string;
  generatedPath?: string;
  changelogPath?: string;
  waveDir?: string;
  vitestPath?: string;
  playwrightPath?: string;
  reportsOnly?: boolean;
  checkLock?: boolean;
  gateWave?: string;
  shouldThreshold?: number;
  today?: string;
  githubPrLabels?: string;
  metadataOnly?: boolean;
  baselineLockPath?: string;
  traceabilityPath?: string;
  playwrightReportPresent?: boolean;
  vitestReportPresent?: boolean;
}

export class ReqCoverageError extends Error {
  readonly exitCode: 1 | 2;

  constructor(message: string, exitCode: 1 | 2 = 2) {
    super(message);
    this.name = "ReqCoverageError";
    this.exitCode = exitCode;
  }
}

const yamlDateString = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.string(),
);

const OverridesSchema = z
  .object({
    provisional: z.array(
      z
        .object({
          id: z.string(),
          section: z.string(),
          level: z.enum(["must", "should", "may", "informative"]),
          text: z.string(),
          status: z.enum(["provisional", "adopted"]),
          issue: z.string(),
        })
        .strict(),
    ),
    manual: z.array(
      z
        .object({
          id: z.string(),
          verification: z.literal("manual"),
          evidence: z.string(),
          reviewedAt: yamlDateString,
          issue: z.string(),
        })
        .strict(),
    ),
    waivers: z.array(
      z
        .object({
          idPattern: z.string(),
          reason: z.string(),
          issue: z.string(),
          waivedUntil: yamlDateString,
        })
        .strict(),
    ),
  })
  .strict();

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function readText(path: string): string {
  // CLI paths are resolved from explicit flags/defaults before reaching this boundary.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFileSync(path, "utf8");
}

function pathExists(path: string): boolean {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return existsSync(path);
}

function writeText(path: string, content: string): void {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(path, content, "utf8");
}

function makeDirectory(path: string): void {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  mkdirSync(path, { recursive: true });
}

function listDirectory(path: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readdirSync(path);
}

function versionOf(spec: string): string {
  const match = spec.match(/^\*\*Version:\*\*\s+([^\s]+)/m);
  if (!match?.[1]) throw new ReqCoverageError("SPEC.md has no **Version:** header");
  return match[1];
}

function levelOf(text: string): { declared: RequirementLevel; effective: RequirementLevel } {
  const first = text.match(NORMATIVE_PATTERN)?.[0];
  const declared: RequirementLevel = first?.startsWith("MUST")
    ? "must"
    : first === "SHOULD"
      ? "should"
      : first === "MAY"
        ? "may"
        : "informative";
  // eslint-disable-next-line security/detect-unsafe-regex
  const effective: RequirementLevel = /\bMUST(?:\s+NOT)?\b/.test(text) ? "must" : declared;
  return { declared, effective };
}

export function parseSpec(spec: string): { version: string; requirements: RequirementRecord[] } {
  const version = versionOf(spec);
  let section = "Unsectioned";
  const requirements: RequirementRecord[] = [];
  const seen = new Set<string>();
  for (const line of spec.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(\d+)\.\s+(.+?)\s*$/);
    if (heading?.[1] && heading[2]) section = `${heading[1]}. ${heading[2]}`;
    const bullet = line.match(BULLET_PATTERN);
    if (!bullet?.[1] || !bullet[2]) continue;
    const id = bullet[1];
    if (seen.has(id)) throw new ReqCoverageError(`duplicate ID in SPEC.md: ${id}`);
    seen.add(id);
    const text = normalize(bullet[2]);
    const levels = levelOf(text);
    requirements.push({
      id,
      text,
      section,
      declaredLevel: levels.declared,
      effectiveLevel: levels.effective,
      source: "spec",
    });
  }
  if (requirements.length === 0)
    throw new ReqCoverageError("SPEC.md contains no requirement bullets");
  return { version, requirements };
}

export function parseOverrides(yaml: string): Overrides {
  let parsedDocument: unknown;
  try {
    const load = (
      createRequire(import.meta.url)("js-yaml") as {
        load(input: string, options?: { json?: boolean }): unknown;
      }
    ).load;
    parsedDocument = load(yaml, { json: false });
  } catch (error) {
    if (error instanceof Error && /Cannot find module/.test(error.message))
      throw new ReqCoverageError(
        "requirements.overrides.yaml requires the direct js-yaml dependency",
      );
    throw new ReqCoverageError(
      `overrides YAML parse failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = OverridesSchema.safeParse(parsedDocument);
  if (!parsed.success)
    throw new ReqCoverageError(`overrides schema validation failed: ${parsed.error.message}`);
  for (const waiver of parsed.data.waivers) {
    try {
      // eslint-disable-next-line security/detect-non-literal-regexp -- waiver patterns are parsed and bounded by policy review.
      new RegExp(waiver.idPattern);
    } catch {
      throw new ReqCoverageError(`overrides: invalid waiver pattern ${waiver.idPattern}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(waiver.waivedUntil))
      throw new ReqCoverageError(`overrides: invalid waiver date ${waiver.waivedUntil}`);
  }
  return parsed.data;
}

export function mergeRequirements(
  spec: RequirementRecord[],
  overrides: Overrides,
): RequirementRecord[] {
  const ids = new Set(spec.map((record) => record.id));
  const merged = [...spec];
  for (const item of overrides.provisional) {
    if (ids.has(item.id))
      throw new ReqCoverageError(`provisional override already exists in SPEC.md: ${item.id}`);
    if (!ID_PATTERN.test(item.id)) throw new ReqCoverageError(`invalid provisional ID: ${item.id}`);
    ID_PATTERN.lastIndex = 0;
    if (ids.has(item.id)) throw new ReqCoverageError(`duplicate provisional ID: ${item.id}`);
    ids.add(item.id);
    // eslint-disable-next-line security/detect-unsafe-regex
    const effectiveLevel: RequirementLevel = /\bMUST(?:\s+NOT)?\b/.test(item.text)
      ? "must"
      : item.level;
    merged.push({
      id: item.id,
      text: normalize(item.text),
      section: item.section,
      declaredLevel: item.level,
      effectiveLevel,
      source: "provisional",
    });
  }
  return merged.sort((left, right) => left.id.localeCompare(right.id));
}

function idList(value: unknown): string[] {
  if (typeof value === "string") {
    ID_PATTERN.lastIndex = 0;
    const ids = [...value.matchAll(ID_PATTERN)].map((match) => match[0]);
    ID_PATTERN.lastIndex = 0;
    return ids;
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    typeof item === "string" ? [...item.matchAll(ID_PATTERN)].map((match) => match[0]) : [],
  );
}

function statusOf(value: unknown): EvidenceRecord["status"] {
  if (value === "passed" || value === "pass" || value === "expected" || value === "success")
    return "passed";
  if (value === "skipped" || value === "skip" || value === "todo" || value === "pending")
    return "skipped";
  return "failed";
}

function textOf(value: Record<string, unknown>): string {
  const ancestor = Array.isArray(value.ancestorTitles)
    ? value.ancestorTitles.filter((item): item is string => typeof item === "string")
    : [];
  const title =
    typeof value.fullName === "string"
      ? value.fullName
      : typeof value.title === "string"
        ? value.title
        : "";
  return [...ancestor, title].filter(Boolean).join(" › ");
}

function collectVitest(value: unknown, records: EvidenceRecord[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectVitest(item, records));
    return;
  }
  const object = value as Record<string, unknown>;
  if (typeof object.fullName === "string" || typeof object.title === "string") {
    const title = textOf(object);
    for (const id of idList(title))
      records.push({ id, kind: "unit", title, status: statusOf(object.status) });
  }
  for (const [key, child] of Object.entries(object)) {
    if (key !== "fullName" && key !== "title" && key !== "status" && key !== "ancestorTitles")
      collectVitest(child, records);
  }
}

function playwrightTestStatus(test: Record<string, unknown>): EvidenceRecord["status"] {
  const expectedStatus = test.expectedStatus;
  const results = Array.isArray(test.results) ? test.results : [];
  const result = results.length > 0 ? results[results.length - 1] : undefined;
  const resultStatus =
    result && typeof result === "object" ? (result as Record<string, unknown>).status : undefined;
  if (test.status === "skipped" || test.status === "pending") return "skipped";
  if (
    test.status === "expected" &&
    (expectedStatus === undefined || expectedStatus === "passed") &&
    (resultStatus === undefined || resultStatus === "passed")
  )
    return "passed";
  if (test.status === "flaky") return "failed";
  return statusOf(resultStatus ?? test.status);
}

function collectPlaywright(
  value: unknown,
  records: EvidenceRecord[],
  inheritedTags: string[] = [],
  inheritedTitle = "",
): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectPlaywright(item, records, inheritedTags, inheritedTitle));
    return;
  }
  const object = value as Record<string, unknown>;
  const ownTags = Array.isArray(object.tags)
    ? object.tags.flatMap((tag) =>
        typeof tag === "string"
          ? [tag]
          : tag &&
              typeof tag === "object" &&
              typeof (tag as Record<string, unknown>).name === "string"
            ? [(tag as Record<string, unknown>).name as string]
            : [],
      )
    : [];
  const ownTitle = typeof object.title === "string" ? object.title : inheritedTitle;
  if (Array.isArray(object.tests)) {
    // Playwright JSON keeps tags on JSONReportSpec and outcomes on JSONReportTest.
    for (const item of object.tests) {
      if (!item || typeof item !== "object") continue;
      const test = item as Record<string, unknown>;
      const title =
        typeof test.title === "string"
          ? [ownTitle, test.title].filter(Boolean).join(" › ")
          : ownTitle;
      const testTags = Array.isArray(test.tags)
        ? test.tags.flatMap((tag) =>
            typeof tag === "string"
              ? [tag]
              : tag &&
                  typeof tag === "object" &&
                  typeof (tag as Record<string, unknown>).name === "string"
                ? [(tag as Record<string, unknown>).name as string]
                : [],
          )
        : [];
      const tags = [...inheritedTags, ...ownTags, ...testTags];
      // Playwright evidence is tag based. IDs mentioned in a human title do not
      // silently credit aliases; both IDs must be explicitly tagged.
      const testIds = [...new Set(tags.flatMap((tag) => idList(tag)))];
      const status = playwrightTestStatus(test);
      for (const id of testIds) records.push({ id, kind: "e2e", title, status });
    }
  }
  if (Array.isArray(object.suites))
    collectPlaywright(object.suites, records, [...inheritedTags, ...ownTags], ownTitle);
  if (Array.isArray(object.specs))
    collectPlaywright(object.specs, records, [...inheritedTags, ...ownTags], ownTitle);
  for (const [key, child] of Object.entries(object)) {
    if (key !== "tests" && key !== "suites" && key !== "specs" && key !== "tags" && key !== "title")
      collectPlaywright(child, records, [...inheritedTags, ...ownTags], ownTitle);
  }
}

export function extractReportEvidence(vitest: unknown, playwright: unknown): EvidenceRecord[] {
  const records: EvidenceRecord[] = [];
  collectVitest(vitest, records);
  collectPlaywright(playwright, records);
  return records;
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readText(path)) as unknown;
  } catch (error) {
    throw new ReqCoverageError(
      `cannot read JSON report ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readIfExists(path: string): unknown {
  return pathExists(path) ? readJson(path) : {};
}

export function parseLock(text: string): {
  version: string;
  entries: Map<string, { level: RequirementLevel; hash: string }>;
} {
  const versionLine = text.match(/^spec-version:\s*(\S+)\s*$/m);
  if (!versionLine?.[1]) throw new ReqCoverageError("requirement-ids.lock has no spec-version");
  const entries = new Map<string, { level: RequirementLevel; hash: string }>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(
      /^(ORB-[A-Z0-9]+-\d{3})\s+(must|should|may|informative)\s+([a-f0-9]{8})\s*$/,
    );
    if (!match?.[1] || !match[2] || !match[3]) continue;
    if (entries.has(match[1]))
      throw new ReqCoverageError(`duplicate ID in requirement-ids.lock: ${match[1]}`);
    entries.set(match[1], { level: match[2] as RequirementLevel, hash: match[3] });
  }
  return { version: versionLine[1], entries };
}

export function renderLock(version: string, requirements: RequirementRecord[]): string {
  const lines = requirements
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (item) =>
        `${item.id} ${item.effectiveLevel} ${createHash("sha256").update(normalize(item.text)).digest("hex").slice(0, 8)}`,
    );
  return [`spec-version: ${version}`, ...lines, ""].join("\n");
}

export function renderGeneratedTypes(requirements: RequirementRecord[]): string {
  const ids = requirements.map((item) => item.id).sort((a, b) => a.localeCompare(b));
  const values = ids.map((id) => `  "${id}",`).join("\n");
  return `/** Generated by pnpm spec:ids. Do not edit by hand. */\nexport const REQ_IDS = [\n${values}\n] as const;\nexport type ReqId = (typeof REQ_IDS)[number];\nexport type Tag = \`@\${ReqId}\`;\n`;
}

function waveNumber(value: string): number {
  // The input is a wave filename or explicit wave label, and only one number is accepted.
  // eslint-disable-next-line security/detect-unsafe-regex
  const match = value.match(/(?:wave[-_ ]?)?(\d+)/i);
  return match?.[1] ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function readWaveOwnership(waveDir: string): OwnershipEntry[] {
  if (!pathExists(waveDir)) throw new ReqCoverageError(`wave directory does not exist: ${waveDir}`);
  // Avoid a dependency on glob; the caller passes the checked-in directory and this
  // function only opens Markdown files discovered by a deterministic shell-free scan.
  let names: string[];
  try {
    names = listDirectory(waveDir)
      .filter((name) => name.endsWith(".md"))
      .sort();
  } catch (error) {
    throw new ReqCoverageError(
      `cannot read wave directory ${waveDir}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const entries: OwnershipEntry[] = [];
  for (const name of names) {
    const path = join(waveDir, name);
    const content = readText(path);
    const wave = name.replace(/\.md$/, "");
    const statusMatch = content.match(/\*\*Status\*\*\s*\|\s*(proposed|in-progress|done)/);
    const status = (statusMatch?.[1] ?? "proposed") as OwnershipEntry["status"];
    const number = waveNumber(wave);
    const section =
      content.split(/^##\s+/m).find((part) => part.startsWith("3. Requirements owned")) ?? "";
    for (const match of section.matchAll(/^\|\s*(ORB-[A-Z0-9]+-\d{3})\s*\|/gm)) {
      if (match[1]) entries.push({ id: match[1], wave, waveNumber: number, status });
    }
  }
  return entries;
}

function validateGateOwnership(
  waveDir: string,
  gateName: string,
  requirements: RequirementRecord[],
  ownership: OwnershipEntry[],
): void {
  const files = listDirectory(waveDir)
    .filter((name) => name.endsWith(".md"))
    .sort();
  const gateNumber = waveNumber(gateName);
  const matches = files.filter(
    (name) =>
      name.replace(/\.md$/, "") === gateName ||
      (waveNumber(name) === gateNumber && /^wave-\d{2}-/.test(name)),
  );
  if (!Number.isFinite(gateNumber) || matches.length !== 1)
    throw new ReqCoverageError(`--gate must identify exactly one wave file: ${gateName}`);
  const counts = new Map<string, number>();
  for (const entry of ownership) counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  const missing = requirements
    .filter((item) => (counts.get(item.id) ?? 0) !== 1)
    .map((item) => item.id);
  if (missing.length)
    throw new ReqCoverageError(
      `gate ownership must assign every SPEC requirement exactly once; invalid IDs: ${missing.join(", ")}`,
    );
}

const REQUIRED_E2E = (id: string): boolean =>
  /^(ORB-GOV-|ORB-A11Y-)|^ORB-(RENDER-006|DEMO-|SEC-00[56])$/.test(id);

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
function isExpired(date: string, today: string): boolean {
  return !validDate(date) || date < today;
}
function matchesWaiver(id: string, waiver: Waiver): boolean {
  // eslint-disable-next-line security/detect-non-literal-regexp -- validated waiver pattern.
  return new RegExp(waiver.idPattern).test(id);
}
function labelsContainSpecChange(labels: string): boolean {
  return labels.split(/[\s,]+/).some((label) => label === "spec-change");
}

function changelogNamesId(path: string, id: string): boolean {
  if (!pathExists(path)) return false;
  const text = readText(path);
  const unreleased = text.match(/^##\s+\[Unreleased\]([\s\S]*?)(?=^##\s+|$)/m)?.[1] ?? "";
  const spec = unreleased.match(/^###\s+Spec([\s\S]*?)(?=^###\s+|$)/m)?.[1] ?? "";
  return spec.includes(id);
}

function checkLock(
  lock: { version: string; entries: Map<string, { level: RequirementLevel; hash: string }> },
  requirements: RequirementRecord[],
  options: CoverageOptions,
): string[] {
  const errors: string[] = [];
  const current = new Map(requirements.map((item) => [item.id, item]));
  for (const [id, entry] of lock.entries) {
    const item = current.get(id);
    if (!item) errors.push(`lock ID missing from SPEC/overrides: ${id}`);
    else {
      const rank: Record<RequirementLevel, number> = { informative: 0, may: 1, should: 2, must: 3 };
      if (rank[item.effectiveLevel] < rank[entry.level]) {
        const labels = options.githubPrLabels ?? process.env.GITHUB_PR_LABELS ?? "";
        const changelog = options.changelogPath ?? "CHANGELOG.md";
        if (!(labelsContainSpecChange(labels) && changelogNamesId(changelog, id)))
          errors.push(
            `lock level downgrade for ${id}: ${entry.level} -> ${item.effectiveLevel}; requires spec-change label and [Unreleased] ### Spec changelog entry`,
          );
      }
    }
  }
  return errors;
}

function reportMarkdown(report: CoverageReport): string {
  const lines = [
    `# Requirement coverage`,
    "",
    `SPEC version: ${report.specVersion}`,
    "",
    "| ID | Level | Status | #unit | #e2e | tests |",
    "|---|---|---|---:|---:|---|",
  ];
  for (const row of report.rows)
    lines.push(
      `| ${row.id} | ${row.level} | ${row.status} | ${row.unit} | ${row.e2e} | ${row.tests.join("<br>") || "—"} |`,
    );
  lines.push(
    "",
    `Totals: must ${report.totals.must}, should ${report.totals.should}, may ${report.totals.may}, informative ${report.totals.informative}.`,
  );
  if (report.errors.length)
    lines.push("", "## Errors", ...report.errors.map((error) => `- ${error}`));
  if (report.warnings.length)
    lines.push("", "## Warnings", ...report.warnings.map((warning) => `- ${warning}`));
  return `${lines.join("\n")}\n`;
}

function traceabilityMarkdown(requirements: RequirementRecord[]): string {
  const lines = ["# Requirement traceability", "", "| ID | Level | Section |", "|---|---|---|"];
  for (const item of requirements)
    lines.push(`| ${item.id} | ${item.effectiveLevel} | ${item.section.replaceAll("|", "\\|")} |`);
  return `${lines.join("\n")}\n`;
}

export function analyzeCoverage(
  requirements: RequirementRecord[],
  overrides: Overrides,
  evidence: EvidenceRecord[],
  options: CoverageOptions = {},
): CoverageReport {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const known = new Set(requirements.map((item) => item.id));
  const unknown = [
    ...new Set(evidence.filter((item) => !known.has(item.id)).map((item) => item.id)),
  ].sort();
  const ownership = options.waveDir ? readWaveOwnership(options.waveDir) : [];
  const gate = options.gateWave ? waveNumber(options.gateWave) : Number.POSITIVE_INFINITY;
  if (options.gateWave && !Number.isFinite(gate))
    throw new ReqCoverageError(`unknown gate wave: ${options.gateWave}`);
  if (options.gateWave && !options.waveDir)
    throw new ReqCoverageError("--gate requires --wave-dir so ownership can be verified");
  if (options.gateWave && options.waveDir)
    validateGateOwnership(options.waveDir, options.gateWave, requirements, ownership);
  const duplicateOwners = [...new Set(ownership.map((entry) => entry.id))].filter(
    (id) => ownership.filter((entry) => entry.id === id).length > 1,
  );
  if (duplicateOwners.length)
    throw new ReqCoverageError(
      `requirement has multiple wave owners: ${duplicateOwners.join(", ")}`,
    );
  const rows: RequirementReportRow[] = [];
  const errors: string[] = unknown.map(
    (id) => `unknown requirement ID referenced by a test: ${id}`,
  );
  const warnings: string[] = [];
  const uncovered: string[] = [];
  const requiredE2eMissing: string[] = [];
  const validManual = new Set<string>();
  for (const item of overrides.manual) {
    const age = Date.parse(`${item.reviewedAt}T00:00:00Z`);
    if (!known.has(item.id))
      errors.push(`manual evidence references unknown requirement ID: ${item.id}`);
    else if (!pathExists(resolve(item.evidence)))
      errors.push(`manual evidence file does not exist for ${item.id}: ${item.evidence}`);
    else if (
      !validDate(item.reviewedAt) ||
      Number.isNaN(age) ||
      item.reviewedAt > today ||
      age < Date.parse(`${today}T00:00:00Z`) - 90 * 86400000
    )
      errors.push(`manual evidence is stale or invalid for ${item.id}`);
    else validManual.add(item.id);
  }
  const activeWaivers = new Map<string, Waiver>();
  for (const requirement of requirements) {
    const waiver = overrides.waivers.find((item) => matchesWaiver(requirement.id, item));
    if (waiver) {
      if (isExpired(waiver.waivedUntil, today)) errors.push(`expired waiver for ${requirement.id}`);
      else {
        const owner = ownership.find((entry) => entry.id === requirement.id);
        if (
          owner &&
          (owner.status === "done" || (options.gateWave !== undefined && owner.waveNumber <= gate))
        )
          errors.push(
            `waiver cannot cover current or completed wave requirement ${requirement.id}`,
          );
        else activeWaivers.set(requirement.id, waiver);
      }
    }
  }
  for (const waiver of overrides.waivers)
    if (!requirements.some((item) => matchesWaiver(item.id, waiver)))
      warnings.push(`dead waiver: ${waiver.idPattern}`);
  for (const requirement of requirements) {
    const records = evidence.filter((item) => item.id === requirement.id);
    const passed = records.filter((item) => item.status === "passed");
    const failures = records.filter((item) => item.status === "failed").map((item) => item.title);
    const waiver = activeWaivers.get(requirement.id);
    const status: RequirementReportRow["status"] =
      requirement.effectiveLevel === "informative"
        ? "informative"
        : passed.length > 0
          ? "covered"
          : validManual.has(requirement.id)
            ? "manual"
            : waiver
              ? "waived"
              : failures.length > 0
                ? "failing"
                : "uncovered";
    if (requirement.effectiveLevel === "must" && status === "uncovered")
      uncovered.push(requirement.id);
    if (
      !options.metadataOnly &&
      requirement.effectiveLevel === "must" &&
      (status === "uncovered" || status === "failing")
    )
      errors.push(`${status === "failing" ? "failing" : "uncovered"} MUST: ${requirement.id}`);
    if (requirement.effectiveLevel === "should" && status === "uncovered")
      warnings.push(`uncovered SHOULD: ${requirement.id}`);
    if (
      !options.metadataOnly &&
      options.gateWave &&
      requirement.effectiveLevel === "must" &&
      REQUIRED_E2E(requirement.id) &&
      !passed.some((item) => item.kind === "e2e") &&
      !waiver
    )
      requiredE2eMissing.push(requirement.id);
    rows.push({
      id: requirement.id,
      section: requirement.section,
      level: requirement.effectiveLevel,
      declaredLevel: requirement.declaredLevel,
      status,
      unit: passed.filter((item) => item.kind === "unit").length,
      e2e: passed.filter((item) => item.kind === "e2e").length,
      tests: [...new Set(passed.map((item) => item.title))],
      failures: [...new Set(failures)],
      ...(waiver ? { waiver: waiver.reason } : {}),
    });
  }
  if (!options.metadataOnly && options.gateWave && requiredE2eMissing.length)
    errors.push(`required E2E evidence missing: ${requiredE2eMissing.join(", ")}`);
  if (
    !options.metadataOnly &&
    (options.gateWave || process.env.CI === "true") &&
    options.playwrightReportPresent === false
  )
    errors.push("required E2E report is missing");
  const shouldRequirements = requirements.filter((item) => item.effectiveLevel === "should");
  if (options.shouldThreshold && shouldRequirements.length > 0) {
    const coveredShould = shouldRequirements.filter(
      (item) => rows.find((row) => row.id === item.id)?.status === "covered",
    ).length;
    const ratio = (coveredShould / shouldRequirements.length) * 100;
    if (ratio < options.shouldThreshold) {
      const message = `SHOULD coverage ${ratio.toFixed(1)}% is below threshold ${options.shouldThreshold}%`;
      if (options.gateWave) errors.push(message);
      else warnings.push(message);
    }
  }
  if (unknown.length || errors.length) {
    // Keep this branch explicit: policy failures are exit 1, while malformed files throw exit 2.
  }
  const totals = { must: 0, should: 0, may: 0, informative: 0 };
  for (const item of requirements) totals[item.effectiveLevel] += 1;
  return {
    specVersion: "unknown",
    generatedAt: new Date().toISOString(),
    totals,
    rows,
    uncovered,
    unknown,
    errors,
    warnings,
  };
}

export function runCoverage(options: CoverageOptions = {}): CoverageReport {
  const specPath = resolve(options.specPath ?? "SPEC.md");
  const overridesPath = resolve(options.overridesPath ?? "specs/requirements.overrides.yaml");
  const parsed = parseSpec(readText(specPath));
  const overrides = pathExists(overridesPath)
    ? parseOverrides(readText(overridesPath))
    : { provisional: [], manual: [], waivers: [] };
  const requirements = mergeRequirements(parsed.requirements, overrides);
  const metadataOnly =
    options.metadataOnly === true ||
    process.argv.includes("--emit-types") ||
    process.argv.includes("--write-lock") ||
    process.argv.includes("--check") ||
    process.argv.includes("--emit-traceability");
  const vitestPath = resolve(options.vitestPath ?? "reports/vitest.json");
  const playwrightPath = resolve(options.playwrightPath ?? "reports/playwright.json");
  const vitestReportPresent = pathExists(vitestPath);
  const playwrightReportPresent = pathExists(playwrightPath);
  const vitest = !metadataOnly ? readIfExists(vitestPath) : {};
  const playwright = !metadataOnly ? readIfExists(playwrightPath) : {};
  const evidence = metadataOnly ? [] : extractReportEvidence(vitest, playwright);
  const analysisOptions: CoverageOptions = {
    ...options,
    metadataOnly,
    playwrightReportPresent,
    vitestReportPresent,
  };
  const report = analyzeCoverage(requirements, overrides, evidence, analysisOptions);
  if (!metadataOnly && !vitestReportPresent && !playwrightReportPresent)
    report.errors.push(
      "runtime test reports are missing; a zero-evidence report cannot satisfy coverage",
    );
  report.specVersion = parsed.version;
  const generated = renderGeneratedTypes(requirements);
  const lock = renderLock(parsed.version, requirements);
  const generatedPath = resolve(options.generatedPath ?? "specs/requirement-ids.ts");
  const lockPath = resolve(options.lockPath ?? "specs/requirement-ids.lock");
  const checking = process.argv.includes("--check");
  const writingTypes = process.argv.includes("--emit-types");
  const writingLock = process.argv.includes("--write-lock");
  const checkingLock =
    options.checkLock || process.argv.includes("--check-lock") || process.env.CI === "true";
  const previousLockPath = resolve(options.baselineLockPath ?? lockPath);
  if (checking && process.argv.includes("--emit-traceability"))
    throw new ReqCoverageError("--check cannot be combined with --emit-traceability");
  if (checkingLock && !pathExists(previousLockPath))
    throw new ReqCoverageError(`missing baseline requirement lock: ${previousLockPath}`);
  if (checkingLock)
    report.errors.push(...checkLock(parseLock(readText(previousLockPath)), requirements, options));
  if (!checking && !report.errors.length && (writingTypes || writingLock)) {
    if (writingTypes) writeText(generatedPath, generated);
    if (writingLock) writeText(lockPath, lock);
  }
  if (process.argv.includes("--check")) {
    if (!pathExists(generatedPath) || readText(generatedPath) !== generated)
      report.errors.push(`generated requirement types are stale: ${generatedPath}`);
    if (!pathExists(lockPath) || readText(lockPath) !== lock)
      report.errors.push(`generated requirement lock is stale: ${lockPath}`);
  }
  const jsonIndex = process.argv.indexOf("--json");
  const jsonArg = jsonIndex >= 0 ? process.argv[jsonIndex + 1] : undefined;
  const jsonPath = resolve(jsonArg ?? "reports/req-coverage.json");
  const mdArgIndex = process.argv.indexOf("--md");
  const mdArg = mdArgIndex >= 0 ? process.argv[mdArgIndex + 1] : undefined;
  const mdPath = resolve(mdArg ?? "reports/req-coverage.md");
  const tracePath = resolve(options.traceabilityPath ?? "reports/traceability.md");
  if (!metadataOnly) {
    makeDirectory(dirname(jsonPath));
    makeDirectory(dirname(mdPath));
    writeText(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    writeText(mdPath, reportMarkdown(report));
  }
  if (process.argv.includes("--emit-traceability")) {
    makeDirectory(dirname(tracePath));
    writeText(tracePath, traceabilityMarkdown(requirements));
  }
  return report;
}

function cli(): number {
  const args = process.argv.slice(2);
  const booleanFlags = new Set([
    "--reports-only",
    "--check-lock",
    "--emit-types",
    "--write-lock",
    "--check",
    "--emit-traceability",
    "--help",
  ]);
  const valueFlags = new Set([
    "--gate",
    "--wave-dir",
    "--spec",
    "--overrides",
    "--lock",
    "--baseline-lock",
    "--types",
    "--vitest",
    "--playwright",
    "--changelog",
    "--traceability",
    "--json",
    "--md",
    "--should-threshold",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument?.startsWith("--"))
      throw new ReqCoverageError(`unexpected positional argument: ${argument ?? ""}`);
    if (booleanFlags.has(argument)) continue;
    if (valueFlags.has(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--"))
        throw new ReqCoverageError(`${argument} requires a value`);
      index += 1;
      continue;
    }
    throw new ReqCoverageError(`unknown option: ${argument}`);
  }
  if (args.includes("--help")) {
    console.log(
      "req-coverage: --reports-only | --emit-types --write-lock | --check | --check-lock [--baseline-lock PATH] | --gate WAVE",
    );
    return 0;
  }
  const valueAfter = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const metadataOnly =
    args.includes("--emit-types") ||
    args.includes("--write-lock") ||
    args.includes("--check") ||
    args.includes("--emit-traceability");
  const options: CoverageOptions = {
    reportsOnly: args.includes("--reports-only"),
    checkLock: args.includes("--check-lock"),
    waveDir: valueAfter("--wave-dir") ?? "specs/waves",
    shouldThreshold: Number(valueAfter("--should-threshold") ?? 0),
    metadataOnly,
  };
  if (args.includes("--check") && args.includes("--emit-traceability"))
    throw new ReqCoverageError("--check cannot be combined with --emit-traceability");
  const gateWave = valueAfter("--gate");
  const specPath = valueAfter("--spec");
  const overridesPath = valueAfter("--overrides");
  const lockPath = valueAfter("--lock");
  const generatedPath = valueAfter("--types");
  const vitestPath = valueAfter("--vitest");
  const playwrightPath = valueAfter("--playwright");
  const changelogPath = valueAfter("--changelog");
  const baselineLockPath = valueAfter("--baseline-lock");
  const traceabilityPath = valueAfter("--traceability");
  if (gateWave) options.gateWave = gateWave;
  if (specPath) options.specPath = specPath;
  if (overridesPath) options.overridesPath = overridesPath;
  if (lockPath) options.lockPath = lockPath;
  if (generatedPath) options.generatedPath = generatedPath;
  if (vitestPath) options.vitestPath = vitestPath;
  if (playwrightPath) options.playwrightPath = playwrightPath;
  if (changelogPath) options.changelogPath = changelogPath;
  if (baselineLockPath) options.baselineLockPath = baselineLockPath;
  if (traceabilityPath) options.traceabilityPath = traceabilityPath;
  if (
    !Number.isFinite(options.shouldThreshold) ||
    (options.shouldThreshold ?? 0) < 0 ||
    (options.shouldThreshold ?? 0) > 100
  )
    throw new ReqCoverageError("--should-threshold must be between 0 and 100");
  if (metadataOnly) options.reportsOnly = false;
  if (!metadataOnly && !options.reportsOnly) {
    for (const script of ["test", "test:e2e"]) {
      const result = spawnSync("pnpm", [script], { stdio: "inherit" });
      if (result.error)
        throw new ReqCoverageError(`unable to run pnpm ${script}: ${result.error.message}`);
      if (result.status !== 0)
        throw new ReqCoverageError(
          `pnpm ${script} failed with exit code ${String(result.status)}`,
          1,
        );
    }
  }
  const report = runCoverage(options);
  for (const warning of report.warnings) console.warn(`warning: ${warning}`);
  for (const error of report.errors) console.error(`error: ${error}`);
  return report.errors.length ? 1 : 0;
}

if (process.argv[1] && basename(process.argv[1]) === "req-coverage.ts") {
  try {
    process.exitCode = cli();
  } catch (error) {
    const exitCode = error instanceof ReqCoverageError ? error.exitCode : 2;
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = exitCode;
  }
}
