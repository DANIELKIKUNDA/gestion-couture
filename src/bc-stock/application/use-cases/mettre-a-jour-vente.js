import { ArticleInexistant, VenteIntrouvable, VenteInvalide } from "../../domain/errors.js";
import { generateVenteLigneId } from "../../../shared/domain/id-generator.js";

export async function mettreAJourVente({ idVente, lignesVente, articleRepo, venteRepo }) {
  const vente = await venteRepo.getById(idVente);
  if (!vente) throw new VenteIntrouvable("Vente introuvable");

  const lignes = lignesVente || [];
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw new VenteInvalide("lignesVente must contain at least one line");
  }

  const nouvellesLignes = [];
  for (const ligne of lignes) {
    const idArticle = ligne.idArticle;
    const article = await articleRepo.getById(idArticle);
    if (!article) throw new ArticleInexistant(`Article ${idArticle} introuvable`);
    article.assertActif();

    nouvellesLignes.push({
      idLigne: generateVenteLigneId(),
      idArticle: article.idArticle,
      libelleArticle: article.nomArticle,
      quantite: Number(ligne.quantite),
      prixUnitaire: Number(article.prixVenteUnitaire || 0)
    });
  }

  vente.setLignes(nouvellesLignes);
  await venteRepo.save(vente);
  return vente;
}
