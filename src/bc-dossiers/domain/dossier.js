function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeTypeDossier(value) {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === "FAMILLE" || normalized === "GROUPE") return normalized;
  return "INDIVIDUEL";
}

function normalizeStatut(value) {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === "SOLDE" || normalized === "CLOTURE") return normalized;
  return "ACTIF";
}

export class Dossier {
  constructor({
    idDossier,
    idResponsableClient,
    nomResponsableSnapshot,
    prenomResponsableSnapshot,
    telephoneResponsableSnapshot = "",
    typeDossier = "INDIVIDUEL",
    statut = "ACTIF",
    notes = "",
    creePar = null,
    modifieParDernier = null,
    dateCreation = new Date().toISOString(),
    dateDerniereActivite = null
  }) {
    const normalizedId = normalizeText(idDossier);
    const normalizedResponsable = normalizeText(idResponsableClient);
    if (!normalizedId) throw new Error("idDossier obligatoire");
    if (!normalizedResponsable) throw new Error("idResponsableClient obligatoire");
    if (!normalizeText(nomResponsableSnapshot) || !normalizeText(prenomResponsableSnapshot)) {
      throw new Error("Identite du responsable obligatoire");
    }

    this.idDossier = normalizedId;
    this.idResponsableClient = normalizedResponsable;
    this.nomResponsableSnapshot = normalizeText(nomResponsableSnapshot);
    this.prenomResponsableSnapshot = normalizeText(prenomResponsableSnapshot);
    this.telephoneResponsableSnapshot = normalizeText(telephoneResponsableSnapshot);
    this.typeDossier = normalizeTypeDossier(typeDossier);
    this.statut = normalizeStatut(statut);
    this.notes = String(notes || "").trim();
    this.creePar = normalizeText(creePar) || null;
    this.modifieParDernier = normalizeText(modifieParDernier) || null;
    this.dateCreation = dateCreation;
    this.dateDerniereActivite = dateDerniereActivite || dateCreation;
  }

  toucher(modifiePar = null) {
    this.modifieParDernier = normalizeText(modifiePar) || this.modifieParDernier || null;
    this.dateDerniereActivite = new Date().toISOString();
  }

  toSnapshot() {
    return {
      idDossier: this.idDossier,
      idResponsableClient: this.idResponsableClient,
      nomResponsableSnapshot: this.nomResponsableSnapshot,
      prenomResponsableSnapshot: this.prenomResponsableSnapshot,
      telephoneResponsableSnapshot: this.telephoneResponsableSnapshot,
      typeDossier: this.typeDossier,
      statut: this.statut,
      notes: this.notes,
      creePar: this.creePar,
      modifieParDernier: this.modifieParDernier,
      dateCreation: this.dateCreation,
      dateDerniereActivite: this.dateDerniereActivite
    };
  }
}
