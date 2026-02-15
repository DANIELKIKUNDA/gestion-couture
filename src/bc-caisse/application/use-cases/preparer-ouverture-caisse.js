import { assertHeureOuvertureAutorisee, determinerSoldeOuverture } from "../../domain/regles-caisse.js";
import { buildDateJour } from "../../domain/horloge-kinshasa.js";
import { StatutCaisse } from "../../domain/value-objects.js";
import { CaisseDejaCreeeJour, CaissePrecedenteNonCloturee } from "../../domain/errors.js";

export async function preparerOuvertureCaisseDuJour({
  soldeInitial = 0,
  caisseRepo,
  now = new Date(),
  timeZone,
  overrideHeureOuverture = false,
  role = "",
  motifOverride = ""
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

  const hasPrecedente = Boolean(precedente && precedente.soldeCloture !== null && precedente.soldeCloture !== undefined);
  const soldeOuverture = determinerSoldeOuverture({
    soldeCloturePrecedent: hasPrecedente ? precedente.soldeCloture : null,
    soldeInitial
  });

  return {
    dateJour,
    soldeOuverture,
    source: hasPrecedente ? "PRECEDENT" : "INITIAL_REQUIRED",
    ouvertureAnticipee: parts.ouvertureAnticipee === true,
    motifOuvertureAnticipee: parts.motifOuvertureAnticipee || null
  };
}
