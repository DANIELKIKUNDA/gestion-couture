export async function ajusterStock({ idArticle, input, articleRepo }) {
  const article = await articleRepo.getById(idArticle);
  if (!article) throw new Error("Article introuvable");
  article.ajusterStock(input);
  await articleRepo.save(article);
  return article;
}
