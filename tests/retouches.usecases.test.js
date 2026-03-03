import assert from "assert";
import { deposerRetouche } from "../src/bc-retouches/application/use-cases/deposer-retouche.js";
import { StatutRetouche } from "../src/bc-retouches/domain/value-objects.js";

function shouldFail(fn) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
}

function run() {
  const policy = {
    retouches: {
      mesuresOptionnelles: true,
      saisiePartielle: false,
      descriptionObligatoire: false
    }
  };

  const r = deposerRetouche(
    {
      idRetouche: "RET-1",
      idClient: "CL-1",
      descriptionRetouche: "Ourlet pantalon",
      typeRetouche: "OURLET_PANTALON",
      datePrevue: new Date().toISOString(),
      montantTotal: 50,
      typeHabit: "PANTALON",
      mesuresHabit: {
        longueur: 102,
        largeurBas: 20
      }
    },
    { policy }
  );
  assert.equal(r.statutRetouche, StatutRetouche.DEPOSEE);

  shouldFail(() => r.terminerTravail());

  r.appliquerPaiement(20);
  assert.equal(r.statutRetouche, StatutRetouche.EN_COURS);
  assert.equal(r.montantPaye, 20);

  r.terminerTravail();
  assert.equal(r.statutRetouche, StatutRetouche.TERMINEE);

  shouldFail(() => r.livrerRetouche());

  r.appliquerPaiement(30);
  r.livrerRetouche();
  assert.equal(r.statutRetouche, StatutRetouche.LIVREE);

  // Cas exige: Reparation dechirure sans mesures (ok)
  const rSansMesures = deposerRetouche(
    {
      idRetouche: "RET-2",
      idClient: "CL-1",
      descriptionRetouche: "Dechirure cote",
      typeRetouche: "REPARATION_DECHIRURE",
      datePrevue: new Date().toISOString(),
      montantTotal: 80,
      typeHabit: "ROBE",
      mesuresHabit: {}
    },
    { policy }
  );
  assert.equal(rSansMesures.statutRetouche, StatutRetouche.DEPOSEE);

  // Cas exige: Ourlet pantalon sans longueur (ko)
  shouldFail(() =>
    deposerRetouche(
      {
        idRetouche: "RET-3",
        idClient: "CL-1",
        descriptionRetouche: "Ourlet incomplet",
        typeRetouche: "OURLET_PANTALON",
        datePrevue: new Date().toISOString(),
        montantTotal: 60,
        typeHabit: "PANTALON",
        mesuresHabit: {
          largeurBas: 20
        }
      },
      {
        policy: {
          retouches: {
            mesuresOptionnelles: true,
            saisiePartielle: false,
            descriptionObligatoire: false
          }
        }
      }
    )
  );

  // Cas exige: Reparation (sans mesures) reste autorisee
  const rLegacySansMesures = deposerRetouche(
    {
      idRetouche: "RET-4",
      idClient: "CL-1",
      descriptionRetouche: "Reparation simple",
      typeRetouche: "REPARATION",
      datePrevue: new Date().toISOString(),
      montantTotal: 40,
      typeHabit: "AUTRES",
      mesuresHabit: {}
    },
    { policy }
  );
  assert.equal(rLegacySansMesures.statutRetouche, StatutRetouche.DEPOSEE);
}

run();
console.log("OK: retouches use cases");
