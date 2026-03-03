import assert from "assert";
import { creerArticle } from "../src/bc-stock/application/use-cases/creer-article.js";
import { entrerStock } from "../src/bc-stock/application/use-cases/entrer-stock.js";
import { Vente } from "../src/bc-stock/domain/vente.js";
import { CaisseJour } from "../src/bc-caisse/domain/caisse-jour.js";

async function run() {
  const a = creerArticle({
    idArticle: "A-1",
    nomArticle: "Tissu bleu",
    categorieArticle: "TISSU",
    uniteStock: "METRE",
    quantiteDisponible: 10,
    prixAchatMoyen: 10
  });
  a.entrerStock({ idMouvement: "M-1", quantite: 5, motif: "ACHAT", utilisateur: "admin", prixAchatUnitaire: 20 });
  a.sortirStock({ idMouvement: "M-2", quantite: 3, motif: "USAGE_ATELIER", utilisateur: "admin" });
  assert.equal(a.quantiteDisponible, 12);
  assert.equal(Number(a.prixAchatMoyen.toFixed(2)), 13.33);

  const vente = new Vente({
    idVente: "V-TEST",
    lignesVente: [{ idLigne: "L-1", idArticle: "A-1", libelleArticle: "Tissu bleu", quantite: 2, prixUnitaire: 30, prixAchatUnitaire: 12 }]
  });
  assert.equal(vente.total, 60);
  assert.equal(vente.totalPrixAchat, 24);
  assert.equal(vente.beneficeTotal, 36);

  const articleAchat = creerArticle({
    idArticle: "A-ACHAT",
    nomArticle: "Fil noir",
    categorieArticle: "FIL",
    uniteStock: "PIECE",
    quantiteDisponible: 0,
    prixAchatMoyen: 0
  });
  const caisse = new CaisseJour({
    idCaisseJour: "CJ-1",
    date: "2026-02-20",
    statutCaisse: "OUVERTE",
    soldeOuverture: 100
  });
  const articleRepo = {
    async getById(id) {
      return id === "A-ACHAT" ? articleAchat : null;
    },
    async save() {}
  };
  const caisseRepo = {
    async getById(id) {
      return id === "CJ-1" ? caisse : null;
    },
    async save() {}
  };

  await entrerStock({
    idArticle: "A-ACHAT",
    input: {
      idMouvement: "M-ACHAT-1",
      quantite: 2,
      motif: "ACHAT",
      utilisateur: "admin",
      prixAchatUnitaire: 15
    },
    articleRepo,
    caisseRepo,
    idCaisseJour: "CJ-1"
  });
  assert.equal(articleAchat.quantiteDisponible, 2);
  assert.equal(caisse.operations.length, 1);
  assert.equal(caisse.operations[0].typeOperation, "SORTIE");
  assert.equal(caisse.operations[0].motif, "ACHAT_STOCK");
  assert.equal(caisse.operations[0].montant, 30);
  assert.equal(caisse.operations[0].referenceMetier, "M-ACHAT-1");
}

run()
  .then(() => {
    console.log("OK: stock use cases");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
