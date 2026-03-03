import { RetoucheRepoPg } from "../../infrastructure/repositories/retouche-repo-pg.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";

export async function annulerRetoucheViaCaisse({
  idRetouche,
  idCaisseJour,
  utilisateur,
  modePaiement = "CASH",
  retoucheRepo = new RetoucheRepoPg(),
  caisseRepo = new CaisseRepoPg()
}) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");

  retouche.annulerRetouche();

  const montantRembourse = Number(retouche.montantPaye || 0);
  if (montantRembourse > 0) {
    if (!idCaisseJour) throw new Error("idCaisseJour requis pour remboursement");
    const caisse = await caisseRepo.getById(idCaisseJour);
    if (!caisse) throw new Error("Caisse introuvable");
    caisse.enregistrerSortie({
      idOperation: generateOperationId(),
      montant: montantRembourse,
      motif: "REMBOURSEMENT_RETOUCHE_ANNULEE",
      referenceMetier: idRetouche,
      utilisateur,
      typeDepense: "QUOTIDIENNE",
      justification: `Annulation retouche ${idRetouche}`,
      role: "SYSTEME",
      rolesAutorises: ["SYSTEME", "PROPRIETAIRE", "ADMIN", "CAISSIER"]
    });
    await caisseRepo.save(caisse);
  }

  await retoucheRepo.save(retouche);
  return retouche;
}
