import './style.css';
import { loadAssertionsById } from './data/loadAssertionsById';
import { loadAssertionsByLayer } from './data/loadAssertionsByLayer';
import { loadAssertionsByPerson } from './data/loadAssertionsByPerson';
import { loadManifest } from './data/loadManifest';
import { loadPersons } from './data/loadPersons';
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

const main = document.createElement('main');
main.className = 'site-main';

app.append(header, status, main);

Promise.all([
  loadManifest(),
  loadPersons(),
  loadAssertionsByPerson(),
  loadAssertionsById(),
  loadAssertionsByLayer(),
])
  .then(
    ([
      manifest,
      persons,
      assertionsByPerson,
      assertionsById,
      assertionsByLayer,
    ]) => {
    status.textContent = 'Loaded artifacts.';
    main.append(
      renderManifestApp(
        manifest,
        persons,
        assertionsByPerson,
        assertionsById,
        assertionsByLayer,
      ),
    );
  })
  .catch((error: Error) => {
    status.textContent = 'Failed to load artifacts.';

    const errorMessage = document.createElement('pre');
    errorMessage.textContent = error.message;
    errorMessage.className = 'error';
    main.append(errorMessage);
  });
