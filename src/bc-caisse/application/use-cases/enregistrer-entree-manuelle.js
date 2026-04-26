import { MotifOperation } from "../../domain/value-objects.js";

export async function enregistrerEntreeManuelle({ idCaisseJour, input, caisseRepo }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");

  const justification = String(input?.justification || "").trim();
  if (!justification) {
    throw new Error("Justification obligatoire");
  }

  caisse.enregistrerEntree({
    ...input,
    motif: MotifOperation.ENTREE_MANUELLE,
    referenceMetier: null,
    justification
  });
  await caisseRepo.save(caisse);

  return caisse;
}
