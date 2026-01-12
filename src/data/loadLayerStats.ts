export type LayerStats = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function loadLayerStats(
  layerStatsUrl = '/data/layer_stats.json',
): Promise<LayerStats | null> {
  try {
    const response = await fetch(layerStatsUrl);

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as unknown;
    return isRecord(payload) ? payload : null;
  } catch (error) {
    console.warn('Unable to load layer_stats.json; continuing without it.', error);
    return null;
  }
}
