import {
  StatutFacture,
  assertClientSnapshot,
  assertLignesFacture,
  assertNumeroFacture,
  assertTypeOrigine
} from "./value-objects.js";

export class Facture {
  constructor({
    idFacture,
    numeroFacture,
    typeOrigine,
    idOrigine,
    client,
    dateEmission,
    montantTotal,
    referenceCaisse = null,
    lignes
  }) {
    if (!idFacture) throw new Error("idFacture requis");
    assertNumeroFacture(numeroFacture);
    assertTypeOrigine(typeOrigine);
    if (!idOrigine) throw new Error("idOrigine requis");
    assertClientSnapshot(client);
    if (!dateEmission) throw new Error("dateEmission requise");
    if (typeof montantTotal !== "number" || Number.isNaN(montantTotal) || montantTotal < 0) {
      throw new Error("montantTotal invalide");
    }
    assertLignesFacture(lignes);

    this.idFacture = idFacture;
    this.numeroFacture = numeroFacture;
    this.typeOrigine = typeOrigine;
    this.idOrigine = idOrigine;
    this.client = {
      nom: String(client.nom || "").trim(),
      contact: String(client.contact || "").trim()
    };
    this.dateEmission = dateEmission;
    this.montantTotal = Number(montantTotal);
    this.referenceCaisse = referenceCaisse;
    this.lignes = lignes.map((ligne) => ({
      description: String(ligne.description || "").trim(),
      quantite: Number(ligne.quantite),
      prix: Number(ligne.prix),
      montant: Number(ligne.montant ?? Number(ligne.quantite) * Number(ligne.prix))
    }));
  }

  withPaiements(montantPaye) {
    const paye = Number(montantPaye || 0);
    const solde = Math.max(0, this.montantTotal - paye);
    const statut =
      paye <= 0
        ? StatutFacture.EMISE
        : paye < this.montantTotal
          ? StatutFacture.PARTIELLEMENT_PAYEE
          : StatutFacture.SOLDEE;

    return {
      idFacture: this.idFacture,
      numeroFacture: this.numeroFacture,
      typeOrigine: this.typeOrigine,
      idOrigine: this.idOrigine,
      client: this.client,
      dateEmission: this.dateEmission,
      montantTotal: this.montantTotal,
      montantPaye: paye,
      solde,
      statut,
      referenceCaisse: this.referenceCaisse,
      lignes: this.lignes
    };
  }
}
