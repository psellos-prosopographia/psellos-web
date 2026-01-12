export interface PersonRecord {
  id: string;
  type?: string;
  name?: string;
  label?: string;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertPersons(value: unknown): Record<string, PersonRecord> {
  if (!isRecord(value)) {
    throw new Error('Invalid persons: expected an object');
  }

  const persons: Record<string, PersonRecord> = {};

  for (const [id, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      throw new Error(`Invalid persons: entry ${id} must be an object`);
    }

    if (typeof entry.id !== 'string') {
      throw new Error(`Invalid persons: entry ${id} missing id string`);
    }

    if (entry.type !== undefined && typeof entry.type !== 'string') {
      throw new Error(`Invalid persons: entry ${id} has non-string type`);
    }

    persons[id] = entry as PersonRecord;
  }

  return persons;
}

export async function loadPersons(
  personsUrl = '/data/persons.json',
): Promise<Record<string, PersonRecord>> {
  const response = await fetch(personsUrl);

  if (!response.ok) {
    throw new Error(`Failed to load persons: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return assertPersons(payload);
}
