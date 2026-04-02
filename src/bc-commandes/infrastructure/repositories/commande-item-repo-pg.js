import { pool } from "../../../shared/infrastructure/db.js";

function normalizeText(value) {
  return String(value || "").trim();
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
    let result;
    try {
      result = await this.db.query(
        `SELECT id_item, id_commande, type_habit, description, prix, ordre_affichage, date_creation
         FROM commande_items
         WHERE atelier_id = $1 AND id_commande = $2
         ORDER BY ordre_affichage ASC, date_creation ASC`,
        [this.atelierId, normalizedId]
      );
    } catch (error) {
      if (String(error?.code || "") === "42P01") return [];
      throw error;
    }
    return result.rows.map((row) => ({
      idItem: row.id_item,
      idCommande: row.id_commande,
      typeHabit: row.type_habit || "",
      description: row.description || "",
      prix: Number(row.prix || 0),
      ordreAffichage: Number(row.ordre_affichage || 1),
      dateCreation: row.date_creation
    }));
  }

  async replaceForCommande(idCommande, items = []) {
    const normalizedCommandeId = normalizeText(idCommande);
    if (!normalizedCommandeId) throw new Error("idCommande obligatoire pour enregistrer les items.");
    await this.db.query("DELETE FROM commande_items WHERE atelier_id = $1 AND id_commande = $2", [this.atelierId, normalizedCommandeId]);
    for (const [index, item] of items.entries()) {
      await this.db.query(
        `INSERT INTO commande_items (id_item, atelier_id, id_commande, type_habit, description, prix, ordre_affichage, date_creation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()))`,
        [
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
