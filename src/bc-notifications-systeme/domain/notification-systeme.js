const NOTIFICATION_PORTEES = Object.freeze(["GLOBAL", "ATELIER"]);
const NOTIFICATION_CANAUX = Object.freeze(["IN_APP"]);
const NOTIFICATION_STATUTS = Object.freeze(["BROUILLON", "ENVOYEE"]);

function normalizeUpper(value) {
  return String(value || "").trim().toUpperCase();
}

export class NotificationSysteme {
  constructor({
    idNotification,
    portee,
    atelierId = null,
    titre,
    message,
    canal = "IN_APP",
    statut = "ENVOYEE",
    creeParUserId,
    creeParNom,
    dateCreation = null,
    dateEnvoi = null
  }) {
    this.idNotification = String(idNotification || "").trim();
    this.portee = normalizeUpper(portee);
    this.atelierId = atelierId ? String(atelierId).trim() : null;
    this.titre = String(titre || "").trim();
    this.message = String(message || "").trim();
    this.canal = normalizeUpper(canal);
    this.statut = normalizeUpper(statut);
    this.creeParUserId = String(creeParUserId || "").trim();
    this.creeParNom = String(creeParNom || "").trim();
    this.dateCreation = dateCreation || null;
    this.dateEnvoi = dateEnvoi || null;

    if (!this.idNotification) throw new Error("idNotification requis");
    if (!NOTIFICATION_PORTEES.includes(this.portee)) throw new Error("Portee notification invalide");
    if (this.portee === "ATELIER" && !this.atelierId) throw new Error("atelierId requis pour une notification atelier");
    if (!this.titre) throw new Error("Titre notification requis");
    if (!this.message) throw new Error("Message notification requis");
    if (!NOTIFICATION_CANAUX.includes(this.canal)) throw new Error("Canal notification invalide");
    if (!NOTIFICATION_STATUTS.includes(this.statut)) throw new Error("Statut notification invalide");
    if (!this.creeParUserId) throw new Error("Auteur notification requis");
    if (!this.creeParNom) throw new Error("Nom auteur notification requis");
  }
}

export { NOTIFICATION_PORTEES, NOTIFICATION_CANAUX, NOTIFICATION_STATUTS };
