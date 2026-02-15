export async function desactiverArticle({ idArticle, articleRepo }) {
  const article = await articleRepo.getById(idArticle);
  if (!article) throw new Error("Article introuvable");
  article.desactiver();
  await articleRepo.save(article);
  return article;
}
