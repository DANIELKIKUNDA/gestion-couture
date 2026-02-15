import { isAfterOrAt } from "./horloge-kinshasa.js";
import { StatutCaisse } from "./value-objects.js";

export const HEURE_CLOTURE_AUTOMATIQUE = 17;
export const MINUTE_CLOTURE_AUTOMATIQUE = 0;

function caisseOuverteLaPlusRecente(caisses = []) {
  for (const caisse of caisses) {
    if (caisse?.statutCaisse === StatutCaisse.OUVERTE) return caisse;
  }
  return null;
}

export function selectionnerCaisseACloturer({ parts, caisseDuJour = null, caissesAnterieures = [] }) {
  // Priorite 1: rattraper une caisse anterieure restee ouverte.
  const caisseRetard = caisseOuverteLaPlusRecente(caissesAnterieures);
  if (caisseRetard) return caisseRetard;

  // Priorite 2: a partir de l'heure de cloture, fermer la caisse du jour si elle est ouverte.
  if (!isAfterOrAt(parts, HEURE_CLOTURE_AUTOMATIQUE, MINUTE_CLOTURE_AUTOMATIQUE)) return null;
  if (!caisseDuJour || caisseDuJour.statutCaisse !== StatutCaisse.OUVERTE) return null;
  return caisseDuJour;
}
