import { pool } from "../../../shared/infrastructure/db.js";
import { NotificationSysteme } from "../../domain/notification-systeme.js";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_lectures (
      notification_id TEXT NOT NULL,
      atelier_id TEXT NOT NULL,
      lu_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lu_par_user_id TEXT NULL,
      PRIMARY KEY (notification_id, atelier_id),
      CONSTRAINT notification_lectures_notification_fk
        FOREIGN KEY (notification_id)
        REFERENCES notifications_systeme(id_notification)
        ON DELETE CASCADE
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_notification_lectures_atelier_lu_at ON notification_lectures (atelier_id, lu_at DESC)`
  );
  schemaReady = true;
}

function mapRow(row) {
  return {
    notification: new NotificationSysteme({
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
    }),
    luAt: row.lu_at || null,
    estLue: Boolean(row.lu_at)
  };
}

export class NotificationLectureRepoPg {
  async listForAtelier(atelierId) {
    await ensureSchema();
    const atelierIdValue = String(atelierId || "").trim();
    const result = await pool.query(
      `SELECT n.id_notification, n.portee, n.atelier_id, n.titre, n.message, n.canal, n.statut,
              n.cree_par_user_id, n.cree_par_nom, n.date_creation, n.date_envoi,
              nl.lu_at
         FROM notifications_systeme n
         LEFT JOIN notification_lectures nl
           ON nl.notification_id = n.id_notification
          AND nl.atelier_id = $1
        WHERE n.portee = 'GLOBAL' OR n.atelier_id = $1
        ORDER BY n.date_creation DESC`,
      [atelierIdValue]
    );
    return result.rows.map(mapRow);
  }

  async countUnreadForAtelier(atelierId) {
    await ensureSchema();
    const atelierIdValue = String(atelierId || "").trim();
    const result = await pool.query(
      `SELECT COUNT(*)::INT AS total
         FROM notifications_systeme n
         LEFT JOIN notification_lectures nl
           ON nl.notification_id = n.id_notification
          AND nl.atelier_id = $1
        WHERE (n.portee = 'GLOBAL' OR n.atelier_id = $1)
          AND nl.lu_at IS NULL`,
      [atelierIdValue]
    );
    return Number(result.rows[0]?.total || 0);
  }

  async markAsRead({ notificationId, atelierId, luParUserId = null }) {
    await ensureSchema();
    const notificationIdValue = String(notificationId || "").trim();
    const atelierIdValue = String(atelierId || "").trim();
    const userIdValue = luParUserId == null ? null : String(luParUserId).trim() || null;

    await pool.query(
      `INSERT INTO notification_lectures (notification_id, atelier_id, lu_par_user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (notification_id, atelier_id)
       DO UPDATE SET
         lu_at = COALESCE(notification_lectures.lu_at, NOW()),
         lu_par_user_id = COALESCE(notification_lectures.lu_par_user_id, EXCLUDED.lu_par_user_id)`,
      [notificationIdValue, atelierIdValue, userIdValue]
    );
  }
}
