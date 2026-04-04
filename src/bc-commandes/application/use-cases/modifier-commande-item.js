import { CommandeItem } from "../../domain/commande-item.js";

function normalizeSnapshotFromItems(items = []) {
  const primaryItemWithMeasures = items.find((item) => item?.mesures) || null;
  const primaryItem = primaryItemWithMeasures || items[0] || null;
  return {
    typeHabit: primaryItem?.typeHabit || null,
    mesuresHabit: primaryItemWithMeasures?.mesures || null
  };
}

export async function modifierCommandeItem({
  idCommande,
  idItem,
  patch = {},
  commandeRepo,
  commandeItemRepo,
  policy = null
}) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  commande.assertModifiableAvantPaiement();

  const existingItems = Array.isArray(commande.items) ? commande.items : [];
  const itemIndex = existingItems.findIndex((item) => String(item?.idItem || "").trim() === String(idItem || "").trim());
  if (itemIndex < 0) throw new Error("Item commande introuvable");

  const currentItem = existingItems[itemIndex];
  const updatedItem = new CommandeItem({
    idItem: currentItem.idItem,
    idCommande: commande.idCommande,
    typeHabit: currentItem.typeHabit,
    description: Object.prototype.hasOwnProperty.call(patch, "description") ? patch.description : currentItem.description,
    prix: Object.prototype.hasOwnProperty.call(patch, "prix") ? patch.prix : currentItem.prix,
    montantPaye: currentItem.montantPaye,
    ordreAffichage: currentItem.ordreAffichage,
    mesures: Object.prototype.hasOwnProperty.call(patch, "mesures") ? patch.mesures : currentItem.mesures,
    dateCreation: currentItem.dateCreation,
    policy
  });

  const nextItems = existingItems.map((item, index) => (index === itemIndex ? updatedItem : item));
  const nextTotal = nextItems.reduce((sum, item) => sum + Number(item?.prix || 0), 0);
  const snapshot = normalizeSnapshotFromItems(nextItems);

  commande.items = nextItems;
  commande.montantTotal = nextTotal;
  commande.typeHabit = snapshot.typeHabit;
  commande.mesuresHabit = snapshot.mesuresHabit;

  await commandeRepo.save(commande);
  await commandeItemRepo.replaceForCommande(commande.idCommande, nextItems);

  return commande;
}
