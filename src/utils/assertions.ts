import type { AssertionRecord } from '../data/loadAssertionsById';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getAssertionRelType(
  assertion: AssertionRecord | undefined,
): string | null {
  if (!assertion || !isRecord(assertion.raw)) {
    return null;
  }

  const extensions = assertion.raw.extensions;
  if (!isRecord(extensions)) {
    return null;
  }

  const psellos = extensions.psellos;
  if (!isRecord(psellos)) {
    return null;
  }

  const rel = psellos.rel;
  return typeof rel === 'string' ? rel : null;
}

export function collectRelTypes(
  assertionsById: Record<string, AssertionRecord>,
): string[] {
  const relTypes = new Set<string>();

  Object.values(assertionsById).forEach((assertion) => {
    const rel = getAssertionRelType(assertion);
    if (rel) {
      relTypes.add(rel);
    }
  });

  return Array.from(relTypes).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}
