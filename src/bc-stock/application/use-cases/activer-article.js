export async function activerArticle({ idArticle, articleRepo }) {
  const article = await articleRepo.getById(idArticle);
  if (!article) throw new Error("Article introuvable");
  article.activer();
  await articleRepo.save(article);
  return article;
}
