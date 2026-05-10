// Enregistrer une sortie
import { assertCaisseDateDuJour } from "../services/caisse-date-guard.js";
import { findAndAssertIdempotentOperation, normalizeIdempotencyKey, saveCaisseIdempotently } from "../services/idempotency.js";

export async function enregistrerSortie({ idCaisseJour, input, caisseRepo, parametresRepo, enforceDateDuJour = false, now, timeZone }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");
  if (enforceDateDuJour) assertCaisseDateDuJour(caisse, { now, timeZone });
  const idempotencyKey = normalizeIdempotencyKey(input?.idempotencyKey);
  if (
    findAndAssertIdempotentOperation(caisse, idempotencyKey, {
      typeOperation: "SORTIE",
      montant: input?.montant,
      motif: input?.motif,
      referenceMetier: input?.referenceMetier || null,
      activite: input?.activite || "ATELIER"
    })
  ) return caisse;

  let rolesAutorises = [];
  if (parametresRepo && typeof parametresRepo.getCurrent === "function") {
    const current = await parametresRepo.getCurrent();
    rolesAutorises = current?.payload?.securite?.rolesAutorises || [];
  }

  caisse.enregistrerSortie({ ...input, idempotencyKey, rolesAutorises });
  await saveCaisseIdempotently(caisseRepo, caisse, idempotencyKey);

  return caisse;
}
