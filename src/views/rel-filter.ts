export interface RelTypeFilterControl {
  element: HTMLElement;
  getSelection: () => string[];
  setSelection: (selection: string[]) => void;
}

export function renderRelTypeFilter(
  relTypes: string[],
  initialSelection: string[],
  onChange: (selection: string[]) => void,
  options?: {
    label?: string;
    description?: string;
    emptyLabel?: string;
  },
): RelTypeFilterControl {
  const wrapper = document.createElement('section');
  wrapper.className = 'rel-filter';

  const heading = document.createElement('h3');
  heading.textContent = options?.label ?? 'Relationship types';

  const description = document.createElement('p');
  description.className = 'rel-filter__description';
  description.textContent =
    options?.description ??
    'Filter assertions by relationship type (extensions.psellos.rel).';

  const select = document.createElement('select');
  select.name = 'rel-types';
  select.multiple = true;
  select.size = Math.min(Math.max(relTypes.length, 3), 8);

  const emptyState = document.createElement('p');
  emptyState.className = 'rel-filter__empty';
  emptyState.textContent = options?.emptyLabel ?? 'No relationship types found.';

  if (relTypes.length === 0) {
    select.disabled = true;
    emptyState.hidden = false;
  } else {
    relTypes.forEach((relType) => {
      const option = document.createElement('option');
      option.value = relType;
      option.textContent = relType;
      select.append(option);
    });
    emptyState.hidden = true;
  }

  const buttonRow = document.createElement('div');
  buttonRow.className = 'rel-filter__actions';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.textContent = 'Clear selection';
  clearButton.disabled = relTypes.length === 0;

  const getSelection = (): string[] =>
    Array.from(select.selectedOptions).map((option) => option.value);

  const setSelection = (selection: string[]) => {
    const selectionSet = new Set(selection);
    Array.from(select.options).forEach((option) => {
      option.selected = selectionSet.has(option.value);
    });
  };

  setSelection(initialSelection);

  const notifyChange = () => {
    onChange(getSelection());
  };

  select.addEventListener('change', notifyChange);
  clearButton.addEventListener('click', () => {
    setSelection([]);
    notifyChange();
  });

  buttonRow.append(clearButton);
  wrapper.append(heading, description, select, emptyState, buttonRow);

  return { element: wrapper, getSelection, setSelection };
}
