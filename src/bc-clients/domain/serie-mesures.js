import { assertNonEmpty, assertMesures } from "./value-objects.js";
import { MesureInvalide } from "./errors.js";

export class SerieMesures {
  constructor({ idSerieMesures, idClient, typeVetement, ensembleMesures, datePrise, prisePar, estActive = false, observations = null }) {
    try {
      assertNonEmpty(idSerieMesures, "idSerieMesures");
      assertNonEmpty(idClient, "idClient");
      assertNonEmpty(typeVetement, "typeVetement");
      assertMesures(ensembleMesures);
    } catch (e) {
      throw new MesureInvalide(e.message);
    }

    this.idSerieMesures = idSerieMesures;
    this.idClient = idClient;
    this.typeVetement = typeVetement;
    this.ensembleMesures = ensembleMesures;
    this.datePrise = datePrise || new Date().toISOString();
    this.prisePar = prisePar || null;
    this.estActive = estActive;
    this.observations = observations;
  }

  activer() {
    this.estActive = true;
  }

  desactiver() {
    this.estActive = false;
  }
}
