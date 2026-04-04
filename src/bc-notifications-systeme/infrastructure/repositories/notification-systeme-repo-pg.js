import { pool } from "../../../shared/infrastructure/db.js";
import { NotificationSysteme } from "../../domain/notification-systeme.js";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications_systeme (
      id_notification TEXT PRIMARY KEY,
      portee TEXT NOT NULL,
      atelier_id TEXT NULL,
      titre TEXT NOT NULL,
      message TEXT NOT NULL,
      canal TEXT NOT NULL DEFAULT 'IN_APP',
      statut TEXT NOT NULL DEFAULT 'ENVOYEE',
      cree_par_user_id TEXT NOT NULL,
      cree_par_nom TEXT NOT NULL,
      date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      date_envoi TIMESTAMPTZ NULL
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_systeme_date_creation ON notifications_systeme (date_creation DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_systeme_portee_date_creation ON notifications_systeme (portee, date_creation DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_systeme_atelier_date_creation ON notifications_systeme (atelier_id, date_creation DESC)`);
  schemaReady = true;
}

function mapRow(row) {
  if (!row) return null;
  return new NotificationSysteme({
    idNotification: row.id_notification,
    portee: row.portee,
    atelierId: row.atelier_id || null,
    titre: row.titre,
    message: row.message,
    canal: row.canal,
    statut: row.statut,
    creeParUserId: row.cree_par_user_id,
    creeParNom: row.cree_par_nom,
    dateCreation: row.date_creation || null,
    dateEnvoi: row.date_envoi || null
  });
}

export class NotificationSystemeRepoPg {
  async save(notification) {
    await ensureSchema();
    const result = await pool.query(
      `INSERT INTO notifications_systeme (
         id_notification, portee, atelier_id, titre, message, canal, statut, cree_par_user_id, cree_par_nom, date_envoi
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id_notification, portee, atelier_id, titre, message, canal, statut, cree_par_user_id, cree_par_nom, date_creation, date_envoi`,
      [
        notification.idNotification,
        notification.portee,
        notification.atelierId,
        notification.titre,
        notification.message,
        notification.canal,
        notification.statut,
        notification.creeParUserId,
        notification.creeParNom,
        notification.dateEnvoi
      ]
    );
    return mapRow(result.rows[0] || null);
  }

  async list() {
    await ensureSchema();
    const result = await pool.query(
      `SELECT id_notification, portee, atelier_id, titre, message, canal, statut, cree_par_user_id, cree_par_nom, date_creation, date_envoi
       FROM notifications_systeme
       ORDER BY date_creation DESC`
    );
    return result.rows.map(mapRow);
  }

  async listForAtelier(atelierId) {
    await ensureSchema();
    const result = await pool.query(
      `SELECT id_notification, portee, atelier_id, titre, message, canal, statut, cree_par_user_id, cree_par_nom, date_creation, date_envoi
       FROM notifications_systeme
       WHERE portee = 'GLOBAL' OR atelier_id = $1
       ORDER BY date_creation DESC`,
      [String(atelierId || "").trim()]
    );
    return result.rows.map(mapRow);
  }
}
