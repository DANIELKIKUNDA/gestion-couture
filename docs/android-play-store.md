# Atelier Pro - Android / Play Store

## Ce qui est deja pret

- Capacitor est installe dans `frontend`.
- Le projet Android natif est dans `frontend/android`.
- Identifiant application: `com.volcanotech.atelierpro`.
- Nom visible: `Atelier Pro`.
- Le build web Android passe avec `npm run build:android`.
- La synchronisation Capacitor passe avec `npm run cap:sync`.

## Point bloquant local actuel

Le build Android est bloque parce que les licences SDK ne sont pas encore acceptees et que les composants Android suivants doivent etre installes:

- Android SDK Platform 35
- Android SDK Build-Tools 34.0.0

Android Studio peut les installer via:

`Settings > Languages & Frameworks > Android SDK`

Puis accepter les licences SDK.

## URL API obligatoire pour Android

Dans une PWA web, `/api` peut fonctionner avec un proxy ou le serveur web.
Dans une application Android, il faut une URL backend publique.

Créer `frontend/.env.android` a partir de `frontend/.env.android.example`:

```env
VITE_API_BASE_URL=https://api.ton-domaine.com/api
```

Sans cette URL, l'application Android pourra s'ouvrir mais ne saura pas joindre le backend de production.

## Commandes

Depuis `frontend`:

```powershell
npm run build:android
npm run cap:sync
npm run android:apk
```

APK debug attendu:

`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

Pour Play Store, generer plutot un AAB release:

```powershell
npm run android:aab
```

AAB attendu:

`frontend/android/app/build/outputs/bundle/release/app-release.aab`

## Avant publication Play Store

- Remplacer les icones Android par le logo final VolcanoTech / Atelier Pro.
- Configurer une signature release.
- Incrementer `versionCode` et `versionName` dans `frontend/android/app/build.gradle`.
- Tester l'application sur un vrai telephone Android.
- Verifier que l'URL API de production est correcte.
