import { Article } from "../../domain/article.js";

export function creerArticle(input) {
  return new Article(input);
}
