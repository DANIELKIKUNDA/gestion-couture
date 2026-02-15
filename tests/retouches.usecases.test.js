import assert from "assert";
import { deposerRetouche } from "../src/bc-retouches/application/use-cases/deposer-retouche.js";
import { StatutRetouche } from "../src/bc-retouches/domain/value-objects.js";

function run() {
  const r = deposerRetouche({
    idRetouche: "RET-1",
    idClient: "CL-1",
    descriptionRetouche: "Ourlet pantalon",
    typeRetouche: "OURLET",
    datePrevue: new Date().toISOString(),
    montantTotal: 50,
    typeHabit: "PANTALON",
    mesuresHabit: {
      longueur: 102
    }
  });
  assert.equal(r.statutRetouche, StatutRetouche.DEPOSEE);

  r.appliquerPaiement(20);
  assert.equal(r.montantPaye, 20);

  r.terminerTravail();
  assert.equal(r.statutRetouche, StatutRetouche.TERMINEE);

  let failed = false;
  try {
    r.livrerRetouche();
  } catch (e) {
    failed = true;
  }
  assert.equal(failed, true);

  r.appliquerPaiement(30);
  r.livrerRetouche();
  assert.equal(r.statutRetouche, StatutRetouche.LIVREE);
}

run();
console.log("OK: retouches use cases");
