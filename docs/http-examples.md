# HTTP Examples (BC Commandes)

Create a commande

```bash
curl -X POST http://localhost:3000/api/commandes \
  -H "Content-Type: application/json" \
  -d '{
    "idCommande": "CMD-1",
    "idClient": "CL-1",
    "descriptionCommande": "Robe simple",
    "datePrevue": "2026-02-15T10:00:00Z",
    "montantTotal": 100
  }'
```

Start work

```bash
curl -X POST http://localhost:3000/api/commandes/CMD-1/demarrer \
  -H "Content-Type: application/json" \
  -d '{
    "parametresAtelier": { "avanceObligatoireCommande": true, "avanceMinimum": 30 }
  }'
```

Finish work

```bash
curl -X POST http://localhost:3000/api/commandes/CMD-1/terminer
```

Apply payment

```bash
curl -X POST http://localhost:3000/api/commandes/CMD-1/paiements \
  -H "Content-Type: application/json" \
  -d '{ "montant": 100 }'
```

Deliver

```bash
curl -X POST http://localhost:3000/api/commandes/CMD-1/livrer
```

Cancel (if not delivered)

```bash
curl -X POST http://localhost:3000/api/commandes/CMD-1/annuler
```

# HTTP Examples (BC Retouches)

Create a retouche

```bash
curl -X POST http://localhost:3000/api/retouches \
  -H "Content-Type: application/json" \
  -d '{
    "idRetouche": "RET-1",
    "idClient": "CL-1",
    "descriptionRetouche": "Ourlet pantalon",
    "typeRetouche": "OURLET",
    "datePrevue": "2026-02-15T10:00:00Z",
    "montantTotal": 50
  }'
```

Start work

```bash
curl -X POST http://localhost:3000/api/retouches/RET-1/demarrer \
  -H "Content-Type: application/json" \
  -d '{
    "parametresAtelier": { "avanceObligatoireRetouche": true, "avanceMinimum": 10 }
  }'
```

Finish work

```bash
curl -X POST http://localhost:3000/api/retouches/RET-1/terminer
```

Apply payment

```bash
curl -X POST http://localhost:3000/api/retouches/RET-1/paiements \
  -H "Content-Type: application/json" \
  -d '{ "montant": 50 }'
```

Deliver

```bash
curl -X POST http://localhost:3000/api/retouches/RET-1/livrer
```

Cancel (if not delivered)

```bash
curl -X POST http://localhost:3000/api/retouches/RET-1/annuler
```

# HTTP Examples (BC Caisse)

Create a caisse jour

```bash
curl -X POST http://localhost:3000/api/caisse \
  -H "Content-Type: application/json" \
  -d '{
    "idCaisseJour": "2026-02-10",
    "date": "2026-02-10",
    "soldeOuverture": 100,
    "utilisateur": "admin"
  }'
```

Enregistrer une entree

```bash
curl -X POST http://localhost:3000/api/caisse/2026-02-10/entrees \
  -H "Content-Type: application/json" \
  -d '{
    "idOperation": "OP-1",
    "montant": 50,
    "modePaiement": "CASH",
    "motif": "PAIEMENT_COMMANDE",
    "referenceMetier": "CMD-1",
    "utilisateur": "admin"
  }'
```

Enregistrer une sortie

```bash
curl -X POST http://localhost:3000/api/caisse/2026-02-10/sorties \
  -H "Content-Type: application/json" \
  -d '{
    "idOperation": "OP-2",
    "montant": 20,
    "motif": "DEPENSE_ATELIER",
    "utilisateur": "admin"
  }'
```

Annuler une operation

```bash
curl -X POST http://localhost:3000/api/caisse/2026-02-10/operations/OP-2/annuler \
  -H "Content-Type: application/json" \
  -d '{
    "motifAnnulation": "erreur",
    "utilisateur": "admin"
  }'
```

Cloturer caisse

```bash
curl -X POST http://localhost:3000/api/caisse/2026-02-10/cloturer \
  -H "Content-Type: application/json" \
  -d '{
    "utilisateur": "admin"
  }'
```

# HTTP Examples (BC Clients & Mesures)

Create client

```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "idClient": "CL-1",
    "nom": "Doe",
    "prenom": "Jane",
    "telephone": "+221771234567"
  }'
```

Update client

```bash
curl -X PUT http://localhost:3000/api/clients/CL-1 \
  -H "Content-Type: application/json" \
  -d '{ "adresse": "Dakar", "sexe": "F" }'
```

Deactivate client

```bash
curl -X POST http://localhost:3000/api/clients/CL-1/desactiver
```

Create serie mesures

```bash
curl -X POST http://localhost:3000/api/clients/CL-1/mesures \
  -H "Content-Type: application/json" \
  -d '{
    "idSerieMesures": "SM-1",
    "typeVetement": "ROBE",
    "ensembleMesures": [
      { "nomMesure": "poitrine", "valeur": 90 },
      { "nomMesure": "taille", "valeur": 70 }
    ]
  }'
```

Activer serie mesures

```bash
curl -X POST http://localhost:3000/api/clients/CL-1/mesures/SM-1/activer \
  -H "Content-Type: application/json" \
  -d '{ "typeVetement": "ROBE" }'
```

Desactiver serie mesures

```bash
curl -X POST http://localhost:3000/api/clients/CL-1/mesures/SM-1/desactiver
```

# HTTP Examples (BC Stock & Ventes)

Create article

```bash
curl -X POST http://localhost:3000/api/stock/articles \
  -H "Content-Type: application/json" \
  -d '{
    "idArticle": "A-1",
    "nomArticle": "Tissu bleu",
    "categorieArticle": "TISSU",
    "uniteStock": "METRE",
    "quantiteDisponible": 10,
    "prixVenteUnitaire": 15,
    "seuilAlerte": 5
  }'
```

Entrer stock

```bash
curl -X POST http://localhost:3000/api/stock/articles/A-1/entrees \
  -H "Content-Type: application/json" \
  -d '{
    "idMouvement": "M-1",
    "quantite": 5,
    "motif": "ACHAT",
    "utilisateur": "admin"
  }'
```

Sortir stock

```bash
curl -X POST http://localhost:3000/api/stock/articles/A-1/sorties \
  -H "Content-Type: application/json" \
  -d '{
    "idMouvement": "M-2",
    "quantite": 3,
    "motif": "USAGE_ATELIER",
    "utilisateur": "admin"
  }'
```

Ajuster stock

```bash
curl -X POST http://localhost:3000/api/stock/articles/A-1/ajuster \
  -H "Content-Type: application/json" \
  -d '{
    "idMouvement": "M-3",
    "quantite": -2,
    "motif": "AJUSTEMENT",
    "utilisateur": "admin"
  }'
```

Activer article

```bash
curl -X POST http://localhost:3000/api/stock/articles/A-1/activer
```

Desactiver article

```bash
curl -X POST http://localhost:3000/api/stock/articles/A-1/desactiver
```

# HTTP Examples (BC Facturation)

Create facture

```bash
curl -X POST http://localhost:3000/api/factures \
  -H "Content-Type: application/json" \
  -d '{
    "idFacture": "F-1",
    "numeroFacture": "FAC-2026-0001",
    "idClient": "CL-1",
    "typeReference": "COMMANDE",
    "idReference": "CMD-1",
    "montantTotal": 100,
    "typeFacture": "GLOBALE"
  }'
```

Emettre facture

```bash
curl -X POST http://localhost:3000/api/factures/F-1/emettre \
  -H "Content-Type: application/json" \
  -d '{ "utilisateur": "admin" }'
```

Mettre a jour paiements

```bash
curl -X POST http://localhost:3000/api/factures/F-1/paiements \
  -H "Content-Type: application/json" \
  -d '{ "montantPayeTotal": 100 }'
```

Annuler facture

```bash
curl -X POST http://localhost:3000/api/factures/F-1/annuler \
  -H "Content-Type: application/json" \
  -d '{ "motifAnnulation": "erreur", "utilisateur": "admin" }'
```
