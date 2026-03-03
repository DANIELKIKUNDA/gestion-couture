import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { ArticleRepoPg } from "../../infrastructure/repositories/article-repo-pg.js";
import { VenteRepoPg } from "../../infrastructure/repositories/vente-repo-pg.js";
import { creerArticle } from "../../application/use-cases/creer-article.js";
import { entrerStock } from "../../application/use-cases/entrer-stock.js";
import { sortirStock } from "../../application/use-cases/sortir-stock.js";
import { ajusterStock } from "../../application/use-cases/ajuster-stock.js";
import { activerArticle } from "../../application/use-cases/activer-article.js";
import { desactiverArticle } from "../../application/use-cases/desactiver-article.js";
import { creerVente } from "../../application/use-cases/creer-vente.js";
import { mettreAJourVente } from "../../application/use-cases/mettre-a-jour-vente.js";
import { validerVente } from "../../application/use-cases/valider-vente.js";
import { annulerVente } from "../../application/use-cases/annuler-vente.js";
import { requireFields, requireNumber, validateSchema } from "../../../shared/interfaces/validation.js";
import { generateArticleId, generateMouvementId } from "../../../shared/domain/id-generator.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { z } from "zod";
import { PERMISSIONS } from "../../../bc-auth/domain/permissions.js";
import { requirePermission } from "../../../bc-auth/interfaces/http/middlewares/require-permission.js";

const router = express.Router();
const articleRepo = new ArticleRepoPg();
const venteRepo = new VenteRepoPg();
const caisseRepo = new CaisseRepoPg();

function generateSupplierId() {
  return `FOU-${Math.random().toString(16).slice(2, 12).toUpperCase()}`;
}

function generatePriceHistoryId() {
  return `PRX-${Math.random().toString(16).slice(2, 12).toUpperCase()}`;
}

// List articles
router.get("/stock/articles", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_article,
              nom_article,
              categorie_article,
              unite_stock,
              quantite_disponible,
              prix_achat_moyen,
              prix_vente_unitaire,
              seuil_alerte,
              actif
       FROM articles
       ORDER BY nom_article ASC`
    );

    res.json(
      result.rows.map((row) => ({
        idArticle: row.id_article,
        nomArticle: row.nom_article,
        categorieArticle: row.categorie_article,
        uniteStock: row.unite_stock,
        quantiteDisponible: Number(row.quantite_disponible),
        prixAchatMoyen: Number(row.prix_achat_moyen || 0),
        prixVenteUnitaire: Number(row.prix_vente_unitaire),
        seuilAlerte: Number(row.seuil_alerte),
        actif: row.actif
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List suppliers
router.get("/stock/fournisseurs", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_fournisseur, nom_fournisseur, telephone, actif, date_creation
       FROM fournisseurs
       ORDER BY nom_fournisseur ASC`
    );
    res.json(
      result.rows.map((row) => ({
        idFournisseur: row.id_fournisseur,
        nomFournisseur: row.nom_fournisseur,
        telephone: row.telephone || null,
        actif: row.actif,
        dateCreation: row.date_creation
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create supplier
router.post("/stock/fournisseurs", async (req, res) => {
  const schema = z
    .object({
      nomFournisseur: z.string().min(1),
      telephone: z.string().optional(),
      actif: z.boolean().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const idFournisseur = generateSupplierId();
  try {
    const result = await pool.query(
      `INSERT INTO fournisseurs (id_fournisseur, nom_fournisseur, telephone, actif)
       VALUES ($1, $2, $3, $4)
       RETURNING id_fournisseur, nom_fournisseur, telephone, actif, date_creation`,
      [idFournisseur, body.nomFournisseur.trim(), body.telephone?.trim() || null, body.actif !== false]
    );
    const row = result.rows[0];
    res.status(201).json({
      idFournisseur: row.id_fournisseur,
      nomFournisseur: row.nom_fournisseur,
      telephone: row.telephone || null,
      actif: row.actif,
      dateCreation: row.date_creation
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update supplier
router.put("/stock/fournisseurs/:id", async (req, res) => {
  const schema = z
    .object({
      nomFournisseur: z.string().min(1).optional(),
      telephone: z.string().optional(),
      actif: z.boolean().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const hasChanges = ["nomFournisseur", "telephone", "actif"].some((field) => body[field] !== undefined);
  if (!hasChanges) return res.status(400).json({ error: "Aucune modification fournie" });

  try {
    const current = await pool.query(
      "SELECT id_fournisseur, nom_fournisseur, telephone, actif, date_creation FROM fournisseurs WHERE id_fournisseur = $1",
      [req.params.id]
    );
    if (current.rowCount === 0) return res.status(404).json({ error: "Fournisseur introuvable" });
    const row = current.rows[0];
    const nom = body.nomFournisseur !== undefined ? body.nomFournisseur.trim() : row.nom_fournisseur;
    const telephone = body.telephone !== undefined ? body.telephone?.trim() || null : row.telephone;
    const actif = body.actif !== undefined ? body.actif : row.actif;

    const updated = await pool.query(
      `UPDATE fournisseurs
       SET nom_fournisseur = $2, telephone = $3, actif = $4
       WHERE id_fournisseur = $1
       RETURNING id_fournisseur, nom_fournisseur, telephone, actif, date_creation`,
      [req.params.id, nom, telephone, actif]
    );
    const out = updated.rows[0];
    res.json({
      idFournisseur: out.id_fournisseur,
      nomFournisseur: out.nom_fournisseur,
      telephone: out.telephone || null,
      actif: out.actif,
      dateCreation: out.date_creation
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List article price history
router.get("/stock/articles/:id/prix-historique", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_historique, id_article, ancien_prix, nouveau_prix, date_modification, modifie_par
       FROM stock_prix_historique
       WHERE id_article = $1
       ORDER BY date_modification DESC`,
      [req.params.id]
    );
    res.json(
      result.rows.map((row) => ({
        idHistorique: row.id_historique,
        idArticle: row.id_article,
        ancienPrix: Number(row.ancien_prix),
        nouveauPrix: Number(row.nouveau_prix),
        dateModification: row.date_modification,
        modifiePar: row.modifie_par || null
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Audit stock & ventes (read-only)
router.get("/audit/stock-ventes", requirePermission(PERMISSIONS.VOIR_BILANS_GLOBAUX), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        m.id_mouvement,
        m.id_article,
        m.type_mouvement,
        m.quantite,
        m.motif,
        m.date_mouvement,
        m.effectue_par,
        m.reference_metier,
        m.fournisseur_id,
        m.fournisseur,
        m.reference_achat,
        m.prix_achat_unitaire,
        m.montant_achat_total,
        a.nom_article,
        a.prix_vente_unitaire,
        f.nom_fournisseur,
        op.id_caisse_jour,
        op.montant AS montant_encaisse
      FROM mouvements_stock m
      INNER JOIN articles a ON a.id_article = m.id_article
      LEFT JOIN fournisseurs f ON f.id_fournisseur = m.fournisseur_id
      LEFT JOIN LATERAL (
        SELECT id_caisse_jour, montant
        FROM caisse_operation
        WHERE statut_operation <> 'ANNULEE'
          AND (
            reference_metier = m.reference_metier
            OR reference_metier = m.id_mouvement
          )
          AND motif IN ('VENTE_STOCK', 'PAIEMENT_STOCK')
        ORDER BY date_operation DESC
        LIMIT 1
      ) op ON TRUE
      ORDER BY m.date_mouvement DESC`
    );

    res.json(
      result.rows.map((row) => {
        const quantite = Number(row.quantite || 0);
        const prixUnitaire = Number(row.prix_vente_unitaire || 0);
        return {
          idMouvement: row.id_mouvement,
          idArticle: row.id_article,
          nomArticle: row.nom_article,
          typeMouvement: row.type_mouvement,
          quantite,
          motif: row.motif,
          dateMouvement: row.date_mouvement,
          utilisateur: row.effectue_par,
          referenceMetier: row.reference_metier,
          fournisseurId: row.fournisseur_id || null,
          fournisseur: row.nom_fournisseur || row.fournisseur || null,
          referenceAchat: row.reference_achat || null,
          prixAchatUnitaire: row.prix_achat_unitaire === null ? null : Number(row.prix_achat_unitaire),
          montantAchatTotal: row.montant_achat_total === null ? null : Number(row.montant_achat_total),
          montantUnitaire: prixUnitaire,
          montantEstime:
            row.montant_achat_total === null ? quantite * prixUnitaire : Number(row.montant_achat_total),
          montantEncaisse: row.montant_encaisse === null ? null : Number(row.montant_encaisse),
          idCaisseJour: row.id_caisse_jour || null
        };
      })
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get stock movement detail
router.get("/stock/mouvements/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        m.id_mouvement,
        m.id_article,
        m.type_mouvement,
        m.quantite,
        m.motif,
        m.date_mouvement,
        m.effectue_par,
        m.reference_metier,
        m.fournisseur_id,
        m.fournisseur,
        m.reference_achat,
        m.prix_achat_unitaire,
        m.montant_achat_total,
        a.nom_article,
        a.prix_vente_unitaire,
        f.nom_fournisseur,
        op.id_caisse_jour,
        op.montant AS montant_encaisse
      FROM mouvements_stock m
      INNER JOIN articles a ON a.id_article = m.id_article
      LEFT JOIN fournisseurs f ON f.id_fournisseur = m.fournisseur_id
      LEFT JOIN LATERAL (
        SELECT id_caisse_jour, montant
        FROM caisse_operation
        WHERE statut_operation <> 'ANNULEE'
          AND (
            reference_metier = m.reference_metier
            OR reference_metier = m.id_mouvement
          )
          AND motif IN ('VENTE_STOCK', 'PAIEMENT_STOCK')
        ORDER BY date_operation DESC
        LIMIT 1
      ) op ON TRUE
      WHERE m.id_mouvement = $1
      LIMIT 1`,
      [req.params.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Mouvement introuvable" });
    const row = result.rows[0];
    const quantite = Number(row.quantite || 0);
    const prixUnitaire = Number(row.prix_vente_unitaire || 0);

    res.json({
      idMouvement: row.id_mouvement,
      idArticle: row.id_article,
      nomArticle: row.nom_article,
      typeMouvement: row.type_mouvement,
      quantite,
      motif: row.motif,
      dateMouvement: row.date_mouvement,
      utilisateur: row.effectue_par,
      referenceMetier: row.reference_metier,
      fournisseurId: row.fournisseur_id || null,
      fournisseur: row.nom_fournisseur || row.fournisseur || null,
      referenceAchat: row.reference_achat || null,
      prixAchatUnitaire: row.prix_achat_unitaire === null ? null : Number(row.prix_achat_unitaire),
      montantAchatTotal: row.montant_achat_total === null ? null : Number(row.montant_achat_total),
      montantUnitaire: prixUnitaire,
      montantEstime: row.montant_achat_total === null ? quantite * prixUnitaire : Number(row.montant_achat_total),
      montantEncaisse: row.montant_encaisse === null ? null : Number(row.montant_encaisse),
      idCaisseJour: row.id_caisse_jour || null
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create article
router.post("/stock/articles", async (req, res) => {
  const schema = z
    .object({
      nomArticle: z.string().min(1),
      categorieArticle: z.string().min(1),
      uniteStock: z.string().min(1),
      quantiteDisponible: z.coerce.number().optional(),
      prixAchatInitial: z.coerce.number().optional(),
      prixVenteUnitaire: z.coerce.number().optional(),
      seuilAlerte: z.coerce.number().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["nomArticle", "categorieArticle", "uniteStock"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  if (body.prixAchatInitial !== undefined && (Number.isNaN(body.prixAchatInitial) || body.prixAchatInitial < 0)) {
    return res.status(400).json({ error: "prixAchatInitial invalide" });
  }

  try {
    const article = creerArticle({
      ...body,
      prixAchatMoyen: body.prixAchatInitial ?? 0,
      idArticle: generateArticleId()
    });
    await articleRepo.save(article);
    res.status(201).json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update article metadata (price, seuil, etc.)
router.put("/stock/articles/:id", async (req, res) => {
  const schema = z
    .object({
      nomArticle: z.string().min(1).optional(),
      categorieArticle: z.string().min(1).optional(),
      uniteStock: z.string().min(1).optional(),
      prixVenteUnitaire: z.coerce.number().optional(),
      seuilAlerte: z.coerce.number().optional(),
      actif: z.boolean().optional(),
      updatedBy: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;

  const hasChanges = ["nomArticle", "categorieArticle", "uniteStock", "prixVenteUnitaire", "seuilAlerte", "actif"].some(
    (field) => body[field] !== undefined
  );
  if (!hasChanges) return res.status(400).json({ error: "Aucune modification fournie" });

  if (body.prixVenteUnitaire !== undefined && (Number.isNaN(body.prixVenteUnitaire) || body.prixVenteUnitaire < 0)) {
    return res.status(400).json({ error: "prixVenteUnitaire invalide" });
  }
  if (body.seuilAlerte !== undefined && (Number.isNaN(body.seuilAlerte) || body.seuilAlerte < 0)) {
    return res.status(400).json({ error: "seuilAlerte invalide" });
  }

  try {
    const article = await articleRepo.getById(req.params.id);
    if (!article) return res.status(404).json({ error: "Article introuvable" });
    const oldPrice = Number(article.prixVenteUnitaire || 0);

    if (body.nomArticle !== undefined) article.nomArticle = body.nomArticle;
    if (body.categorieArticle !== undefined) article.categorieArticle = body.categorieArticle;
    if (body.uniteStock !== undefined) article.uniteStock = body.uniteStock;
    if (body.prixVenteUnitaire !== undefined) article.prixVenteUnitaire = body.prixVenteUnitaire;
    if (body.seuilAlerte !== undefined) article.seuilAlerte = body.seuilAlerte;
    if (body.actif !== undefined) article.actif = body.actif;

    await articleRepo.save(article);
    if (body.prixVenteUnitaire !== undefined && oldPrice !== body.prixVenteUnitaire) {
      await pool.query(
        `INSERT INTO stock_prix_historique (id_historique, id_article, ancien_prix, nouveau_prix, modifie_par)
         VALUES ($1, $2, $3, $4, $5)`,
        [generatePriceHistoryId(), article.idArticle, oldPrice, body.prixVenteUnitaire, body.updatedBy || null]
      );
    }
    res.json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Entrer stock
router.post("/stock/articles/:id/entrees", async (req, res) => {
  const schema = z
    .object({
      quantite: z.coerce.number(),
      motif: z.string().min(1),
      utilisateur: z.string().min(1),
      idCaisseJour: z.string().optional(),
      referenceMetier: z.string().optional(),
      fournisseurId: z.string().optional(),
      fournisseur: z.string().optional(),
      referenceAchat: z.string().optional(),
      prixAchatUnitaire: z.coerce.number().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["quantite", "motif", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "quantite");
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  if (String(body.motif || "").toUpperCase() === "ACHAT" && (body.prixAchatUnitaire === undefined || body.prixAchatUnitaire === null)) {
    return res.status(400).json({ error: "prixAchatUnitaire requis pour motif ACHAT" });
  }
  if (body.prixAchatUnitaire !== undefined && (Number.isNaN(body.prixAchatUnitaire) || body.prixAchatUnitaire < 0)) {
    return res.status(400).json({ error: "prixAchatUnitaire invalide" });
  }

  try {
    let fournisseurNom = body.fournisseur || null;
    if (body.fournisseurId) {
      const supplierRes = await pool.query(
        "SELECT id_fournisseur, nom_fournisseur FROM fournisseurs WHERE id_fournisseur = $1 AND actif = true",
        [body.fournisseurId]
      );
      if (supplierRes.rowCount === 0) return res.status(400).json({ error: "Fournisseur introuvable" });
      fournisseurNom = supplierRes.rows[0].nom_fournisseur;
    }
    const article = await entrerStock({
      idArticle: req.params.id,
      input: {
        idMouvement: generateMouvementId(),
        quantite: body.quantite,
        motif: body.motif,
        utilisateur: body.utilisateur,
        referenceMetier: body.referenceMetier || body.referenceAchat || null,
        fournisseurId: body.fournisseurId || null,
        fournisseur: fournisseurNom,
        referenceAchat: body.referenceAchat || null,
        prixAchatUnitaire: body.prixAchatUnitaire === undefined ? null : body.prixAchatUnitaire
      },
      articleRepo,
      caisseRepo,
      idCaisseJour: body.idCaisseJour || null
    });
    res.json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Sortir stock
router.post("/stock/articles/:id/sorties", async (req, res) => {
  const schema = z
    .object({
      quantite: z.coerce.number(),
      motif: z.string().min(1),
      utilisateur: z.string().min(1),
      referenceMetier: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["quantite", "motif", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "quantite");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const article = await sortirStock({
      idArticle: req.params.id,
      input: {
        idMouvement: generateMouvementId(),
        quantite: body.quantite,
        motif: body.motif,
        utilisateur: body.utilisateur,
        referenceMetier: body.referenceMetier || null
      },
      articleRepo
    });
    res.json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Ajuster stock
router.post("/stock/articles/:id/ajuster", async (req, res) => {
  const schema = z
    .object({
      quantite: z.coerce.number(),
      motif: z.string().min(1),
      utilisateur: z.string().min(1),
      referenceMetier: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["quantite", "motif", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "quantite");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const article = await ajusterStock({
      idArticle: req.params.id,
      input: {
        idMouvement: generateMouvementId(),
        quantite: body.quantite,
        motif: body.motif,
        utilisateur: body.utilisateur,
        referenceMetier: body.referenceMetier || null
      },
      articleRepo
    });
    res.json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Activer article
router.post("/stock/articles/:id/activer", async (req, res) => {
  try {
    const article = await activerArticle({ idArticle: req.params.id, articleRepo });
    res.json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Desactiver article
router.post("/stock/articles/:id/desactiver", async (req, res) => {
  try {
    const article = await desactiverArticle({ idArticle: req.params.id, articleRepo });
    res.json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List ventes
router.get("/ventes", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_vente, date_vente, total, statut, reference_caisse, motif_annulation
              , total_prix_achat, benefice_total
       FROM ventes
       ORDER BY date_vente DESC`
    );

    res.json(
      result.rows.map((row) => ({
        idVente: row.id_vente,
        date: row.date_vente,
        total: Number(row.total),
        totalPrixAchat: Number(row.total_prix_achat || 0),
        beneficeTotal: Number(row.benefice_total || 0),
        statut: row.statut,
        referenceCaisse: row.reference_caisse,
        motifAnnulation: row.motif_annulation || null
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get vente detail
router.get("/ventes/:id", async (req, res) => {
  try {
    const vente = await venteRepo.getById(req.params.id);
    if (!vente) return res.status(404).json({ error: "Vente introuvable" });

    res.json({
      idVente: vente.idVente,
      date: vente.date,
      total: Number(vente.total),
      totalPrixAchat: Number(vente.totalPrixAchat || 0),
      beneficeTotal: Number(vente.beneficeTotal || 0),
      statut: vente.statut,
      referenceCaisse: vente.referenceCaisse,
      motifAnnulation: vente.motifAnnulation || null,
      lignesVente: vente.lignesVente.map((ligne) => ({
        ...ligne,
        prixAchatUnitaire: Number(ligne.prixAchatUnitaire || 0),
        beneficeUnitaire: Number(ligne.beneficeUnitaire || 0),
        beneficeTotal: Number(ligne.beneficeTotal || 0)
      }))
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Creer vente (brouillon)
router.post("/ventes", async (req, res) => {
  const schema = z
    .object({
      lignesVente: z.array(z.any())
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["lignesVente"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const vente = await creerVente({
      input: body,
      articleRepo,
      venteRepo
    });
    res.status(201).json(vente);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Modifier lignes vente (brouillon uniquement)
router.post("/ventes/:id/lignes", async (req, res) => {
  const schema = z
    .object({
      lignesVente: z.array(z.any())
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["lignesVente"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const vente = await mettreAJourVente({
      idVente: req.params.id,
      lignesVente: body.lignesVente,
      articleRepo,
      venteRepo
    });
    res.json(vente);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Valider vente
router.post("/ventes/:id/valider", async (req, res) => {
  const schema = z
    .object({
      idCaisseJour: z.string().min(1),
      utilisateur: z.string().min(1),
      modePaiement: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["idCaisseJour", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const vente = await validerVente({
      idVente: req.params.id,
      idCaisseJour: body.idCaisseJour,
      modePaiement: body.modePaiement || "CASH",
      utilisateur: body.utilisateur,
      venteRepo,
      articleRepo,
      caisseRepo
    });
    res.json(vente);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Annuler vente (brouillon uniquement)
router.post("/ventes/:id/annuler", async (req, res) => {
  try {
    const schema = z
      .object({
        motif: z.string().optional()
      })
      .passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const vente = await annulerVente({
      idVente: req.params.id,
      motif: parsed.data.motif || null,
      venteRepo
    });
    res.json(vente);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
