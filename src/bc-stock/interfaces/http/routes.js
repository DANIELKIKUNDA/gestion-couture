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
import { requireFields, requireNumber } from "../../../shared/interfaces/validation.js";
import { generateArticleId, generateMouvementId } from "../../../shared/domain/id-generator.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";

const router = express.Router();
const articleRepo = new ArticleRepoPg();
const venteRepo = new VenteRepoPg();
const caisseRepo = new CaisseRepoPg();

// List articles
router.get("/stock/articles", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_article,
              nom_article,
              categorie_article,
              unite_stock,
              quantite_disponible,
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
        prixVenteUnitaire: Number(row.prix_vente_unitaire),
        seuilAlerte: Number(row.seuil_alerte),
        actif: row.actif
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Audit stock & ventes (read-only)
router.get("/audit/stock-ventes", async (req, res) => {
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
        a.nom_article,
        a.prix_vente_unitaire,
        op.id_caisse_jour,
        op.montant AS montant_encaisse
      FROM mouvements_stock m
      INNER JOIN articles a ON a.id_article = m.id_article
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
      WHERE m.type_mouvement = 'SORTIE'
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
          montantUnitaire: prixUnitaire,
          montantEstime: quantite * prixUnitaire,
          montantEncaisse: row.montant_encaisse === null ? null : Number(row.montant_encaisse),
          idCaisseJour: row.id_caisse_jour || null
        };
      })
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create article
router.post("/stock/articles", async (req, res) => {
  const r1 = requireFields(req.body, ["nomArticle", "categorieArticle", "uniteStock"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const article = creerArticle({
      ...req.body,
      idArticle: generateArticleId()
    });
    await articleRepo.save(article);
    res.status(201).json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Entrer stock
router.post("/stock/articles/:id/entrees", async (req, res) => {
  const r1 = requireFields(req.body, ["quantite", "motif", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "quantite");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const article = await entrerStock({
      idArticle: req.params.id,
      input: {
        idMouvement: generateMouvementId(),
        quantite: req.body.quantite,
        motif: req.body.motif,
        utilisateur: req.body.utilisateur,
        referenceMetier: req.body.referenceMetier || null
      },
      articleRepo
    });
    res.json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Sortir stock
router.post("/stock/articles/:id/sorties", async (req, res) => {
  const r1 = requireFields(req.body, ["quantite", "motif", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "quantite");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const article = await sortirStock({
      idArticle: req.params.id,
      input: {
        idMouvement: generateMouvementId(),
        quantite: req.body.quantite,
        motif: req.body.motif,
        utilisateur: req.body.utilisateur,
        referenceMetier: req.body.referenceMetier || null
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
  const r1 = requireFields(req.body, ["quantite", "motif", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "quantite");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const article = await ajusterStock({
      idArticle: req.params.id,
      input: {
        idMouvement: generateMouvementId(),
        quantite: req.body.quantite,
        motif: req.body.motif,
        utilisateur: req.body.utilisateur,
        referenceMetier: req.body.referenceMetier || null
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
       FROM ventes
       ORDER BY date_vente DESC`
    );

    res.json(
      result.rows.map((row) => ({
        idVente: row.id_vente,
        date: row.date_vente,
        total: Number(row.total),
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
      statut: vente.statut,
      referenceCaisse: vente.referenceCaisse,
      motifAnnulation: vente.motifAnnulation || null,
      lignesVente: vente.lignesVente
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Creer vente (brouillon)
router.post("/ventes", async (req, res) => {
  const r1 = requireFields(req.body, ["lignesVente"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const vente = await creerVente({
      input: req.body,
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
  const r1 = requireFields(req.body, ["lignesVente"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const vente = await mettreAJourVente({
      idVente: req.params.id,
      lignesVente: req.body.lignesVente,
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
  const r1 = requireFields(req.body, ["idCaisseJour", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const vente = await validerVente({
      idVente: req.params.id,
      idCaisseJour: req.body.idCaisseJour,
      modePaiement: req.body.modePaiement || "CASH",
      utilisateur: req.body.utilisateur,
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
    const vente = await annulerVente({
      idVente: req.params.id,
      motif: req.body?.motif || null,
      venteRepo
    });
    res.json(vente);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
