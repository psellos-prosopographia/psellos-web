import type { ProsopographyData } from '../data/prosopography';

export function renderEntityEncyclopedia(data: ProsopographyData): HTMLElement {
  const section = document.createElement('section');
  section.className = 'view';

  const heading = document.createElement('h2');
  heading.textContent = 'Entity Encyclopedia';

  const description = document.createElement('p');
  description.textContent =
    'Placeholder for entity encyclopedia content. Entities will be listed and searchable here.';

  const metadata = document.createElement('p');
  metadata.textContent = `Loaded entities: ${data.entities.length}`;

  const todo = document.createElement('p');
  todo.className = 'todo';
  todo.textContent =
    'TODO: map psellos-builder entity fields into encyclopedia cards (names, roles, sources).';

  section.append(heading, description, metadata, todo);
  return section;
}
