import assert from "node:assert/strict";
import { resolveAchatMontants } from "../src/bc-stock/domain/prix-achat.js";

const unitOnly = resolveAchatMontants({ quantite: 4, prixAchatUnitaire: 2500 });
assert.equal(unitOnly.prixAchatUnitaire, 2500);
assert.equal(unitOnly.montantAchatTotal, 10000);

const lotOnly = resolveAchatMontants({ quantite: 4, montantAchatTotal: 10000 });
assert.equal(lotOnly.prixAchatUnitaire, 2500);
assert.equal(lotOnly.montantAchatTotal, 10000);

const coherentBoth = resolveAchatMontants({ quantite: 3, prixAchatUnitaire: 1000, montantAchatTotal: 3000 });
assert.equal(coherentBoth.prixAchatUnitaire, 1000);
assert.equal(coherentBoth.montantAchatTotal, 3000);

assert.throws(
  () => resolveAchatMontants({ quantite: 3, prixAchatUnitaire: 1000, montantAchatTotal: 4000 }),
  /incoherents/i
);
assert.throws(
  () => resolveAchatMontants({ quantite: 0, montantAchatTotal: 10000 }),
  /quantite superieure a zero/i
);
assert.deepEqual(resolveAchatMontants({ quantite: 0, allowEmpty: true }), {
  prixAchatUnitaire: 0,
  montantAchatTotal: 0
});

console.log("OK: stock purchase price resolution");
