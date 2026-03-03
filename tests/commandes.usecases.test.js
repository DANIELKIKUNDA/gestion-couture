import assert from "assert";
import { creerCommande } from "../src/bc-commandes/application/use-cases/creer-commande.js";
import { StatutCommande } from "../src/bc-commandes/domain/value-objects.js";

function run() {
  // Create
  const c = creerCommande({
    idCommande: "CMD-1",
    idClient: "CL-1",
    descriptionCommande: "Robe simple",
    datePrevue: new Date().toISOString(),
    montantTotal: 100,
    typeHabit: "ROBE",
    mesuresHabit: {
      poitrine: 88.5,
      taille: 70,
      hanche: 95,
      longueur: 110
    }
  });
  assert.equal(c.statutCommande, StatutCommande.CREEE);

  // Payment
  c.appliquerPaiement(50);
  assert.equal(c.montantPaye, 50);
  assert.equal(c.resteAPayer(), 50);

  // Finish work then deliver should fail because not paid
  c.terminerTravail();
  assert.equal(c.statutCommande, StatutCommande.TERMINEE);

  let failed = false;
  try {
    c.livrerCommande();
  } catch (e) {
    failed = true;
  }
  assert.equal(failed, true);

  // Pay remaining and deliver
  c.appliquerPaiement(50);
  c.livrerCommande();
  assert.equal(c.statutCommande, StatutCommande.LIVREE);

  // Cannot change after delivery
  let failed2 = false;
  try {
    c.annulerCommande();
  } catch (e) {
    failed2 = true;
  }
  assert.equal(failed2, true);
}

run();
console.log("OK: commandes use cases");
