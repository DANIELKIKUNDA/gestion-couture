import { CommandeRepoPg } from "../../infrastructure/repositories/commande-repo-pg.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";
import { assertCaisseDateDuJour } from "../../../bc-caisse/application/services/caisse-date-guard.js";
import {
  findAndAssertIdempotentOperation,
  normalizeIdempotencyKey,
  saveCaisseIdempotently
} from "../../../bc-caisse/application/services/idempotency.js";

export async function enregistrerPaiementViaCaisse({
  idCommande,
  montant,
  idCaisseJour,
  utilisateur,
  modePaiement = "CASH",
  policy = null,
  commandeRepo = new CommandeRepoPg(),
  caisseRepo = new CaisseRepoPg(),
  enforceDateDuJour = false,
  idempotencyKey = null,
  now,
  timeZone
}) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");
  if (enforceDateDuJour) assertCaisseDateDuJour(caisse, { now, timeZone });
  const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
  if (
    findAndAssertIdempotentOperation(caisse, normalizedIdempotencyKey, {
      typeOperation: "ENTREE",
      montant,
      motif: "PAIEMENT_COMMANDE",
      referenceMetier: idCommande,
      activite: "ATELIER"
    })
  ) return commande;

  caisse.enregistrerEntree({
    idOperation: generateOperationId(),
    montant: Number(montant || 0),
    modePaiement,
    motif: "PAIEMENT_COMMANDE",
    referenceMetier: idCommande,
    activite: "ATELIER",
    utilisateur,
    idempotencyKey: normalizedIdempotencyKey
  });
  commande.appliquerPaiement(Number(montant || 0), { policy });

  const savedCaisse = await saveCaisseIdempotently(caisseRepo, caisse, normalizedIdempotencyKey);
  if (savedCaisse !== caisse) return (await commandeRepo.getById(idCommande)) || commande;
  await commandeRepo.save(commande);
  return commande;
}
