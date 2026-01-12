import './style.css';
import { loadProsopographyData } from './data/prosopography';
import { renderEntityEncyclopedia } from './views/entity-encyclopedia';
import { renderRelationshipGraph } from './views/relationship-graph';
import { renderNarrativeLayerToggle } from './views/narrative-layer';

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
status.textContent = 'Loading compiled data...';

const main = document.createElement('main');
main.className = 'site-main';

app.append(header, status, main);

loadProsopographyData()
  .then((data) => {
    status.textContent = 'Loaded compiled artifacts.';
    main.append(
      renderEntityEncyclopedia(data),
      renderRelationshipGraph(data),
      renderNarrativeLayerToggle(data),
    );
  })
  .catch((error: Error) => {
    status.textContent = 'Failed to load compiled artifacts.';

    const errorMessage = document.createElement('pre');
    errorMessage.textContent = error.message;
    errorMessage.className = 'error';
    main.append(errorMessage);
  });
