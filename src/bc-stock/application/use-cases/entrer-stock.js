import { generateMouvementId, generateOperationId } from "../../../shared/domain/id-generator.js";

export async function entrerStock({ idArticle, input, articleRepo, caisseRepo, idCaisseJour, fournisseurRepo }) {
  const article = await articleRepo.getById(idArticle);
  if (!article) throw new Error("Article introuvable");

  const motif = String(input?.motif || "").toUpperCase();
  const isAchat = motif === "ACHAT";
  let fournisseurNom = String(input?.fournisseur || "").trim() || null;
  if (input?.fournisseurId) {
    if (!fournisseurRepo || typeof fournisseurRepo.getActiveById !== "function") {
      throw new Error("Configuration fournisseur manquante");
    }
    const fournisseur = await fournisseurRepo.getActiveById(input.fournisseurId);
    if (!fournisseur) throw new Error("Fournisseur introuvable");
    fournisseurNom = fournisseur.nomFournisseur;
  }

  const mouvementInput = {
    idMouvement: input?.idMouvement || generateMouvementId(),
    quantite: input?.quantite,
    motif,
    utilisateur: input?.utilisateur,
    referenceMetier: input?.referenceMetier || input?.referenceAchat || null,
    fournisseurId: input?.fournisseurId || null,
    fournisseur: fournisseurNom,
    referenceAchat: input?.referenceAchat || null,
    prixAchatUnitaire: input?.prixAchatUnitaire === undefined ? null : input.prixAchatUnitaire
  };

  let caisse = null;
  if (isAchat) {
    const prixAchatUnitaire = Number(mouvementInput.prixAchatUnitaire);
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
      montant: Number(mouvementInput.quantite || 0) * prixAchatUnitaire,
      motif: "ACHAT_STOCK",
      referenceMetier: mouvementInput.idMouvement || null,
      utilisateur: mouvementInput.utilisateur,
      // Achat stock is operational spend that should not be blocked by daily result.
      typeDepense: "EXCEPTIONNELLE",
      justification: "Achat stock",
      role: "ADMIN"
    });
  }

  article.entrerStock(mouvementInput);
  await articleRepo.save(article);

  if (isAchat) {
    await caisseRepo.save(caisse);
  }

  return article;
}
