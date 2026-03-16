# Strategie Paiements Offline

## Objet

Ce document cadre la strategie recommandee pour la gestion des paiements en mode offline-first dans le frontend.

Dans cette version du projet, les paiements offline ne doivent pas etre synchronises automatiquement. La raison principale est l'absence de cle d'idempotence cote backend pour les endpoints de paiement.

L'objectif est de proteger la caisse, d'eviter les doubles encaissements et de fournir une base claire avant toute implementation future.

## Pourquoi les paiements offline automatiques sont dangereux

Un paiement n'est pas une simple donnee metier comme une commande ou une retouche. Il impacte directement la caisse et la comptabilite de l'atelier.

Sans cle d'idempotence backend, un meme paiement peut etre envoye plusieurs fois si :

- le frontend perd la connexion juste apres un envoi reussi mais avant de recevoir la reponse
- le navigateur ferme pendant la synchronisation
- un retry reseau rejoue la meme requete
- deux onglets ou deux terminaux essayent de rejouer la meme intention de paiement
- l'operateur relance manuellement une action deja envoyee

Dans ce contexte, un moteur d'auto-sync classique est dangereux, car il ne peut pas prouver qu'un paiement a deja ete comptabilise cote serveur.

## Invariants metier de la caisse

### Dependence a `idCaisseJour`

Les paiements actuels sont lies a une caisse journaliere via `idCaisseJour`.

Cela implique que :

- un paiement ne peut pas etre considere valide sans reference de caisse correcte
- la caisse ouverte au moment de la saisie offline doit encore etre coherente au moment de la reconnexion
- si `idCaisseJour` change, l'intention offline ne peut plus etre rejouee aveuglement

### Risque si la caisse change

Entre la saisie offline et la reconnexion, plusieurs situations peuvent se produire :

- la caisse du jour a ete cloturee
- une nouvelle caisse a ete ouverte
- l'utilisateur reconnecte n'est plus dans le meme contexte de caisse
- un autre terminal a deja saisi le paiement

Dans tous ces cas, rejouer automatiquement la requete initiale peut produire une incoherence comptable.

### Risque de double paiement

Le risque de double paiement est le risque principal.

Exemples :

- l'operateur encaisse en especes offline, puis le paiement est saisi une seconde fois a la reconnexion
- un autre poste enregistre deja le meme paiement pendant la coupure reseau
- le frontend rejoue une requete dont le serveur a deja applique l'effet

Sans mecanisme d'idempotence, le frontend ne peut pas garantir qu'un paiement n'a pas deja ete pris en compte.

## Strategie recommandee

La strategie recommandee est d'enregistrer offline une **payment intent** locale, et non un paiement comptable reel.

Une payment intent represente :

- l'intention de l'operateur d'enregistrer un paiement
- le contexte local connu au moment de la saisie
- un statut local en attente de verification humaine

Une payment intent ne doit pas :

- modifier automatiquement la caisse serveur
- etre consideree comme un paiement definitif
- etre auto-synchronisee sans validation operateur

## Flux recommande

### 1. Saisie offline

Quand il n'y a pas de connexion :

- l'utilisateur saisit un paiement
- le frontend enregistre une payment intent locale
- cette intention contient les informations utiles :
  - commande ou retouche cible
  - montant
  - mode de paiement
  - operateur
  - date locale
  - `idCaisseJour` connu localement au moment de la saisie
  - statut local du type `pending_confirmation`

Le frontend doit afficher clairement qu'il s'agit d'une intention de paiement non encore comptabilisee.

### 2. Reconnexion

Quand la connexion revient :

- le frontend recharge l'etat courant de la caisse
- il verifie si `idCaisseJour` de l'intention est encore valide
- il recharge l'etat metier de la commande ou de la retouche
- il prepare une vue de reconciliation pour l'operateur

A ce stade, aucun envoi automatique ne doit etre effectue.

### 3. Verification caisse

Le frontend doit controler au minimum :

- la caisse referencee est-elle encore ouverte
- `idCaisseJour` est-il identique a celui de la saisie offline
- la commande ou retouche existe-t-elle toujours
- le solde restant est-il toujours coherent
- un paiement similaire a-t-il deja ete enregistre entre-temps

Si une de ces verifications echoue, l'intention doit etre bloquee pour revue manuelle.

### 4. Confirmation manuelle operateur

Si les verifications sont favorables :

- le frontend affiche a l'operateur un recapitulatif
- l'operateur confirme explicitement l'enregistrement
- cette confirmation humaine devient la seule autorisation d'envoi

La decision finale ne doit pas etre prise par le moteur de synchronisation.

### 5. Envoi API unique

Apres confirmation :

- le frontend envoie une seule requete API
- il marque l'intention locale comme `processing`
- il attend le resultat serveur
- en succes, l'intention locale passe en `confirmed`
- en echec, elle passe en `blocked` ou revient en attente selon le type d'erreur

Le point cle est le suivant : **une payment intent ne doit jamais etre rejouee automatiquement sans revalidation operateur**.

## Cas particuliers

### Caisse fermee

Si la caisse referencee est cloturee :

- ne pas envoyer le paiement
- bloquer l'intention
- demander une decision operateur ou manager

Exemple de traitement :

- soit annuler l'intention
- soit demander une nouvelle saisie dans la caisse actuellement ouverte

### Caisse changee

Si `idCaisseJour` a change depuis la saisie offline :

- ne pas reaffecter automatiquement le paiement a la nouvelle caisse
- afficher un ecart clair a l'operateur
- exiger une confirmation manuelle explicite

Le changement de caisse modifie le contexte comptable. Il ne doit donc jamais etre traite comme un simple retry reseau.

### Paiement deja enregistre ailleurs

Si un paiement equivalent semble deja present :

- bloquer l'intention
- afficher les informations de rapprochement disponibles
- demander une validation humaine

Le frontend ne peut pas deviner de maniere fiable si deux paiements proches sont identiques ou distincts. Cette decision doit rester humaine.

## Pourquoi l'auto-sync paiement est desactive dans cette version

L'auto-sync des paiements est volontairement desactive dans cette version pour les raisons suivantes :

- absence de cle d'idempotence backend
- impact direct sur la caisse et la comptabilite
- forte sensibilite aux retries reseau
- risque eleve de double encaissement
- impossibilite de garantir une reconciliation automatique fiable entre plusieurs terminaux

En consequence :

- les commandes, retouches et photos peuvent suivre un modele offline-first automatise
- les paiements doivent suivre un modele plus strict, centre sur l'intention locale et la validation humaine

## Recommandation d'implementation future

Avant d'implementer les paiements offline, il est recommande de valider au minimum un des garde-fous suivants :

- ajouter une cle d'idempotence backend sur les endpoints de paiement
- ou mettre en place une reference de payment intent stable reconnue cote serveur
- ou imposer une interface de reconciliation manuelle avant tout envoi

Sans un de ces garde-fous, un paiement offline ne doit pas etre synchronise automatiquement.

## Conclusion

La bonne approche pour cette application est :

- offline-first pour les donnees metier classiques
- **manual-first** pour les paiements

Autrement dit :

- offline = enregistrement d'une intention
- reconnexion = verification
- validation operateur = autorisation d'envoi
- API = enregistrement unique du paiement reel

Cette separation limite fortement les risques comptables sans remettre en cause l'architecture backend existante.
