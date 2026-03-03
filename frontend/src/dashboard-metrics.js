export function buildDashboardMetricsSnapshot(source = {}) {
  const commandes = Number(source.commandes ?? 0);
  const retouches = Number(source.retouches ?? 0);
  const ventes = Number(source.ventes ?? 0);
  const encaissements = Number(source.encaissements ?? 0);

  return {
    commandes,
    retouches,
    ventes,
    encaissements,
    activiteTotale: commandes + retouches + ventes,
    cashIn: encaissements
  };
}
