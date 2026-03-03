import { CommandeRepoPg } from "../../infrastructure/repositories/commande-repo-pg.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";
import { resolveCommandePolicy } from "../../domain/commande-policy.js";

export async function annulerCommandeViaCaisse({
  idCommande,
  idCaisseJour,
  utilisateur,
  modePaiement = "CASH",
  policy = null,
  commandeRepo = new CommandeRepoPg(),
  caisseRepo = new CaisseRepoPg()
}) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  const resolvedPolicy = resolveCommandePolicy(policy);
  commande.annulerCommande({ policy: resolvedPolicy });

  const montantRembourse = Number(commande.montantPaye || 0);
  if (montantRembourse > 0) {
    if (!idCaisseJour) throw new Error("idCaisseJour requis pour remboursement");
    const caisse = await caisseRepo.getById(idCaisseJour);
    if (!caisse) throw new Error("Caisse introuvable");
    caisse.enregistrerSortie({
      idOperation: generateOperationId(),
      montant: montantRembourse,
      motif: "REMBOURSEMENT_COMMANDE_ANNULEE",
      referenceMetier: idCommande,
      utilisateur,
      typeDepense: "QUOTIDIENNE",
      justification: `Annulation commande ${idCommande}`,
      role: "SYSTEME",
      rolesAutorises: ["SYSTEME", "PROPRIETAIRE", "ADMIN", "CAISSIER"]
    });
    await caisseRepo.save(caisse);
  }

  await commandeRepo.save(commande);
  return commande;
}
