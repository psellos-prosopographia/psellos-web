import type { AssertionsByLayer } from './loadAssertionsByLayer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLayerEntry(entry: unknown): string | null {
  if (typeof entry === 'string') {
    return entry;
  }

  if (isRecord(entry) && typeof entry.id === 'string') {
    return entry.id;
  }

  return null;
}

function parseLayers(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((entry) => normalizeLayerEntry(entry))
    .filter((layerId): layerId is string => layerId !== null);
}

export async function loadNarrativeLayers(
  assertionsByLayer: AssertionsByLayer,
  layersUrl = '/data/layers.json',
): Promise<string[]> {
  try {
    const response = await fetch(layersUrl);

    if (response.ok) {
      const payload = (await response.json()) as unknown;
      const layers = parseLayers(payload);
      if (layers) {
        return layers;
      }
    }
  } catch (error) {
    console.warn('Unable to load layers.json, falling back to assertions.', error);
  }

  return Object.keys(assertionsByLayer);
}
