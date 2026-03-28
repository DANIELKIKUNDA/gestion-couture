import { pool } from "../../../shared/infrastructure/db.js";
import { hasCommandeLignesTable } from "./commande-ligne-schema.js";

function mapCommandeLigne(row) {
  return {
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
  };
}

export class CommandeLigneRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new CommandeLigneRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new CommandeLigneRepoPg(this.atelierId, db || pool);
  }

  async listByCommandeId(idCommande) {
    if (!(await hasCommandeLignesTable(this.db))) {
      return [];
    }
    const res = await this.db.query(
      `SELECT id_ligne, id_commande, id_client, role, nom_affiche, prenom_affiche, type_habit, mesures_habit_snapshot, ordre_affichage, date_creation
       FROM commande_lignes
       WHERE atelier_id = $1 AND id_commande = $2
       ORDER BY ordre_affichage ASC, date_creation ASC`,
      [this.atelierId, idCommande]
    );
    return res.rows.map(mapCommandeLigne);
  }

  async replaceForCommande(idCommande, lignes = []) {
    const normalizedLignes = Array.isArray(lignes) ? lignes.filter(Boolean) : [];
    if (!(await hasCommandeLignesTable(this.db))) {
      if (normalizedLignes.length > 1) {
        const err = new Error("Le serveur doit finaliser sa mise a jour avant les commandes avec plusieurs beneficiaires.");
        err.code = "COMMANDE_LIGNES_SCHEMA_REQUIRED";
        err.status = 400;
        throw err;
      }
      return;
    }
    await this.db.query(
      `DELETE FROM commande_lignes
       WHERE atelier_id = $1 AND id_commande = $2`,
      [this.atelierId, idCommande]
    );

    for (const ligne of normalizedLignes) {
      await this.db.query(
        `INSERT INTO commande_lignes (
          id_ligne,
          atelier_id,
          id_commande,
          id_client,
          role,
          nom_affiche,
          prenom_affiche,
          type_habit,
          mesures_habit_snapshot,
          ordre_affichage,
          date_creation
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          ligne.idLigne,
          this.atelierId,
          idCommande,
          ligne.idClient || null,
          ligne.role,
          ligne.nomAffiche || "",
          ligne.prenomAffiche || "",
          ligne.typeHabit,
          JSON.stringify(ligne.mesuresHabit),
          Number(ligne.ordreAffichage || 1),
          ligne.dateCreation || new Date().toISOString()
        ]
      );
    }
  }
}
