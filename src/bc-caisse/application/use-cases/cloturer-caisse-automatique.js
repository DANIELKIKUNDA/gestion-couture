import { buildDateJour, getKinshasaParts } from "../../domain/horloge-kinshasa.js";
import { resolveClotureAutoConfig, selectionnerCaisseACloturer } from "../../domain/cloture-automatique-policy.js";

export async function cloturerCaisseAutomatique({
  caisseRepo,
  parametresRepo = null,
  utilisateur = "system",
  now = new Date(),
  timeZone
}) {
  const parts = getKinshasaParts(now, timeZone);
  const dateJour = buildDateJour(parts);
  const parametres = parametresRepo && typeof parametresRepo.getCurrent === "function"
    ? await parametresRepo.getCurrent()
    : null;
  const clotureAuto = resolveClotureAutoConfig(parametres?.payload || null);
  const caisseDuJour = await caisseRepo.getByDate(dateJour);
  const caissesAnterieures = typeof caisseRepo.listBeforeDate === "function"
    ? await caisseRepo.listBeforeDate(dateJour, 60)
    : [];
  const caisse = selectionnerCaisseACloturer({
    parts,
    caisseDuJour,
    caissesAnterieures,
    clotureAuto
  });
  if (!caisse) return null;

  caisse.cloturerCaisse({ utilisateur, dateCloture: now.toISOString() });
  await caisseRepo.save(caisse);
  return caisse;
}
