import assert from "assert";
import { Article } from "../src/bc-stock/domain/article.js";
import { Vente } from "../src/bc-stock/domain/vente.js";
import { creerVente } from "../src/bc-stock/application/use-cases/creer-vente.js";
import { validerVente } from "../src/bc-stock/application/use-cases/valider-vente.js";
import { annulerVente } from "../src/bc-stock/application/use-cases/annuler-vente.js";
import { StatutVente } from "../src/bc-stock/domain/value-objects.js";
import { CaisseJour } from "../src/bc-caisse/domain/caisse-jour.js";
import { StatutCaisse } from "../src/bc-caisse/domain/value-objects.js";

class FakeArticleRepo {
  constructor() {
    this.map = new Map();
  }
  async getById(idArticle) {
    return this.map.get(idArticle) || null;
  }
  async save(article) {
    this.map.set(article.idArticle, article);
  }
}

class FakeVenteRepo {
  constructor() {
    this.map = new Map();
  }
  async getById(idVente) {
    return this.map.get(idVente) || null;
  }
  async save(vente) {
    this.map.set(vente.idVente, vente);
  }
}

class FakeCaisseRepo {
  constructor(caisse) {
    this.caisse = caisse;
  }
  async getById(idCaisseJour) {
    if (!this.caisse || this.caisse.idCaisseJour !== idCaisseJour) return null;
    return this.caisse;
  }
  async save(caisse) {
    this.caisse = caisse;
  }
}

async function run() {
  const articleRepo = new FakeArticleRepo();
  const venteRepo = new FakeVenteRepo();

  const article = new Article({
    idArticle: "ART-1",
    nomArticle: "Tissu bleu",
    categorieArticle: "TISSU",
    uniteStock: "METRE",
    quantiteDisponible: 10,
    prixVenteUnitaire: 500
  });
  await articleRepo.save(article);

  const created = await creerVente({
    input: { lignesVente: [{ idArticle: "ART-1", quantite: 3 }] },
    articleRepo,
    venteRepo
  });
  assert.equal(created.statut, StatutVente.BROUILLON);
  assert.equal(created.total, 1500);

  const cancelled = await annulerVente({
    idVente: created.idVente,
    motif: "Erreur de saisie",
    venteRepo
  });
  assert.equal(cancelled.statut, StatutVente.ANNULEE);
  assert.equal(cancelled.motifAnnulation, "Erreur de saisie");

  const caisse = new CaisseJour({
    idCaisseJour: "CJ-1",
    date: "2026-02-14",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 0,
    operations: []
  });
  const caisseRepo = new FakeCaisseRepo(caisse);

  const created2 = await creerVente({
    input: { lignesVente: [{ idArticle: "ART-1", quantite: 3 }] },
    articleRepo,
    venteRepo
  });

  const validated = await validerVente({
    idVente: created2.idVente,
    idCaisseJour: "CJ-1",
    modePaiement: "CASH",
    utilisateur: "tester",
    venteRepo,
    articleRepo,
    caisseRepo
  });

  assert.equal(validated.statut, StatutVente.VALIDEE);
  assert.ok(validated.referenceCaisse);

  const savedArticle = await articleRepo.getById("ART-1");
  assert.equal(savedArticle.quantiteDisponible, 7);
  assert.equal(savedArticle.mouvements.length, 1);
  assert.equal(savedArticle.mouvements[0].motif, "VENTE");

  const savedCaisse = await caisseRepo.getById("CJ-1");
  assert.equal(savedCaisse.operations.length, 1);
  assert.equal(savedCaisse.operations[0].montant, 1500);
  assert.equal(savedCaisse.operations[0].motif, "VENTE_STOCK");

  const vente = new Vente({
    idVente: "V-2",
    date: "2026-02-14",
    lignesVente: [
      { idLigne: "L-1", idArticle: "ART-1", libelleArticle: "Tissu bleu", quantite: 3, prixUnitaire: 500 },
      { idLigne: "L-2", idArticle: "ART-1", libelleArticle: "Tissu bleu", quantite: 6, prixUnitaire: 500 }
    ],
    statut: StatutVente.BROUILLON
  });
  await venteRepo.save(vente);

  let error = null;
  try {
    await validerVente({
      idVente: "V-2",
      idCaisseJour: "CJ-1",
      modePaiement: "CASH",
      utilisateur: "tester",
      venteRepo,
      articleRepo,
      caisseRepo
    });
  } catch (err) {
    error = err;
  }
  assert.ok(error, "Expected validation error on insufficient stock");
}

run();
console.log("OK: ventes use cases");
