import './style.css';
import { loadAssertionsById } from './data/loadAssertionsById';
import { loadAssertionsByLayer } from './data/loadAssertionsByLayer';
import { loadAssertionsByPerson } from './data/loadAssertionsByPerson';
import { loadLayersMeta } from './data/loadLayersMeta';
import { loadLayerStats } from './data/loadLayerStats';
import { loadManifest } from './data/loadManifest';
import { loadNarrativeLayers } from './data/loadNarrativeLayers';
import { loadPersons } from './data/loadPersons';
import { buildLayerDefinitions } from './utils/layers';
import { renderLayerCompareView } from './views/layer-compare';
import { renderLayerDiagnosticsView } from './views/layer-diagnostics';
import { renderManifestApp } from './views/manifest-app';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

const header = document.createElement('header');
const title = document.createElement('h1');
const subtitle = document.createElement('p');

header.className = 'site-header';

title.textContent = 'Psellos Web';
subtitle.textContent =
  'Static explorer for compiled prosopographical data from psellos-builder.';

header.append(title, subtitle);

const status = document.createElement('p');
status.className = 'status';
status.textContent = 'Loading artifacts...';

const navigation = document.createElement('nav');
navigation.className = 'site-nav';

const main = document.createElement('main');
main.className = 'site-main';

app.append(header, status, navigation, main);

Promise.all([
  loadManifest(),
  loadPersons(),
  loadAssertionsById(),
  loadAssertionsByLayer(),
  loadAssertionsByPerson().catch((error) => {
    console.warn('Failed to load assertions_by_person; continuing.', error);
    return null;
  }),
  loadLayersMeta(),
  loadLayerStats(),
])
  .then(
    async ([
      manifest,
      persons,
      assertionsById,
      assertionsByLayer,
      assertionsByPerson,
      layersMeta,
      layerStats,
    ]) => {
      const narrativeLayers = await loadNarrativeLayers(assertionsByLayer);
      const layerDefinitions = buildLayerDefinitions(narrativeLayers, layersMeta);
      status.textContent = 'Loaded artifacts.';

      const content = document.createElement('div');
      content.className = 'site-content';
      main.append(content);

      const views = [
        {
          id: 'manifest',
          label: 'Manifest overview',
          render: () =>
            renderManifestApp(
              manifest,
              persons,
              assertionsByPerson,
              assertionsById,
              assertionsByLayer,
              layerDefinitions,
            ),
        },
        {
          id: 'compare-layers',
          label: 'Compare layers',
          render: () =>
            renderLayerCompareView(
              assertionsByLayer,
              assertionsById,
              layerDefinitions,
              layerStats,
            ),
        },
        {
          id: 'diagnostics',
          label: 'Diagnostics',
          render: () =>
            renderLayerDiagnosticsView(
              layerDefinitions,
              assertionsByLayer,
              assertionsById,
              assertionsByPerson,
              persons,
              layerStats,
            ),
        },
      ] as const;

      const renderNavigation = (currentView: string) => {
        const list = document.createElement('ul');
        list.className = 'site-nav__list';
        views.forEach((view) => {
          const item = document.createElement('li');
          const link = document.createElement('a');
          link.href = buildViewUrl(view.id);
          link.textContent = view.label;
          if (view.id === currentView) {
            link.setAttribute('aria-current', 'page');
          }
          link.addEventListener('click', (event) => {
            event.preventDefault();
            navigateToView(view.id);
          });
          item.append(link);
          list.append(item);
        });
        navigation.replaceChildren(list);
      };

      const renderView = () => {
        const currentView = resolveView();
        renderNavigation(currentView);
        const view =
          views.find((entry) => entry.id === currentView) ?? views[0];
        content.replaceChildren(view.render());
      };

      const navigateToView = (viewId: string) => {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('view', viewId);
          window.history.pushState({}, '', url);
        } catch {
          // Ignore navigation if URL APIs are unavailable.
        }
        renderView();
      };

      window.addEventListener('popstate', renderView);
      renderView();
    },
  )
  .catch((error: Error) => {
    status.textContent = 'Failed to load artifacts.';

    const errorMessage = document.createElement('pre');
    errorMessage.textContent = error.message;
    errorMessage.className = 'error';
    main.append(errorMessage);
  });

function resolveView(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') ?? 'manifest';
  } catch {
    return 'manifest';
  }
}

function buildViewUrl(viewId: string): string {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('view', viewId);
    return url.toString();
  } catch {
    return `?view=${encodeURIComponent(viewId)}`;
  }
}
