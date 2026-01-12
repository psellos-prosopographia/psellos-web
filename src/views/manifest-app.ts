import type { AssertionRecord } from '../data/loadAssertionsById';
import type { AssertionsByLayer } from '../data/loadAssertionsByLayer';
import type { AssertionsByPerson } from '../data/loadAssertionsByPerson';
import type { Manifest } from '../data/loadManifest';
import type { PersonRecord } from '../data/loadPersons';
import { downloadBlob, downloadJson, downloadText, sanitizeLayerId } from '../utils/download';
import { getAssertionRelType, collectRelTypes } from '../utils/assertions';
import { computeDiff, sortAssertionIds } from '../utils/diff';
import { computeSha256Hex } from '../utils/hash';
import { formatLayerLabel, type LayerDefinition } from '../utils/layers';
import { createZipBlob } from '../utils/zip';
import { renderNarrativeLayerToggle } from './narrative-layer';
import { renderRelTypeFilter } from './rel-filter';

const LAYER_STORAGE_KEY = 'psellos.selectedLayer';
const LAYER_QUERY_PARAM = 'layer';
const REVIEW_QUERY_PARAM = 'review';

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
  let isReviewMode = readReviewModeFromUrl();

  const narrativeToggle = renderNarrativeLayerToggle(
    availableLayers,
    selectedLayer,
    (layerId) => {
      selectedLayer = layerId;
      persistLayerSelection(layerId);
      layerExports.update(layerId);
      updateReviewSummary(layerId);
      updateChangelog(layerId);
      render();
    },
  );

  const layerExports = createLayerExportControls(
    selectedLayer,
    assertionsByLayer,
    assertionsById,
    manifest,
    availableLayers,
  );

  const reviewToggle = createReviewModeToggle(isReviewMode, (enabled) => {
    isReviewMode = enabled;
    syncReviewParam(enabled);
    setReviewModeState(enabled);
  });

  const reviewPanel = document.createElement('section');
  reviewPanel.className = 'review-panel';

  const reviewSummary = document.createElement('div');
  reviewSummary.className = 'review-panel__summary';

  const reviewMeta = document.createElement('div');
  reviewMeta.className = 'review-panel__meta';

  const reviewLayerLabel = document.createElement('span');
  reviewLayerLabel.className = 'review-panel__layer';

  const reviewAssertionCount = document.createElement('span');
  reviewAssertionCount.className = 'review-panel__count';

  reviewMeta.append(reviewLayerLabel, reviewAssertionCount);
  reviewSummary.append(reviewMeta);

  const reviewExportsSlot = document.createElement('div');
  reviewExportsSlot.className = 'review-panel__exports';

  reviewPanel.append(reviewSummary, reviewExportsSlot);

  const layerExportsSlot = document.createElement('div');
  layerExportsSlot.append(layerExports.element);

  const changelogSection = createNarrativeChangelogSection(
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

  if (!isReviewMode) {
    console.info('[psellos-web] narrative layers', {
      availableLayers: availableLayers.map((layer) => layer.id),
      selectedLayer,
    });
  }

  const setReviewModeState = (enabled: boolean) => {
    document.body.classList.toggle('review-mode', enabled);
    reviewPanel.hidden = !enabled;
    if (enabled) {
      reviewExportsSlot.append(layerExports.element);
    } else {
      layerExportsSlot.append(layerExports.element);
    }
  };

  const updateReviewSummary = (layerId: string) => {
    const ids = sortAssertionIds(assertionsByLayer[layerId] ?? []);
    const layerDefinition = availableLayers.find((layer) => layer.id === layerId);
    const label = layerDefinition ? formatLayerLabel(layerDefinition) : layerId;
    reviewLayerLabel.textContent = `Layer: ${label || 'unknown'}`;
    reviewAssertionCount.textContent = `Assertions: ${ids.length}`;
  };

  const updateChangelog = (layerId: string) => {
    changelogSection.update(layerId);
  };

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

  updateReviewSummary(selectedLayer);
  updateChangelog(selectedLayer);
  setReviewModeState(isReviewMode);
  render();

  section.append(
    heading,
    reviewToggle,
    reviewPanel,
    narrativeToggle,
    layerExportsSlot,
    relFilter.element,
    changelogSection.element,
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
  manifest: Manifest,
  availableLayers: LayerDefinition[],
): { element: HTMLElement; update: (layerId: string) => void } {
  const container = document.createElement('section');
  container.className = 'layer-export';

  const heading = document.createElement('h3');
  heading.textContent = 'Layer exports';

  const description = document.createElement('p');
  description.className = 'layer-export__description';

  const hashRow = document.createElement('div');
  hashRow.className = 'layer-export__hash';

  const hashRowCurrent = document.createElement('div');
  hashRowCurrent.className = 'layer-export__hash-row';

  const hashLabel = document.createElement('span');
  hashLabel.textContent = 'Current narrative hash';

  const hashValue = document.createElement('code');
  hashValue.className = 'layer-export__hash-value';

  const hashCopyButton = document.createElement('button');
  hashCopyButton.type = 'button';
  hashCopyButton.textContent = 'Copy hash';
  hashCopyButton.addEventListener('click', () => {
    const currentHash = hashValue.textContent ?? '';
    if (!currentHash) {
      return;
    }
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(currentHash);
      return;
    }
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(hashValue);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });

  hashRowCurrent.append(hashLabel, hashValue, hashCopyButton);

  const hashRowId = document.createElement('div');
  hashRowId.className = 'layer-export__hash-row';

  const narrativeIdLabel = document.createElement('span');
  narrativeIdLabel.textContent = 'Canonical narrative ID';

  const narrativeIdValue = document.createElement('code');
  narrativeIdValue.className = 'layer-export__hash-value';

  const narrativeIdCopyButton = document.createElement('button');
  narrativeIdCopyButton.type = 'button';
  narrativeIdCopyButton.textContent = 'Copy ID';
  narrativeIdCopyButton.addEventListener('click', () => {
    const currentId = narrativeIdValue.textContent ?? '';
    if (!currentId) {
      return;
    }
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(currentId);
      return;
    }
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(narrativeIdValue);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });

  hashRowId.append(narrativeIdLabel, narrativeIdValue, narrativeIdCopyButton);

  hashRow.append(hashRowCurrent, hashRowId);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'layer-export__actions';

  const exportIdsButton = document.createElement('button');
  exportIdsButton.type = 'button';
  exportIdsButton.textContent = 'Export assertion IDs';

  const exportObjectsButton = document.createElement('button');
  exportObjectsButton.type = 'button';
  exportObjectsButton.textContent = 'Export assertion objects';

  const freezeButton = document.createElement('button');
  freezeButton.type = 'button';
  freezeButton.textContent = 'Freeze narrative';

  const exportCitationsButton = document.createElement('button');
  exportCitationsButton.type = 'button';
  exportCitationsButton.textContent = 'Export citation bundle';

  const exportBibtexButton = document.createElement('button');
  exportBibtexButton.type = 'button';
  exportBibtexButton.textContent = 'Export BibTeX';

  const exportCslButton = document.createElement('button');
  exportCslButton.type = 'button';
  exportCslButton.textContent = 'Export CSL-JSON';

  const exportChangelogButton = document.createElement('button');
  exportChangelogButton.type = 'button';
  exportChangelogButton.textContent = 'Export changelog vs canon';

  const exportBundleButton = document.createElement('button');
  exportBundleButton.type = 'button';
  exportBundleButton.textContent = 'Download publication bundle';

  const layerRef = { current: initialLayer };
  const freezeRecordsByLayer = new Map<string, FreezeRecord[]>();

  const freezeSection = document.createElement('div');
  freezeSection.className = 'layer-export__freezes';

  const freezeHeading = document.createElement('h4');
  freezeHeading.textContent = 'Frozen narratives';

  const freezeEmpty = document.createElement('p');
  freezeEmpty.className = 'layer-export__freezes-empty';
  freezeEmpty.textContent = 'No freezes recorded for this layer yet.';

  const freezeList = document.createElement('ul');
  freezeList.className = 'layer-export__freezes-list';

  freezeSection.append(freezeHeading, freezeEmpty, freezeList);

  const updateDescription = (layerId: string) => {
    description.textContent = `Export data for layer: ${layerId || 'unknown'}. Freeze hashes are based on sorted assertion IDs. Canonical narrative IDs use psellos:<layer>@<hash>.`;
  };

  const buildAssertionIds = (layerId: string) =>
    sortAssertionIds(assertionsByLayer[layerId] ?? []);

  const buildArtifactVersions = () => {
    const versions: Record<string, string> = {
      spec: manifest.spec_version,
    };
    if (manifest.builder_version) {
      versions.builder = manifest.builder_version;
    }
    return versions;
  };

  const resolveLayerDefinition = (layerId: string) =>
    availableLayers.find((layer) => layer.id === layerId);

  const buildNarrativeId = (layerId: string, hash: string) =>
    `psellos:${layerId}@${hash}`;

  const resolveLayerTitle = (layerId: string) => {
    const definition = resolveLayerDefinition(layerId);
    const label = definition ? formatLayerLabel(definition) : layerId;
    return `Narrative layer: ${label || 'unknown'}`;
  };

  const resolveLayerAbstract = (layerId: string) => {
    const definition = resolveLayerDefinition(layerId);
    return definition?.description;
  };

  const resolveAuthorName = () => {
    const title = document.querySelector('h1')?.textContent?.trim();
    return title || 'Psellos';
  };

  const resolveBaseUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return undefined;
    }
  };

  const buildFreezeRecord = (
    layerId: string,
    ids: string[],
    hash: string,
  ): FreezeRecord => {
    const generatedAt = new Date().toISOString();
    return {
      layer: layerId,
      hash,
      narrative_id: buildNarrativeId(layerId, hash),
      generated_at: generatedAt,
      assertion_count: ids.length,
      assertion_ids: ids,
      artifact_versions: buildArtifactVersions(),
    };
  };

  const buildFreezePayload = (record: FreezeRecord) => ({
    layer: record.layer,
    hash: record.hash,
    narrative_id: record.narrative_id,
    generated_at: record.generated_at,
    assertion_count: record.assertion_count,
    assertion_ids: record.assertion_ids,
    artifact_versions: record.artifact_versions,
  });

  const buildCitationBundle = (
    layerId: string,
    ids: string[],
    hash: string,
  ) => {
    const assertions = ids
      .map((id) => buildAssertionSummary(id, assertionsById))
      .filter((entry): entry is AssertionSummary => Boolean(entry));
    return {
      layer: layerId,
      hash,
      narrative_id: buildNarrativeId(layerId, hash),
      assertions,
    };
  };

  const buildBibtex = (record: FreezeRecord) => {
    const author = resolveAuthorName();
    const year = new Date(record.generated_at).getUTCFullYear();
    const url = resolveBaseUrl();
    const lines = [
      `@dataset{psellos_${sanitizeLayerId(record.layer)}_${record.hash},`,
      `  title = {${resolveLayerTitle(record.layer)}},`,
      `  author = {${author}},`,
      `  year = {${year}},`,
      `  version = {${record.hash}},`,
    ];
    if (url) {
      lines.push(`  url = {${url}},`);
    }
    lines.push(
      `  note = {Psellos narrative freeze; Identifier: ${record.narrative_id}}`,
      `}`,
    );
    return `${lines.join('\n')}\n`;
  };

  const buildCslJson = (record: FreezeRecord) => {
    const author = resolveAuthorName();
    const year = new Date(record.generated_at).getUTCFullYear();
    const url = resolveBaseUrl();
    const abstract = resolveLayerAbstract(record.layer);
    const payload: Record<string, unknown> = {
      id: record.narrative_id,
      type: 'dataset',
      title: resolveLayerTitle(record.layer),
      author: [{ literal: author }],
      issued: { 'date-parts': [[year]] },
      version: record.hash,
    };
    if (url) {
      payload.URL = url;
    }
    if (abstract) {
      payload.abstract = abstract;
    }
    return payload;
  };

  const downloadPublicationBundle = (
    record: FreezeRecord,
    changelog: ReturnType<typeof computeDiff> | null,
  ) => {
    const layerId = record.layer;
    const sanitizedLayer = sanitizeLayerId(layerId);
    const freezePayload = buildFreezePayload(record);
    const citationBundle = buildCitationBundle(
      layerId,
      record.assertion_ids,
      record.hash,
    );
    const bundleEntries = [
      {
        name: `narrative_freeze_${sanitizedLayer}_${record.hash}.json`,
        data: JSON.stringify(freezePayload, null, 2),
      },
      {
        name: `citations_${sanitizedLayer}_${record.hash}.json`,
        data: JSON.stringify(citationBundle, null, 2),
      },
      {
        name: `narrative_${sanitizedLayer}_${record.hash}.bib`,
        data: buildBibtex(record),
      },
      {
        name: `narrative_${sanitizedLayer}_${record.hash}.csl.json`,
        data: JSON.stringify(buildCslJson(record), null, 2),
      },
    ];
    if (changelog) {
      const added = changelog.added
        .map((id) => buildAssertionSummary(id, assertionsById))
        .filter((entry): entry is AssertionSummary => Boolean(entry));
      const removed = changelog.removed
        .map((id) => buildAssertionSummary(id, assertionsById))
        .filter((entry): entry is AssertionSummary => Boolean(entry));
      bundleEntries.push({
        name: `narrative_changelog_${sanitizedLayer}_vs_canon.json`,
        data: JSON.stringify(
          {
            layer: layerId,
            base: 'canon',
            narrative_id: record.narrative_id,
            added,
            removed,
          },
          null,
          2,
        ),
      });
    }
    const zipBlob = createZipBlob(bundleEntries);
    downloadBlob(
      `publication_bundle_${sanitizedLayer}_${record.hash}.zip`,
      zipBlob,
    );
  };

  const updateHashRef = async (layerId: string, ids: string[]) => {
    hashValue.textContent = 'Computing hash…';
    narrativeIdValue.textContent = '';
    const requestId = `${layerId}:${ids.length}`;
    hashValue.dataset.requestId = requestId;
    const hash = await computeSha256Hex(JSON.stringify(ids));
    if (layerRef.current !== layerId || hashValue.dataset.requestId !== requestId) {
      return;
    }
    hashValue.textContent = hash;
    narrativeIdValue.textContent = buildNarrativeId(layerId, hash);
  };

  const renderFreezeList = (layerId: string) => {
    const records = freezeRecordsByLayer.get(layerId) ?? [];
    freezeList.replaceChildren();
    freezeEmpty.hidden = records.length > 0;
    records.forEach((record) => {
      const item = document.createElement('li');
      item.className = 'layer-export__freeze-item';

      const meta = document.createElement('div');
      meta.className = 'layer-export__freeze-meta';
      meta.textContent = `Frozen at ${record.generated_at} • ${record.assertion_count} assertions`;

      const hashBlock = document.createElement('code');
      hashBlock.className = 'layer-export__freeze-hash';
      hashBlock.textContent = record.hash;

      const idBlock = document.createElement('code');
      idBlock.className = 'layer-export__freeze-hash';
      idBlock.textContent = record.narrative_id;

      const actionRow = document.createElement('div');
      actionRow.className = 'layer-export__freeze-actions';

      const downloadFreezeButton = document.createElement('button');
      downloadFreezeButton.type = 'button';
      downloadFreezeButton.textContent = 'Download freeze JSON';
      downloadFreezeButton.addEventListener('click', () => {
        const filename = `assertions_${sanitizeLayerId(record.layer)}_freeze_${record.hash}.json`;
        downloadJson(filename, buildFreezePayload(record));
      });

      const downloadBibtexButton = document.createElement('button');
      downloadBibtexButton.type = 'button';
      downloadBibtexButton.textContent = 'Export BibTeX';
      downloadBibtexButton.addEventListener('click', () => {
        const filename = `narrative_${sanitizeLayerId(record.layer)}_${record.hash}.bib`;
        downloadText(filename, buildBibtex(record), 'application/x-bibtex');
      });

      const downloadCslButton = document.createElement('button');
      downloadCslButton.type = 'button';
      downloadCslButton.textContent = 'Export CSL-JSON';
      downloadCslButton.addEventListener('click', () => {
        const filename = `narrative_${sanitizeLayerId(record.layer)}_${record.hash}.csl.json`;
        downloadJson(filename, buildCslJson(record));
      });

      const downloadBundleButton = document.createElement('button');
      downloadBundleButton.type = 'button';
      downloadBundleButton.textContent = 'Download publication bundle';
      downloadBundleButton.addEventListener('click', () => {
        const changelog =
          record.layer === 'canon'
            ? null
            : computeDiff(assertionsByLayer, 'canon', record.layer);
        downloadPublicationBundle(record, changelog);
      });

      actionRow.append(
        downloadFreezeButton,
        downloadBibtexButton,
        downloadCslButton,
        downloadBundleButton,
      );

      item.append(meta, hashBlock, idBlock, actionRow);
      freezeList.append(item);
    });
  };

  const addFreezeRecord = (record: FreezeRecord) => {
    const records = freezeRecordsByLayer.get(record.layer) ?? [];
    freezeRecordsByLayer.set(record.layer, [...records, record]);
    if (layerRef.current === record.layer) {
      renderFreezeList(record.layer);
      exportBibtexButton.disabled = false;
      exportCslButton.disabled = false;
      exportBundleButton.disabled = false;
    }
  };

  const getLatestFreezeRecord = (layerId: string) => {
    const records = freezeRecordsByLayer.get(layerId) ?? [];
    return records.at(-1);
  };

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

  freezeButton.addEventListener('click', () => {
    const layerId = layerRef.current;
    const ids = buildAssertionIds(layerId);
    freezeButton.disabled = true;
    hashValue.textContent = 'Computing hash…';
    narrativeIdValue.textContent = '';
    const requestId = `${layerId}:${ids.length}:freeze`;
    hashValue.dataset.requestId = requestId;
    void computeSha256Hex(JSON.stringify(ids)).then((hash) => {
      if (layerRef.current !== layerId || hashValue.dataset.requestId !== requestId) {
        freezeButton.disabled = false;
        return;
      }
      hashValue.textContent = hash;
      narrativeIdValue.textContent = buildNarrativeId(layerId, hash);
      const record = buildFreezeRecord(layerId, ids, hash);
      const filename = `assertions_${sanitizeLayerId(layerId)}_freeze_${hash}.json`;
      downloadJson(filename, buildFreezePayload(record));
      addFreezeRecord(record);
      freezeButton.disabled = false;
    });
  });

  exportCitationsButton.addEventListener('click', () => {
    const layerId = layerRef.current;
    const ids = buildAssertionIds(layerId);
    void computeSha256Hex(JSON.stringify(ids)).then((hash) => {
      const filename = `citations_${sanitizeLayerId(layerId)}.json`;
      downloadJson(filename, buildCitationBundle(layerId, ids, hash));
    });
  });

  exportBibtexButton.addEventListener('click', () => {
    const layerId = layerRef.current;
    const record = getLatestFreezeRecord(layerId);
    if (!record) {
      return;
    }
    const filename = `narrative_${sanitizeLayerId(layerId)}_${record.hash}.bib`;
    downloadText(filename, buildBibtex(record), 'application/x-bibtex');
  });

  exportCslButton.addEventListener('click', () => {
    const layerId = layerRef.current;
    const record = getLatestFreezeRecord(layerId);
    if (!record) {
      return;
    }
    const filename = `narrative_${sanitizeLayerId(layerId)}_${record.hash}.csl.json`;
    downloadJson(filename, buildCslJson(record));
  });

  exportChangelogButton.addEventListener('click', () => {
    const layerId = layerRef.current;
    if (layerId === 'canon') {
      return;
    }
    const diff = computeDiff(assertionsByLayer, 'canon', layerId);
    const added = diff.added
      .map((id) => buildAssertionSummary(id, assertionsById))
      .filter((entry): entry is AssertionSummary => Boolean(entry));
    const removed = diff.removed
      .map((id) => buildAssertionSummary(id, assertionsById))
      .filter((entry): entry is AssertionSummary => Boolean(entry));
    const ids = buildAssertionIds(layerId);
    void computeSha256Hex(JSON.stringify(ids)).then((hash) => {
      const filename = `narrative_changelog_${sanitizeLayerId(layerId)}_vs_canon.json`;
      downloadJson(filename, {
        layer: layerId,
        base: 'canon',
        narrative_id: buildNarrativeId(layerId, hash),
        added,
        removed,
      });
    });
  });

  exportBundleButton.addEventListener('click', () => {
    const layerId = layerRef.current;
    const record = getLatestFreezeRecord(layerId);
    if (!record) {
      return;
    }
    const changelog =
      layerId === 'canon' ? null : computeDiff(assertionsByLayer, 'canon', layerId);
    downloadPublicationBundle(record, changelog);
  });

  const update = (layerId: string) => {
    layerRef.current = layerId;
    updateDescription(layerId);
    exportChangelogButton.disabled = layerId === 'canon';
    const hasFreeze = (freezeRecordsByLayer.get(layerId) ?? []).length > 0;
    exportBibtexButton.disabled = !hasFreeze;
    exportCslButton.disabled = !hasFreeze;
    exportBundleButton.disabled = !hasFreeze;
    const ids = buildAssertionIds(layerId);
    void updateHashRef(layerId, ids);
    renderFreezeList(layerId);
  };

  update(initialLayer);

  buttonRow.append(
    exportIdsButton,
    exportObjectsButton,
    freezeButton,
    exportCitationsButton,
    exportBibtexButton,
    exportCslButton,
    exportBundleButton,
    exportChangelogButton,
  );
  container.append(heading, description, hashRow, buttonRow, freezeSection);

  return { element: container, update };
}

interface FreezeRecord {
  layer: string;
  hash: string;
  narrative_id: string;
  generated_at: string;
  assertion_count: number;
  assertion_ids: string[];
  artifact_versions: Record<string, string>;
}

interface AssertionSummary {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  rel: string | null;
  source?: unknown;
}

function buildAssertionSummary(
  assertionId: string,
  assertionsById: Record<string, AssertionRecord>,
): AssertionSummary | null {
  const assertion = assertionsById[assertionId];
  if (!assertion) {
    return null;
  }

  const summary: AssertionSummary = {
    id: assertionId,
    subject: assertion.subjectId,
    predicate: assertion.predicate,
    object: assertion.objectId,
    rel: getAssertionRelType(assertion),
  };

  if ('source' in assertion.raw) {
    summary.source = assertion.raw.source;
  }

  return summary;
}

function readReviewModeFromUrl(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(REVIEW_QUERY_PARAM);
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
}

function syncReviewParam(enabled: boolean): void {
  try {
    const url = new URL(window.location.href);
    if (enabled) {
      url.searchParams.set(REVIEW_QUERY_PARAM, '1');
    } else {
      url.searchParams.delete(REVIEW_QUERY_PARAM);
    }
    window.history.replaceState({}, '', url);
  } catch {
    // Ignore URL updates if unavailable.
  }
}

function createReviewModeToggle(
  initialValue: boolean,
  onChange: (enabled: boolean) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'review-toggle';

  const label = document.createElement('label');
  label.textContent = 'Review mode';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = initialValue;
  input.addEventListener('change', () => {
    onChange(input.checked);
  });

  label.prepend(input);
  wrapper.append(label);
  return wrapper;
}

function createNarrativeChangelogSection(
  initialLayer: string,
  assertionsByLayer: AssertionsByLayer,
  assertionsById: Record<string, AssertionRecord>,
): { element: HTMLElement; update: (layerId: string) => void } {
  const container = document.createElement('section');
  container.className = 'layer-changelog';

  const heading = document.createElement('h3');
  heading.textContent = 'Narrative changelog vs canon';

  const description = document.createElement('p');
  description.className = 'layer-changelog__description';

  const addedList = document.createElement('ul');
  addedList.className = 'layer-changelog__list';

  const removedList = document.createElement('ul');
  removedList.className = 'layer-changelog__list';

  const addedSection = document.createElement('section');
  const addedHeading = document.createElement('h4');
  addedHeading.textContent = 'Added assertions';
  addedSection.append(addedHeading, addedList);

  const removedSection = document.createElement('section');
  const removedHeading = document.createElement('h4');
  removedHeading.textContent = 'Removed assertions';
  removedSection.append(removedHeading, removedList);

  const update = (layerId: string) => {
    if (layerId === 'canon') {
      description.textContent =
        'Changelog is only available for non-canon layers.';
      addedList.replaceChildren();
      removedList.replaceChildren();
      return;
    }

    const diff = computeDiff(assertionsByLayer, 'canon', layerId);
    description.textContent = `Showing changes for ${layerId} vs canon.`;

    const renderList = (list: HTMLElement, ids: string[]) => {
      list.replaceChildren(
        ...ids.map((id) => {
          const summary = buildAssertionSummary(id, assertionsById);
          const item = document.createElement('li');
          if (!summary) {
            item.textContent = id;
            return item;
          }
          item.textContent = `${summary.id}: ${summary.subject} ${summary.predicate} ${summary.object}`;
          if (summary.rel) {
            item.textContent += ` (rel: ${summary.rel})`;
          }
          return item;
        }),
      );
    };

    renderList(addedList, diff.added);
    renderList(removedList, diff.removed);
  };

  update(initialLayer);

  container.append(heading, description, addedSection, removedSection);
  return { element: container, update };
}
