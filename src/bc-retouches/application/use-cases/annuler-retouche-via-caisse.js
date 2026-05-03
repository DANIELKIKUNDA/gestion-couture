import { RetoucheRepoPg } from "../../infrastructure/repositories/retouche-repo-pg.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";
import {
  findAndAssertIdempotentOperation,
  normalizeIdempotencyKey,
  saveCaisseIdempotently
} from "../../../bc-caisse/application/services/idempotency.js";

export async function annulerRetoucheViaCaisse({
  idRetouche,
  idCaisseJour,
  utilisateur,
  modePaiement = "CASH",
  retoucheRepo = new RetoucheRepoPg(),
  caisseRepo = new CaisseRepoPg(),
  idempotencyKey = null
}) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");
  const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
  if (normalizedIdempotencyKey && idCaisseJour) {
    const existingCaisse = await caisseRepo.getById(idCaisseJour);
    if (
      findAndAssertIdempotentOperation(existingCaisse, normalizedIdempotencyKey, {
        typeOperation: "SORTIE",
        motif: "REMBOURSEMENT_RETOUCHE_ANNULEE",
        referenceMetier: idRetouche,
        activite: "ATELIER"
      })
    ) return retouche;
  }

  retouche.annulerRetouche();

  const montantRembourse = Number(retouche.montantPaye || 0);
  if (montantRembourse > 0) {
    if (!idCaisseJour) throw new Error("idCaisseJour requis pour remboursement");
    const caisse = await caisseRepo.getById(idCaisseJour);
    if (!caisse) throw new Error("Caisse introuvable");
    if (
      findAndAssertIdempotentOperation(caisse, normalizedIdempotencyKey, {
        typeOperation: "SORTIE",
        montant: montantRembourse,
        motif: "REMBOURSEMENT_RETOUCHE_ANNULEE",
        referenceMetier: idRetouche,
        activite: "ATELIER"
      })
    ) {
      await retoucheRepo.save(retouche);
      return retouche;
    }
    caisse.enregistrerSortie({
      idOperation: generateOperationId(),
      montant: montantRembourse,
      motif: "REMBOURSEMENT_RETOUCHE_ANNULEE",
      referenceMetier: idRetouche,
      utilisateur,
      typeDepense: "QUOTIDIENNE",
      justification: `Annulation retouche ${idRetouche}`,
      activite: "ATELIER",
      role: "SYSTEME",
      rolesAutorises: ["SYSTEME", "PROPRIETAIRE", "ADMIN", "CAISSIER"],
      idempotencyKey: normalizedIdempotencyKey
    });
    await saveCaisseIdempotently(caisseRepo, caisse, normalizedIdempotencyKey);
  }

  await retoucheRepo.save(retouche);
  return retouche;
}
