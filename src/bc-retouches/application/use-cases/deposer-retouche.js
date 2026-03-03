import { Retouche } from "../../domain/retouche.js";
import { StatutRetouche } from "../../domain/value-objects.js";

// Create a Retouche from input (does not persist)
export function deposerRetouche(input) {
  return new Retouche({
    ...input,
    statutRetouche: StatutRetouche.DEPOSEE,
    dateDepot: input.dateDepot || new Date().toISOString()
  });
}
