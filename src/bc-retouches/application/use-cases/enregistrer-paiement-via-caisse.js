import { RetoucheRepoPg } from "../../infrastructure/repositories/retouche-repo-pg.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";
import { assertCaisseDateDuJour } from "../../../bc-caisse/application/services/caisse-date-guard.js";
import {
  findAndAssertIdempotentOperation,
  normalizeIdempotencyKey,
  saveCaisseIdempotently
} from "../../../bc-caisse/application/services/idempotency.js";

export async function enregistrerPaiementRetoucheViaCaisse({
  idRetouche,
  montant,
  idCaisseJour,
  utilisateur,
  modePaiement = "CASH",
  retoucheRepo = new RetoucheRepoPg(),
  caisseRepo = new CaisseRepoPg(),
  enforceDateDuJour = false,
  idempotencyKey = null,
  now,
  timeZone
}) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");

  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");
  if (enforceDateDuJour) assertCaisseDateDuJour(caisse, { now, timeZone });
  const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
  if (
    findAndAssertIdempotentOperation(caisse, normalizedIdempotencyKey, {
      typeOperation: "ENTREE",
      montant,
      motif: "PAIEMENT_RETOUCHE",
      referenceMetier: idRetouche,
      activite: "ATELIER"
    })
  ) return retouche;

  caisse.enregistrerEntree({
    idOperation: generateOperationId(),
    montant: Number(montant || 0),
    modePaiement,
    motif: "PAIEMENT_RETOUCHE",
    referenceMetier: idRetouche,
    activite: "ATELIER",
    utilisateur,
    idempotencyKey: normalizedIdempotencyKey
  });
  retouche.appliquerPaiement(Number(montant || 0));

  const savedCaisse = await saveCaisseIdempotently(caisseRepo, caisse, normalizedIdempotencyKey);
  if (savedCaisse !== caisse) return (await retoucheRepo.getById(idRetouche)) || retouche;
  await retoucheRepo.save(retouche);
  return retouche;
}
