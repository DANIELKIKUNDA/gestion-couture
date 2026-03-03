import { CommandeRepoPg } from "../../infrastructure/repositories/commande-repo-pg.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";

export async function enregistrerPaiementViaCaisse({
  idCommande,
  montant,
  idCaisseJour,
  utilisateur,
  modePaiement = "CASH",
  policy = null,
  commandeRepo = new CommandeRepoPg(),
  caisseRepo = new CaisseRepoPg()
}) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");

  caisse.enregistrerEntree({
    idOperation: generateOperationId(),
    montant: Number(montant || 0),
    modePaiement,
    motif: "PAIEMENT_COMMANDE",
    referenceMetier: idCommande,
    utilisateur
  });
  commande.appliquerPaiement(Number(montant || 0), { policy });

  await caisseRepo.save(caisse);
  await commandeRepo.save(commande);
  return commande;
}
