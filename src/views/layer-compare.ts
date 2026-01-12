import type { AssertionRecord } from '../data/loadAssertionsById';
import type { AssertionsByLayer } from '../data/loadAssertionsByLayer';
import type { LayerStats } from '../data/loadLayerStats';
import { collectRelTypes, getAssertionRelType } from '../utils/assertions';
import { downloadJson, sanitizeLayerId } from '../utils/download';
import type { LayerDefinition } from '../utils/layers';
import { formatLayerLabel } from '../utils/layers';
import { renderRelTypeFilter } from './rel-filter';

const QUERY_PARAM_BASE = 'a';
const QUERY_PARAM_COMPARE = 'b';
const QUERY_PARAM_REL = 'rel';

export function renderLayerCompareView(
  assertionsByLayer: AssertionsByLayer,
  assertionsById: Record<string, AssertionRecord>,
  layers: LayerDefinition[],
  layerStats: LayerStats | null,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'view layer-compare';

  const heading = document.createElement('h2');
  heading.textContent = 'Compare layers';

  const description = document.createElement('p');
  description.textContent =
    'Diff assertions between two narrative layers using compiled artifacts.';

  const compareControls = document.createElement('div');
  compareControls.className = 'layer-compare__controls';

  const layerIds = layers.map((layer) => layer.id);

  const defaultBase = 'canon';
  const defaultCompare = pickDefaultCompareLayer(layerIds);

  const fromParams = readSelectionFromQuery();

  let selectedBase = fromParams.base ?? defaultBase;
  let selectedCompare = fromParams.compare ?? defaultCompare;
  let selectedRelTypes = fromParams.relTypes;

  const baseControl = renderLayerSelect(
    'Base layer (A)',
    'layer-compare-base',
    layers,
    selectedBase,
    (value) => {
      selectedBase = value;
      syncQueryParams(selectedBase, selectedCompare, selectedRelTypes);
      renderResults();
    },
  );

  const compareControl = renderLayerSelect(
    'Compare layer (B)',
    'layer-compare-compare',
    layers,
    selectedCompare,
    (value) => {
      selectedCompare = value;
      syncQueryParams(selectedBase, selectedCompare, selectedRelTypes);
      renderResults();
    },
  );

  compareControls.append(baseControl, compareControl);

  const relTypes = collectRelTypes(assertionsById);
  selectedRelTypes = selectedRelTypes.filter((relType) =>
    relTypes.includes(relType),
  );
  const relFilter = renderRelTypeFilter(
    relTypes,
    selectedRelTypes,
    (selection) => {
      selectedRelTypes = selection;
      syncQueryParams(selectedBase, selectedCompare, selectedRelTypes);
      renderResults();
    },
    {
      label: 'Relationship type filter',
      description:
        'Show assertion diffs only when extensions.psellos.rel matches the selection.',
    },
  );

  const exportControls = createDiffExportControls(
    () => selectedBase,
    () => selectedCompare,
    () => selectedRelTypes,
    assertionsByLayer,
    assertionsById,
    layerIds,
  );

  const analytics = document.createElement('section');
  analytics.className = 'layer-compare__analytics';

  const results = document.createElement('div');
  results.className = 'layer-compare__results';

  const renderResults = () => {
    const baseValid = layerIds.includes(selectedBase);
    const compareValid = layerIds.includes(selectedCompare);

    const diff =
      baseValid && compareValid
        ? computeDiff(assertionsByLayer, selectedBase, selectedCompare)
        : { added: [], removed: [], shared: [] };

    const relFiltered = filterDiffByRelTypes(
      diff,
      assertionsById,
      new Set(selectedRelTypes),
    );

    exportControls.update(baseValid, compareValid);

    const counts = renderDiffCounts(
      relFiltered.added.length,
      relFiltered.removed.length,
      relFiltered.shared.length,
    );

    const addedList = renderAssertionList(
      'Added assertions',
      relFiltered.added,
      assertionsById,
    );
    const removedList = renderAssertionList(
      'Removed assertions',
      relFiltered.removed,
      assertionsById,
    );

    analytics.replaceChildren(
      renderAnalyticsSection(
        selectedBase,
        selectedCompare,
        relFiltered,
        assertionsById,
        layerStats,
        selectedRelTypes,
      ),
    );

    results.replaceChildren(counts, addedList, removedList);
  };

  renderResults();

  section.append(
    heading,
    description,
    compareControls,
    relFilter.element,
    analytics,
    exportControls.element,
    results,
  );
  return section;
}

function createDiffExportControls(
  getBase: () => string,
  getCompare: () => string,
  getRelTypes: () => string[],
  assertionsByLayer: AssertionsByLayer,
  assertionsById: Record<string, AssertionRecord>,
  layers: string[],
): { element: HTMLElement; update: (baseValid: boolean, compareValid: boolean) => void } {
  const container = document.createElement('section');
  container.className = 'layer-compare__exports';

  const heading = document.createElement('h3');
  heading.textContent = 'Diff exports';

  const description = document.createElement('p');
  description.className = 'layer-compare__exports-description';

  const buttonRow = document.createElement('div');
  buttonRow.className = 'layer-compare__exports-actions';

  const exportSummaryButton = document.createElement('button');
  exportSummaryButton.type = 'button';
  exportSummaryButton.textContent = 'Export diff summary';

  const exportObjectsButton = document.createElement('button');
  exportObjectsButton.type = 'button';
  exportObjectsButton.textContent = 'Export diff objects';

  const updateDescription = () => {
    const base = getBase();
    const compare = getCompare();
    const relTypes = getRelTypes();
    const relSummary =
      relTypes.length > 0 ? ` filtered to ${relTypes.join(', ')}` : '';
    description.textContent = `Export diff for ${base || 'unknown'} vs ${compare || 'unknown'}${relSummary}`;
  };

  const buildDiff = () => {
    const base = getBase();
    const compare = getCompare();
    const diff = computeDiff(assertionsByLayer, base, compare);
    return filterDiffByRelTypes(diff, assertionsById, new Set(getRelTypes()));
  };

  const buildFilename = (suffix: string) => {
    const base = sanitizeLayerId(getBase());
    const compare = sanitizeLayerId(getCompare());
    return `assertions_diff_${base}_vs_${compare}${suffix}.json`;
  };

  exportSummaryButton.addEventListener('click', () => {
    if (!layers.includes(getBase()) || !layers.includes(getCompare())) {
      return;
    }
    const base = getBase();
    const compare = getCompare();
    const diff = buildDiff();
    downloadJson(buildFilename(''), {
      base,
      compare,
      relTypes: getRelTypes(),
      added: diff.added,
      removed: diff.removed,
    });
  });

  exportObjectsButton.addEventListener('click', () => {
    if (!layers.includes(getBase()) || !layers.includes(getCompare())) {
      return;
    }
    const base = getBase();
    const compare = getCompare();
    const diff = buildDiff();
    const added = diff.added
      .map((id) => assertionsById[id])
      .filter((record): record is AssertionRecord => Boolean(record));
    const removed = diff.removed
      .map((id) => assertionsById[id])
      .filter((record): record is AssertionRecord => Boolean(record));
    downloadJson(buildFilename('_objects'), {
      base,
      compare,
      relTypes: getRelTypes(),
      added,
      removed,
    });
  });

  const update = (baseValid: boolean, compareValid: boolean) => {
    const disabled = !baseValid || !compareValid;
    exportSummaryButton.disabled = disabled;
    exportObjectsButton.disabled = disabled;
    updateDescription();
  };

  updateDescription();

  buttonRow.append(exportSummaryButton, exportObjectsButton);
  container.append(heading, description, buttonRow);
  return { element: container, update };
}

function pickDefaultCompareLayer(layers: string[]): string {
  const nonCanon = layers.find((layerId) => layerId !== 'canon');
  return nonCanon ?? 'canon';
}

function readSelectionFromQuery(): {
  base: string | null;
  compare: string | null;
  relTypes: string[];
} {
  try {
    const params = new URLSearchParams(window.location.search);
    const relParam = params.get(QUERY_PARAM_REL);
    return {
      base: params.get(QUERY_PARAM_BASE),
      compare: params.get(QUERY_PARAM_COMPARE),
      relTypes: relParam ? relParam.split(',').filter(Boolean) : [],
    };
  } catch {
    return { base: null, compare: null, relTypes: [] };
  }
}

function syncQueryParams(base: string, compare: string, relTypes: string[]): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(QUERY_PARAM_BASE, base);
    url.searchParams.set(QUERY_PARAM_COMPARE, compare);
    if (relTypes.length > 0) {
      url.searchParams.set(QUERY_PARAM_REL, relTypes.join(','));
    } else {
      url.searchParams.delete(QUERY_PARAM_REL);
    }
    window.history.replaceState({}, '', url);
  } catch {
    // Ignore URL updates if unavailable.
  }
}

function renderLayerSelect(
  labelText: string,
  selectId: string,
  layers: LayerDefinition[],
  selectedLayer: string,
  onSelect: (layerId: string) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'layer-compare__control';

  const label = document.createElement('label');
  label.htmlFor = selectId;
  label.textContent = labelText;

  const select = document.createElement('select');
  select.id = selectId;
  select.name = selectId;

  const layerIds = layers.map((layer) => layer.id);
  const options = buildLayerOptions(layerIds, selectedLayer);
  options.forEach((layerId) => {
    const layer = layers.find((entry) => entry.id === layerId);
    const option = document.createElement('option');
    option.value = layerId;
    option.textContent = layer ? formatLayerLabel(layer) : layerId;
    select.append(option);
  });

  select.value = selectedLayer;

  const status = document.createElement('span');
  status.className = 'layer-compare__status';

  const meta = document.createElement('div');
  meta.className = 'layer-compare__meta';

  const updateMeta = (layerId: string) => {
    const layer = layers.find((entry) => entry.id === layerId);
    if (!layer) {
      meta.textContent = '';
      meta.hidden = true;
      return;
    }

    const summary = document.createElement('div');
    summary.className = 'layer-meta';

    if (layer.color) {
      const swatch = document.createElement('span');
      swatch.className = 'layer-meta__swatch';
      swatch.style.backgroundColor = layer.color;
      summary.append(swatch);
    }

    const name = document.createElement('span');
    name.textContent = formatLayerLabel(layer);
    summary.append(name);

    const description = document.createElement('div');
    description.className = 'layer-meta__description';
    description.textContent = layer.description ?? 'No description provided.';

    meta.replaceChildren(summary, description);
    meta.hidden = false;
  };

  const updateStatus = (layerId: string) => {
    if (layerId !== '' && !layerIds.includes(layerId)) {
      status.textContent = `Missing layer: ${layerId}`;
      status.hidden = false;
    } else {
      status.textContent = '';
      status.hidden = true;
    }
  };

  updateStatus(selectedLayer);
  updateMeta(selectedLayer);

  select.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      updateStatus(target.value);
      updateMeta(target.value);
      onSelect(target.value);
    }
  });

  wrapper.append(label, select, status, meta);
  return wrapper;
}

function buildLayerOptions(layers: string[], selectedLayer: string): string[] {
  const options = [...layers].sort((a, b) => a.localeCompare(b));
  if (selectedLayer !== '' && !options.includes(selectedLayer)) {
    return [selectedLayer, ...options];
  }
  return options;
}

function computeDiff(
  assertionsByLayer: AssertionsByLayer,
  baseLayer: string,
  compareLayer: string,
): { added: string[]; removed: string[]; shared: string[] } {
  const baseSet = new Set(assertionsByLayer[baseLayer] ?? []);
  const compareSet = new Set(assertionsByLayer[compareLayer] ?? []);

  const added: string[] = [];
  const removed: string[] = [];
  const shared: string[] = [];

  compareSet.forEach((id) => {
    if (!baseSet.has(id)) {
      added.push(id);
    } else {
      shared.push(id);
    }
  });

  baseSet.forEach((id) => {
    if (!compareSet.has(id)) {
      removed.push(id);
    }
  });

  return {
    added: sortAssertionIds(added),
    removed: sortAssertionIds(removed),
    shared: sortAssertionIds(shared),
  };
}

function filterDiffByRelTypes(
  diff: { added: string[]; removed: string[]; shared: string[] },
  assertionsById: Record<string, AssertionRecord>,
  relTypes: Set<string>,
): { added: string[]; removed: string[]; shared: string[] } {
  if (relTypes.size === 0) {
    return diff;
  }

  const matchesRel = (assertionId: string) => {
    const relType = getAssertionRelType(assertionsById[assertionId]);
    return relType !== null && relTypes.has(relType);
  };

  return {
    added: diff.added.filter(matchesRel),
    removed: diff.removed.filter(matchesRel),
    shared: diff.shared.filter(matchesRel),
  };
}

function sortAssertionIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function renderDiffCounts(
  addedCount: number,
  removedCount: number,
  sharedCount: number,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'layer-compare__counts';

  const list = document.createElement('dl');

  const addRow = (label: string, value: number) => {
    const term = document.createElement('dt');
    term.textContent = label;
    const definition = document.createElement('dd');
    definition.textContent = String(value);
    list.append(term, definition);
  };

  addRow('Added', addedCount);
  addRow('Removed', removedCount);
  addRow('Shared', sharedCount);

  container.append(list);
  return container;
}

function renderAssertionList(
  title: string,
  assertionIds: string[],
  assertionsById: Record<string, AssertionRecord>,
): HTMLElement {
  const container = document.createElement('section');
  container.className = 'layer-compare__list';

  const heading = document.createElement('h3');
  heading.textContent = `${title} (${assertionIds.length})`;

  if (assertionIds.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'None.';
    container.append(heading, empty);
    return container;
  }

  const list = document.createElement('ul');
  list.className = 'layer-compare__items';

  assertionIds.forEach((assertionId) => {
    const item = document.createElement('li');
    item.append(renderAssertionCard(assertionId, assertionsById[assertionId]));
    list.append(item);
  });

  container.append(heading, list);
  return container;
}

function renderAssertionCard(
  assertionId: string,
  assertion: AssertionRecord | undefined,
): HTMLElement {
  const card = document.createElement('article');
  card.className = 'assertion-card';

  const heading = document.createElement('h4');
  heading.textContent = assertionId;

  if (!assertion) {
    const missing = document.createElement('p');
    missing.textContent = 'Assertion details not found in assertions_by_id.';
    card.append(heading, missing);
    return card;
  }

  const statement = document.createElement('p');
  statement.textContent = `${assertion.subjectId} — ${assertion.predicate} → ${assertion.objectId}`;

  card.append(heading, statement);

  const relType = getAssertionRelType(assertion);
  if (relType) {
    const relLine = document.createElement('p');
    relLine.textContent = `Relationship type: ${relType}`;
    card.append(relLine);
  }

  return card;
}

function renderAnalyticsSection(
  baseLayer: string,
  compareLayer: string,
  diff: { added: string[]; removed: string[]; shared: string[] },
  assertionsById: Record<string, AssertionRecord>,
  layerStats: LayerStats | null,
  selectedRelTypes: string[],
): HTMLElement {
  const container = document.createElement('section');
  container.className = 'layer-compare__analytics-panel';

  const heading = document.createElement('h3');
  heading.textContent = 'Layer comparison analytics';

  const summary = document.createElement('p');
  summary.className = 'layer-compare__analytics-summary';

  const stats = findComparisonStats(layerStats, baseLayer, compareLayer);
  const relFilterNote =
    selectedRelTypes.length > 0
      ? `Rel filter: ${selectedRelTypes.join(', ')}.`
      : 'Rel filter: none.';

  summary.textContent = stats
    ? `Stats sourced from layer_stats.json. ${relFilterNote}`
    : `Stats derived from assertion diffs. ${relFilterNote}`;

  const content = document.createElement('div');
  content.className = 'layer-compare__analytics-content';

  if (stats) {
    const affectedPersons = parsePersonList(
      stats.affectedPersons ?? stats.affected_persons,
    );
    const relTypeCounts = parseCounts(
      stats.relTypeCounts ?? stats.rel_type_counts ?? stats.rel_types,
    );
    const predicateCounts = parseCounts(
      stats.predicateCounts ?? stats.predicate_counts ?? stats.predicates,
    );

    content.append(
      renderAnalyticsList('Affected persons', affectedPersons),
      renderAnalyticsCounts('Rel-type counts', relTypeCounts),
      renderAnalyticsCounts('Predicate counts', predicateCounts),
    );
  } else {
    const affectedPersons = buildAffectedPersons(diff, assertionsById);
    const addedRelTypes = buildRelTypeCounts(diff.added, assertionsById);
    const removedRelTypes = buildRelTypeCounts(diff.removed, assertionsById);

    content.append(
      renderAnalyticsList('Affected persons', affectedPersons),
      renderAnalyticsCounts('Added rel types', addedRelTypes),
      renderAnalyticsCounts('Removed rel types', removedRelTypes),
    );
  }

  container.append(heading, summary, content);
  return container;
}

function renderAnalyticsList(
  label: string,
  values: string[] | null,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'layer-compare__analytics-section';

  const heading = document.createElement('h4');
  heading.textContent = label;

  if (!values || values.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'None available.';
    section.append(heading, empty);
    return section;
  }

  const list = document.createElement('ul');
  list.className = 'layer-compare__analytics-list';

  values.forEach((value) => {
    const item = document.createElement('li');
    item.textContent = value;
    list.append(item);
  });

  section.append(heading, list);
  return section;
}

function renderAnalyticsCounts(
  label: string,
  counts: Record<string, number> | null,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'layer-compare__analytics-section';

  const heading = document.createElement('h4');
  heading.textContent = label;

  if (!counts || Object.keys(counts).length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'None available.';
    section.append(heading, empty);
    return section;
  }

  const list = document.createElement('ul');
  list.className = 'layer-compare__analytics-list';

  Object.entries(counts)
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], undefined, { sensitivity: 'base' });
    })
    .forEach(([key, value]) => {
      const item = document.createElement('li');
      item.textContent = `${key}: ${value}`;
      list.append(item);
    });

  section.append(heading, list);
  return section;
}

function buildAffectedPersons(
  diff: { added: string[]; removed: string[] },
  assertionsById: Record<string, AssertionRecord>,
): string[] {
  const persons = new Set<string>();

  [...diff.added, ...diff.removed].forEach((assertionId) => {
    const assertion = assertionsById[assertionId];
    if (!assertion) {
      return;
    }
    persons.add(assertion.subjectId);
    persons.add(assertion.objectId);
  });

  return Array.from(persons).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

function buildRelTypeCounts(
  assertionIds: string[],
  assertionsById: Record<string, AssertionRecord>,
): Record<string, number> {
  const counts: Record<string, number> = {};

  assertionIds.forEach((assertionId) => {
    const relType = getAssertionRelType(assertionsById[assertionId]);
    if (!relType) {
      return;
    }
    counts[relType] = (counts[relType] ?? 0) + 1;
  });

  return counts;
}

function findComparisonStats(
  layerStats: LayerStats | null,
  base: string,
  compare: string,
): Record<string, unknown> | null {
  if (!layerStats || !isRecord(layerStats)) {
    return null;
  }

  const candidates: Record<string, unknown>[] = [];

  const comparisons = layerStats.comparisons;
  if (Array.isArray(comparisons)) {
    comparisons.forEach((entry) => {
      if (isRecord(entry)) {
        candidates.push(entry);
      }
    });
  }

  const compareRecords = layerStats.compare;
  if (isRecord(compareRecords)) {
    Object.values(compareRecords).forEach((entry) => {
      if (isRecord(entry)) {
        candidates.push(entry);
      }
    });
  }

  for (const entry of candidates) {
    const baseValue =
      readString(entry, ['base', 'a', 'layerA', 'layer_a']) ?? '';
    const compareValue =
      readString(entry, ['compare', 'b', 'layerB', 'layer_b']) ?? '';
    if (baseValue === base && compareValue === compare) {
      return entry;
    }
  }

  return null;
}

function parsePersonList(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const persons: string[] = [];

  value.forEach((entry) => {
    if (typeof entry === 'string') {
      persons.push(entry);
    } else if (isRecord(entry)) {
      const id = readString(entry, ['id', 'personId', 'person_id']);
      if (id) {
        persons.push(id);
      }
    }
  });

  return persons.length > 0
    ? persons.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    : null;
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
      const key = readString(entry, ['rel', 'relType', 'predicate', 'type']);
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
