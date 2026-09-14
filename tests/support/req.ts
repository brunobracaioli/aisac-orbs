import { REQ_IDS, type ReqId, type Tag } from "../../specs/requirement-ids";

const knownIds = new Set<string>(REQ_IDS);

function assertKnown(id: ReqId): void {
  if (!knownIds.has(id)) throw new Error(`unknown requirement ID: ${id}`);
}

/** Adds an auditable requirement marker to a test title. */
export function req(...ids: [ReqId, ...ReqId[]]): string {
  ids.forEach(assertKnown);
  return `[${ids.join(",")}]`;
}

/** Creates Playwright's explicit requirement tags. Every alias must be listed. */
export function tags(...ids: [ReqId, ...ReqId[]]): Tag[] {
  ids.forEach(assertKnown);
  return ids.map((id) => `@${id}` as Tag);
}
