import { MotifOperation } from "../../domain/value-objects.js";
import { assertCaisseDateDuJour } from "../services/caisse-date-guard.js";
import { findAndAssertIdempotentOperation, normalizeIdempotencyKey, saveCaisseIdempotently } from "../services/idempotency.js";

export async function enregistrerEntreeManuelle({ idCaisseJour, input, caisseRepo, enforceDateDuJour = false, now, timeZone }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");
  if (enforceDateDuJour) assertCaisseDateDuJour(caisse, { now, timeZone });
  const idempotencyKey = normalizeIdempotencyKey(input?.idempotencyKey);
  if (
    findAndAssertIdempotentOperation(caisse, idempotencyKey, {
      typeOperation: "ENTREE",
      montant: input?.montant,
      motif: MotifOperation.ENTREE_MANUELLE,
      referenceMetier: null,
      activite: input?.activite || "ATELIER"
    })
  ) return caisse;

  const justification = String(input?.justification || "").trim();
  if (!justification) {
    throw new Error("Justification obligatoire");
  }

  caisse.enregistrerEntree({
    ...input,
    motif: MotifOperation.ENTREE_MANUELLE,
    referenceMetier: null,
    justification,
    idempotencyKey
  });
  await saveCaisseIdempotently(caisseRepo, caisse, idempotencyKey);

  return caisse;
}
