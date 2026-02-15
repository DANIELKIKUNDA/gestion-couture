import { pool } from "../../../shared/infrastructure/db.js";
import { Client } from "../../domain/client.js";

export class ClientRepoPg {
  async listAll() {
    const res = await pool.query(
      `SELECT id_client, nom, prenom, telephone, adresse, sexe, actif, date_creation
       FROM clients
       ORDER BY date_creation DESC`
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
      "SELECT id_client, nom, prenom, telephone, adresse, sexe, actif, date_creation FROM clients WHERE id_client = $1",
      [idClient]
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
      `INSERT INTO clients (id_client, nom, prenom, telephone, adresse, sexe, actif, date_creation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id_client)
       DO UPDATE SET nom=$2, prenom=$3, telephone=$4, adresse=$5, sexe=$6, actif=$7`,
      [
        client.idClient,
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
