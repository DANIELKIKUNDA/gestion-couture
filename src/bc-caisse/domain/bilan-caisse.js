import { StatutOperation, TypeOperation } from "./value-objects.js";

export function calculerBilanCaisse({ caisses, dateDebut, dateFin, typeBilan }) {
  const sorted = [...caisses].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const first = sorted[0] || null;
  const last = sorted[sorted.length - 1] || null;

  const totalEntrees = sorted.reduce((sum, caisse) => {
    const ops = caisse.operations || [];
    return (
      sum +
      ops
        .filter((op) => op.statutOperation !== StatutOperation.ANNULEE && op.typeOperation === TypeOperation.ENTREE)
        .reduce((acc, op) => acc + Number(op.montant || 0), 0)
    );
  }, 0);

  const totalSorties = sorted.reduce((sum, caisse) => {
    const ops = caisse.operations || [];
    return (
      sum +
      ops
        .filter((op) => op.statutOperation !== StatutOperation.ANNULEE && op.typeOperation === TypeOperation.SORTIE)
        .reduce((acc, op) => acc + Number(op.montant || 0), 0)
    );
  }, 0);

  const soldeOuverture = first ? Number(first.soldeOuverture || 0) : 0;
  const soldeCloture = last ? Number(last.soldeCloture ?? last.soldeCourant()) : soldeOuverture;

  return {
    typeBilan,
    dateDebut,
    dateFin,
    soldeOuverture,
    totalEntrees,
    totalSorties,
    soldeCloture,
    nombreJours: sorted.length
  };
}
