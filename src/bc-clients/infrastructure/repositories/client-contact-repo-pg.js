import { randomUUID } from "node:crypto";
import { pool } from "../../../shared/infrastructure/db.js";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_contact_suivi (
      id_contact TEXT PRIMARY KEY,
      atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
      id_client TEXT NOT NULL,
      origine_type TEXT NULL,
      origine_id TEXT NULL,
      canal TEXT NOT NULL DEFAULT 'NOTE',
      modele_key TEXT NULL,
      statut TEXT NOT NULL DEFAULT 'A_RELANCER',
      note TEXT NULL,
      utilisateur TEXT NULL,
      date_contact TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_contact_suivi_client_date ON client_contact_suivi (atelier_id, id_client, date_contact DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_contact_suivi_statut ON client_contact_suivi (atelier_id, statut)`);
  schemaReady = true;
}

function normalizeEntry(row) {
  return {
    idContact: String(row.id_contact || "").trim(),
    idClient: String(row.id_client || "").trim(),
    origineType: String(row.origine_type || "").trim(),
    origineId: String(row.origine_id || "").trim(),
    canal: String(row.canal || "").trim().toUpperCase(),
    modeleKey: String(row.modele_key || "").trim(),
    statut: String(row.statut || "").trim().toUpperCase() || "A_RELANCER",
    note: String(row.note || "").trim(),
    utilisateur: String(row.utilisateur || "").trim(),
    dateContact: row.date_contact ? new Date(row.date_contact).toISOString() : null
  };
}

function normalizeDashboardClient(row) {
  return {
    idClient: String(row.id_client || "").trim(),
    nomClient: `${row.nom || ""} ${row.prenom || ""}`.trim(),
    telephone: String(row.telephone || "").trim(),
    statut: String(row.statut || "A_RELANCER").trim().toUpperCase(),
    canal: String(row.canal || "").trim().toUpperCase(),
    modeleKey: String(row.modele_key || "").trim(),
    note: String(row.note || "").trim(),
    utilisateur: String(row.utilisateur || "").trim(),
    dateContact: row.date_contact ? new Date(row.date_contact).toISOString() : null
  };
}

function normalizeDashboardCommande(row) {
  const datePrevue =
    row.date_prevue instanceof Date
      ? row.date_prevue.toISOString().slice(0, 10)
      : String(row.date_prevue || "").slice(0, 10);
  return {
    idCommande: String(row.id_commande || "").trim(),
    idClient: String(row.id_client || "").trim(),
    clientNom: `${row.nom || ""} ${row.prenom || ""}`.trim(),
    telephone: String(row.telephone || "").trim(),
    typeHabit: String(row.type_habit || "").trim(),
    datePrevue: datePrevue || "",
    montantTotal: Number(row.montant_total || 0),
    montantPaye: Number(row.montant_paye || 0),
    soldeRestant: Math.max(0, Number(row.montant_total || 0) - Number(row.montant_paye || 0))
  };
}

function normalizeDashboardRetouche(row) {
  const datePrevue =
    row.date_prevue instanceof Date
      ? row.date_prevue.toISOString().slice(0, 10)
      : String(row.date_prevue || "").slice(0, 10);
  return {
    idRetouche: String(row.id_retouche || "").trim(),
    idClient: String(row.id_client || "").trim(),
    clientNom: `${row.nom || ""} ${row.prenom || ""}`.trim(),
    telephone: String(row.telephone || "").trim(),
    typeHabit: String(row.type_habit || "").trim(),
    typeRetouche: String(row.type_retouche || "").trim(),
    datePrevue: datePrevue || "",
    montantTotal: Number(row.montant_total || 0),
    montantPaye: Number(row.montant_paye || 0),
    soldeRestant: Math.max(0, Number(row.montant_total || 0) - Number(row.montant_paye || 0))
  };
}

export class ClientContactRepoPg {
  constructor(atelierId = "ATELIER") {
    this.atelierId = String(atelierId || "ATELIER").trim() || "ATELIER";
  }

  forAtelier(atelierId) {
    return new ClientContactRepoPg(atelierId);
  }

  async create({
    idClient,
    origineType = null,
    origineId = null,
    canal = "NOTE",
    modeleKey = null,
    statut = "A_RELANCER",
    note = "",
    utilisateur = null
  }) {
    await ensureSchema();
    const idContact = randomUUID();
    await pool.query(
      `INSERT INTO client_contact_suivi (
         id_contact,
         atelier_id,
         id_client,
         origine_type,
         origine_id,
         canal,
         modele_key,
         statut,
         note,
         utilisateur,
         date_contact
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
      [
        idContact,
        this.atelierId,
        String(idClient || "").trim(),
        origineType ? String(origineType).trim().toUpperCase() : null,
        origineId ? String(origineId).trim() : null,
        String(canal || "NOTE").trim().toUpperCase(),
        modeleKey ? String(modeleKey).trim() : null,
        String(statut || "A_RELANCER").trim().toUpperCase(),
        String(note || "").trim(),
        utilisateur ? String(utilisateur).trim() : null
      ]
    );
    return this.getLastByClientId(idClient);
  }

  async getLastByClientId(idClient) {
    await ensureSchema();
    const result = await pool.query(
      `SELECT id_contact, id_client, origine_type, origine_id, canal, modele_key, statut, note, utilisateur, date_contact
       FROM client_contact_suivi
       WHERE atelier_id = $1 AND id_client = $2
       ORDER BY date_contact DESC
       LIMIT 1`,
      [this.atelierId, String(idClient || "").trim()]
    );
    if (result.rowCount === 0) return null;
    return normalizeEntry(result.rows[0]);
  }

  async countByClientId(idClient) {
    await ensureSchema();
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM client_contact_suivi
       WHERE atelier_id = $1 AND id_client = $2`,
      [this.atelierId, String(idClient || "").trim()]
    );
    return Number(result.rows[0]?.total || 0);
  }

  async getDashboardSummary(limit = 5) {
    await ensureSchema();
    const safeLimit = Math.min(Math.max(Number(limit || 5), 1), 20);

    const [
      clientsResult,
      clientsCountResult,
      commandesResult,
      commandesCountResult,
      retouchesResult,
      retouchesCountResult
    ] = await Promise.all([
      pool.query(
        `WITH latest_contacts AS (
           SELECT
             s.id_client,
             s.canal,
             s.modele_key,
             s.statut,
             s.note,
             s.utilisateur,
             s.date_contact,
             ROW_NUMBER() OVER (PARTITION BY s.id_client ORDER BY s.date_contact DESC) AS rn
           FROM client_contact_suivi s
           WHERE s.atelier_id = $1
         )
         SELECT
           c.id_client,
           c.nom,
           c.prenom,
           c.telephone,
           lc.canal,
           lc.modele_key,
           lc.statut,
           lc.note,
           lc.utilisateur,
           lc.date_contact
         FROM latest_contacts lc
         INNER JOIN clients c ON c.id_client = lc.id_client AND c.atelier_id = $1
         WHERE lc.rn = 1
           AND lc.statut = 'A_RELANCER'
           AND COALESCE(c.actif, TRUE) = TRUE
         ORDER BY lc.date_contact DESC, c.nom ASC, c.prenom ASC
         LIMIT $2`,
        [this.atelierId, safeLimit]
      ),
      pool.query(
        `WITH latest_contacts AS (
           SELECT
             s.id_client,
             s.statut,
             ROW_NUMBER() OVER (PARTITION BY s.id_client ORDER BY s.date_contact DESC) AS rn
           FROM client_contact_suivi s
           WHERE s.atelier_id = $1
         )
         SELECT COUNT(*)::int AS total
         FROM latest_contacts lc
         INNER JOIN clients c ON c.id_client = lc.id_client AND c.atelier_id = $1
         WHERE lc.rn = 1
           AND lc.statut = 'A_RELANCER'
           AND COALESCE(c.actif, TRUE) = TRUE`,
        [this.atelierId]
      ),
      pool.query(
        `SELECT
           c.id_commande,
           c.id_client,
           c.type_habit,
           c.date_prevue,
           c.montant_total,
           c.montant_paye,
           cl.nom,
           cl.prenom,
           cl.telephone
         FROM commandes c
         LEFT JOIN clients cl ON cl.id_client = c.id_client AND cl.atelier_id = c.atelier_id
         WHERE c.atelier_id = $1
           AND c.statut = 'TERMINEE'
           AND NOT EXISTS (
             SELECT 1
             FROM client_contact_suivi s
             WHERE s.atelier_id = c.atelier_id
               AND s.origine_type = 'COMMANDE'
               AND s.origine_id = c.id_commande
               AND (
                 s.canal IN ('CALL', 'WHATSAPP')
                 OR s.statut IN ('CONTACTE', 'PROMIS', 'TERMINE')
               )
           )
         ORDER BY c.date_prevue ASC NULLS LAST, c.id_commande DESC
         LIMIT $2`,
        [this.atelierId, safeLimit]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM commandes c
         WHERE c.atelier_id = $1
           AND c.statut = 'TERMINEE'
           AND NOT EXISTS (
             SELECT 1
             FROM client_contact_suivi s
             WHERE s.atelier_id = c.atelier_id
               AND s.origine_type = 'COMMANDE'
               AND s.origine_id = c.id_commande
               AND (
                 s.canal IN ('CALL', 'WHATSAPP')
                 OR s.statut IN ('CONTACTE', 'PROMIS', 'TERMINE')
               )
           )`,
        [this.atelierId]
      ),
      pool.query(
        `SELECT
           r.id_retouche,
           r.id_client,
           r.type_habit,
           r.type_retouche,
           r.date_prevue,
           r.montant_total,
           r.montant_paye,
           cl.nom,
           cl.prenom,
           cl.telephone
         FROM retouches r
         LEFT JOIN clients cl ON cl.id_client = r.id_client AND cl.atelier_id = r.atelier_id
         WHERE r.atelier_id = $1
           AND r.statut = 'TERMINEE'
           AND NOT EXISTS (
             SELECT 1
             FROM client_contact_suivi s
             WHERE s.atelier_id = r.atelier_id
               AND s.origine_type = 'RETOUCHE'
               AND s.origine_id = r.id_retouche
               AND (
                 s.canal IN ('CALL', 'WHATSAPP')
                 OR s.statut IN ('CONTACTE', 'PROMIS', 'TERMINE')
               )
           )
         ORDER BY r.date_prevue ASC NULLS LAST, r.id_retouche DESC
         LIMIT $2`,
        [this.atelierId, safeLimit]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM retouches r
         WHERE r.atelier_id = $1
           AND r.statut = 'TERMINEE'
           AND NOT EXISTS (
             SELECT 1
             FROM client_contact_suivi s
             WHERE s.atelier_id = r.atelier_id
               AND s.origine_type = 'RETOUCHE'
               AND s.origine_id = r.id_retouche
               AND (
                 s.canal IN ('CALL', 'WHATSAPP')
                 OR s.statut IN ('CONTACTE', 'PROMIS', 'TERMINE')
               )
           )`,
        [this.atelierId]
      )
    ]);

    return {
      clientsARelancer: {
        total: Number(clientsCountResult.rows[0]?.total || 0),
        items: clientsResult.rows.map(normalizeDashboardClient)
      },
      commandesPretesNonSignalees: {
        total: Number(commandesCountResult.rows[0]?.total || 0),
        items: commandesResult.rows.map(normalizeDashboardCommande)
      },
      retouchesPretesNonSignalees: {
        total: Number(retouchesCountResult.rows[0]?.total || 0),
        items: retouchesResult.rows.map(normalizeDashboardRetouche)
      }
    };
  }
}
