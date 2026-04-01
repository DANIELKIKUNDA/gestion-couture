# Tests E2E Playwright

Ce dossier contient la suite E2E Playwright d'AtelierPro.

## Installation

Depuis la racine du projet :

```bash
npm install
npm --prefix frontend install
npx playwright install chromium
```

Sous PowerShell Windows, utilise de preference :

```powershell
npm.cmd install
npm.cmd --prefix frontend install
npx.cmd playwright install chromium
```

## Lancer les tests en local

Mode standard :

```bash
npx playwright test
```

Ou via les scripts npm :

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:debug
npm run validate:local
```

En local, les helpers E2E demarrent automatiquement le backend (`:3000`) et le frontend Vite (`:5173`) si necessaire.

`npm run validate:local` execute :

- les tests backend
- le demarrage local backend + frontend si necessaire
- la suite Playwright complete

En CI, le build frontend est execute avant `npm run validate:local`.

Le hook Git `pre-push` appelle aussi `npm run validate:local`.

## Choisir une URL cible

Le frontend cible est configurable via `BASE_URL`.

Exemples :

```bash
BASE_URL=http://127.0.0.1:5173 npx playwright test
BASE_URL=https://staging.mon-app.com npx playwright test
```

Si l'API n'est pas servie sur la meme origine que le frontend cible, surcharge aussi l'URL API :

```bash
BASE_URL=https://staging.mon-app.com API_URL=https://api.staging.mon-app.com npx playwright test
```

Variables reconnues :

- `BASE_URL` : URL frontend cible
- `API_URL` : URL backend cible explicite
- `PLAYWRIGHT_HEADLESS=false` : lance le navigateur en mode visible

## Rapports et artefacts

Les epreuves sont conservees a l'echec :

- screenshots
- video
- trace Playwright

Le rapport HTML peut etre ouvert apres execution avec :

```bash
npx playwright show-report
```
