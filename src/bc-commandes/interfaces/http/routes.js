import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { CommandeRepoPg } from "../../infrastructure/repositories/commande-repo-pg.js";
import { CommandeLigneRepoPg } from "../../infrastructure/repositories/commande-ligne-repo-pg.js";
import { CommandeMediaRepoPg } from "../../infrastructure/repositories/commande-media-repo-pg.js";
import { CommandeMediaStorageLocal } from "../../infrastructure/storage/commande-media-storage-local.js";
import { ClientRepoPg } from "../../../bc-clients/infrastructure/repositories/client-repo-pg.js";
import { SerieMesuresRepoPg } from "../../../bc-clients/infrastructure/repositories/serie-mesures-repo-pg.js";
import { creerCommande } from "../../application/use-cases/creer-commande.js";
import { terminerTravail } from "../../application/use-cases/terminer-travail.js";
import { appliquerPaiement } from "../../application/use-cases/appliquer-paiement.js";
import { enregistrerPaiementViaCaisse } from "../../application/use-cases/enregistrer-paiement-via-caisse.js";
import { enregistrerPaiementCommandeItemViaCaisse } from "../../application/use-cases/enregistrer-paiement-item-via-caisse.js";
import { livrerCommande } from "../../application/use-cases/livrer-commande.js";
import { annulerCommandeViaCaisse } from "../../application/use-cases/annuler-commande-via-caisse.js";
import { modifierCommandeItem } from "../../application/use-cases/modifier-commande-item.js";
import { listerCommandeMedia } from "../../application/use-cases/lister-commande-media.js";
import { ajouterCommandeMedia } from "../../application/use-cases/ajouter-commande-media.js";
import { supprimerCommandeMedia } from "../../application/use-cases/supprimer-commande-media.js";
import { mettreAJourCommandeMedia } from "../../application/use-cases/mettre-a-jour-commande-media.js";
import { resolveCommandeClientForCreation, serializeCommandeClientConflict } from "../../application/services/resolve-commande-client.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { requireFields, requireNumber, validateSchema } from "../../../shared/interfaces/validation.js";
import { generateCommandeId } from "../../../shared/domain/id-generator.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PERMISSIONS } from "../../../bc-auth/domain/permissions.js";
import { hasPermission, requireAnyPermission, requirePermission } from "../../../bc-auth/interfaces/http/middlewares/require-permission.js";
import { enregistrerEvenementAudit } from "../../../shared/infrastructure/audit-log.js";
import { AtelierParametresRepoPg } from "../../../bc-parametres/infrastructure/repositories/atelier-parametres-repo-pg.js";
import { DossierRepoPg } from "../../../bc-dossiers/infrastructure/repositories/dossier-repo-pg.js";
import { resolveCommandePolicy } from "../../domain/commande-policy.js";
import { processCommandeMediaImage } from "../../infrastructure/storage/commande-media-image.js";
import { cleanupCommandeMediaUpload, commandeMediaUploadSingle } from "./commande-media-upload.js";
import { resolveCommandeLignesForCreation } from "../../application/services/resolve-commande-lignes-for-creation.js";
import { saveLatestMeasuresForClientAndType } from "../../../bc-clients/application/services/measure-prefill-service.js";
import { hasCommandeLignesTable } from "../../infrastructure/repositories/commande-ligne-schema.js";
import { CommandeItemRepoPg } from "../../infrastructure/repositories/commande-item-repo-pg.js";
import { generateCommandeItemId } from "../../../shared/domain/id-generator.js";
import { createMesuresCommande } from "../../../shared/domain/mesures-habit.js";
import { CommandeItem } from "../../domain/commande-item.js";

const router = express.Router();
const commandeRepo = new CommandeRepoPg();
const commandeLigneRepo = new CommandeLigneRepoPg();
const commandeMediaRepo = new CommandeMediaRepoPg();
const commandeItemRepo = new CommandeItemRepoPg();
const commandeMediaStorage = new CommandeMediaStorageLocal();
const clientRepo = new ClientRepoPg();
const serieRepo = new SerieMesuresRepoPg();
const parametresRepo = new AtelierParametresRepoPg();
const dossierRepo = new DossierRepoPg();
const requireCommandeReadAccess = requireAnyPermission([
  PERMISSIONS.VOIR_COMMANDES,
  PERMISSIONS.VOIR_BILANS_GLOBAUX,
  PERMISSIONS.CLOTURER_CAISSE,
  PERMISSIONS.TERMINER_COMMANDE,
  PERMISSIONS.LIVRER_COMMANDE,
  PERMISSIONS.ANNULER_COMMANDE
]);
const requireCommandeCreateAccess = requireAnyPermission([
  PERMISSIONS.CREER_COMMANDE,
  PERMISSIONS.VOIR_BILANS_GLOBAUX,
  PERMISSIONS.CLOTURER_CAISSE
]);

function resolveActeur(req, fallback = null) {
  const utilisateurId = req.auth?.utilisateurId || null;
  const utilisateurNom = req.auth?.nom || String(fallback || "").trim() || null;
  const role = req.auth?.role || null;
  const utilisateur = utilisateurNom ? `${utilisateurNom}${role ? ` (${role})` : ""}` : null;
  return { utilisateurId, utilisateurNom, role, utilisateur };
}

function atelierIdFromReq(req) {
  return String(req.auth?.atelierId || "ATELIER");
}

function scopedCommandeRepo(req) {
  return commandeRepo.forAtelier(atelierIdFromReq(req));
}

function scopedCommandeMediaRepo(req) {
  return commandeMediaRepo.forAtelier(atelierIdFromReq(req));
}

function scopedCommandeItemRepo(req) {
  return commandeItemRepo.forAtelier(atelierIdFromReq(req));
}

function scopedCommandeLigneRepo(req) {
  return commandeLigneRepo.forAtelier(atelierIdFromReq(req));
}

function scopedClientRepo(req) {
  return clientRepo.forAtelier(atelierIdFromReq(req));
}

function scopedSerieRepo(req) {
  return serieRepo.forAtelier(atelierIdFromReq(req));
}

function scopedParametresRepo(req) {
  return parametresRepo.forAtelier(atelierIdFromReq(req));
}

function scopedCaisseRepo(req) {
  return new CaisseRepoPg(atelierIdFromReq(req));
}

function scopedDossierRepo(req) {
  return dossierRepo.forAtelier(atelierIdFromReq(req));
}

const DEBUG_COMMANDE_POLICY = String(process.env.DEBUG_COMMANDE_POLICY || "").toLowerCase() === "true";

function logCommandePolicy(context, meta) {
  if (!DEBUG_COMMANDE_POLICY) return;
  const scope = String(context || "unknown");
  console.info(`[COMMANDES_POLICY] context=${scope} source=${meta.source} version=${meta.version ?? "n/a"}`);
}

async function loadCommandePolicy(context = "unknown", req = null) {
  const repo = req ? scopedParametresRepo(req) : parametresRepo;
  if (!repo || typeof repo.getCurrent !== "function") {
    const meta = {
      policy: resolveCommandePolicy(null),
      payload: null,
      source: "default-no-repo",
      version: null
    };
    logCommandePolicy(context, meta);
    return meta;
  }
  try {
    const current = await repo.getCurrent();
    const meta = {
      policy: resolveCommandePolicy(current?.payload || null),
      payload: current?.payload || null,
      source: current?.payload ? "atelier_parametres" : "default-empty-parametres",
      version: Number(current?.version || 1)
    };
    logCommandePolicy(context, meta);
    return meta;
  } catch {
    const meta = {
      policy: resolveCommandePolicy(null),
      payload: null,
      source: "default-on-error",
      version: null
    };
    logCommandePolicy(context, meta);
    return meta;
  }
}

function actionRulesForCommande(commande, policy) {
  const soldeRestant = Math.max(0, Number(commande.montantTotal || 0) - Number(commande.montantPaye || 0));
  const statut = commande.statutCommande;
  const allowAnnulation = statut !== "LIVREE" && (policy.autoriserAnnulationApresPaiement || Number(commande.montantPaye || 0) === 0);
  const actions = {
    voir: true,
    payer: false,
    terminer: false,
    livrer: false,
    annuler: false,
    modifier: statut !== "LIVREE" && statut !== "ANNULEE" && Number(commande.montantPaye || 0) === 0
  };

  if (statut === "CREEE") {
    actions.payer = soldeRestant > 0;
    actions.annuler = allowAnnulation;
  } else if (statut === "EN_COURS") {
    actions.payer = soldeRestant > 0;
    actions.terminer = true;
    actions.annuler = allowAnnulation;
  } else if (statut === "TERMINEE") {
    actions.payer = soldeRestant > 0;
    actions.livrer = policy.livraisonAutoriseeSeulementSiPaiementTotal ? soldeRestant === 0 : true;
    actions.annuler = allowAnnulation;
  }

  return {
    statutCommande: statut,
    soldeRestant,
    actions
  };
}

function actionRulesForCommandeAvecPermissions(commande, auth, policy) {
  const base = actionRulesForCommande(commande, policy);
  return {
    ...base,
    actions: {
      ...base.actions,
      modifier: base.actions.modifier && hasPermission(auth, PERMISSIONS.CREER_COMMANDE),
      terminer: base.actions.terminer && hasPermission(auth, PERMISSIONS.TERMINER_COMMANDE),
      livrer: base.actions.livrer && hasPermission(auth, PERMISSIONS.LIVRER_COMMANDE),
      annuler: base.actions.annuler && hasPermission(auth, PERMISSIONS.ANNULER_COMMANDE)
    }
  };
}

async function enregistrerEvenementCommande({
  atelierId,
  idCommande,
  typeEvent,
  utilisateur = null,
  ancienStatut = null,
  nouveauStatut = null,
  payload = {}
}, db = pool) {
  const eventPayload = {
    utilisateur,
    ancienStatut,
    nouveauStatut,
    ...payload
  };
  await db.query(
    `INSERT INTO commande_events (id_event, atelier_id, id_commande, type_event, payload, date_event)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
    [randomUUID(), atelierId, idCommande, typeEvent, JSON.stringify(eventPayload)]
  );
}

async function lockCommandeCreation(db, atelierId, idCommande) {
  const lockKey = `commande:create:${String(atelierId || "").trim()}:${String(idCommande || "").trim()}`;
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);
}

function mapCommandeMedia(row) {
  if (!row) return null;
  return {
    idMedia: row.idMedia || row.id_media || "",
    idCommande: row.idCommande || row.id_commande || "",
    idItem: row.idItem || row.id_item || "",
    typeMedia: row.typeMedia || row.type_media || "IMAGE",
    sourceType: row.sourceType || row.source_type || "UPLOAD",
    nomFichierOriginal: row.nomFichierOriginal || row.nom_fichier_original || "",
    mimeType: row.mimeType || row.mime_type || "image/webp",
    extensionStockage: row.extensionStockage || row.extension_stockage || "webp",
    tailleOriginaleBytes: Number(row.tailleOriginaleBytes ?? row.taille_originale_bytes ?? 0),
    largeur: row.largeur === null || row.largeur === undefined ? null : Number(row.largeur),
    hauteur: row.hauteur === null || row.hauteur === undefined ? null : Number(row.hauteur),
    note: row.note || "",
    position: Number(row.position || 1),
    isPrimary: row.isPrimary === true || row.is_primary === true,
    dateCreation: row.dateCreation || row.date_creation || ""
  };
}

function buildClientFullName(nom, prenom) {
  const fullName = `${String(nom || "").trim()} ${String(prenom || "").trim()}`.trim();
  return fullName || null;
}

function buildLegacyCommandeLine(row) {
  if (!row?.type_habit || !row?.mesures_habit_snapshot) return [];
  const clientNom = buildClientFullName(row.nom, row.prenom) || "";
  const [nomAffiche = "", ...reste] = clientNom.split(" ");
  return [
    {
      idLigne: `LEGACY-${row.id_commande}`,
      idCommande: row.id_commande,
      idClient: row.id_client,
      role: "PAYEUR_BENEFICIAIRE",
      nomAffiche,
      prenomAffiche: reste.join(" ").trim(),
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot,
      ordreAffichage: 1,
      dateCreation: row.date_creation
    }
  ];
}

function normalizeCommandeItemInput(rawItem, index = 0) {
  const item = rawItem && typeof rawItem === "object" ? rawItem : {};
  return {
    idItem: String(item.idItem || item.id_item || "").trim() || generateCommandeItemId(),
    typeHabit: String(item.typeHabit || item.type_habit || "").trim().toUpperCase(),
    description: String(item.description || "").trim(),
    prix: Number(item.prix ?? 0),
    ordreAffichage: Number(item.ordreAffichage ?? item.ordre_affichage ?? index + 1) || index + 1,
    mesuresBrutes:
      item.mesures ||
      item.mesuresSnapshot ||
      item.mesures_snapshot_json ||
      item.mesuresHabit ||
      null
  };
}

function normalizeCommandeItemMesures(typeHabit, rawMesures, policy = null) {
  if (!typeHabit || !rawMesures || typeof rawMesures !== "object" || Array.isArray(rawMesures)) return null;
  const resolvedPolicy = resolveCommandePolicy(policy);
  const hasExplicitValues =
    rawMesures.typeHabit ||
    rawMesures.unite ||
    (rawMesures.valeurs && typeof rawMesures.valeurs === "object");
  if (hasExplicitValues) {
    return createMesuresCommande(rawMesures.typeHabit || typeHabit, rawMesures.valeurs || rawMesures, {
      requireComplete: resolvedPolicy.mesuresObligatoiresPourCommande && resolvedPolicy.interdireEnregistrementSansToutesMesuresUtiles,
      requireAtLeastOne: resolvedPolicy.mesuresObligatoiresPourCommande,
      allowDecimals: resolvedPolicy.valeursDecimalesAutorisees,
      unit: rawMesures.unite || resolvedPolicy.uniteMesure,
      habitDefinitions: resolvedPolicy.habits
    });
  }
  return createMesuresCommande(typeHabit, rawMesures, {
    requireComplete: resolvedPolicy.mesuresObligatoiresPourCommande && resolvedPolicy.interdireEnregistrementSansToutesMesuresUtiles,
    requireAtLeastOne: resolvedPolicy.mesuresObligatoiresPourCommande,
    allowDecimals: resolvedPolicy.valeursDecimalesAutorisees,
    unit: resolvedPolicy.uniteMesure,
    habitDefinitions: resolvedPolicy.habits
  });
}

function buildCommandeItemsFromPayload(body = {}, policy = null) {
  const sourceItems = Array.isArray(body.items) ? body.items : [];
  const items = sourceItems
    .map((row, index) => {
      const item = normalizeCommandeItemInput(row, index);
      const fallbackMesures = index === 0 ? body.mesuresHabit : null;
      const { mesuresBrutes, ...baseItem } = item;
      return {
        ...baseItem,
        mesures: normalizeCommandeItemMesures(item.typeHabit, mesuresBrutes || fallbackMesures, policy)
      };
    })
    .filter((item) => item.typeHabit && Number.isFinite(item.prix) && item.prix >= 0)
    .map((item) => new CommandeItem({ ...item, policy }));
  if (items.length > 0) return items;
  const fallbackTypeHabit = String(body.typeHabit || "").trim().toUpperCase();
  if (!fallbackTypeHabit) return [];
  return [
    new CommandeItem({
      idItem: generateCommandeItemId(),
      typeHabit: fallbackTypeHabit,
      description: String(body.descriptionCommande || "").trim(),
      prix: Number(body.montantTotal || 0),
      ordreAffichage: 1,
      mesures: normalizeCommandeItemMesures(fallbackTypeHabit, body.mesuresHabit, policy),
      policy
    })
  ];
}

function hydrateCommandeItems(items = [], commandeRow = null) {
  if (Array.isArray(items) && items.length > 0) return items;
  if (!commandeRow?.type_habit) return [];
  return [
    new CommandeItem({
      idItem: `LEGACY-${commandeRow.id_commande}`,
      idCommande: commandeRow.id_commande,
      typeHabit: commandeRow.type_habit,
      description: String(commandeRow.description || "").trim() || commandeRow.type_habit,
      prix: Number(commandeRow.montant_total || 0),
      ordreAffichage: 1,
      mesures: commandeRow.mesures_habit_snapshot || null,
      dateCreation: commandeRow.date_creation
    })
  ];
}

function computeCommandeTotalFromItems(items = [], fallbackValue = 0) {
  if (!Array.isArray(items) || items.length === 0) return Number(fallbackValue || 0);
  return items.reduce((sum, item) => sum + Number(item.prix || 0), 0);
}

async function loadCommandeLignesMap(db, atelierId, commandeIds = []) {
  const ids = Array.from(new Set((commandeIds || []).map((value) => String(value || "").trim()).filter(Boolean)));
  if (ids.length === 0) return new Map();
  if (!(await hasCommandeLignesTable(db))) return new Map();
  const result = await db.query(
    `SELECT id_ligne, atelier_id, id_commande, id_client, role, nom_affiche, prenom_affiche, type_habit, mesures_habit_snapshot, ordre_affichage, date_creation
     FROM commande_lignes
     WHERE atelier_id = $1 AND id_commande = ANY($2::text[])
     ORDER BY ordre_affichage ASC, date_creation ASC`,
    [atelierId, ids]
  );
  const map = new Map();
  for (const row of result.rows) {
    const current = map.get(row.id_commande) || [];
    current.push({
      idLigne: row.id_ligne,
      idCommande: row.id_commande,
      idClient: row.id_client,
      role: row.role,
      nomAffiche: row.nom_affiche || "",
      prenomAffiche: row.prenom_affiche || "",
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot,
      ordreAffichage: Number(row.ordre_affichage || 1),
      dateCreation: row.date_creation
    });
    map.set(row.id_commande, current);
  }
  return map;
}

async function loadCommandeItemsMap(db, atelierId, commandeIds = []) {
  const ids = Array.from(new Set((commandeIds || []).map((value) => String(value || "").trim()).filter(Boolean)));
  if (ids.length === 0) return new Map();
  const itemColumnsResult = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'commande_items'
       AND column_name IN ('mesures_snapshot_json', 'montant_paye')`
  ).catch(() => ({ rows: [] }));
  const itemColumns = new Set((itemColumnsResult.rows || []).map((row) => String(row.column_name || "").trim()));
  const includeMeasures = itemColumns.has("mesures_snapshot_json");
  const includeMontantPaye = itemColumns.has("montant_paye");
  let result;
  try {
    result = await db.query(
      includeMeasures
        ? `SELECT id_item, id_commande, type_habit, description, prix, ${includeMontantPaye ? "montant_paye," : ""} ordre_affichage, mesures_snapshot_json, date_creation
           FROM commande_items
           WHERE atelier_id = $1 AND id_commande = ANY($2::text[])
           ORDER BY ordre_affichage ASC, date_creation ASC`
        : `SELECT id_item, id_commande, type_habit, description, prix, ${includeMontantPaye ? "montant_paye," : ""} ordre_affichage, date_creation
           FROM commande_items
           WHERE atelier_id = $1 AND id_commande = ANY($2::text[])
           ORDER BY ordre_affichage ASC, date_creation ASC`,
      [atelierId, ids]
    );
  } catch (error) {
    if (String(error?.code || "") === "42P01") return new Map();
    throw error;
  }
  const map = new Map();
  for (const row of result.rows) {
    const current = map.get(row.id_commande) || [];
    current.push({
      idItem: row.id_item,
      idCommande: row.id_commande,
      typeHabit: row.type_habit || "",
      description: row.description || "",
      prix: Number(row.prix || 0),
      montantPaye: Number(row.montant_paye || 0),
      ordreAffichage: Number(row.ordre_affichage || 1),
      mesures: row.mesures_snapshot_json || null,
      dateCreation: row.date_creation
    });
    map.set(row.id_commande, current);
  }
  return map;
}

// List commandes
router.get("/commandes", requireCommandeReadAccess, async (req, res) => {
  try {
    const commandesLignesReady = await hasCommandeLignesTable(pool);
    const result = await pool.query(
      commandesLignesReady
        ? `SELECT c.id_commande,
                  c.id_client,
                  c.id_dossier,
                  c.description,
                  c.date_creation,
                  c.date_prevue,
                  c.montant_total,
                  c.montant_paye,
                  c.type_habit,
                  c.mesures_habit_snapshot,
                  c.statut,
                  cl.nom,
                  cl.prenom,
                  COALESCE((
                    SELECT COUNT(*)::int
                    FROM commande_lignes l
                    WHERE l.atelier_id = c.atelier_id
                      AND l.id_commande = c.id_commande
                  ), CASE WHEN c.type_habit IS NOT NULL THEN 1 ELSE 0 END) AS nombre_lignes,
                  COALESCE((
                    SELECT COUNT(DISTINCT COALESCE(NULLIF(l.id_client, ''), LOWER(TRIM(l.nom_affiche)) || '::' || LOWER(TRIM(l.prenom_affiche))))::int
                    FROM commande_lignes l
                    WHERE l.atelier_id = c.atelier_id
                      AND l.id_commande = c.id_commande
                  ), CASE WHEN c.id_client IS NOT NULL THEN 1 ELSE 0 END) AS nombre_beneficiaires
           FROM commandes c
           LEFT JOIN clients cl ON cl.id_client = c.id_client AND cl.atelier_id = c.atelier_id
           WHERE c.atelier_id = $1
           ORDER BY c.date_creation DESC`
        : `SELECT c.id_commande,
                  c.id_client,
                  c.id_dossier,
                  c.description,
                  c.date_creation,
                  c.date_prevue,
                  c.montant_total,
                  c.montant_paye,
                  c.type_habit,
                  c.mesures_habit_snapshot,
                  c.statut,
                  cl.nom,
                  cl.prenom,
                  CASE WHEN c.type_habit IS NOT NULL THEN 1 ELSE 0 END AS nombre_lignes,
                  CASE WHEN c.id_client IS NOT NULL THEN 1 ELSE 0 END AS nombre_beneficiaires
           FROM commandes c
           LEFT JOIN clients cl ON cl.id_client = c.id_client AND cl.atelier_id = c.atelier_id
           WHERE c.atelier_id = $1
           ORDER BY c.date_creation DESC`,
      [atelierIdFromReq(req)]
    );

    const itemMap = await loadCommandeItemsMap(pool, atelierIdFromReq(req), result.rows.map((row) => row.id_commande));
    const rows = result.rows.map((row) => {
      const items = hydrateCommandeItems(itemMap.get(row.id_commande) || [], row);
      return {
        idCommande: row.id_commande,
        idClient: row.id_client,
        dossierId: row.id_dossier || null,
        clientPayeurId: row.id_client,
        clientNom: row.nom && row.prenom ? `${row.nom} ${row.prenom}` : null,
        descriptionCommande: row.description,
        dateCreation: row.date_creation,
        datePrevue: row.date_prevue,
        montantTotal: Number(row.montant_total),
        montantPaye: Number(row.montant_paye),
        typeHabit: row.type_habit,
        mesuresHabit: row.mesures_habit_snapshot,
        items,
        statutCommande: row.statut,
        nombreLignes: items.length,
        nombreBeneficiaires: Number(row.nombre_beneficiaires || 0)
      };
    });

    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Audit commandes (read-only)
router.get("/audit/commandes", requirePermission(PERMISSIONS.VOIR_BILANS_GLOBAUX), async (req, res) => {
  try {
    const commandesLignesReady = await hasCommandeLignesTable(pool);
    const result = await pool.query(
      commandesLignesReady
        ? `SELECT
            c.id_commande,
            c.id_client,
            c.id_dossier,
            c.description,
            c.date_creation,
            c.date_prevue,
            c.montant_total,
            c.montant_paye,
            c.type_habit,
            c.mesures_habit_snapshot,
            c.statut,
            cl.nom,
            cl.prenom,
            COALESCE((
              SELECT COUNT(*)::int
              FROM commande_lignes l
              WHERE l.atelier_id = c.atelier_id
                AND l.id_commande = c.id_commande
            ), CASE WHEN c.type_habit IS NOT NULL THEN 1 ELSE 0 END) AS nombre_lignes,
            COALESCE((
              SELECT COUNT(DISTINCT COALESCE(NULLIF(l.id_client, ''), LOWER(TRIM(l.nom_affiche)) || '::' || LOWER(TRIM(l.prenom_affiche))))::int
              FROM commande_lignes l
              WHERE l.atelier_id = c.atelier_id
                AND l.id_commande = c.id_commande
            ), CASE WHEN c.id_client IS NOT NULL THEN 1 ELSE 0 END) AS nombre_beneficiaires,
            COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' THEN op.montant ELSE 0 END), 0) AS total_paiements,
            COALESCE(COUNT(op.id_operation), 0) AS nombre_paiements
          FROM commandes c
          LEFT JOIN clients cl ON cl.id_client = c.id_client AND cl.atelier_id = c.atelier_id
          LEFT JOIN caisse_operation op ON op.reference_metier = c.id_commande AND op.motif = 'PAIEMENT_COMMANDE' AND op.atelier_id = c.atelier_id
          WHERE c.atelier_id = $1
          GROUP BY c.id_commande, cl.nom, cl.prenom
          ORDER BY c.date_creation DESC`
        : `SELECT
            c.id_commande,
            c.id_client,
            c.id_dossier,
            c.description,
            c.date_creation,
            c.date_prevue,
            c.montant_total,
            c.montant_paye,
            c.type_habit,
            c.mesures_habit_snapshot,
            c.statut,
            cl.nom,
            cl.prenom,
            CASE WHEN c.type_habit IS NOT NULL THEN 1 ELSE 0 END AS nombre_lignes,
            CASE WHEN c.id_client IS NOT NULL THEN 1 ELSE 0 END AS nombre_beneficiaires,
            COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' THEN op.montant ELSE 0 END), 0) AS total_paiements,
            COALESCE(COUNT(op.id_operation), 0) AS nombre_paiements
          FROM commandes c
          LEFT JOIN clients cl ON cl.id_client = c.id_client AND cl.atelier_id = c.atelier_id
          LEFT JOIN caisse_operation op ON op.reference_metier = c.id_commande AND op.motif = 'PAIEMENT_COMMANDE' AND op.atelier_id = c.atelier_id
          WHERE c.atelier_id = $1
          GROUP BY c.id_commande, cl.nom, cl.prenom
          ORDER BY c.date_creation DESC`,
      [atelierIdFromReq(req)]
    );

    res.json(
      result.rows.map((row) => ({
        idCommande: row.id_commande,
        idClient: row.id_client,
        dossierId: row.id_dossier || null,
        clientPayeurId: row.id_client,
        clientNom: row.nom && row.prenom ? `${row.nom} ${row.prenom}` : null,
        descriptionCommande: row.description,
        dateCreation: row.date_creation,
        datePrevue: row.date_prevue,
        montantTotal: Number(row.montant_total),
        montantPaye: Number(row.montant_paye),
        typeHabit: row.type_habit,
        mesuresHabit: row.mesures_habit_snapshot,
        statutCommande: row.statut,
        nombreLignes: Number(row.nombre_lignes || 0),
        nombreBeneficiaires: Number(row.nombre_beneficiaires || 0),
        totalPaiements: Number(row.total_paiements),
        nombrePaiements: Number(row.nombre_paiements)
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get commande by id
router.get("/commandes/:id", requireCommandeReadAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id_commande,
              c.id_client,
              c.id_dossier,
              c.description,
              c.date_creation,
              c.date_prevue,
              c.montant_total,
              c.montant_paye,
              c.type_habit,
              c.mesures_habit_snapshot,
              c.statut,
              cl.nom,
              cl.prenom
       FROM commandes c
       LEFT JOIN clients cl ON cl.id_client = c.id_client AND cl.atelier_id = c.atelier_id
       WHERE c.id_commande = $1 AND c.atelier_id = $2`,
      [req.params.id, atelierIdFromReq(req)]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Commande introuvable" });

    const row = result.rows[0];
    const [lignes, items] = await Promise.all([
      scopedCommandeLigneRepo(req).listByCommandeId(req.params.id),
      scopedCommandeItemRepo(req).listByCommande(req.params.id)
    ]);
    const resolvedLignes = lignes.length > 0 ? lignes : buildLegacyCommandeLine(row);
    const resolvedItems = hydrateCommandeItems(items, row);
    res.json({
      idCommande: row.id_commande,
      idClient: row.id_client,
      dossierId: row.id_dossier || null,
      clientPayeurId: row.id_client,
      clientNom: row.nom && row.prenom ? `${row.nom} ${row.prenom}` : null,
      descriptionCommande: row.description,
      dateCreation: row.date_creation,
      datePrevue: row.date_prevue,
      montantTotal: Number(row.montant_total),
      montantPaye: Number(row.montant_paye),
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot,
      items: resolvedItems,
      statutCommande: row.statut,
      nombreLignes: resolvedItems.length,
      nombreBeneficiaires: new Set(
        resolvedLignes.map((ligne) => ligne.idClient || `${ligne.nomAffiche}::${ligne.prenomAffiche}`)
      ).size,
      lignesCommande: resolvedLignes
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get actions autorisees for commande
router.get("/commandes/:id/actions", requireCommandeReadAccess, async (req, res) => {
  try {
    const commande = await scopedCommandeRepo(req).getById(req.params.id);
    if (!commande) return res.status(404).json({ error: "Commande introuvable" });
    const policyMeta = await loadCommandePolicy("commandes.actions", req);
    res.json(actionRulesForCommandeAvecPermissions(commande, req.auth, policyMeta.policy));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/commandes/:id/items/:itemId", requireCommandeCreateAccess, async (req, res) => {
  const schema = z
    .object({
      description: z.string().optional(),
      prix: z.coerce.number().nonnegative().optional(),
      mesures: z.any().optional()
    })
    .passthrough()
    .refine((data) => Object.keys(data || {}).length > 0, {
      message: "Aucune modification fournie"
    });
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");
    const policyMeta = await loadCommandePolicy("commandes.items.patch", req);
    const repo = scopedCommandeRepo(req).withExecutor(dbClient);
    const itemRepo = scopedCommandeItemRepo(req).withExecutor(dbClient);
    const before = await repo.getById(req.params.id);
    const commande = await modifierCommandeItem({
      idCommande: req.params.id,
      idItem: req.params.itemId,
      patch: parsed.data,
      commandeRepo: repo,
      commandeItemRepo: itemRepo,
      policy: policyMeta.payload || { commandes: policyMeta.policy }
    });
    await enregistrerEvenementCommande({
      atelierId: atelierIdFromReq(req),
      idCommande: commande.idCommande,
      typeEvent: "ITEM_COMMANDE_MODIFIE",
      utilisateur: resolveActeur(req).utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
      payload: {
        utilisateurId: req.auth?.utilisateurId || null,
        utilisateurNom: req.auth?.nom || null,
        role: req.auth?.role || null,
        idItem: req.params.itemId
      }
    }, dbClient);
    await dbClient.query("COMMIT");
    res.json(commande);
  } catch (err) {
    await dbClient.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// Get events for commande (audit trail)
router.get("/commandes/:id/events", requireCommandeReadAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_event, id_commande, type_event, payload, date_event
       FROM commande_events
       WHERE id_commande = $1 AND atelier_id = $2
       ORDER BY date_event DESC`,
      [req.params.id, atelierIdFromReq(req)]
    );
    res.json(
      result.rows.map((row) => ({
        idEvent: row.id_event,
        idCommande: row.id_commande,
        typeEvent: row.type_event,
        payload: row.payload,
        dateEvent: row.date_event
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/commandes/:id/media", requireCommandeReadAccess, async (req, res) => {
  try {
    const medias = await listerCommandeMedia({
      idCommande: req.params.id,
      mediaRepo: scopedCommandeMediaRepo(req)
    });
    res.json(medias.map(mapCommandeMedia).filter(Boolean));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/commandes/:id/media/:mediaId/fichier", requireCommandeReadAccess, async (req, res) => {
  try {
    const media = await scopedCommandeMediaRepo(req).getById(req.params.id, req.params.mediaId);
    if (!media) return res.status(404).json({ error: "Media commande introuvable" });
    const absolutePath = commandeMediaStorage.resolveStoredPath(media.cheminOriginal);
    res.set("Cache-Control", "private, max-age=60");
    res.type("image/webp");
    res.sendFile(absolutePath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/commandes/:id/media/:mediaId/thumbnail", requireCommandeReadAccess, async (req, res) => {
  try {
    const media = await scopedCommandeMediaRepo(req).getById(req.params.id, req.params.mediaId);
    if (!media) return res.status(404).json({ error: "Media commande introuvable" });
    const absolutePath = commandeMediaStorage.resolveStoredPath(media.cheminThumbnail);
    res.set("Cache-Control", "private, max-age=300");
    res.type("image/webp");
    res.sendFile(absolutePath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/commandes/:id/media", requireCommandeCreateAccess, async (req, res) => {
  commandeMediaUploadSingle("photo")(req, res, async (uploadErr) => {
    if (uploadErr) {
      await cleanupCommandeMediaUpload(req);
      res.status(400).json({ error: uploadErr.message || "Upload photo impossible" });
      return;
    }

    const schema = z
      .object({
        note: z.string().max(500).optional(),
        sourceType: z.enum(["UPLOAD", "CAMERA"]).optional(),
        idItem: z.string().min(1).optional()
      })
      .passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) {
      await cleanupCommandeMediaUpload(req);
      return res.status(400).json({ error: parsed.error });
    }

    if (!req.file?.path) {
      await cleanupCommandeMediaUpload(req);
      return res.status(400).json({ error: "Photo obligatoire" });
    }

    try {
      const normalizedIdItem = String(parsed.data.idItem || "").trim();
      if (normalizedIdItem) {
        const commandeItems = await scopedCommandeItemRepo(req).listByCommande(req.params.id);
        if (!commandeItems.some((item) => String(item?.idItem || "").trim() === normalizedIdItem)) {
          await cleanupCommandeMediaUpload(req);
          return res.status(400).json({ error: "Item commande introuvable pour cette photo" });
        }
      }
      const acteur = resolveActeur(req);
      const created = await ajouterCommandeMedia({
        atelierId: atelierIdFromReq(req),
        idCommande: req.params.id,
        idItem: normalizedIdItem,
        fichierUpload: req.file,
        tempDir: req.commandeMediaUpload?.tempDir || "",
        acteur,
        mediaRepo: scopedCommandeMediaRepo(req),
        storage: commandeMediaStorage,
        processImage: processCommandeMediaImage,
        note: parsed.data.note || "",
        sourceType: parsed.data.sourceType || "UPLOAD"
      });

      await enregistrerEvenementCommande({
        atelierId: atelierIdFromReq(req),
        idCommande: req.params.id,
        typeEvent: "MEDIA_COMMANDE_AJOUTEE",
        utilisateur: acteur.utilisateur,
        payload: {
          utilisateurId: acteur.utilisateurId,
          utilisateurNom: acteur.utilisateurNom,
          role: acteur.role,
          idMedia: created.idMedia,
          position: created.position,
          isPrimary: created.isPrimary
        }
      });
      await enregistrerEvenementAudit({
        utilisateurId: acteur.utilisateurId,
        role: acteur.role,
        atelierId: req.auth?.atelierId,
        action: "AJOUTER_MEDIA_COMMANDE",
        entite: "COMMANDE_MEDIA",
        entiteId: created.idMedia,
        payload: {
          idCommande: req.params.id,
          position: created.position,
          isPrimary: created.isPrimary
        }
      });
      res.status(201).json(mapCommandeMedia(created));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
});

router.patch("/commandes/:id/media/:mediaId", requireCommandeCreateAccess, async (req, res) => {
  const schema = z
    .object({
      note: z.string().max(500).optional(),
      position: z.coerce.number().int().min(1).max(3).optional(),
      isPrimary: z.boolean().optional(),
      idItem: z.string().min(1).optional().or(z.literal("").transform(() => ""))
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  try {
    const normalizedIdItem = Object.prototype.hasOwnProperty.call(parsed.data, "idItem")
      ? String(parsed.data.idItem || "").trim()
      : undefined;
    if (normalizedIdItem !== undefined && normalizedIdItem !== "") {
      const commandeItems = await scopedCommandeItemRepo(req).listByCommande(req.params.id);
      if (!commandeItems.some((item) => String(item?.idItem || "").trim() === normalizedIdItem)) {
        return res.status(400).json({ error: "Item commande introuvable pour cette photo" });
      }
    }
    const acteur = resolveActeur(req);
    const updated = await mettreAJourCommandeMedia({
      atelierId: atelierIdFromReq(req),
      idCommande: req.params.id,
      idMedia: req.params.mediaId,
      mediaRepo: scopedCommandeMediaRepo(req),
      patch: {
        ...parsed.data,
        ...(normalizedIdItem !== undefined ? { idItem: normalizedIdItem || null } : {})
      }
    });
    await enregistrerEvenementCommande({
      atelierId: atelierIdFromReq(req),
      idCommande: req.params.id,
      typeEvent: parsed.data.isPrimary === true ? "MEDIA_COMMANDE_PRINCIPALE_DEFINIE" : "MEDIA_COMMANDE_MISE_A_JOUR",
      utilisateur: acteur.utilisateur,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        idMedia: updated.idMedia,
        position: updated.position,
        isPrimary: updated.isPrimary
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: parsed.data.isPrimary === true ? "DEFINIR_MEDIA_PRINCIPAL_COMMANDE" : "METTRE_A_JOUR_MEDIA_COMMANDE",
      entite: "COMMANDE_MEDIA",
      entiteId: updated.idMedia,
      payload: {
        idCommande: req.params.id,
        position: updated.position,
        isPrimary: updated.isPrimary
      }
    });
    res.json(mapCommandeMedia(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/commandes/:id/media/:mediaId", requireCommandeCreateAccess, async (req, res) => {
  try {
    const acteur = resolveActeur(req);
    const deleted = await supprimerCommandeMedia({
      atelierId: atelierIdFromReq(req),
      idCommande: req.params.id,
      idMedia: req.params.mediaId,
      mediaRepo: scopedCommandeMediaRepo(req),
      storage: commandeMediaStorage
    });
    await enregistrerEvenementCommande({
      atelierId: atelierIdFromReq(req),
      idCommande: req.params.id,
      typeEvent: "MEDIA_COMMANDE_SUPPRIMEE",
      utilisateur: acteur.utilisateur,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        idMedia: deleted.idMedia
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "SUPPRIMER_MEDIA_COMMANDE",
      entite: "COMMANDE_MEDIA",
      entiteId: deleted.idMedia,
      payload: {
        idCommande: req.params.id
      }
    });
    res.json({ ok: true, media: mapCommandeMedia(deleted) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get paiements for commande
router.get("/commandes/:id/paiements", requireCommandeReadAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT op.id_operation,
              op.id_caisse_jour,
              op.type_operation,
              op.montant,
              op.mode_paiement,
              op.motif,
              op.reference_metier,
              op.date_operation,
              op.effectue_par,
              op.statut_operation,
              cj.date_jour
       FROM caisse_operation op
       LEFT JOIN caisse_jour cj ON cj.id_caisse_jour = op.id_caisse_jour AND cj.atelier_id = op.atelier_id
       WHERE op.reference_metier = $1 AND op.atelier_id = $2
       ORDER BY op.date_operation DESC`,
      [req.params.id, atelierIdFromReq(req)]
    );

    res.json(
      result.rows.map((row) => ({
        idOperation: row.id_operation,
        idCaisseJour: row.id_caisse_jour,
        typeOperation: row.type_operation,
        montant: Number(row.montant),
        modePaiement: row.mode_paiement,
        motif: row.motif,
        referenceMetier: row.reference_metier,
        dateOperation: row.date_operation,
        dateJour: row.date_jour,
        effectuePar: row.effectue_par,
        statutOperation: row.statut_operation
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create a new Commande
router.post("/commandes", requireCommandeCreateAccess, async (req, res) => {
  const schema = z
    .object({
      idCommande: z.string().min(1).optional(),
      idDossier: z.string().min(1).optional(),
      clientPayeurId: z.string().min(1).optional(),
      idClient: z.string().min(1).optional(),
      nouveauClient: z
        .object({
          idClient: z.string().min(1).optional(),
          nom: z.string().min(1),
          prenom: z.string().min(1),
          telephone: z.string().optional().default("")
        })
        .optional(),
      doublonDecision: z
        .object({
          action: z.enum(["USE_EXISTING", "UPDATE_EXISTING_PHONE", "CONFIRM_NEW"]),
          idClient: z.string().min(1).optional()
        })
        .optional(),
      lignesCommande: z
        .array(
          z
            .object({
              idLigne: z.string().min(1).optional(),
              idClient: z.string().min(1).optional(),
              utiliseClientPayeur: z.boolean().optional(),
              source: z.enum(["PAYEUR"]).optional(),
              role: z.enum(["PAYEUR_BENEFICIAIRE"]).optional(),
              nomAffiche: z.string().optional(),
              prenomAffiche: z.string().optional(),
              typeHabit: z.string().min(1),
              mesuresHabit: z.any().optional(),
              ordreAffichage: z.coerce.number().int().positive().optional()
            })
            .passthrough()
        )
        .optional(),
      descriptionCommande: z.string().min(1),
      montantTotal: z.coerce.number(),
      items: z
        .array(
          z.object({
            idItem: z.string().min(1).optional(),
            typeHabit: z.string().min(1),
            description: z.string().optional(),
            prix: z.coerce.number().nonnegative(),
            mesures: z.any().optional(),
            mesuresHabit: z.any().optional()
          }).passthrough()
        )
        .optional(),
      typeHabit: z.string().min(1).optional(),
      mesuresHabit: z.any().optional(),
      datePrevue: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const payerClientId = String(body.clientPayeurId || body.idClient || "").trim();
  const hasExistingClient = Boolean(payerClientId);
  const hasNewClient = Boolean(body.nouveauClient);
  if (hasExistingClient === hasNewClient) {
    return res.status(400).json({ error: "Fournissez soit clientPayeurId, soit nouveauClient." });
  }
  const r1 = requireFields(body, ["descriptionCommande", "montantTotal"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montantTotal");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  const dbClient = await pool.connect();
  try {
    const acteur = resolveActeur(req);
    const policyMeta = await loadCommandePolicy("commandes.create", req);
    const policyInput = policyMeta.payload || { commandes: policyMeta.policy };
    const repo = scopedCommandeRepo(req).withExecutor(dbClient);
    const lignesRepo = scopedCommandeLigneRepo(req).withExecutor(dbClient);
    const clients = scopedClientRepo(req).withExecutor(dbClient);
    const mesuresRepo = scopedSerieRepo(req).withExecutor(dbClient);
    const dossiers = scopedDossierRepo(req).withExecutor(dbClient);
    const atelierId = atelierIdFromReq(req);
    const requestedDossierId = String(body.idDossier || "").trim() || null;
    const requestedIdCommande = String(body.idCommande || "").trim();
    if (requestedIdCommande) {
      const existingCommande = await repo.getById(requestedIdCommande);
      if (existingCommande) {
        const existingItems = await scopedCommandeItemRepo(req).withExecutor(dbClient).listByCommande(requestedIdCommande);
        return res.status(200).json({
          ...existingCommande,
          items: hydrateCommandeItems(existingItems, {
            id_commande: existingCommande.idCommande,
            type_habit: existingCommande.typeHabit,
            description: existingCommande.descriptionCommande,
            montant_total: existingCommande.montantTotal,
            date_creation: existingCommande.dateCreation
          })
        });
      }
    }

    await dbClient.query("BEGIN");
    const resolvedCommandeId = requestedIdCommande || generateCommandeId();
    await lockCommandeCreation(dbClient, atelierId, resolvedCommandeId);
    const existingCommande = await repo.getById(resolvedCommandeId);
    if (existingCommande) {
      const existingItems = await scopedCommandeItemRepo(req).withExecutor(dbClient).listByCommande(resolvedCommandeId);
      await dbClient.query("COMMIT");
      return res.status(200).json({
        ...existingCommande,
        items: hydrateCommandeItems(existingItems, {
          id_commande: existingCommande.idCommande,
          type_habit: existingCommande.typeHabit,
          description: existingCommande.descriptionCommande,
          montant_total: existingCommande.montantTotal,
          date_creation: existingCommande.dateCreation
        })
      });
    }

    if (requestedDossierId) {
      const existingDossier = await dossiers.getById(requestedDossierId);
      if (!existingDossier) {
        throw Object.assign(new Error("Dossier introuvable."), { status: 404, code: "DOSSIER_NOT_FOUND" });
      }
    }

    const clientResolution = await resolveCommandeClientForCreation({
      idClient: payerClientId,
      nouveauClient: body.nouveauClient,
      doublonDecision: body.doublonDecision,
      clientRepo: clients
    });

    const lignesResolution = await resolveCommandeLignesForCreation({
      body: {
        ...body,
        idClient: payerClientId
      },
      clientPayeurResolution: clientResolution,
      policy: policyInput
    });

    const commandeItems = buildCommandeItemsFromPayload({
      ...body,
      typeHabit: lignesResolution.typeHabitReference
    }, policyInput);
    if (commandeItems.length === 0) {
      throw new Error("Ajoutez au moins un habit a cette commande.");
    }

    const primaryMeasuredItem = commandeItems.find((item) => item.mesures) || commandeItems[0] || null;

    const commande = creerCommande({
      idCommande: resolvedCommandeId,
      idClient: clientResolution.idClient,
      dossierId: requestedDossierId,
      descriptionCommande: String(body.descriptionCommande || commandeItems[0]?.description || "").trim(),
      montantTotal: computeCommandeTotalFromItems(commandeItems, body.montantTotal),
      typeHabit: primaryMeasuredItem?.typeHabit || lignesResolution.typeHabitReference,
      mesuresHabit:
        primaryMeasuredItem?.mesures?.valeurs ||
        primaryMeasuredItem?.mesures ||
        lignesResolution.mesuresHabitReference?.valeurs ||
        lignesResolution.mesuresHabitReference ||
        null,
      datePrevue: body.datePrevue,
      items: commandeItems
    }, {
      policy: policyInput
    });
    await repo.save(commande);
    await scopedCommandeItemRepo(req).withExecutor(dbClient).replaceForCommande(commande.idCommande, commandeItems);
    await lignesRepo.replaceForCommande(commande.idCommande, lignesResolution.lignesCommande);
    if (requestedDossierId) {
      await dossiers.touch(requestedDossierId, acteur.utilisateur);
    }
    for (const ligne of lignesResolution.lignesCommande) {
      if (!ligne.idClient || !ligne.mesuresHabit) continue;
      await saveLatestMeasuresForClientAndType({
        idClient: ligne.idClient,
        typeHabit: ligne.typeHabit,
        mesuresSnapshot: ligne.mesuresHabit,
        prisePar: acteur.utilisateur,
        observations: `Commande ${commande.idCommande}`,
        serieRepo: mesuresRepo
      });
    }
    for (const item of commandeItems) {
      if (!item.mesures) continue;
      await saveLatestMeasuresForClientAndType({
        idClient: clientResolution.idClient,
        typeHabit: item.typeHabit,
        mesuresSnapshot: item.mesures,
        prisePar: acteur.utilisateur,
        observations: `Commande ${commande.idCommande} / item ${item.idItem}`,
        serieRepo: mesuresRepo
      });
    }
    await enregistrerEvenementCommande({
      atelierId,
      idCommande: commande.idCommande,
      typeEvent: "COMMANDE_CREEE",
      utilisateur: acteur.utilisateur,
      nouveauStatut: commande.statutCommande,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        montantTotal: Number(commande.montantTotal || 0),
        nombreLignes: commandeItems.length,
        nombreBeneficiaires: lignesResolution.nombreBeneficiaires
      }
    }, dbClient);
    await dbClient.query("COMMIT");
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "CREER_COMMANDE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom
      }
    });
    const clientIdsAssocies = Array.from(new Set([clientResolution.idClient].map((value) => String(value || "").trim()).filter(Boolean)));
    const clientsAssocies = [];
    for (const idClientAssocie of clientIdsAssocies) {
      const clientAssocie = await clients.getById(idClientAssocie);
      if (clientAssocie) clientsAssocies.push(clientAssocie);
    }
    const commandeResponse = {
      ...commande,
      dossierId: commande.dossierId || null,
      clientPayeurId: commande.idClient,
      nombreLignes: commandeItems.length,
      nombreBeneficiaires: lignesResolution.nombreBeneficiaires,
      lignesCommande: lignesResolution.lignesCommande,
      items: commandeItems
    };
    if (hasNewClient) {
      return res.status(201).json({
        commande: commandeResponse,
        client: clientResolution.client,
        clientResolution: clientResolution.strategy,
        clientsAssocies
      });
    }
    res.status(201).json({
      ...commandeResponse,
      clientsAssocies
    });
  } catch (err) {
    await dbClient.query("ROLLBACK").catch(() => {});
    if (Number(err?.status || 0) === 409) {
      return res.status(409).json(serializeCommandeClientConflict(err));
    }
    if (Number(err?.status || 0) === 404) {
      return res.status(404).json({ code: String(err.code || "NOT_FOUND"), message: err.message });
    }
    res.status(400).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// Finish work
router.post("/commandes/:id/terminer", requirePermission(PERMISSIONS.TERMINER_COMMANDE), async (req, res) => {
  const schema = z
    .object({
      utilisateur: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const acteur = resolveActeur(req, parsed.data.utilisateur);
    const repo = scopedCommandeRepo(req);
    const before = await repo.getById(req.params.id);
    const commande = await terminerTravail({
      idCommande: req.params.id,
      commandeRepo: repo
    });
    await enregistrerEvenementCommande({
      atelierId: atelierIdFromReq(req),
      idCommande: commande.idCommande,
      typeEvent: "TRAVAIL_TERMINE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "TERMINER_COMMANDE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom
      }
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apply payment
router.post("/commandes/:id/paiements", async (req, res) => {
  const schema = z
    .object({
      montant: z.coerce.number(),
      utilisateur: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["montant"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    const repo = scopedCommandeRepo(req);
    const before = await repo.getById(req.params.id);
    const policyMeta = await loadCommandePolicy("commandes.paiements", req);
    const commande = await appliquerPaiement({
      idCommande: req.params.id,
      montant: body.montant,
      commandeRepo: repo,
      policy: { commandes: policyMeta.policy }
    });
    await enregistrerEvenementCommande({
      atelierId: atelierIdFromReq(req),
      idCommande: commande.idCommande,
      typeEvent: "PAIEMENT_ENREGISTRE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        montant: Number(body.montant || 0)
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "PAYER_COMMANDE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        montant: Number(body.montant || 0)
      }
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apply payment via caisse (atomic)
router.post("/commandes/:id/paiements/caisse", async (req, res) => {
  const schema = z
    .object({
      montant: z.coerce.number(),
      idCaisseJour: z.string().min(1),
      utilisateur: z.string().min(1),
      modePaiement: z.string().optional(),
      idItem: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["montant", "idCaisseJour", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    const repo = scopedCommandeRepo(req);
    const before = await repo.getById(req.params.id);
    const policyMeta = await loadCommandePolicy("commandes.paiements.caisse", req);
    const normalizedIdItem = String(body.idItem || "").trim();
    const commande = normalizedIdItem
      ? await enregistrerPaiementCommandeItemViaCaisse({
          idCommande: req.params.id,
          idItem: normalizedIdItem,
          montant: body.montant,
          commandeRepo: repo,
          commandeItemRepo: scopedCommandeItemRepo(req),
          caisseRepo: scopedCaisseRepo(req),
          idCaisseJour: body.idCaisseJour,
          utilisateur: acteur.utilisateur || body.utilisateur,
          modePaiement: body.modePaiement || "CASH",
          policy: { commandes: policyMeta.policy }
        })
      : await enregistrerPaiementViaCaisse({
          idCommande: req.params.id,
          montant: body.montant,
          commandeRepo: repo,
          caisseRepo: scopedCaisseRepo(req),
          idCaisseJour: body.idCaisseJour,
          utilisateur: acteur.utilisateur || body.utilisateur,
          modePaiement: body.modePaiement || "CASH",
          policy: { commandes: policyMeta.policy }
        });
    await enregistrerEvenementCommande({
      atelierId: atelierIdFromReq(req),
      idCommande: commande.idCommande,
      typeEvent: "PAIEMENT_CAISSE_ENREGISTRE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        montant: Number(body.montant || 0),
        idItem: normalizedIdItem || null,
        idCaisseJour: body.idCaisseJour || null,
        modePaiement: body.modePaiement || "CASH"
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "PAYER_COMMANDE_CAISSE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        montant: Number(body.montant || 0),
        idItem: normalizedIdItem || null,
        idCaisseJour: body.idCaisseJour || null
      }
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Deliver
router.post("/commandes/:id/livrer", requirePermission(PERMISSIONS.LIVRER_COMMANDE), async (req, res) => {
  const schema = z
    .object({
      utilisateur: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const acteur = resolveActeur(req, parsed.data.utilisateur);
    const repo = scopedCommandeRepo(req);
    const before = await repo.getById(req.params.id);
    const policyMeta = await loadCommandePolicy("commandes.livrer", req);
    const commande = await livrerCommande({ idCommande: req.params.id, commandeRepo: repo, policy: { commandes: policyMeta.policy } });
    await enregistrerEvenementCommande({
      atelierId: atelierIdFromReq(req),
      idCommande: commande.idCommande,
      typeEvent: "COMMANDE_LIVREE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "LIVRER_COMMANDE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom
      }
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel
router.post("/commandes/:id/annuler", requirePermission(PERMISSIONS.ANNULER_COMMANDE), async (req, res) => {
  const schema = z
    .object({
      idCaisseJour: z.string().min(1).optional(),
      utilisateur: z.string().min(1).optional(),
      modePaiement: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  try {
    const acteur = resolveActeur(req, parsed.data.utilisateur);
    const repo = scopedCommandeRepo(req);
    const before = await repo.getById(req.params.id);
    const policyMeta = await loadCommandePolicy("commandes.annuler", req);
    const commande = await annulerCommandeViaCaisse({
      idCommande: req.params.id,
      commandeRepo: repo,
      caisseRepo: scopedCaisseRepo(req),
      idCaisseJour: parsed.data.idCaisseJour,
      utilisateur: acteur.utilisateur || parsed.data.utilisateur,
      modePaiement: parsed.data.modePaiement || "CASH",
      policy: { commandes: policyMeta.policy }
    });
    await enregistrerEvenementCommande({
      atelierId: atelierIdFromReq(req),
      idCommande: commande.idCommande,
      typeEvent: "COMMANDE_ANNULEE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        montantRembourse: Number(before?.montantPaye || 0),
        idCaisseJour: parsed.data.idCaisseJour || null,
        modePaiement: parsed.data.modePaiement || "CASH"
      }
    });
    if (Number(before?.montantPaye || 0) > 0) {
      await enregistrerEvenementCommande({
        atelierId: atelierIdFromReq(req),
        idCommande: commande.idCommande,
        typeEvent: "REMBOURSEMENT_COMMANDE_ANNULEE",
        utilisateur: acteur.utilisateur,
        ancienStatut: before?.statutCommande || null,
        nouveauStatut: commande.statutCommande,
        payload: {
          utilisateurId: acteur.utilisateurId,
          utilisateurNom: acteur.utilisateurNom,
          role: acteur.role,
          montant: Number(before?.montantPaye || 0),
          idCaisseJour: parsed.data.idCaisseJour || null,
          modePaiement: parsed.data.modePaiement || "CASH"
        }
      });
    }
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "ANNULER_COMMANDE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        montantRembourse: Number(before?.montantPaye || 0)
      }
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
