import { pool } from "../../../shared/infrastructure/db.js";
import { Client } from "../../domain/client.js";

export class ClientRepoPg {
  constructor(atelierId = "ATELIER") {
    this.atelierId = String(atelierId || "ATELIER");
  }

  forAtelier(atelierId) {
    return new ClientRepoPg(atelierId);
  }

  async listAll() {
    const res = await pool.query(
      `SELECT id_client, nom, prenom, telephone, adresse, sexe, actif, date_creation
       FROM clients
       WHERE atelier_id = $1
       ORDER BY date_creation DESC`,
      [this.atelierId]
    );

    return res.rows.map((row) => ({
      idClient: row.id_client,
      nom: row.nom,
      prenom: row.prenom,
      telephone: row.telephone,
      adresse: row.adresse,
      sexe: row.sexe,
      actif: row.actif,
      dateCreation: row.date_creation
    }));
  }

  async getById(idClient) {
    const res = await pool.query(
      "SELECT id_client, nom, prenom, telephone, adresse, sexe, actif, date_creation FROM clients WHERE id_client = $1 AND atelier_id = $2",
      [idClient, this.atelierId]
    );
    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    return new Client({
      idClient: row.id_client,
      nom: row.nom,
      prenom: row.prenom,
      telephone: row.telephone,
      adresse: row.adresse,
      sexe: row.sexe,
      actif: row.actif,
      dateCreation: row.date_creation
    });
  }

  async save(client) {
    await pool.query(
      `INSERT INTO clients (id_client, atelier_id, nom, prenom, telephone, adresse, sexe, actif, date_creation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id_client)
       DO UPDATE SET atelier_id=$2, nom=$3, prenom=$4, telephone=$5, adresse=$6, sexe=$7, actif=$8`,
      [
        client.idClient,
        this.atelierId,
        client.nom,
        client.prenom,
        client.telephone,
        client.adresse,
        client.sexe,
        client.actif,
        client.dateCreation
      ]
    );
  }
}
