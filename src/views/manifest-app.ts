import type { AssertionRecord } from '../data/loadAssertionsById';
import type { AssertionsByLayer } from '../data/loadAssertionsByLayer';
import type { AssertionsByPerson } from '../data/loadAssertionsByPerson';
import type { Manifest } from '../data/loadManifest';
import type { PersonRecord } from '../data/loadPersons';
import { renderNarrativeLayerToggle } from './narrative-layer';

export function renderManifestApp(
  manifest: Manifest,
  persons: Record<string, PersonRecord>,
  assertionsByPerson: AssertionsByPerson,
  assertionsById: Record<string, AssertionRecord>,
  assertionsByLayer: AssertionsByLayer,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'view';

  const heading = document.createElement('h2');
  heading.textContent = 'Manifest Overview';

  const content = document.createElement('div');

  let selectedPersonId: string | null = null;
  let selectedLayer = 'canon';

  const layerOptions = buildLayerOptions(assertionsByLayer);
  const narrativeToggle = renderNarrativeLayerToggle(
    layerOptions,
    selectedLayer,
    (layerId) => {
      selectedLayer = layerId;
      render();
    },
  );

  const render = () => {
    const allowedAssertionIds = new Set(
      assertionsByLayer[selectedLayer] ?? [],
    );
    content.replaceChildren(
      selectedPersonId
        ? renderPersonDetailView(
            manifest,
            persons,
            assertionsByPerson,
            assertionsById,
            allowedAssertionIds,
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

  section.append(heading, narrativeToggle, content);
  return section;
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
  assertionsByPerson: AssertionsByPerson,
  assertionsById: Record<string, AssertionRecord>,
  allowedAssertionIds: ReadonlySet<string>,
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

  const relatedAssertionIds = assertionsByPerson[personId] ?? [];
  const relatedAssertions = relatedAssertionIds
    .filter((assertionId) => allowedAssertionIds.has(assertionId))
    .map((assertionId) => assertionsById[assertionId])
    .filter(
      (assertion): assertion is AssertionRecord => assertion !== undefined,
    );

  if (relatedAssertions.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No related assertions found.';
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

function buildLayerOptions(assertionsByLayer: AssertionsByLayer): string[] {
  const layerIds = Object.keys(assertionsByLayer);
  if (layerIds.includes('canon')) {
    return ['canon', ...layerIds.filter((layerId) => layerId !== 'canon')];
  }
  return ['canon', ...layerIds];
}
