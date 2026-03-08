import { generateMouvementId } from "../../../shared/domain/id-generator.js";

export async function sortirStock({ idArticle, input, articleRepo }) {
  const article = await articleRepo.getById(idArticle);
  if (!article) throw new Error("Article introuvable");
  article.sortirStock({
    ...input,
    idMouvement: input?.idMouvement || generateMouvementId(),
    referenceMetier: input?.referenceMetier || null
  });
  await articleRepo.save(article);
  return article;
}
