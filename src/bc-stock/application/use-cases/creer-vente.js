import { Vente } from "../../domain/vente.js";
import { StatutVente } from "../../domain/value-objects.js";
import { ArticleInexistant, VenteInvalide } from "../../domain/errors.js";
import { generateVenteId, generateVenteLigneId } from "../../../shared/domain/id-generator.js";

export async function creerVente({ input, articleRepo, venteRepo }) {
  const lignes = input?.lignesVente || input?.lignes || [];
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw new VenteInvalide("lignesVente must contain at least one line");
  }

  const lignesVente = [];
  for (const ligne of lignes) {
    const idArticle = ligne.idArticle;
    const article = await articleRepo.getById(idArticle);
    if (!article) throw new ArticleInexistant(`Article ${idArticle} introuvable`);
    article.assertActif();

    lignesVente.push({
      idLigne: generateVenteLigneId(),
      idArticle: article.idArticle,
      libelleArticle: article.nomArticle,
      quantite: Number(ligne.quantite),
      prixUnitaire: Number(article.prixVenteUnitaire || 0)
    });
  }

  const vente = new Vente({
    idVente: generateVenteId(),
    date: input?.date || new Date().toISOString(),
    lignesVente,
    statut: StatutVente.BROUILLON,
    referenceCaisse: null
  });

  await venteRepo.save(vente);
  return vente;
}
