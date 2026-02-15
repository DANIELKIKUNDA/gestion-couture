export async function entrerStock({ idArticle, input, articleRepo }) {
  const article = await articleRepo.getById(idArticle);
  if (!article) throw new Error("Article introuvable");
  article.entrerStock(input);
  await articleRepo.save(article);
  return article;
}
