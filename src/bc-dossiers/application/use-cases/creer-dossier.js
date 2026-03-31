import { Dossier } from "../../domain/dossier.js";
import { generateDossierId } from "../../../shared/domain/id-generator.js";

export function creerDossier({
  idDossier,
  responsableClient,
  typeDossier = "INDIVIDUEL",
  notes = "",
  creePar = null
} = {}) {
  return new Dossier({
    idDossier: String(idDossier || "").trim() || generateDossierId(),
    idResponsableClient: responsableClient?.idClient,
    nomResponsableSnapshot: responsableClient?.nom,
    prenomResponsableSnapshot: responsableClient?.prenom,
    telephoneResponsableSnapshot: responsableClient?.telephone || "",
    typeDossier,
    notes,
    creePar
  });
}
