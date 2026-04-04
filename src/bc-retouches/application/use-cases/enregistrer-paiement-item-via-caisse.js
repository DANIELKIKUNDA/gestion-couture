import { RetoucheRepoPg } from "../../infrastructure/repositories/retouche-repo-pg.js";
import { RetoucheItemRepoPg } from "../../infrastructure/repositories/retouche-item-repo-pg.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";
import { RetoucheItem } from "../../domain/retouche-item.js";
import { applyPaymentToItemCollection } from "../../../shared/domain/item-finance.js";

export async function enregistrerPaiementRetoucheItemViaCaisse({
  idRetouche,
  idItem,
  montant,
  idCaisseJour,
  utilisateur,
  modePaiement = "CASH",
  policy = null,
  retoucheRepo = new RetoucheRepoPg(),
  retoucheItemRepo = new RetoucheItemRepoPg(),
  caisseRepo = new CaisseRepoPg()
}) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");

  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");

  const { nextItems } = applyPaymentToItemCollection({
    items: retouche.items,
    idItem,
    montant,
    itemLabel: "Item retouche",
    rebuildItem: (currentItem, nextPaid) =>
      new RetoucheItem({
        idItem: currentItem.idItem,
        idRetouche: retouche.idRetouche,
        typeRetouche: currentItem.typeRetouche,
        typeHabit: currentItem.typeHabit,
        description: currentItem.description,
        prix: currentItem.prix,
        montantPaye: nextPaid,
        ordreAffichage: currentItem.ordreAffichage,
        mesures: currentItem.mesures,
        dateCreation: currentItem.dateCreation,
        policy,
        rehydrate: true
      })
  });

  caisse.enregistrerEntree({
    idOperation: generateOperationId(),
    montant: Number(montant || 0),
    modePaiement,
    motif: "PAIEMENT_RETOUCHE_ITEM",
    referenceMetier: `${idRetouche}:${idItem}`,
    utilisateur
  });

  retouche.items = nextItems;
  retouche.appliquerPaiement(Number(montant || 0));

  await caisseRepo.save(caisse);
  await retoucheRepo.save(retouche);
  await retoucheItemRepo.replaceForRetouche(retouche.idRetouche, nextItems);
  return retouche;
}
