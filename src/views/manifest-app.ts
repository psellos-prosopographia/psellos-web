import type { AssertionRecord } from '../data/loadAssertionsById';
import type { AssertionsByLayer } from '../data/loadAssertionsByLayer';
import type { AssertionsByPerson } from '../data/loadAssertionsByPerson';
import type { Manifest } from '../data/loadManifest';
import type { PersonRecord } from '../data/loadPersons';
import { downloadJson, sanitizeLayerId } from '../utils/download';
import { getAssertionRelType, collectRelTypes } from '../utils/assertions';
import type { LayerDefinition } from '../utils/layers';
import { renderNarrativeLayerToggle } from './narrative-layer';
import { renderRelTypeFilter } from './rel-filter';

const LAYER_STORAGE_KEY = 'psellos.selectedLayer';
const LAYER_QUERY_PARAM = 'layer';

export function renderManifestApp(
  manifest: Manifest,
  persons: Record<string, PersonRecord>,
  assertionsByPerson: AssertionsByPerson | null,
  assertionsById: Record<string, AssertionRecord>,
  assertionsByLayer: AssertionsByLayer,
  availableLayers: LayerDefinition[],
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'view';

  const heading = document.createElement('h2');
  heading.textContent = 'Manifest Overview';

  const content = document.createElement('div');

  let selectedPersonId: string | null = null;
  let selectedLayer = resolveInitialLayerSelection();
  let selectedRelTypes: string[] = [];

  const narrativeToggle = renderNarrativeLayerToggle(
    availableLayers,
    selectedLayer,
    (layerId) => {
      selectedLayer = layerId;
      persistLayerSelection(layerId);
      layerExports.update(layerId);
      render();
    },
  );

  const layerExports = createLayerExportControls(
    selectedLayer,
    assertionsByLayer,
    assertionsById,
  );

  const relTypes = collectRelTypes(assertionsById);
  const relFilter = renderRelTypeFilter(
    relTypes,
    selectedRelTypes,
    (selection) => {
      selectedRelTypes = selection;
      render();
    },
    {
      label: 'Relationship type filter',
      description:
        'Show assertions only when their extensions.psellos.rel type matches.',
    },
  );

  console.info('[psellos-web] narrative layers', {
    availableLayers: availableLayers.map((layer) => layer.id),
    selectedLayer,
  });

  const render = () => {
    const allowedAssertionIds = new Set(
      assertionsByLayer[selectedLayer] ?? [],
    );
    const relTypeSet = new Set(selectedRelTypes);
    const isRelMatch = (assertionId: string) => {
      if (relTypeSet.size === 0) {
        return true;
      }
      const relType = getAssertionRelType(assertionsById[assertionId]);
      return relType !== null && relTypeSet.has(relType);
    };
    content.replaceChildren(
      selectedPersonId
        ? renderPersonDetailView(
            manifest,
            persons,
            assertionsByPerson,
            assertionsById,
            allowedAssertionIds,
            isRelMatch,
            selectedPersonId,
            (id) => {
              selectedPersonId = id;
              render();
            },
          )
        : renderHomeView(manifest, (id) => {
            selectedPersonId = id;
            render();
          }),
    );
  };

  render();

  section.append(
    heading,
    narrativeToggle,
    layerExports.element,
    relFilter.element,
    content,
  );
  return section;
}

function resolveInitialLayerSelection(): string {
  const fromUrl = readLayerFromUrl();
  if (fromUrl) {
    return fromUrl;
  }

  const fromStorage = readLayerFromStorage();
  if (fromStorage) {
    return fromStorage;
  }

  return 'canon';
}

function readLayerFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(LAYER_QUERY_PARAM);
  } catch {
    return null;
  }
}

function readLayerFromStorage(): string | null {
  try {
    return window.localStorage.getItem(LAYER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistLayerSelection(layerId: string): void {
  const updatedUrl = writeLayerToUrl(layerId);
  if (!updatedUrl) {
    writeLayerToStorage(layerId);
    return;
  }

  writeLayerToStorage(layerId);
}

function writeLayerToUrl(layerId: string): boolean {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(LAYER_QUERY_PARAM, layerId);
    window.history.replaceState({}, '', url);
    return true;
  } catch {
    return false;
  }
}

function writeLayerToStorage(layerId: string): void {
  try {
    window.localStorage.setItem(LAYER_STORAGE_KEY, layerId);
  } catch {
    // Ignore storage failures.
  }
}

function renderHomeView(
  manifest: Manifest,
  onSelect: (id: string) => void,
): HTMLElement {
  const container = document.createElement('div');

  const spec = document.createElement('p');
  spec.textContent = `Spec version: ${manifest.spec_version}`;

  const counts = document.createElement('p');
  counts.textContent = `Persons: ${manifest.counts.persons} · Assertions: ${manifest.counts.assertions}`;

  const listHeading = document.createElement('h3');
  listHeading.textContent = 'Persons';

  const list = document.createElement('ul');

  const entries = Object.entries(manifest.person_index).sort(([, a], [, b]) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No persons found in manifest.';
    container.append(spec, counts, listHeading, empty);
    return container;
  }

  entries.forEach(([id, displayName]) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${displayName} (${id})`;
    button.addEventListener('click', () => onSelect(id));
    item.append(button);
    list.append(item);
  });

  container.append(spec, counts, listHeading, list);
  return container;
}

function renderPersonDetailView(
  manifest: Manifest,
  persons: Record<string, PersonRecord>,
  assertionsByPerson: AssertionsByPerson | null,
  assertionsById: Record<string, AssertionRecord>,
  allowedAssertionIds: ReadonlySet<string>,
  isRelMatch: (assertionId: string) => boolean,
  personId: string,
  onSelect: (id: string | null) => void,
): HTMLElement {
  const container = document.createElement('div');

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.textContent = 'Back to list';
  backButton.addEventListener('click', () => onSelect(null));

  const heading = document.createElement('h3');
  heading.textContent = 'Person Detail';

  const person = persons[personId];
  const displayName =
    person?.name ??
    person?.label ??
    manifest.person_index[personId] ??
    'Unknown';

  const recordSection = document.createElement('section');
  const recordHeading = document.createElement('h4');
  recordHeading.textContent = 'Record';

  const recordList = document.createElement('dl');

  const addRecordRow = (label: string, value: string) => {
    const term = document.createElement('dt');
    term.textContent = label;
    const definition = document.createElement('dd');
    definition.textContent = value;
    recordList.append(term, definition);
  };

  addRecordRow('ID', personId);
  if (person?.type) {
    addRecordRow('Type', person.type);
  }
  if (person?.name || person?.label || displayName !== 'Unknown') {
    addRecordRow('Name', displayName);
  }

  if (!person) {
    addRecordRow('Note', 'Person record not found in persons.json');
  }

  recordSection.append(recordHeading, recordList);

  const relatedSection = document.createElement('section');
  const relatedHeading = document.createElement('h4');
  relatedHeading.textContent = 'Related assertions';

  const relatedList = document.createElement('ul');

  const relatedAssertionIds = assertionsByPerson?.[personId] ?? [];
  const relatedAssertions = relatedAssertionIds
    .filter(
      (assertionId) =>
        allowedAssertionIds.has(assertionId) && isRelMatch(assertionId),
    )
    .map((assertionId) => assertionsById[assertionId])
    .filter(
      (assertion): assertion is AssertionRecord => assertion !== undefined,
    );

  if (relatedAssertions.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = assertionsByPerson
      ? 'No related assertions found.'
      : 'Related assertions unavailable (missing assertions_by_person).';
    relatedSection.append(relatedHeading, empty);
  } else {
    relatedAssertions.forEach((assertion) => {
      const item = document.createElement('li');
      const otherId =
        assertion.subjectId === personId
          ? assertion.objectId
          : assertion.subjectId;
      const otherPerson = persons[otherId];
      const otherName =
        otherPerson?.name ??
        otherPerson?.label ??
        manifest.person_index[otherId] ??
        'Unknown';

      const predicateLine = document.createElement('div');
      predicateLine.textContent = `Predicate: ${assertion.predicate}`;

      const otherLine = document.createElement('div');
      otherLine.textContent = `Other party: ${otherName} (${otherId})`;

      item.append(predicateLine, otherLine);

      const relType = getAssertionRelType(assertion);
      if (relType) {
        const relLine = document.createElement('div');
        relLine.textContent = `Relationship type: ${relType}`;
        item.append(relLine);
      }

      const start = assertion.raw.start ?? assertion.raw.start_date;
      const end = assertion.raw.end ?? assertion.raw.end_date;

      if (start !== undefined || end !== undefined) {
        const timeLine = document.createElement('div');
        const startText = start !== undefined ? String(start) : 'unknown';
        const endText = end !== undefined ? String(end) : 'unknown';
        timeLine.textContent = `Time range: ${startText} – ${endText}`;
        item.append(timeLine);
      }

      relatedList.append(item);
    });

    relatedSection.append(relatedHeading, relatedList);
  }

  container.append(backButton, heading, recordSection, relatedSection);
  return container;
}

function createLayerExportControls(
  initialLayer: string,
  assertionsByLayer: AssertionsByLayer,
  assertionsById: Record<string, AssertionRecord>,
): { element: HTMLElement; update: (layerId: string) => void } {
  const container = document.createElement('section');
  container.className = 'layer-export';

  const heading = document.createElement('h3');
  heading.textContent = 'Layer exports';

  const description = document.createElement('p');
  description.className = 'layer-export__description';

  const buttonRow = document.createElement('div');
  buttonRow.className = 'layer-export__actions';

  const exportIdsButton = document.createElement('button');
  exportIdsButton.type = 'button';
  exportIdsButton.textContent = 'Export assertion IDs';

  const exportObjectsButton = document.createElement('button');
  exportObjectsButton.type = 'button';
  exportObjectsButton.textContent = 'Export assertion objects';

  const layerRef = { current: initialLayer };

  const updateDescription = (layerId: string) => {
    description.textContent = `Export data for layer: ${layerId || 'unknown'}`;
  };

  const buildAssertionIds = (layerId: string) =>
    sortAssertionIds(assertionsByLayer[layerId] ?? []);

  exportIdsButton.addEventListener('click', () => {
    const layerId = layerRef.current;
    const ids = buildAssertionIds(layerId);
    const filename = `assertions_${sanitizeLayerId(layerId)}.ids.json`;
    downloadJson(filename, ids);
  });

  exportObjectsButton.addEventListener('click', () => {
    const layerId = layerRef.current;
    const ids = buildAssertionIds(layerId);
    const objects = ids
      .map((id) => assertionsById[id])
      .filter((record): record is AssertionRecord => Boolean(record));
    const filename = `assertions_${sanitizeLayerId(layerId)}.json`;
    downloadJson(filename, objects);
  });

  const update = (layerId: string) => {
    layerRef.current = layerId;
    updateDescription(layerId);
  };

  update(initialLayer);

  buttonRow.append(exportIdsButton, exportObjectsButton);
  container.append(heading, description, buttonRow);

  return { element: container, update };
}

function sortAssertionIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}
