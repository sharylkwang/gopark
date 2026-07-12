export interface AvailabilityValues {
  available: number | null;
  total: number | null;
}

export type SourceIdIndex = Record<string, Record<string, string>>;

export function buildSourceIdIndex(carparks: { id: string; sourceIds: unknown }[]): SourceIdIndex {
  const index: SourceIdIndex = {};
  for (const cp of carparks) {
    const ids = (cp.sourceIds ?? {}) as Record<string, string>;
    for (const [source, sourceId] of Object.entries(ids)) {
      if (!sourceId) continue;
      if (!index[source]) index[source] = {};
      index[source][sourceId] = cp.id;
    }
  }
  return index;
}

export function resolveCarparkId(index: SourceIdIndex, source: string, sourceId: string): string {
  return index[source]?.[sourceId] ?? sourceId;
}

export function planAvailabilityWrite(existing: AvailabilityValues | null, incoming: AvailabilityValues): AvailabilityValues | null {
  if (incoming.available == null && incoming.total == null) return null;

  if (incoming.available == null) {
    if (existing && existing.total === incoming.total) return null;
    return { available: existing?.available ?? null, total: incoming.total };
  }

  const inferredTotal = existing?.total == null || incoming.available > existing.total
    ? incoming.available
    : existing.total;

  return { available: incoming.available, total: incoming.total ?? inferredTotal };
}
