import type { LayerDefinition } from '../utils/layers';
import { formatLayerLabel } from '../utils/layers';

function isMissingLayer(layers: string[], selectedLayer: string): boolean {
  return selectedLayer !== '' && !layers.includes(selectedLayer);
}

export function renderNarrativeLayerToggle(
  layers: LayerDefinition[],
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

  const layerIds = layers.map((layer) => layer.id);
  if (selectedLayer !== '' && !layerIds.includes(selectedLayer)) {
    const option = document.createElement('option');
    option.value = selectedLayer;
    option.textContent = selectedLayer;
    select.append(option);
  }

  layers.forEach((layer) => {
    const option = document.createElement('option');
    option.value = layer.id;
    option.textContent = formatLayerLabel(layer);
    select.append(option);
  });

  const status = document.createElement('span');
  status.className = 'narrative-layer__status';

  const meta = document.createElement('div');
  meta.className = 'narrative-layer__meta';

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
    if (isMissingLayer(layerIds, layerId)) {
      status.textContent = `Current layer: ${layerId} (missing)`;
      status.hidden = false;
    } else {
      status.textContent = '';
      status.hidden = true;
    }
  };

  select.value = selectedLayer;
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

  label.append(select);
  wrapper.append(label, status, meta);

  return wrapper;
}
