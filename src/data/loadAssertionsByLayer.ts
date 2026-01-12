function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertAssertionsByLayer(
  value: unknown,
): Record<string, string[]> {
  if (!isRecord(value)) {
    throw new Error('Invalid assertions_by_layer: expected an object');
  }

  const mapping: Record<string, string[]> = {};

  for (const [layerId, entry] of Object.entries(value)) {
    if (!Array.isArray(entry)) {
      throw new Error(
        `Invalid assertions_by_layer: entry ${layerId} must be an array`,
      );
    }

    entry.forEach((assertionId, index) => {
      if (typeof assertionId !== 'string') {
        throw new Error(
          `Invalid assertions_by_layer: entry ${layerId} at ${index} must be a string`,
        );
      }
    });

    mapping[layerId] = entry as string[];
  }

  return mapping;
}

export async function loadAssertionsByLayer(
  assertionsByLayerUrl = '/data/assertions_by_layer.json',
): Promise<Record<string, string[]>> {
  const response = await fetch(assertionsByLayerUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to load assertions_by_layer: ${response.status}`,
    );
  }

  const payload = (await response.json()) as unknown;
  return assertAssertionsByLayer(payload);
}

export type AssertionsByLayer = Record<string, string[]>;
