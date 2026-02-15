import { buildDateJour, getKinshasaParts } from "../../domain/horloge-kinshasa.js";
import { selectionnerCaisseACloturer } from "../../domain/cloture-automatique-policy.js";

export async function cloturerCaisseAutomatique({
  caisseRepo,
  utilisateur = "system",
  now = new Date(),
  timeZone
}) {
  const parts = getKinshasaParts(now, timeZone);
  const dateJour = buildDateJour(parts);
  const caisseDuJour = await caisseRepo.getByDate(dateJour);
  const caissesAnterieures = typeof caisseRepo.listBeforeDate === "function"
    ? await caisseRepo.listBeforeDate(dateJour, 60)
    : [];
  const caisse = selectionnerCaisseACloturer({
    parts,
    caisseDuJour,
    caissesAnterieures
  });
  if (!caisse) return null;

  caisse.cloturerCaisse({ utilisateur, dateCloture: now.toISOString() });
  await caisseRepo.save(caisse);
  return caisse;
}
