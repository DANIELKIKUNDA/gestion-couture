# Changelog

## Auth (connexion / session)

- `4cac6fa` - Corrige le bug principal: l'atelier reste initialise apres redemarrage, et un compte inactif ne peut plus se connecter.
- `291b808` - Connexion persistante (pas de deconnexion automatique).
- `8936551` - Stabilise les connexions avec persistance Postgres.
- `af4ca62` - Restaure les gardes d'acces backend/frontend par role.
- `0d6ed67` - Rend les messages de connexion compréhensibles cote utilisateur.

## UI / UX

- `65cbf85` - Nouvelle page de connexion (version visuelle V3).
- `60cee18` - Remplace les popups natives par des modales/toasts plus propres.

## Securite (roles / permissions)

- `a8a2958` - Finalise la gestion dynamique des roles/permissions.
- `f1a2ce9` - Renforce les controles de securite sans casser la connexion persistante.

## Caisse

- `b7e157e` - Ajoute le resultat journalier et les types de depense (quotidienne/exceptionnelle), sans changer le solde global.
