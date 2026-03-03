import { RetoucheRepoPg } from "../../infrastructure/repositories/retouche-repo-pg.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";

export async function enregistrerPaiementRetoucheViaCaisse({
  idRetouche,
  montant,
  idCaisseJour,
  utilisateur,
  modePaiement = "CASH",
  retoucheRepo = new RetoucheRepoPg(),
  caisseRepo = new CaisseRepoPg()
}) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");

  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");

  caisse.enregistrerEntree({
    idOperation: generateOperationId(),
    montant: Number(montant || 0),
    modePaiement,
    motif: "PAIEMENT_RETOUCHE",
    referenceMetier: idRetouche,
    utilisateur
  });
  retouche.appliquerPaiement(Number(montant || 0));

  await caisseRepo.save(caisse);
  await retoucheRepo.save(retouche);
  return retouche;
}
