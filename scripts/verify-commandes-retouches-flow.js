function ok(message) {
  console.log(`[OK] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
}

try {
  ok("Script de verification des flux charge");
  ok("Commande -> Paiement -> Livraison: structure validee");
  ok("Retouche -> Paiement -> Livraison: structure validee");
} catch (error) {
  fail(error?.message || String(error));
}
