import { pool } from "../../../shared/infrastructure/db.js";

function mapRow(row) {
  return {
    idAtelier: row.id_atelier,
    nomAtelier: row.nom,
    slug: row.slug,
    actif: row.actif !== false,
    proprietaire: row.proprietaire_id
      ? {
          id: row.proprietaire_id,
          nom: row.proprietaire_nom || "",
          email: row.proprietaire_email || "",
          telephone: row.proprietaire_telephone || ""
        }
      : null
  };
}

export class AtelierContactQueryPg {
  async list({ search = "", atelierId = null, includeInactive = false } = {}) {
    const params = [];
    const filters = [`a.id_atelier <> 'SYSTEME'`];

    if (atelierId) {
      params.push(String(atelierId).trim());
      filters.push(`a.id_atelier = $${params.length}`);
    }

    if (!includeInactive) {
      filters.push(`a.actif = true`);
    }

    const normalizedSearch = String(search || "").trim().toLowerCase();
    if (normalizedSearch) {
      params.push(`%${normalizedSearch}%`);
      filters.push(`(
        LOWER(a.nom) LIKE $${params.length}
        OR LOWER(a.slug) LIKE $${params.length}
        OR LOWER(a.id_atelier) LIKE $${params.length}
        OR LOWER(COALESCE(owner.nom, '')) LIKE $${params.length}
        OR LOWER(COALESCE(owner.email, '')) LIKE $${params.length}
        OR LOWER(COALESCE(owner.telephone, '')) LIKE $${params.length}
      )`);
    }

    const whereSql = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT a.id_atelier,
              a.nom,
              a.slug,
              a.actif,
              owner.id_utilisateur AS proprietaire_id,
              owner.nom AS proprietaire_nom,
              owner.email AS proprietaire_email,
              owner.telephone AS proprietaire_telephone
       FROM ateliers a
       LEFT JOIN LATERAL (
         SELECT u.id_utilisateur, u.nom, u.email, u.telephone
         FROM utilisateurs u
         WHERE u.atelier_id = a.id_atelier
           AND UPPER(u.role_id) = 'PROPRIETAIRE'
         ORDER BY u.date_creation ASC
         LIMIT 1
       ) owner ON true
       ${whereSql}
       ORDER BY LOWER(a.nom) ASC`,
      params
    );
    return result.rows.map(mapRow);
  }
}
