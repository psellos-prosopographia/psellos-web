export function renderNarrativeLayerToggle(
  layers: string[],
  selectedLayer: string,
  onSelect: (layerId: string) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'narrative-layer';

  const label = document.createElement('label');
  label.textContent = 'Narrative layer ';

  const select = document.createElement('select');
  select.name = 'narrative-layer';
  select.setAttribute('aria-label', 'Narrative layer');

  layers.forEach((layerId) => {
    const option = document.createElement('option');
    option.value = layerId;
    option.textContent = layerId;
    select.append(option);
  });

  select.value = selectedLayer;
  select.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      onSelect(target.value);
    }
  });

  label.append(select);
  wrapper.append(label);

  return wrapper;
}
