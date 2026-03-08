import { generateMouvementId } from "../../../shared/domain/id-generator.js";

export async function ajusterStock({ idArticle, input, articleRepo }) {
  const article = await articleRepo.getById(idArticle);
  if (!article) throw new Error("Article introuvable");
  article.ajusterStock({
    ...input,
    idMouvement: input?.idMouvement || generateMouvementId(),
    referenceMetier: input?.referenceMetier || null
  });
  await articleRepo.save(article);
  return article;
}
