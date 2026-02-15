import assert from "assert";
import { emettreFacture } from "../src/bc-facturation/application/use-cases/emettre-facture.js";
import { StatutFacture } from "../src/bc-facturation/domain/value-objects.js";

async function run() {
  const saved = new Map();
  let sequence = 0;
  const fakeRepo = {
    async getByOrigine(type, id) {
      for (const item of saved.values()) {
        if (item.typeOrigine === type && item.idOrigine === id) return item.withPaiements(0);
      }
      return null;
    },
    async nextFactureId() {
      sequence += 1;
      return `F-${sequence}`;
    },
    async nextNumeroFacture() {
      return "FAC-2026-000001";
    },
    async save(facture) {
      saved.set(facture.idFacture, facture);
    }
  };

  const fakeOrigineReader = {
    async read(typeOrigine, idOrigine) {
      if (typeOrigine !== "COMMANDE" || idOrigine !== "CMD-1") return null;
      return {
        client: { nom: "Alice Dupont", contact: "0999999999" },
        montantTotal: 100,
        referenceCaisse: null,
        lignes: [{ description: "Commande robe", quantite: 1, prix: 100 }]
      };
    }
  };

  const facture = await emettreFacture({
    input: { typeOrigine: "COMMANDE", idOrigine: "CMD-1" },
    factureRepo: fakeRepo,
    origineReader: fakeOrigineReader,
    now: new Date("2026-02-14T10:00:00.000Z")
  });

  const projection = facture.withPaiements(0);
  assert.equal(facture.numeroFacture, "FAC-2026-000001");
  assert.equal(projection.statut, StatutFacture.EMISE);
  assert.equal(projection.montantPaye, 0);
  assert.equal(projection.solde, 100);

  const partielle = facture.withPaiements(40);
  assert.equal(partielle.statut, StatutFacture.PARTIELLEMENT_PAYEE);
  assert.equal(partielle.solde, 60);

  const soldee = facture.withPaiements(100);
  assert.equal(soldee.statut, StatutFacture.SOLDEE);
  assert.equal(soldee.solde, 0);
}

run();
console.log("OK: facturation use cases");
