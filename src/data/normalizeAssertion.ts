export interface NormalizedAssertion {
  predicate: string;
  subjectId: string;
  objectId: string;
  raw: Record<string, unknown>;
}

const endpointPairs = [
  { subject: 'subject', object: 'object' },
  { subject: 'from', object: 'to' },
  { subject: 'source', object: 'target' },
  { subject: 'subj', object: 'obj' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeAssertion(
  entry: unknown,
  index: number,
): NormalizedAssertion {
  if (!isRecord(entry)) {
    throw new Error(`Invalid assertions: entry ${index} must be an object`);
  }

  if (typeof entry.predicate !== 'string') {
    throw new Error(`Invalid assertions: entry ${index} missing predicate`);
  }

  for (const pair of endpointPairs) {
    const subjectValue = entry[pair.subject];
    const objectValue = entry[pair.object];

    if (typeof subjectValue === 'string' && typeof objectValue === 'string') {
      return {
        predicate: entry.predicate,
        subjectId: subjectValue,
        objectId: objectValue,
        raw: entry,
      };
    }
  }

  const presentKeys = Object.keys(entry);
  const expectedKeys = endpointPairs
    .map((pair) => `${pair.subject}/${pair.object}`)
    .join(', ');
  const foundKeys = presentKeys.length ? presentKeys.join(', ') : 'none';

  throw new Error(
    `Invalid assertions: entry ${index} has unsupported endpoint shape. Expected ${expectedKeys}; artifact shape is unsupported. Found keys: ${foundKeys}`,
  );
}
