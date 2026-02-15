import { ArticleInexistant, VenteIntrouvable } from "../../domain/errors.js";
import { generateMouvementId, generateOperationId } from "../../../shared/domain/id-generator.js";

export async function validerVente({ idVente, idCaisseJour, modePaiement, utilisateur, venteRepo, articleRepo, caisseRepo }) {
  const vente = await venteRepo.getById(idVente);
  if (!vente) throw new VenteIntrouvable("Vente introuvable");

  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");
  caisse.assertOuverte();

  const articles = new Map();
  const quantitesParArticle = new Map();
  for (const ligne of vente.lignesVente) {
    const previous = quantitesParArticle.get(ligne.idArticle) || 0;
    quantitesParArticle.set(ligne.idArticle, previous + Number(ligne.quantite || 0));
  }
  for (const [idArticle, quantiteDemandee] of quantitesParArticle.entries()) {
    const article = await articleRepo.getById(idArticle);
    if (!article) throw new ArticleInexistant(`Article ${idArticle} introuvable`);
    article.assertActif();
    if (article.quantiteDisponible < quantiteDemandee) {
      throw new Error(`Stock insuffisant pour ${article.nomArticle}`);
    }
    articles.set(idArticle, article);
  }

  for (const ligne of vente.lignesVente) {
    const article = articles.get(ligne.idArticle);
    article.sortirStock({
      idMouvement: generateMouvementId(),
      quantite: ligne.quantite,
      motif: "VENTE",
      utilisateur,
      referenceMetier: vente.idVente
    });
    await articleRepo.save(article);
  }

  const idOperation = generateOperationId();
  caisse.enregistrerEntree({
    idOperation,
    montant: vente.total,
    modePaiement,
    motif: "VENTE_STOCK",
    referenceMetier: vente.idVente,
    utilisateur
  });
  await caisseRepo.save(caisse);

  vente.valider({ referenceCaisse: idOperation });
  await venteRepo.save(vente);

  return vente;
}
