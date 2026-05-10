// Enregistrer une entree
import { assertCaisseDateDuJour } from "../services/caisse-date-guard.js";
import { findAndAssertIdempotentOperation, normalizeIdempotencyKey, saveCaisseIdempotently } from "../services/idempotency.js";

export async function enregistrerEntree({ idCaisseJour, input, caisseRepo, enforceDateDuJour = false, now, timeZone }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");
  if (enforceDateDuJour) assertCaisseDateDuJour(caisse, { now, timeZone });
  const idempotencyKey = normalizeIdempotencyKey(input?.idempotencyKey);
  if (
    findAndAssertIdempotentOperation(caisse, idempotencyKey, {
      typeOperation: "ENTREE",
      montant: input?.montant,
      motif: input?.motif,
      referenceMetier: input?.referenceMetier || null,
      activite: input?.activite || "ATELIER"
    })
  ) return caisse;

  caisse.enregistrerEntree({ ...input, idempotencyKey });
  await saveCaisseIdempotently(caisseRepo, caisse, idempotencyKey);

  return caisse;
}
