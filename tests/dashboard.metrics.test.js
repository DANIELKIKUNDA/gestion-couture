import assert from "node:assert/strict";

import { buildDashboardMetricsSnapshot } from "../frontend/src/dashboard-metrics.js";

function run() {
  const snapshot = buildDashboardMetricsSnapshot({
    commandes: "4",
    retouches: 3,
    ventes: 2,
    encaissements: "150.5"
  });

  assert.deepEqual(snapshot, {
    commandes: 4,
    retouches: 3,
    ventes: 2,
    encaissements: 150.5,
    activiteTotale: 9,
    cashIn: 150.5
  });

  const empty = buildDashboardMetricsSnapshot();
  assert.deepEqual(empty, {
    commandes: 0,
    retouches: 0,
    ventes: 0,
    encaissements: 0,
    activiteTotale: 0,
    cashIn: 0
  });
}

run();
console.log("OK: dashboard metrics");
