export interface ManifestCounts {
  persons: number;
  assertions: number;
}

export interface Manifest {
  spec_version: string;
  builder_version?: string;
  counts: ManifestCounts;
  person_index: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertManifest(value: unknown): Manifest {
  if (!isRecord(value)) {
    throw new Error('Invalid manifest: expected an object');
  }

  if (typeof value.spec_version !== 'string') {
    throw new Error('Invalid manifest: missing spec_version string');
  }

  if (!isRecord(value.counts)) {
    throw new Error('Invalid manifest: missing counts object');
  }

  const { persons, assertions } = value.counts;

  if (typeof persons !== 'number' || !Number.isFinite(persons)) {
    throw new Error('Invalid manifest: counts.persons must be a number');
  }

  if (typeof assertions !== 'number' || !Number.isFinite(assertions)) {
    throw new Error('Invalid manifest: counts.assertions must be a number');
  }

  if (!isRecord(value.person_index)) {
    throw new Error('Invalid manifest: missing person_index object');
  }

  const personIndex: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value.person_index)) {
    if (typeof entry !== 'string') {
      throw new Error('Invalid manifest: person_index values must be strings');
    }
    personIndex[key] = entry;
  }

  const builderVersion =
    typeof value.builder_version === 'string' ? value.builder_version : undefined;

  return {
    spec_version: value.spec_version,
    builder_version: builderVersion,
    counts: {
      persons,
      assertions,
    },
    person_index: personIndex,
  };
}

export async function loadManifest(
  manifestUrl = '/data/manifest.json',
): Promise<Manifest> {
  const response = await fetch(manifestUrl);

  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return assertManifest(payload);
}
