import { Commande } from "../../domain/commande.js";
import { StatutCommande } from "../../domain/value-objects.js";

// Create a Commande from input (does not persist)
export function creerCommande(input) {
  return new Commande({
    ...input,
    statutCommande: StatutCommande.CREEE,
    dateCreation: input.dateCreation || new Date().toISOString()
  });
}
