import assert from "assert";
import { creerCommande } from "../src/bc-commandes/application/use-cases/creer-commande.js";
import { deposerRetouche } from "../src/bc-retouches/application/use-cases/deposer-retouche.js";

function assertThrows(fn, messageFragment) {
  let thrown = false;
  try {
    fn();
  } catch (err) {
    thrown = true;
    if (messageFragment) {
      assert.ok(String(err.message || "").toLowerCase().includes(messageFragment.toLowerCase()));
    }
  }
  assert.equal(thrown, true);
}

function run() {
  assertThrows(
    () =>
      creerCommande({
        idCommande: "CMD-M-1",
        idClient: "CL-1",
        descriptionCommande: "Sans mesures",
        montantTotal: 100,
        typeHabit: "PANTALON",
        mesuresHabit: {}
      }),
    "mesure manquante"
  );

  assertThrows(
    () =>
      creerCommande({
        idCommande: "CMD-M-2",
        idClient: "CL-1",
        descriptionCommande: "Pantalon incomplet",
        montantTotal: 100,
        typeHabit: "PANTALON",
        mesuresHabit: { longueur: 105 }
      }),
    "mesure manquante"
  );

  assertThrows(
    () =>
      creerCommande({
        idCommande: "CMD-M-3",
        idClient: "CL-1",
        descriptionCommande: "Chemise manches longues invalide",
        montantTotal: 100,
        typeHabit: "CHEMISE",
        mesuresHabit: {
          poitrine: 95,
          longueurChemise: 72,
          typeManches: "longues",
          poignet: 20,
          carrure: 45
        }
      }),
    "longueurmanches"
  );

  assertThrows(
    () =>
      deposerRetouche({
        idRetouche: "RET-M-1",
        idClient: "CL-1",
        descriptionRetouche: "Aucune mesure",
        typeRetouche: "OURLET",
        montantTotal: 30,
        typeHabit: "ROBE",
        mesuresHabit: {}
      }),
    "au moins une mesure"
  );

  const retouche = deposerRetouche({
    idRetouche: "RET-M-2",
    idClient: "CL-1",
    descriptionRetouche: "Mesure partielle OK",
    typeRetouche: "OURLET",
    montantTotal: 30,
    typeHabit: "ROBE",
    mesuresHabit: { longueur: 98.5 }
  });
  assert.equal(retouche.typeHabit, "ROBE");
  assert.equal(retouche.mesuresHabit.valeurs.longueur, 98.5);

  assertThrows(
    () =>
      deposerRetouche({
        idRetouche: "RET-M-3",
        idClient: "CL-1",
        descriptionRetouche: "Valeur aberrante",
        typeRetouche: "OURLET",
        montantTotal: 30,
        typeHabit: "ROBE",
        mesuresHabit: { longueur: 999 }
      }),
    "aberrante"
  );
}

run();
console.log("OK: mesures rules");
