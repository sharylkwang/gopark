export type SourceIdIndex = Record<string, Record<string, string[]>>;

const DATAMALL_AGENCY_PREFIX = /^(LTA|URA)-/;

export function buildSourceIdIndex(carparks: { id: string; sourceIds: Record<string, string> }[]): SourceIdIndex {
  const index: SourceIdIndex = {};
  for (const cp of carparks) {
    for (const [source, sourceId] of Object.entries(cp.sourceIds)) {
      if (!sourceId) continue;
      ((index[source] ??= {})[sourceId] ??= []).push(cp.id);
    }
  }
  return index;
}

export function resolveCarparkIds(index: SourceIdIndex, source: string, providerId: string): string[] {
  const ids = new Set(index[source]?.[providerId] ?? []);
  ids.add(providerId);
  if (source === 'datamall') {
    const unprefixed = providerId.replace(DATAMALL_AGENCY_PREFIX, '');
    ids.add(unprefixed);
  }
  return [...ids];
}
