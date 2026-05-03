// Annuler une operation
import { assertCaisseDateDuJour } from "../services/caisse-date-guard.js";

export async function annulerOperation({ idCaisseJour, input, caisseRepo, enforceDateDuJour = false, now, timeZone }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");
  if (enforceDateDuJour) assertCaisseDateDuJour(caisse, { now, timeZone });

  caisse.annulerOperation(input);
  await caisseRepo.save(caisse);

  return caisse;
}
