import { Commande } from "../../domain/commande.js";
import { StatutCommande } from "../../domain/value-objects.js";
import { buildDatePrevueCommande } from "../../domain/commande-policy.js";

// Create a Commande from input (does not persist)
export function creerCommande(input, { policy = null } = {}) {
  const dateCreation = input.dateCreation || new Date().toISOString();
  return new Commande({
    ...input,
    dateCreation,
    datePrevue: buildDatePrevueCommande({
      dateCreation,
      datePrevue: input.datePrevue,
      policy
    }),
    policy,
    statutCommande: StatutCommande.CREEE
  });
}
