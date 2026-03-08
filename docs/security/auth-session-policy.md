# Politique Officielle de Session d'Authentification

## Objet

Ce document fige la politique officielle d'authentification et de session du projet Atelier.

Il a pour but d'eviter toute evolution future qui introduirait une expiration visible des sessions utilisateur ou une reconnexion forcee non voulue.

## Principe Metier Fondamental

Un utilisateur reste connecte tant qu'il ne se deconnecte pas lui-meme.

Le temps ne doit pas, a lui seul, provoquer une reconnexion visible.

## Justification UX Metier

L'application Atelier est un ERP metier pour atelier de couture. Les utilisateurs travaillent sur des operations longues, repetitives et quotidiennes. Une reconnexion imposee par le temps degrade fortement l'usage:

- interruption du travail en cours
- perte de fluidite a la caisse ou en production
- incomprehension fonctionnelle pour des utilisateurs non techniques
- risque d'erreurs operatoires en contexte metier

La session doit donc etre persistante, simple et previsible.

## Politique Officielle

### Regle generale

Une session reste valide tant que:

- la session existe
- la session n'est pas revoquee
- l'utilisateur est actif

### Causes autorisees de deconnexion

Les seules causes autorisees de perte de session sont:

- deconnexion volontaire de l'utilisateur
- revocation administrative d'une session
- revocation de toutes les sessions d'un utilisateur
- desactivation du compte utilisateur
- suppression explicite de la session

### Cause interdite

Une session ne doit jamais devenir invalide uniquement a cause du temps, si cela produit un effet visible cote utilisateur.

## Regles d'Architecture

### Domaine

Le domaine doit raisonner en termes de:

- `Utilisateur`
- `SessionUtilisateur`
- session `active`
- session `revoquee`

Le domaine ne doit pas imposer une expiration UX basee uniquement sur le temps.

### Application

Les cas d'usage cibles compatibles avec cette politique sont:

- `seConnecter`
- `seDeconnecter`
- `revoquerSession`
- `revoquerToutesLesSessions`
- `verifierSessionPersistante`

Tout futur cas d'usage de securite doit respecter la persistance de session cote utilisateur.

### Infrastructure

L'infrastructure peut utiliser:

- cookies persistants
- tokens techniques
- stockage serveur de session
- validations techniques internes

Mais ces mecanismes ne doivent pas provoquer de reconnexion visible tant qu'une session valide peut etre restauree automatiquement.

Les expirations purement techniques sont autorisees seulement si elles sont renouvelees automatiquement sans impact UX.

### Interface Utilisateur

Le comportement attendu est:

- si la session est valide, l'utilisateur accede directement a l'application
- si le token technique doit etre renouvele, cela se fait automatiquement
- si la session est revoquee ou le compte desactive, l'utilisateur retourne a l'ecran de connexion

## Comportements Interdits

Ne jamais introduire:

- expiration visible des sessions
- redirection automatique vers login a cause du temps
- access token expirant qui deconnecte visiblement l'utilisateur
- refresh token avec expiration UX visible
- reconnexion forcee quotidienne
- logique frontend qui vide la session uniquement parce qu'un delai est depasse

## Regle de Compatibilite Pour Les Evolutions Futures

Toute evolution auth/session doit repondre a cette question:

"Un utilisateur encore actif, avec une session non revoquee, peut-il etre renvoye au login uniquement a cause du temps ?"

Si la reponse est oui, l'evolution ne respecte pas la politique officielle.

## Lecture du Code Actuel

Le code actuel suit globalement cette politique:

- le frontend tente de restaurer automatiquement la session via `/auth/refresh`
- les appels API retentent un refresh automatiquement en cas de `401`
- la session serveur reste valide tant qu'elle existe et n'est pas revoquee
- la deconnexion visible survient surtout sur revocation, compte inactif, absence de session, ou suppression des supports de session

## Points de Vigilance Pour Le Futur

Les zones qui pourraient casser cette politique sont:

- ajout d'un `exp` strict sur les access tokens sans renouvellement transparent
- ajout d'une expiration courte sur les sessions serveur ou refresh tokens avec effet UX
- suppression du mecanisme de refresh automatique cote frontend
- nettoyage automatique du stockage local sans verification de session serveur
- changement de `/auth/refresh` pour imposer une reconnexion visible apres un delai
- introduction d'une regle "une reconnexion par jour"

## Decision Projet

La politique officielle du projet Atelier est donc la suivante:

> Un utilisateur actif reste connecte tant qu'il ne se deconnecte pas lui-meme, tant que sa session n'est pas revoquee ou explicitement supprimee.

Cette regle doit etre preservee dans toute future evolution du module securite et du futur passage au multi-tenant.
