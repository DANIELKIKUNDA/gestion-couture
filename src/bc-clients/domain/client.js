import { assertNonEmpty, assertPhone } from "./value-objects.js";
import { ClientInvalide } from "./errors.js";

export class Client {
  constructor({ idClient, nom, prenom, telephone, adresse = null, sexe = null, actif = true, dateCreation }) {
    try {
      assertNonEmpty(idClient, "idClient");
      assertNonEmpty(nom, "nom");
      assertNonEmpty(prenom, "prenom");
      assertPhone(telephone);
    } catch (e) {
      throw new ClientInvalide(e.message);
    }

    this.idClient = idClient;
    this.nom = nom;
    this.prenom = prenom;
    this.telephone = telephone;
    this.adresse = adresse;
    this.sexe = sexe;
    this.actif = actif;
    this.dateCreation = dateCreation || new Date().toISOString();
  }

  modifier({ nom, prenom, telephone, adresse, sexe }) {
    if (nom) this.nom = nom;
    if (prenom) this.prenom = prenom;
    if (telephone) this.telephone = telephone;
    if (adresse !== undefined) this.adresse = adresse;
    if (sexe !== undefined) this.sexe = sexe;
  }

  desactiver() {
    this.actif = false;
  }
}
