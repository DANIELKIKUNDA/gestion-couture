import assert from "assert";
import { creerArticle } from "../src/bc-stock/application/use-cases/creer-article.js";

function run() {
  const a = creerArticle({
    idArticle: "A-1",
    nomArticle: "Tissu bleu",
    categorieArticle: "TISSU",
    uniteStock: "METRE",
    quantiteDisponible: 10
  });
  a.entrerStock({ idMouvement: "M-1", quantite: 5, motif: "ACHAT", utilisateur: "admin" });
  a.sortirStock({ idMouvement: "M-2", quantite: 3, motif: "USAGE_ATELIER", utilisateur: "admin" });
  assert.equal(a.quantiteDisponible, 12);
}

run();
console.log("OK: stock use cases");
