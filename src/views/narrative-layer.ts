import type { ProsopographyData } from '../data/prosopography';

export function renderNarrativeLayerToggle(data: ProsopographyData): HTMLElement {
  const section = document.createElement('section');
  section.className = 'view';

  const heading = document.createElement('h2');
  heading.textContent = 'Narrative Layer Toggle';

  const description = document.createElement('p');
  description.textContent =
    'UI stub for enabling or disabling narrative layers. No filtering is applied yet.';

  const toggleWrapper = document.createElement('div');
  const toggleLabel = document.createElement('label');
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.disabled = true;
  toggleLabel.append(toggleInput, ' Enable narrative overlays');

  toggleWrapper.append(toggleLabel);

  const metadata = document.createElement('p');
  metadata.textContent = `Available narrative layers: ${data.narratives.length}`;

  const todo = document.createElement('p');
  todo.className = 'todo';
  todo.textContent =
    'TODO: connect narrative layer toggles to builder-provided narrative definitions.';

  section.append(heading, description, toggleWrapper, metadata, todo);
  return section;
}
