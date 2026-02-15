import { CaisseJour } from "../../domain/caisse-jour.js";
import { StatutCaisse } from "../../domain/value-objects.js";

// Create a CaisseJour from input (does not persist)
export function creerCaisseJour(input) {
  return new CaisseJour({
    ...input,
    statutCaisse: StatutCaisse.OUVERTE,
    dateOuverture: input.dateOuverture || new Date().toISOString()
  });
}
