import { normalizeRole } from "./roles.js";

export class Utilisateur {
  constructor({ id, nom, email, roleId, actif = true, motDePasseHash = "", atelierId = "ATELIER" } = {}) {
    this.id = id;
    this.nom = String(nom ?? "").trim();
    this.email = String(email ?? "").trim().toLowerCase();
    this.roleId = normalizeRole(roleId);
    this.actif = actif !== false;
    this.motDePasseHash = motDePasseHash;
    this.atelierId = atelierId;
  }

  activer() {
    this.actif = true;
  }

  desactiver() {
    this.actif = false;
  }
}
