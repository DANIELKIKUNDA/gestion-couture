import assert from "assert";
import {
  normalizeMesuresSnapshot,
  filterHistoriques
} from "../src/bc-clients/domain/consultation-client.js";
import { paginateRows, positiveInt, toIsoDate } from "../src/bc-clients/application/services/consultation-client.js";

function run() {
  const normalized = normalizeMesuresSnapshot({
    mode: "ESTIMATION",
    unite: "cm",
    valeurs: { poitrine: 98, typeManches: "Longues", ignore: 0 }
  }, "CHEMISE");
  assert.equal(normalized.typeHabit, "CHEMISE");
  assert.equal(normalized.unite, "cm");
  assert.equal(normalized.valeurs.poitrine, 98);
  assert.equal(normalized.valeurs.typeManches, "longues");

  const flat = normalizeMesuresSnapshot({ poitrine: 92.5, taille: "74" }, "ROBE");
  assert.equal(flat.valeurs.poitrine, 92.5);
  assert.equal(flat.valeurs.taille, 74);

  const filtered = filterHistoriques({
    commandes: [{ idCommande: "C1", date: "2026-02-10", typeHabit: "CHEMISE", statut: "CREEE", montant: 100 }],
    retouches: [{ idRetouche: "R1", date: "2026-02-11", typeHabit: "JUPE", statut: "DEPOSEE", montant: 50 }],
    mesures: [{ datePrise: "2026-02-11", typeHabit: "JUPE", source: "RETOUCHE", mesures: { valeurs: { taille: 74 } } }],
    source: "RETOUCHE",
    typeHabit: "JUPE",
    periode: "ALL"
  });
  assert.equal(filtered.commandes.length, 0);
  assert.equal(filtered.retouches.length, 1);
  assert.equal(filtered.mesures.length, 1);

  const paged = paginateRows([1, 2, 3, 4, 5], 2, 2);
  assert.deepEqual(paged.rows, [3, 4]);
  assert.equal(paged.totalPages, 3);
  assert.equal(paged.total, 5);

  assert.equal(positiveInt("12", 5), 12);
  assert.equal(positiveInt("-1", 5), 5);
  assert.equal(toIsoDate("2026-02-14T10:00:00.000Z"), "2026-02-14");
}

run();
console.log("OK: clients consultation service");
