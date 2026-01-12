export interface AssertionRecord {
  predicate: string;
  subject: string;
  object: string;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertAssertions(value: unknown): AssertionRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid assertions: expected an array');
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid assertions: entry ${index} must be an object`);
    }

    if (typeof entry.predicate !== 'string') {
      throw new Error(`Invalid assertions: entry ${index} missing predicate`);
    }

    if (typeof entry.subject !== 'string') {
      throw new Error(`Invalid assertions: entry ${index} missing subject`);
    }

    if (typeof entry.object !== 'string') {
      throw new Error(`Invalid assertions: entry ${index} missing object`);
    }

    return entry as AssertionRecord;
  });
}

export async function loadAssertions(
  assertionsUrl = '/data/assertions.json',
): Promise<AssertionRecord[]> {
  const response = await fetch(assertionsUrl);

  if (!response.ok) {
    throw new Error(`Failed to load assertions: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return assertAssertions(payload);
}
