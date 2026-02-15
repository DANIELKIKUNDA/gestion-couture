import assert from "assert";
import { CaisseJour } from "../src/bc-caisse/domain/caisse-jour.js";
import { StatutCaisse } from "../src/bc-caisse/domain/value-objects.js";

function run() {
  const c = new CaisseJour({
    idCaisseJour: "2026-02-10",
    date: "2026-02-10",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 100
  });

  c.enregistrerEntree({
    idOperation: "OP-1",
    montant: 50,
    modePaiement: "CASH",
    motif: "PAIEMENT_COMMANDE",
    referenceMetier: "CMD-1",
    utilisateur: "user1"
  });

  c.enregistrerSortie({
    idOperation: "OP-2",
    montant: 20,
    motif: "DEPENSE_ATELIER",
    utilisateur: "user1"
  });

  assert.equal(c.soldeCourant(), 130);

  c.annulerOperation({
    idOperation: "OP-2",
    motifAnnulation: "erreur",
    utilisateur: "user1"
  });

  assert.equal(c.soldeCourant(), 150);

  c.cloturerCaisse({ utilisateur: "user1" });
  assert.equal(c.statutCaisse, StatutCaisse.CLOTUREE);
}

run();
console.log("OK: caisse use cases");
