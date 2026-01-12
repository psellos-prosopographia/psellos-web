import type { LayerMetaEntry, LayersMetaMap } from '../data/loadLayersMeta';

export interface LayerDefinition {
  id: string;
  displayName: string;
  description?: string;
  order?: number;
  color?: string;
}

function buildLayerDefinition(
  layerId: string,
  meta: LayerMetaEntry | undefined,
): LayerDefinition {
  return {
    id: layerId,
    displayName: meta?.displayName ?? layerId,
    description: meta?.description,
    order: meta?.order,
    color: meta?.color,
  };
}

export function buildLayerDefinitions(
  layerIds: string[],
  layersMeta: LayersMetaMap,
): LayerDefinition[] {
  const definitions = layerIds.map((layerId) =>
    buildLayerDefinition(layerId, layersMeta[layerId]),
  );

  const hasOrder = definitions.some((layer) => typeof layer.order === 'number');

  if (hasOrder) {
    return [...definitions].sort((a, b) => {
      const orderA = a.order ?? Number.POSITIVE_INFINITY;
      const orderB = b.order ?? Number.POSITIVE_INFINITY;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
    });
  }

  return [...definitions].sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }),
  );
}

export function formatLayerLabel(layer: LayerDefinition): string {
  return layer.displayName === layer.id
    ? layer.id
    : `${layer.displayName} (${layer.id})`;
}
