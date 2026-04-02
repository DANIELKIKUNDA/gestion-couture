import { pool } from "../../../shared/infrastructure/db.js";

function normalizeText(value) {
  return String(value || "").trim();
}

export class RetoucheItemRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new RetoucheItemRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new RetoucheItemRepoPg(this.atelierId, db || pool);
  }

  async listByRetouche(idRetouche) {
    const normalizedId = normalizeText(idRetouche);
    if (!normalizedId) return [];
    let result;
    try {
      result = await this.db.query(
        `SELECT id_item, id_retouche, type_retouche, description, prix, ordre_affichage, date_creation
         FROM retouche_items
         WHERE atelier_id = $1 AND id_retouche = $2
         ORDER BY ordre_affichage ASC, date_creation ASC`,
        [this.atelierId, normalizedId]
      );
    } catch (error) {
      if (String(error?.code || "") === "42P01") return [];
      throw error;
    }
    return result.rows.map((row) => ({
      idItem: row.id_item,
      idRetouche: row.id_retouche,
      typeRetouche: row.type_retouche || "",
      description: row.description || "",
      prix: Number(row.prix || 0),
      ordreAffichage: Number(row.ordre_affichage || 1),
      dateCreation: row.date_creation
    }));
  }

  async replaceForRetouche(idRetouche, items = []) {
    const normalizedRetoucheId = normalizeText(idRetouche);
    if (!normalizedRetoucheId) throw new Error("idRetouche obligatoire pour enregistrer les items.");
    await this.db.query("DELETE FROM retouche_items WHERE atelier_id = $1 AND id_retouche = $2", [this.atelierId, normalizedRetoucheId]);
    for (const [index, item] of items.entries()) {
      await this.db.query(
        `INSERT INTO retouche_items (id_item, atelier_id, id_retouche, type_retouche, description, prix, ordre_affichage, date_creation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()))`,
        [
          item.idItem,
          this.atelierId,
          normalizedRetoucheId,
          normalizeText(item.typeRetouche),
          normalizeText(item.description),
          Number(item.prix || 0),
          Number(item.ordreAffichage || index + 1),
          item.dateCreation || null
        ]
      );
    }
  }
}
