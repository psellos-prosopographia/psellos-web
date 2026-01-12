import type { AssertionRecord } from '../data/loadAssertionsById';
import type { AssertionsByLayer } from '../data/loadAssertionsByLayer';
import type { AssertionsByPerson } from '../data/loadAssertionsByPerson';
import type { LayerStats } from '../data/loadLayerStats';
import type { PersonRecord } from '../data/loadPersons';
import { getAssertionRelType } from '../utils/assertions';
import { downloadJson } from '../utils/download';
import type { LayerDefinition } from '../utils/layers';

interface LayerDiagnosticsEntry {
  id: string;
  displayName: string;
  description?: string;
  color?: string;
  assertionCount: number;
  topPersons: Array<{ id: string; name: string; count: number }> | null;
  relTypes: Record<string, number> | null;
  untypedCount: number;
  relSource: 'layer_stats' | 'derived';
  personSource: 'layer_stats' | 'derived' | 'unavailable';
}

export function renderLayerDiagnosticsView(
  layers: LayerDefinition[],
  assertionsByLayer: AssertionsByLayer,
  assertionsById: Record<string, AssertionRecord>,
  assertionsByPerson: AssertionsByPerson | null,
  persons: Record<string, PersonRecord>,
  layerStats: LayerStats | null,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'view layer-diagnostics';

  const heading = document.createElement('h2');
  heading.textContent = 'Diagnostics';

  const description = document.createElement('p');
  description.textContent =
    'Layer diagnostics include assertion counts, relationship typing coverage, and top persons per layer.';

  const exportControls = document.createElement('div');
  exportControls.className = 'diagnostics-export';

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Export diagnostics';

  const diagnostics = buildLayerDiagnostics(
    layers,
    assertionsByLayer,
    assertionsById,
    assertionsByPerson,
    persons,
    layerStats,
  );

  exportButton.addEventListener('click', () => {
    downloadJson('layer_diagnostics.json', {
      layers: diagnostics.map((entry) => ({
        id: entry.id,
        displayName: entry.displayName,
        description: entry.description,
        assertionCount: entry.assertionCount,
        topPersons: entry.topPersons,
        relTypes: entry.relTypes,
        untypedCount: entry.untypedCount,
        relSource: entry.relSource,
        personSource: entry.personSource,
      })),
    });
  });

  exportControls.append(exportButton);

  const list = document.createElement('div');
  list.className = 'diagnostics-layers';

  diagnostics.forEach((entry) => {
    list.append(renderLayerDiagnosticsCard(entry));
  });

  section.append(heading, description, exportControls, list);
  return section;
}

function buildLayerDiagnostics(
  layers: LayerDefinition[],
  assertionsByLayer: AssertionsByLayer,
  assertionsById: Record<string, AssertionRecord>,
  assertionsByPerson: AssertionsByPerson | null,
  persons: Record<string, PersonRecord>,
  layerStats: LayerStats | null,
): LayerDiagnosticsEntry[] {
  return layers.map((layer) => {
    const assertionIds = assertionsByLayer[layer.id] ?? [];
    const assertionCount = assertionIds.length;

    const layerStatsEntry = getLayerStatsEntry(layerStats, layer.id);
    const relTypesFromStats = parseCounts(
      layerStatsEntry?.relTypeCounts ??
        layerStatsEntry?.rel_type_counts ??
        layerStatsEntry?.relTypes ??
        layerStatsEntry?.rel_types,
    );

    const { relTypes, untypedCount, relSource } = relTypesFromStats
      ? {
          relTypes: relTypesFromStats,
          untypedCount: 0,
          relSource: 'layer_stats' as const,
        }
      : deriveRelTypes(assertionIds, assertionsById);

    const topPersonsFromStats = parseTopPersons(layerStatsEntry?.topPersons ?? layerStatsEntry?.top_persons);

    const topPersons = topPersonsFromStats
      ? normalizeTopPersons(topPersonsFromStats, persons)
      : assertionsByPerson
        ? deriveTopPersons(assertionIds, assertionsByPerson, persons)
        : null;

    const personSource: LayerDiagnosticsEntry['personSource'] = topPersonsFromStats
      ? 'layer_stats'
      : assertionsByPerson
        ? 'derived'
        : 'unavailable';

    return {
      id: layer.id,
      displayName: layer.displayName,
      description: layer.description,
      color: layer.color,
      assertionCount,
      topPersons,
      relTypes,
      untypedCount,
      relSource,
      personSource,
    };
  });
}

function renderLayerDiagnosticsCard(entry: LayerDiagnosticsEntry): HTMLElement {
  const card = document.createElement('article');
  card.className = 'diagnostics-card';

  const heading = document.createElement('h3');
  heading.textContent =
    entry.displayName === entry.id
      ? entry.id
      : `${entry.displayName} (${entry.id})`;

  const meta = document.createElement('div');
  meta.className = 'layer-meta';

  if (entry.color) {
    const swatch = document.createElement('span');
    swatch.className = 'layer-meta__swatch';
    swatch.style.backgroundColor = entry.color;
    meta.append(swatch);
  }

  const label = document.createElement('span');
  label.textContent =
    entry.displayName === entry.id
      ? entry.id
      : `${entry.displayName} (${entry.id})`;
  meta.append(label);

  const description = document.createElement('p');
  description.className = 'diagnostics-card__description';
  description.textContent = entry.description ?? 'No description provided.';

  const stats = document.createElement('dl');
  stats.className = 'diagnostics-card__stats';

  const addRow = (labelText: string, value: string) => {
    const term = document.createElement('dt');
    term.textContent = labelText;
    const definition = document.createElement('dd');
    definition.textContent = value;
    stats.append(term, definition);
  };

  addRow('Assertion count', String(entry.assertionCount));
  addRow('Rel type source', entry.relSource);
  addRow('Top persons source', entry.personSource);

  const relSection = document.createElement('section');
  relSection.className = 'diagnostics-card__section';

  const relHeading = document.createElement('h4');
  relHeading.textContent = 'Rel-type distribution';

  if (!entry.relTypes || Object.keys(entry.relTypes).length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No rel types recorded for this layer.';
    relSection.append(relHeading, empty);
  } else {
    const list = document.createElement('ul');
    list.className = 'diagnostics-card__list';
    Object.entries(entry.relTypes)
      .sort((a, b) => {
        if (b[1] !== a[1]) {
          return b[1] - a[1];
        }
        return a[0].localeCompare(b[0], undefined, { sensitivity: 'base' });
      })
      .forEach(([relType, count]) => {
        const item = document.createElement('li');
        item.textContent = `${relType}: ${count}`;
        list.append(item);
      });

    relSection.append(relHeading, list);
  }

  if (entry.untypedCount > 0) {
    const untyped = document.createElement('p');
    untyped.className = 'diagnostics-card__note';
    untyped.textContent = `Assertions without rel types: ${entry.untypedCount}`;
    relSection.append(untyped);
  }

  const personSection = document.createElement('section');
  personSection.className = 'diagnostics-card__section';

  const personHeading = document.createElement('h4');
  personHeading.textContent = 'Top persons by assertions';

  if (!entry.topPersons || entry.topPersons.length === 0) {
    const empty = document.createElement('p');
    empty.textContent =
      entry.personSource === 'unavailable'
        ? 'Top persons unavailable (missing assertions_by_person).'
        : 'No persons recorded for this layer.';
    personSection.append(personHeading, empty);
  } else {
    const list = document.createElement('ul');
    list.className = 'diagnostics-card__list';
    entry.topPersons.forEach((person) => {
      const item = document.createElement('li');
      item.textContent = `${person.name} (${person.id}): ${person.count}`;
      list.append(item);
    });
    personSection.append(personHeading, list);
  }

  card.append(heading, meta, description, stats, relSection, personSection);
  return card;
}

function deriveRelTypes(
  assertionIds: string[],
  assertionsById: Record<string, AssertionRecord>,
): { relTypes: Record<string, number> | null; untypedCount: number; relSource: 'derived' } {
  const counts: Record<string, number> = {};
  let untypedCount = 0;

  assertionIds.forEach((assertionId) => {
    const relType = getAssertionRelType(assertionsById[assertionId]);
    if (!relType) {
      untypedCount += 1;
      return;
    }
    counts[relType] = (counts[relType] ?? 0) + 1;
  });

  const relTypes = Object.keys(counts).length > 0 ? counts : null;

  return { relTypes, untypedCount, relSource: 'derived' };
}

function deriveTopPersons(
  assertionIds: string[],
  assertionsByPerson: AssertionsByPerson,
  persons: Record<string, PersonRecord>,
  limit = 5,
): Array<{ id: string; name: string; count: number }> {
  const assertionSet = new Set(assertionIds);
  const counts: Array<{ id: string; count: number }> = [];

  Object.entries(assertionsByPerson).forEach(([personId, ids]) => {
    let count = 0;
    ids.forEach((assertionId) => {
      if (assertionSet.has(assertionId)) {
        count += 1;
      }
    });
    if (count > 0) {
      counts.push({ id: personId, count });
    }
  });

  counts.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
  });

  return counts.slice(0, limit).map((entry) => ({
    id: entry.id,
    name: resolvePersonName(entry.id, persons),
    count: entry.count,
  }));
}

function normalizeTopPersons(
  entries: Array<{ id: string; count: number }>,
  persons: Record<string, PersonRecord>,
): Array<{ id: string; name: string; count: number }> {
  return entries.map((entry) => ({
    id: entry.id,
    name: resolvePersonName(entry.id, persons),
    count: entry.count,
  }));
}

function resolvePersonName(
  personId: string,
  persons: Record<string, PersonRecord>,
): string {
  const person = persons[personId];
  return person?.name ?? person?.label ?? personId;
}

function getLayerStatsEntry(
  layerStats: LayerStats | null,
  layerId: string,
): Record<string, unknown> | null {
  if (!layerStats || !isRecord(layerStats)) {
    return null;
  }

  const layersEntry = layerStats.layers;
  if (isRecord(layersEntry) && isRecord(layersEntry[layerId])) {
    return layersEntry[layerId] as Record<string, unknown>;
  }

  if (isRecord(layerStats[layerId])) {
    return layerStats[layerId] as Record<string, unknown>;
  }

  return null;
}

function parseTopPersons(
  value: unknown,
): Array<{ id: string; count: number }> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries: Array<{ id: string; count: number }> = [];

  value.forEach((entry) => {
    if (!isRecord(entry)) {
      return;
    }
    const id =
      readString(entry, ['id', 'personId', 'person_id']) ??
      readString(entry, ['person']);
    const count = entry.count;
    if (id && typeof count === 'number' && Number.isFinite(count)) {
      entries.push({ id, count });
    }
  });

  return entries.length > 0 ? entries : null;
}

function parseCounts(value: unknown): Record<string, number> | null {
  if (isRecord(value)) {
    const counts: Record<string, number> = {};
    Object.entries(value).forEach(([key, count]) => {
      if (typeof count === 'number' && Number.isFinite(count)) {
        counts[key] = count;
      }
    });
    return Object.keys(counts).length > 0 ? counts : null;
  }

  if (Array.isArray(value)) {
    const counts: Record<string, number> = {};
    value.forEach((entry) => {
      if (!isRecord(entry)) {
        return;
      }
      const key = readString(entry, ['rel', 'relType', 'type']);
      const count = entry.count;
      if (key && typeof count === 'number' && Number.isFinite(count)) {
        counts[key] = count;
      }
    });
    return Object.keys(counts).length > 0 ? counts : null;
  }

  return null;
}

function readString(
  entry: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
