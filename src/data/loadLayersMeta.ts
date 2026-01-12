export interface LayerMetaEntry {
  id: string;
  displayName?: string;
  description?: string;
  order?: number;
  color?: string;
}

export type LayersMetaMap = Record<string, LayerMetaEntry>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLayerMetaEntry(entry: unknown): LayerMetaEntry | null {
  if (!isRecord(entry)) {
    return null;
  }

  if (typeof entry.id !== 'string') {
    return null;
  }

  const meta: LayerMetaEntry = { id: entry.id };

  if (typeof entry.displayName === 'string') {
    meta.displayName = entry.displayName;
  }

  if (typeof entry.description === 'string') {
    meta.description = entry.description;
  }

  if (typeof entry.order === 'number' && Number.isFinite(entry.order)) {
    meta.order = entry.order;
  }

  if (typeof entry.color === 'string') {
    meta.color = entry.color;
  }

  return meta;
}

function parseLayersMeta(value: unknown): LayersMetaMap {
  const mapping: LayersMetaMap = {};

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const meta = normalizeLayerMetaEntry(entry);
      if (meta) {
        mapping[meta.id] = meta;
      }
    });
    return mapping;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([id, entry]) => {
      const meta = normalizeLayerMetaEntry(
        isRecord(entry) ? { id, ...entry } : { id },
      );
      if (meta) {
        mapping[id] = meta;
      }
    });
  }

  return mapping;
}

export async function loadLayersMeta(
  layersMetaUrl = '/data/layers_meta.json',
): Promise<LayersMetaMap> {
  try {
    const response = await fetch(layersMetaUrl);

    if (!response.ok) {
      return {};
    }

    const payload = (await response.json()) as unknown;
    return parseLayersMeta(payload);
  } catch (error) {
    console.warn('Unable to load layers_meta.json; continuing without it.', error);
    return {};
  }
}
