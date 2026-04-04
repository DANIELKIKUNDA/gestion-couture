import { RetoucheItem } from "../../domain/retouche-item.js";

function normalizeSnapshotFromItems(items = []) {
  const primaryItemWithMeasures = items.find((item) => item?.mesures) || null;
  const primaryItem = primaryItemWithMeasures || items[0] || null;
  return {
    typeRetouche: primaryItem?.typeRetouche || null,
    typeHabit: primaryItem?.typeHabit || null,
    mesuresHabit: primaryItemWithMeasures?.mesures || null
  };
}

export async function modifierRetoucheItem({
  idRetouche,
  idItem,
  patch = {},
  retoucheRepo,
  retoucheItemRepo,
  policy = null
}) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");

  retouche.assertModifiableAvantPaiement();

  const existingItems = Array.isArray(retouche.items) ? retouche.items : [];
  const itemIndex = existingItems.findIndex((item) => String(item?.idItem || "").trim() === String(idItem || "").trim());
  if (itemIndex < 0) throw new Error("Item retouche introuvable");

  const currentItem = existingItems[itemIndex];
  const updatedItem = new RetoucheItem({
    idItem: currentItem.idItem,
    idRetouche: retouche.idRetouche,
    typeRetouche: currentItem.typeRetouche,
    typeHabit: currentItem.typeHabit,
    description: Object.prototype.hasOwnProperty.call(patch, "description") ? patch.description : currentItem.description,
    prix: Object.prototype.hasOwnProperty.call(patch, "prix") ? patch.prix : currentItem.prix,
    ordreAffichage: currentItem.ordreAffichage,
    mesures: Object.prototype.hasOwnProperty.call(patch, "mesures") ? patch.mesures : currentItem.mesures,
    dateCreation: currentItem.dateCreation,
    policy
  });

  const nextItems = existingItems.map((item, index) => (index === itemIndex ? updatedItem : item));
  const nextTotal = nextItems.reduce((sum, item) => sum + Number(item?.prix || 0), 0);
  const snapshot = normalizeSnapshotFromItems(nextItems);

  retouche.items = nextItems;
  retouche.montantTotal = nextTotal;
  retouche.typeRetouche = snapshot.typeRetouche || retouche.typeRetouche;
  retouche.typeHabit = snapshot.typeHabit;
  retouche.mesuresHabit = snapshot.mesuresHabit;

  await retoucheRepo.save(retouche);
  await retoucheItemRepo.replaceForRetouche(retouche.idRetouche, nextItems);

  return retouche;
}
