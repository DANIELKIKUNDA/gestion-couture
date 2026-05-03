import { CaisseJour } from "../../domain/caisse-jour.js";
import { buildDateJour, getKinshasaParts, TIMEZONE_KINSHASA } from "../../domain/horloge-kinshasa.js";
import { StatutCaisse } from "../../domain/value-objects.js";
import { determinerSoldeOuverture } from "../../domain/regles-caisse.js";
import { generateCaisseJourId } from "../../../shared/domain/id-generator.js";

export async function creerCaisseDuJourClotureeAutomatique({
  caisseRepo,
  utilisateur = "system-auto",
  now = new Date(),
  timeZone = TIMEZONE_KINSHASA
}) {
  const parts = getKinshasaParts(now, timeZone);
  const dateJour = buildDateJour(parts);
  const existing = await caisseRepo.getByDate(dateJour);
  if (existing) return null;

  const precedente = await caisseRepo.getLatestBeforeDate(dateJour);
  if (!precedente) return null;
  if (precedente && precedente.statutCaisse !== StatutCaisse.CLOTUREE) return null;

  const soldeOuverture = determinerSoldeOuverture({
    soldeCloturePrecedent: precedente ? precedente.soldeCloture : null,
    soldeInitial: 0
  });
  const iso = now.toISOString();
  const caisse = new CaisseJour({
    idCaisseJour: generateCaisseJourId(),
    date: dateJour,
    statutCaisse: StatutCaisse.CLOTUREE,
    soldeOuverture,
    soldeCloture: soldeOuverture,
    ouvertePar: utilisateur,
    clotureePar: utilisateur,
    dateOuverture: iso,
    dateCloture: iso
  });

  await caisseRepo.save(caisse);
  return caisse;
}
