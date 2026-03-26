# Deploiement frontend sur Vercel

## Objectif
Deployer uniquement le frontend Vue/Vite sur Vercel sans casser :
- l'authentification
- le rafraichissement de session
- les routes SPA
- la PWA

## Configuration Vercel recommandee
- Framework Preset : `Vite`
- Root Directory : `frontend`
- Build Command : `npm run build`
- Output Directory : `dist`
- Install Command : `npm install`

## Variables d'environnement Vercel
Configurer au minimum :

```bash
VITE_API_BASE_URL=https://api.monatelier.com/api
VITE_CAISSE_USER=frontend
VITE_CAISSE_MODE_PAIEMENT=CASH
```

## Topologie recommandee
La version la plus propre en production est :

- frontend : `https://app.monatelier.com`
- backend : `https://api.monatelier.com`

Pourquoi :
- le frontend appelle une API publique stable
- les cookies de refresh restent dans le meme site applicatif
- le CORS backend reste simple a piloter

## Backend a aligner avant mise en ligne
Le backend doit autoriser l'origine Vercel/custom domain du frontend dans :

```bash
CORS_ALLOWED_ORIGINS=https://app.monatelier.com
```

Si tu testes d'abord sur une URL Vercel temporaire, ajoute-la aussi cote backend.

## Point important sur l'auth
Pour une version vraiment propre, evite de garder le frontend final sur une URL `*.vercel.app` si le backend reste sur un domaine totalement different.

La meilleure configuration est :
- frontend sur ton domaine final
- backend sur un sous-domaine API du meme domaine principal

Exemple :
- `app.monatelier.com`
- `api.monatelier.com`

## Routes SPA et PWA
Le fichier `frontend/vercel.json` couvre :
- la reecriture SPA vers `index.html`
- le cache prudent de `index.html`
- le non-cache du service worker

## Checklist avant production
1. Importer le repo dans Vercel
2. Definir `frontend` comme `Root Directory`
3. Ajouter les variables d'environnement Vercel
4. Deployer
5. Ajouter l'URL Vercel/custom domain dans `CORS_ALLOWED_ORIGINS` du backend
6. Verifier :
   - login
   - refresh session
   - commandes
   - retouches
   - dashboard
   - upload photo
   - PWA update

## Verdict
Si tu veux un deploiement Vercel vraiment pro :
- frontend sur Vercel
- backend sur domaine public stable
- `VITE_API_BASE_URL` absolu
- custom domain frontend de preference
