import assert from "node:assert/strict";

import { calculateActivityBalances } from "../src/bc-caisse/domain/activity-balances.js";

function testAllocationInitialeEtSoldesCumulatifs() {
  const balances = calculateActivityBalances({
    openingBalance: 500000,
    initialAllocation: {
      configured: true,
      soldeAtelierInitial: 400000,
      soldeStockInitial: 100000
    },
    operations: [
      { typeOperation: "ENTREE", montant: 50000, activite: "ATELIER", statutOperation: "VALIDE" },
      { typeOperation: "SORTIE", montant: 10000, activite: "ATELIER", statutOperation: "VALIDE", typeDepense: "QUOTIDIENNE" },
      { typeOperation: "SORTIE", montant: 80000, activite: "ATELIER", statutOperation: "VALIDE", typeDepense: "EXCEPTIONNELLE" },
      { typeOperation: "ENTREE", montant: 30000, activite: "STOCK", statutOperation: "VALIDE" },
      { typeOperation: "SORTIE", montant: 20000, activite: "STOCK", statutOperation: "VALIDE" }
    ]
  });

  assert.equal(balances.allocationConfigured, true);
  assert.equal(balances.soldeAtelier, 360000);
  assert.equal(balances.soldeStock, 110000);
  assert.equal(balances.soldeNonReparti, 0);
  assert.equal(balances.soldeGlobalCalcule, 470000);
  assert.equal(balances.totalEntreesAtelier, 50000);
  assert.equal(balances.totalSortiesAtelier, 90000);
  assert.equal(balances.totalEntreesStock, 30000);
  assert.equal(balances.totalSortiesStock, 20000);
}

function testSoldeInitialInconnuResteNonRepartiSansEtreInvente() {
  const balances = calculateActivityBalances({
    openingBalance: 500000,
    operations: [
      { typeOperation: "ENTREE", montant: 50000, activite: "ATELIER", statutOperation: "VALIDE" },
      { typeOperation: "ENTREE", montant: 25000, activite: "STOCK", statutOperation: "VALIDE" },
      { typeOperation: "SORTIE", montant: 10000, activite: "ATELIER", statutOperation: "ANNULEE" }
    ]
  });

  assert.equal(balances.allocationConfigured, false);
  assert.equal(balances.soldeAtelier, 50000);
  assert.equal(balances.soldeStock, 25000);
  assert.equal(balances.soldeNonReparti, 500000);
  assert.equal(balances.soldeGlobalCalcule, 575000);
}

function testDepenseExceptionnelleAffecteLeSoldeActiviteCommeTouteSortie() {
  const balances = calculateActivityBalances({
    openingBalance: 200000,
    initialAllocation: { configured: true, soldeAtelierInitial: 200000, soldeStockInitial: 0 },
    operations: [
      { typeOperation: "ENTREE", montant: 50000, activite: "ATELIER", statutOperation: "VALIDE" },
      { typeOperation: "SORTIE", montant: 80000, activite: "ATELIER", statutOperation: "VALIDE", typeDepense: "EXCEPTIONNELLE" }
    ]
  });

  assert.equal(balances.soldeAtelier, 170000);
  assert.equal(balances.soldeGlobalCalcule, 170000);
}

testAllocationInitialeEtSoldesCumulatifs();
testSoldeInitialInconnuResteNonRepartiSansEtreInvente();
testDepenseExceptionnelleAffecteLeSoldeActiviteCommeTouteSortie();
console.log("OK: caisse activity balances");
