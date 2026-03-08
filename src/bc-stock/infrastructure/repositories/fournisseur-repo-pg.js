import { pool } from "../../../shared/infrastructure/db.js";

export class FournisseurRepoPg {
  async getActiveById(idFournisseur) {
    const result = await pool.query(
      "SELECT id_fournisseur, nom_fournisseur, telephone, actif, date_creation FROM fournisseurs WHERE id_fournisseur = $1 AND actif = true",
      [idFournisseur]
    );
    if (result.rowCount === 0) return null;

    const row = result.rows[0];
    return {
      idFournisseur: row.id_fournisseur,
      nomFournisseur: row.nom_fournisseur,
      telephone: row.telephone || null,
      actif: row.actif,
      dateCreation: row.date_creation
    };
  }
}
