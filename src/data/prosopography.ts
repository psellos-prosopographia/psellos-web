export interface ProsopographyEntity {
  id: string;
  label: string;
  // TODO: align entity fields with psellos-builder output (titles, metadata, temporal data).
}

export interface ProsopographyRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  // TODO: align relationship attributes with psellos-builder output (confidence, citations).
}

export interface NarrativeLayer {
  id: string;
  label: string;
  // TODO: align narrative layer fields with psellos-builder output (scope, ordering).
}

export interface ProsopographyData {
  entities: ProsopographyEntity[];
  relationships: ProsopographyRelationship[];
  narratives: NarrativeLayer[];
}

export async function loadProsopographyData(): Promise<ProsopographyData> {
  // TODO: confirm artifact name(s) and path(s) from psellos-builder output bundle.
  const response = await fetch('/data/prosopography.json');

  if (!response.ok) {
    throw new Error(`Failed to load prosopography data: ${response.status}`);
  }

  // TODO: add runtime validation once builder schema is finalized.
  return (await response.json()) as ProsopographyData;
}
