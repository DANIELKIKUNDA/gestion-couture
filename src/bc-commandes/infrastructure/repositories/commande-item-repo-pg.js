import { pool } from "../../../shared/infrastructure/db.js";
import { CommandeItem } from "../../domain/commande-item.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeMeasures(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

async function hasCommandeItemMeasuresColumn(db) {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'commande_items'
       AND column_name = 'mesures_snapshot_json'
     LIMIT 1`
  );
  return result.rowCount > 0;
}

export class CommandeItemRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new CommandeItemRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new CommandeItemRepoPg(this.atelierId, db || pool);
  }

  async listByCommande(idCommande) {
    const normalizedId = normalizeText(idCommande);
    if (!normalizedId) return [];
    const includeMeasures = await hasCommandeItemMeasuresColumn(this.db).catch(() => false);
    try {
      const result = await this.db.query(
        includeMeasures
          ? `SELECT id_item, id_commande, type_habit, description, prix, ordre_affichage, mesures_snapshot_json, date_creation
             FROM commande_items
             WHERE atelier_id = $1 AND id_commande = $2
             ORDER BY ordre_affichage ASC, date_creation ASC`
          : `SELECT id_item, id_commande, type_habit, description, prix, ordre_affichage, date_creation
             FROM commande_items
             WHERE atelier_id = $1 AND id_commande = $2
             ORDER BY ordre_affichage ASC, date_creation ASC`,
        [this.atelierId, normalizedId]
      );
      return result.rows.map((row) => ({
        idItem: row.id_item,
        idCommande: row.id_commande,
        typeHabit: row.type_habit || "",
        description: row.description || "",
        prix: Number(row.prix || 0),
        ordreAffichage: Number(row.ordre_affichage || 1),
        mesures: normalizeMeasures(row.mesures_snapshot_json),
        dateCreation: row.date_creation
      })).map((row) => new CommandeItem({ ...row, rehydrate: true }));
    } catch (error) {
      if (String(error?.code || "") === "42P01") return [];
      throw error;
    }
  }

  async replaceForCommande(idCommande, items = []) {
    const normalizedCommandeId = normalizeText(idCommande);
    if (!normalizedCommandeId) throw new Error("idCommande obligatoire pour enregistrer les items.");
    await this.db.query("DELETE FROM commande_items WHERE atelier_id = $1 AND id_commande = $2", [this.atelierId, normalizedCommandeId]);
    const includeMeasures = await hasCommandeItemMeasuresColumn(this.db).catch(() => false);
    for (const [index, item] of items.entries()) {
      await this.db.query(
        includeMeasures
          ? `INSERT INTO commande_items (id_item, atelier_id, id_commande, type_habit, description, prix, ordre_affichage, mesures_snapshot_json, date_creation)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,COALESCE($9, NOW()))`
          : `INSERT INTO commande_items (id_item, atelier_id, id_commande, type_habit, description, prix, ordre_affichage, date_creation)
             VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()))`,
        includeMeasures
          ? [
              item.idItem,
              this.atelierId,
              normalizedCommandeId,
              normalizeText(item.typeHabit),
              normalizeText(item.description),
              Number(item.prix || 0),
              Number(item.ordreAffichage || index + 1),
              item.mesures ? JSON.stringify(item.mesures) : null,
              item.dateCreation || null
            ]
          : [
              item.idItem,
              this.atelierId,
              normalizedCommandeId,
              normalizeText(item.typeHabit),
              normalizeText(item.description),
              Number(item.prix || 0),
              Number(item.ordreAffichage || index + 1),
              item.dateCreation || null
            ]
      );
    }
  }
}
