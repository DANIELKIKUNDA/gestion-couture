import { creerCaisseJour } from "./creer-caisse-jour.js";
import { assertHeureOuvertureAutorisee, determinerSoldeOuverture } from "../../domain/regles-caisse.js";
import { buildDateJour } from "../../domain/horloge-kinshasa.js";
import { StatutCaisse } from "../../domain/value-objects.js";
import { CaisseDejaCreeeJour, CaissePrecedenteNonCloturee } from "../../domain/errors.js";
import { generateCaisseJourId } from "../../../shared/domain/id-generator.js";

export async function ouvrirCaisseDuJour({
  utilisateur,
  soldeInitial,
  overrideHeureOuverture = false,
  role = "",
  motifOverride = "",
  caisseRepo,
  now = new Date(),
  timeZone
}) {
  const parts = assertHeureOuvertureAutorisee({
    now,
    timeZone,
    override: overrideHeureOuverture,
    role,
    motif: motifOverride
  });
  const dateJour = buildDateJour(parts);

  const existing = await caisseRepo.getByDate(dateJour);
  if (existing) throw new CaisseDejaCreeeJour("Caisse deja creee pour ce jour");

  const precedente = await caisseRepo.getLatestBeforeDate(dateJour);
  if (precedente && precedente.statutCaisse !== StatutCaisse.CLOTUREE) {
    throw new CaissePrecedenteNonCloturee("Caisse precedente non cloturee");
  }

  const soldeOuverture = determinerSoldeOuverture({
    soldeCloturePrecedent: precedente ? precedente.soldeCloture : null,
    soldeInitial
  });

  const caisse = creerCaisseJour({
    idCaisseJour: generateCaisseJourId(),
    date: dateJour,
    soldeOuverture,
    ouvertePar: utilisateur,
    dateOuverture: now.toISOString(),
    ouvertureAnticipee: parts.ouvertureAnticipee,
    motifOuvertureAnticipee: parts.motifOuvertureAnticipee,
    autoriseePar: parts.ouvertureAnticipee ? utilisateur : null
  });

  await caisseRepo.save(caisse);
  return caisse;
}
