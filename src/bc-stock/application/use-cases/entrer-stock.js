import { generateMouvementId, generateOperationId } from "../../../shared/domain/id-generator.js";
import { resolveAchatMontants } from "../../domain/prix-achat.js";
import { assertCaisseDateDuJour } from "../../../bc-caisse/application/services/caisse-date-guard.js";
import {
  findAndAssertIdempotentOperation,
  normalizeIdempotencyKey,
  saveCaisseIdempotently
} from "../../../bc-caisse/application/services/idempotency.js";

export async function entrerStock({ idArticle, input, articleRepo, caisseRepo, idCaisseJour, fournisseurRepo, enforceDateDuJour = false, now, timeZone }) {
  const article = await articleRepo.getById(idArticle);
  if (!article) throw new Error("Article introuvable");

  const motif = String(input?.motif || "").toUpperCase();
  const isAchat = motif === "ACHAT";
  const sourceFinancement = normalizeAchatStockSource(input?.sourceFinancement);
  const activiteAchat = sourceFinancement === "ATELIER" ? "ATELIER" : "STOCK";
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
    prixAchatUnitaire: input?.prixAchatUnitaire === undefined ? null : input.prixAchatUnitaire,
    montantAchatTotal: input?.montantAchatTotal === undefined ? null : input.montantAchatTotal
  };

  let caisse = null;
  const idempotencyKey = normalizeIdempotencyKey(input?.idempotencyKey);
  if (isAchat) {
    const achat = resolveAchatMontants({
      quantite: mouvementInput.quantite,
      prixAchatUnitaire: mouvementInput.prixAchatUnitaire,
      montantAchatTotal: mouvementInput.montantAchatTotal
    });
    mouvementInput.prixAchatUnitaire = achat.prixAchatUnitaire;
    mouvementInput.montantAchatTotal = achat.montantAchatTotal;
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
    if (enforceDateDuJour) assertCaisseDateDuJour(caisse, { now, timeZone });
    if (
      findAndAssertIdempotentOperation(caisse, idempotencyKey, {
        typeOperation: "SORTIE",
        montant: mouvementInput.montantAchatTotal,
        motif: "ACHAT_STOCK",
        referenceMetier: mouvementInput.idMouvement || null,
        activite: activiteAchat
      })
    ) return article;
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
      montant: mouvementInput.montantAchatTotal,
      motif: "ACHAT_STOCK",
      referenceMetier: mouvementInput.idMouvement || null,
      utilisateur: mouvementInput.utilisateur,
      // Achat stock is operational spend that should not be blocked by daily result.
      typeDepense: "EXCEPTIONNELLE",
      justification: `Achat stock - ${formatAchatStockSource(sourceFinancement)}`,
      activite: activiteAchat,
      role: "ADMIN",
      idempotencyKey
    });
  }

  article.entrerStock(mouvementInput);
  await articleRepo.save(article);

  if (isAchat) {
    await saveCaisseIdempotently(caisseRepo, caisse, idempotencyKey);
  }

  return article;
}

function normalizeAchatStockSource(value) {
  const source = String(value || "SOLDE_CAISSE").trim().toUpperCase();
  if (source === "ATELIER") return "ATELIER";
  if (source === "STOCK") return "STOCK";
  return "SOLDE_CAISSE";
}

function formatAchatStockSource(value) {
  if (value === "ATELIER") return "budget atelier";
  if (value === "STOCK") return "budget stock";
  return "solde caisse";
}
