import { generateOperationId } from "../../../shared/domain/id-generator.js";

export async function entrerStock({ idArticle, input, articleRepo, caisseRepo, idCaisseJour }) {
  const article = await articleRepo.getById(idArticle);
  if (!article) throw new Error("Article introuvable");

  const motif = String(input?.motif || "").toUpperCase();
  const isAchat = motif === "ACHAT";

  let caisse = null;
  if (isAchat) {
    const prixAchatUnitaire = Number(input?.prixAchatUnitaire);
    if (!Number.isFinite(prixAchatUnitaire) || prixAchatUnitaire < 0) {
      throw new Error("prixAchatUnitaire requis pour motif ACHAT");
    }
    if (!caisseRepo) {
      throw new Error("Configuration caisse manquante");
    }

    if (idCaisseJour) {
      caisse = await caisseRepo.getById(idCaisseJour);
    } else if (typeof caisseRepo.getByDate === "function") {
      const now = new Date();
      const dateKinshasa = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Kinshasa",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(now);
      caisse = await caisseRepo.getByDate(dateKinshasa);
      if (!caisse) {
        const dateIso = now.toISOString().slice(0, 10);
        caisse = await caisseRepo.getByDate(dateIso);
      }
    }

    if (!caisse) throw new Error("Caisse du jour introuvable");
    try {
      caisse.assertOuverte();
    } catch (err) {
      if (String(err?.name || "") === "CaisseCloturee") {
        throw new Error("Caisse cloturee: achat impossible");
      }
      throw err;
    }
    caisse.enregistrerSortie({
      idOperation: generateOperationId(),
      montant: Number(input.quantite || 0) * prixAchatUnitaire,
      motif: "ACHAT_STOCK",
      referenceMetier: input.idMouvement || null,
      utilisateur: input.utilisateur,
      // Achat stock is operational spend that should not be blocked by daily result.
      typeDepense: "EXCEPTIONNELLE",
      justification: "Achat stock",
      role: "ADMIN"
    });
  }

  article.entrerStock(input);
  await articleRepo.save(article);

  if (isAchat) {
    await caisseRepo.save(caisse);
  }

  return article;
}
