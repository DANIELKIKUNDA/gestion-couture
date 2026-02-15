import { pool } from "../../../shared/infrastructure/db.js";
import { generateFactureId } from "../../../shared/domain/id-generator.js";
import { Facture } from "../../domain/facture.js";
import { calculerMontantPayeFacture } from "../../domain/policies.js";

const OPERATIONS_SQL = `
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'typeOperation', op.type_operation,
        'statutOperation', op.statut_operation,
        'motif', op.motif,
        'montant', op.montant
      )
    )
    FROM caisse_operation op
    WHERE op.reference_metier = COALESCE(f.id_origine, f.id_reference)
  ), '[]'::jsonb) AS operations_caisse
`;

function toFacture(row) {
  const normalizedType = String(row.type_origine || "").trim().toUpperCase();
  const operations = Array.isArray(row.operations_caisse) ? row.operations_caisse : [];
  const montantPaye = calculerMontantPayeFacture({
    typeOrigine: normalizedType,
    operations
  });

  return new Facture({
    idFacture: row.id_facture,
    numeroFacture: row.numero_facture,
    typeOrigine: normalizedType,
    idOrigine: String(row.id_origine || "").trim(),
    client: row.client_snapshot || {},
    dateEmission: row.date_emission,
    montantTotal: Number(row.montant_total),
    referenceCaisse: row.reference_caisse || null,
    lignes: row.lignes_json || []
  }).withPaiements(montantPaye);
}

export class FactureRepoPg {
  async ensureNumeroSequence() {
    await pool.query("CREATE SEQUENCE IF NOT EXISTS facture_numero_seq START WITH 1 INCREMENT BY 1");
  }

  async nextFactureId() {
    return generateFactureId();
  }

  async nextNumeroFacture(date = new Date()) {
    await this.ensureNumeroSequence();
    const res = await pool.query(
      "SELECT to_char($1::timestamp, 'YYYY') AS year, lpad(nextval('facture_numero_seq')::text, 6, '0') AS seq",
      [date.toISOString()]
    );
    const row = res.rows[0];
    return `FAC-${row.year}-${row.seq}`;
  }

  async getByOrigine(typeOrigine, idOrigine) {
    const res = await pool.query(
      `SELECT f.id_facture,
              f.numero_facture,
              COALESCE(f.type_origine, f.type_reference) AS type_origine,
              COALESCE(f.id_origine, f.id_reference) AS id_origine,
              COALESCE(
                f.client_snapshot,
                jsonb_build_object(
                  'nom', COALESCE(NULLIF(TRIM(COALESCE(cl.nom, '') || ' ' || COALESCE(cl.prenom, '')), ''), COALESCE(f.id_client, 'Client')),
                  'contact', COALESCE(cl.telephone, '')
                )
              ) AS client_snapshot,
              COALESCE(f.date_emission, NOW()) AS date_emission,
              f.montant_total,
              f.reference_caisse,
              COALESCE(
                f.lignes_json,
                jsonb_build_array(jsonb_build_object('description', 'Facture legacy', 'quantite', 1, 'prix', f.montant_total, 'montant', f.montant_total))
              ) AS lignes_json,
              ${OPERATIONS_SQL}
       FROM factures f
       LEFT JOIN clients cl ON cl.id_client = f.id_client
       WHERE f.type_origine = $1 AND f.id_origine = $2
       LIMIT 1`,
      [typeOrigine, idOrigine]
    );
    if (res.rowCount === 0) return null;
    return toFacture(res.rows[0]);
  }

  async getByIdWithPaiements(idFacture) {
    const res = await pool.query(
      `SELECT f.id_facture,
              f.numero_facture,
              COALESCE(f.type_origine, f.type_reference) AS type_origine,
              COALESCE(f.id_origine, f.id_reference) AS id_origine,
              COALESCE(
                f.client_snapshot,
                jsonb_build_object(
                  'nom', COALESCE(NULLIF(TRIM(COALESCE(cl.nom, '') || ' ' || COALESCE(cl.prenom, '')), ''), COALESCE(f.id_client, 'Client')),
                  'contact', COALESCE(cl.telephone, '')
                )
              ) AS client_snapshot,
              COALESCE(f.date_emission, NOW()) AS date_emission,
              f.montant_total,
              f.reference_caisse,
              COALESCE(
                f.lignes_json,
                jsonb_build_array(jsonb_build_object('description', 'Facture legacy', 'quantite', 1, 'prix', f.montant_total, 'montant', f.montant_total))
              ) AS lignes_json,
              ${OPERATIONS_SQL}
       FROM factures f
       LEFT JOIN clients cl ON cl.id_client = f.id_client
       WHERE f.id_facture = $1`,
      [idFacture]
    );
    if (res.rowCount === 0) return null;
    return toFacture(res.rows[0]);
  }

  async listWithPaiements() {
    const res = await pool.query(
      `SELECT f.id_facture,
              f.numero_facture,
              COALESCE(f.type_origine, f.type_reference) AS type_origine,
              COALESCE(f.id_origine, f.id_reference) AS id_origine,
              COALESCE(
                f.client_snapshot,
                jsonb_build_object(
                  'nom', COALESCE(NULLIF(TRIM(COALESCE(cl.nom, '') || ' ' || COALESCE(cl.prenom, '')), ''), COALESCE(f.id_client, 'Client')),
                  'contact', COALESCE(cl.telephone, '')
                )
              ) AS client_snapshot,
              COALESCE(f.date_emission, NOW()) AS date_emission,
              f.montant_total,
              f.reference_caisse,
              COALESCE(
                f.lignes_json,
                jsonb_build_array(jsonb_build_object('description', 'Facture legacy', 'quantite', 1, 'prix', f.montant_total, 'montant', f.montant_total))
              ) AS lignes_json,
              ${OPERATIONS_SQL}
       FROM factures f
       LEFT JOIN clients cl ON cl.id_client = f.id_client
       WHERE COALESCE(f.type_origine, f.type_reference) IN ('COMMANDE', 'RETOUCHE', 'VENTE')
       ORDER BY f.date_emission DESC, f.numero_facture DESC`
    );
    const items = [];
    for (const row of res.rows) {
      try {
        items.push(toFacture(row));
      } catch {
        // Ignore legacy malformed rows instead of breaking the whole API list.
      }
    }
    return items;
  }

  async save(facture) {
    await pool.query(
      `INSERT INTO factures (
        id_facture, numero_facture, type_origine, id_origine, client_snapshot,
        date_emission, montant_total, reference_caisse, lignes_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        facture.idFacture,
        facture.numeroFacture,
        facture.typeOrigine,
        facture.idOrigine,
        JSON.stringify(facture.client),
        facture.dateEmission,
        facture.montantTotal,
        facture.referenceCaisse,
        JSON.stringify(facture.lignes)
      ]
    );
  }
}
