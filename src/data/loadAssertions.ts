import { normalizeAssertion, type NormalizedAssertion } from './normalizeAssertion';

function assertAssertions(value: unknown): NormalizedAssertion[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid assertions: expected an array');
  }

  return value.map((entry, index) => normalizeAssertion(entry, index));
}

export async function loadAssertions(
  assertionsUrl = '/data/assertions.json',
): Promise<NormalizedAssertion[]> {
  const response = await fetch(assertionsUrl);

  if (!response.ok) {
    throw new Error(`Failed to load assertions: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return assertAssertions(payload);
}

export type { NormalizedAssertion as AssertionRecord };
