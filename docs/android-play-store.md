# Atelier Pro - Android / Play Store

## Architecture de mise a jour

Atelier Pro Android est une application Capacitor qui **embarque le frontend compile** dans l'APK/AAB.
Le serveur de production et la PWA peuvent etre mis a jour sans modifier automatiquement les fichiers web deja integres dans une APK installee.

Cela signifie qu'une modification Vue/CSS/JS destinee a Android exige une nouvelle release Android :

1. compiler le frontend avec le mode `android` ;
2. synchroniser le build dans Capacitor ;
3. verifier que les assets Capacitor sont identiques au build Vite ;
4. produire un nouvel APK/AAB ;
5. installer ou publier cette nouvelle version.

La chaine automatisee de ce depot realise maintenant les etapes 1 a 4 et **arrete le build si les assets Android sont obsoletes**.

## URL API obligatoire

Creer `frontend/.env.android` a partir de `frontend/.env.android.production.example` :

```env
VITE_API_BASE_URL=https://api.ton-domaine-production.com/api
```

Le build Android refuse :

- une URL relative comme `/api` ;
- HTTP ;
- `localhost`, `127.0.0.1`, `0.0.0.0` ou `::1`.

Le fichier `.env.android` n'est pas versionne dans Git.

## Version Android

La version distribuee est definie dans :

`frontend/android/version.properties`

Exemple :

```properties
VERSION_CODE=2
VERSION_NAME=1.1.0
```

`VERSION_CODE` doit etre augmente avant chaque nouvelle version publiee sur Google Play.
`VERSION_NAME` est la version lisible par l'utilisateur.

Gradle lit directement ce fichier ; il n'est donc plus necessaire de modifier manuellement `app/build.gradle` a chaque release.

## Commandes recommandees

Depuis `frontend` :

```powershell
npm run android:prepare
```

Cette commande :

- valide l'URL API Android ;
- execute le build Vite Android ;
- genere `dist/atelierpro-release.json` avec l'identite de la release et l'empreinte du frontend ;
- execute `cap sync android` ;
- compare chaque fichier de `dist` avec sa copie Capacitor par SHA-256.

Pour produire directement l'APK debug avec toutes ces protections :

```powershell
npm run android:apk
```

APK attendu :

`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

Pour Play Store :

```powershell
npm run android:aab
```

La commande AAB refuse de continuer si `frontend/android/keystore.properties` n'existe pas ou si le working tree Git contient des modifications non commitees.

AAB attendu :

`frontend/android/app/build/outputs/bundle/release/app-release.aab`

Pour verifier uniquement qu'un build deja synchronise correspond encore a `dist` :

```powershell
npm run android:verify-assets
```

## Preuve de provenance embarquee

Le build ajoute `atelierpro-release.json` aux assets web embarques. Il contient notamment :

- `versionCode` ;
- `versionName` ;
- commit Git lorsque disponible et indicateur `gitDirty` ;
- URL API utilisee ;
- empreinte SHA-256 agregee des assets web ;
- nombre de fichiers web.

Cette preuve permet de distinguer une APK recente d'une APK contenant encore un ancien frontend.

## Avant publication Play Store

- verifier que `VERSION_CODE` est superieur a celui deja publie ;
- verifier l'URL HTTPS de production dans `.env.android` ;
- conserver le keystore de release hors Git et sauvegarde de maniere sure ;
- executer les tests frontend/backend et le build Android ;
- tester l'APK/AAB sur un vrai telephone Android ;
- verifier connexion, mode hors ligne, Mon compte, themes Clair/Sombre/Systeme et page de demarrage ;
- publier l'AAB seulement apres validation de la branche de release.
