import assert from "node:assert/strict";
import { PURCHASE_PRICE_MODES, calculateStockFinancialSummary, resolvePurchaseEntry } from "../frontend/src/utils/stock-finance.js";

const unit = resolvePurchaseEntry({ quantity: 10, mode: PURCHASE_PRICE_MODES.UNIT, amount: 2500 });
assert.equal(unit.valid, true);
assert.equal(unit.unitPrice, 2500);
assert.equal(unit.totalAmount, 25000);

const lot = resolvePurchaseEntry({ quantity: 4, mode: PURCHASE_PRICE_MODES.LOT_TOTAL, amount: 10000 });
assert.equal(lot.valid, true);
assert.equal(lot.unitPrice, 2500);
assert.equal(lot.totalAmount, 10000);

const invalidLot = resolvePurchaseEntry({ quantity: 0, mode: PURCHASE_PRICE_MODES.LOT_TOTAL, amount: 10000 });
assert.equal(invalidLot.valid, false);

const summary = calculateStockFinancialSummary([
  { quantiteDisponible: 10, prixAchatMoyen: 1000, prixVenteUnitaire: 1500, seuilAlerte: 2, actif: true },
  { quantiteDisponible: 2, prixAchatMoyen: 2000, prixVenteUnitaire: 2500, seuilAlerte: 2, actif: true },
  { quantiteDisponible: 0, prixAchatMoyen: 5000, prixVenteUnitaire: 7000, seuilAlerte: 1, actif: false }
]);
assert.equal(summary.purchaseValue, 14000);
assert.equal(summary.potentialSaleValue, 20000);
assert.equal(summary.potentialGrossProfit, 6000);
assert.equal(summary.articlesWithStock, 2);
assert.equal(summary.lowStockCount, 1);
assert.equal(summary.articlesWithoutPurchaseCost, 0);
assert.equal(summary.articlesWithoutSalePrice, 0);

const incompleteSummary = calculateStockFinancialSummary([
  { quantiteDisponible: 3, prixAchatMoyen: 0, prixVenteUnitaire: 0, seuilAlerte: 0, actif: true }
]);
assert.equal(incompleteSummary.articlesWithoutPurchaseCost, 1);
assert.equal(incompleteSummary.articlesWithoutSalePrice, 1);

console.log("OK: stock finance UX calculations");
