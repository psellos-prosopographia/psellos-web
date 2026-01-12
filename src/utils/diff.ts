import type { AssertionsByLayer } from '../data/loadAssertionsByLayer';

export function sortAssertionIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

export function computeDiff(
  assertionsByLayer: AssertionsByLayer,
  baseLayer: string,
  compareLayer: string,
): { added: string[]; removed: string[]; shared: string[] } {
  const baseSet = new Set(assertionsByLayer[baseLayer] ?? []);
  const compareSet = new Set(assertionsByLayer[compareLayer] ?? []);

  const added: string[] = [];
  const removed: string[] = [];
  const shared: string[] = [];

  compareSet.forEach((id) => {
    if (!baseSet.has(id)) {
      added.push(id);
    } else {
      shared.push(id);
    }
  });

  baseSet.forEach((id) => {
    if (!compareSet.has(id)) {
      removed.push(id);
    }
  });

  return {
    added: sortAssertionIds(added),
    removed: sortAssertionIds(removed),
    shared: sortAssertionIds(shared),
  };
}
