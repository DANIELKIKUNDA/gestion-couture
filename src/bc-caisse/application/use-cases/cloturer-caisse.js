// Cloturer la caisse
import { assertCaisseDateDuJour } from "../services/caisse-date-guard.js";

export async function cloturerCaisse({ idCaisseJour, input, caisseRepo, enforceDateDuJour = false, now, timeZone }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");
  if (enforceDateDuJour) assertCaisseDateDuJour(caisse, { now, timeZone });

  caisse.cloturerCaisse(input);
  await caisseRepo.save(caisse);

  return caisse;
}
