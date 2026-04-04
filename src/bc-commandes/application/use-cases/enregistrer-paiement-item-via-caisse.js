import { CommandeRepoPg } from "../../infrastructure/repositories/commande-repo-pg.js";
import { CommandeItemRepoPg } from "../../infrastructure/repositories/commande-item-repo-pg.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";
import { CommandeItem } from "../../domain/commande-item.js";
import { applyPaymentToItemCollection } from "../../../shared/domain/item-finance.js";

export async function enregistrerPaiementCommandeItemViaCaisse({
  idCommande,
  idItem,
  montant,
  idCaisseJour,
  utilisateur,
  modePaiement = "CASH",
  policy = null,
  commandeRepo = new CommandeRepoPg(),
  commandeItemRepo = new CommandeItemRepoPg(),
  caisseRepo = new CaisseRepoPg()
}) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");

  const { nextItems } = applyPaymentToItemCollection({
    items: commande.items,
    idItem,
    montant,
    itemLabel: "Item commande",
    rebuildItem: (currentItem, nextPaid) =>
      new CommandeItem({
        idItem: currentItem.idItem,
        idCommande: commande.idCommande,
        typeHabit: currentItem.typeHabit,
        description: currentItem.description,
        prix: currentItem.prix,
        montantPaye: nextPaid,
        ordreAffichage: currentItem.ordreAffichage,
        mesures: currentItem.mesures,
        dateCreation: currentItem.dateCreation,
        policy
      })
  });

  caisse.enregistrerEntree({
    idOperation: generateOperationId(),
    montant: Number(montant || 0),
    modePaiement,
    motif: "PAIEMENT_COMMANDE_ITEM",
    referenceMetier: `${idCommande}:${idItem}`,
    utilisateur
  });

  commande.items = nextItems;
  commande.appliquerPaiement(Number(montant || 0), { policy });

  await caisseRepo.save(caisse);
  await commandeRepo.save(commande);
  await commandeItemRepo.replaceForCommande(commande.idCommande, nextItems);
  return commande;
}
