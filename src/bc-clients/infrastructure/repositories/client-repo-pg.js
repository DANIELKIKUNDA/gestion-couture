import { pool } from "../../../shared/infrastructure/db.js";
import { Client } from "../../domain/client.js";

export class ClientRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new ClientRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new ClientRepoPg(this.atelierId, db || pool);
  }

  mapRow(row) {
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

  async listAll() {
    const res = await this.db.query(
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
    const res = await this.db.query(
      `SELECT id_client, nom, prenom, telephone, adresse, sexe, actif, date_creation
       FROM clients
       WHERE id_client = $1 AND atelier_id = $2`,
      [idClient, this.atelierId]
    );
    if (res.rowCount === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async findByTelephone(telephone) {
    const normalizedTelephone = String(telephone || "").replace(/\D/g, "");
    if (!normalizedTelephone) return null;

    const res = await this.db.query(
      `SELECT id_client, nom, prenom, telephone, adresse, sexe, actif, date_creation
       FROM clients
       WHERE atelier_id = $1
         AND regexp_replace(COALESCE(telephone, ''), '[^0-9]', '', 'g') = $2
       ORDER BY date_creation DESC
       LIMIT 1`,
      [this.atelierId, normalizedTelephone]
    );
    if (res.rowCount === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async findProbableDuplicates({ nom, prenom } = {}) {
    const normalizedNom = String(nom || "").trim();
    const normalizedPrenom = String(prenom || "").trim();
    if (!normalizedNom || !normalizedPrenom) return [];

    const res = await this.db.query(
      `SELECT id_client, nom, prenom, telephone, adresse, sexe, actif, date_creation
       FROM clients
       WHERE atelier_id = $1
         AND LOWER(TRIM(nom)) = LOWER(TRIM($2))
         AND LOWER(TRIM(prenom)) = LOWER(TRIM($3))
       ORDER BY date_creation DESC`,
      [this.atelierId, normalizedNom, normalizedPrenom]
    );

    return res.rows.map((row) => this.mapRow(row));
  }

  async save(client) {
    await this.db.query(
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
