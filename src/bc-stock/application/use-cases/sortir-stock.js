export async function sortirStock({ idArticle, input, articleRepo }) {
  const article = await articleRepo.getById(idArticle);
  if (!article) throw new Error("Article introuvable");
  article.sortirStock(input);
  await articleRepo.save(article);
  return article;
}
