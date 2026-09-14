import { notFound } from "next/navigation";

import { env } from "@/app/_lib/env";

import SmokePoints from "./SmokePoints";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseSeed(value: string | undefined, fallback: number): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export default async function SmokePointsPage({ searchParams }: { searchParams: SearchParams }) {
  if (env.server.ORB_SMOKE_ROUTES !== "1") {
    notFound();
  }

  const params = await searchParams;
  const debug = firstValue(params.debug) === "1";
  const seed = parseSeed(firstValue(params.seed), env.client.NEXT_PUBLIC_ORB_SEED);

  return <SmokePoints debug={debug} seed={seed} />;
}
