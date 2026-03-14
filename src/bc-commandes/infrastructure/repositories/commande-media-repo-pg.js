import { pool } from "../../../shared/infrastructure/db.js";

function mapCommandeMediaRow(row) {
  if (!row) return null;
  return {
    idMedia: row.id_media,
    atelierId: row.atelier_id,
    idCommande: row.id_commande,
    typeMedia: row.type_media,
    sourceType: row.source_type,
    cheminOriginal: row.chemin_original,
    cheminThumbnail: row.chemin_thumbnail,
    nomFichierOriginal: row.nom_fichier_original,
    mimeType: row.mime_type,
    extensionStockage: row.extension_stockage,
    tailleOriginaleBytes: Number(row.taille_originale_bytes || 0),
    largeur: row.largeur === null ? null : Number(row.largeur),
    hauteur: row.hauteur === null ? null : Number(row.hauteur),
    note: row.note || "",
    position: Number(row.position || 1),
    isPrimary: row.is_primary === true,
    creePar: row.cree_par || "",
    dateCreation: row.date_creation
  };
}

export class CommandeMediaRepoPg {
  constructor(atelierId = "ATELIER") {
    this.atelierId = String(atelierId || "ATELIER");
  }

  forAtelier(atelierId) {
    return new CommandeMediaRepoPg(atelierId);
  }

  async listByCommande(idCommande, db = pool) {
    const result = await db.query(
      `SELECT id_media,
              atelier_id,
              id_commande,
              type_media,
              source_type,
              chemin_original,
              chemin_thumbnail,
              nom_fichier_original,
              mime_type,
              extension_stockage,
              taille_originale_bytes,
              largeur,
              hauteur,
              note,
              position,
              is_primary,
              cree_par,
              date_creation
       FROM commande_media
       WHERE atelier_id = $1 AND id_commande = $2
       ORDER BY position ASC, date_creation ASC`,
      [this.atelierId, idCommande]
    );
    return result.rows.map(mapCommandeMediaRow).filter(Boolean);
  }

  async countByCommande(idCommande, db = pool) {
    const result = await db.query(
      "SELECT COUNT(*)::int AS total FROM commande_media WHERE atelier_id = $1 AND id_commande = $2",
      [this.atelierId, idCommande]
    );
    return Number(result.rows?.[0]?.total || 0);
  }

  async getById(idCommande, idMedia, db = pool) {
    const result = await db.query(
      `SELECT id_media,
              atelier_id,
              id_commande,
              type_media,
              source_type,
              chemin_original,
              chemin_thumbnail,
              nom_fichier_original,
              mime_type,
              extension_stockage,
              taille_originale_bytes,
              largeur,
              hauteur,
              note,
              position,
              is_primary,
              cree_par,
              date_creation
       FROM commande_media
       WHERE atelier_id = $1 AND id_commande = $2 AND id_media = $3`,
      [this.atelierId, idCommande, idMedia]
    );
    if (result.rowCount === 0) return null;
    return mapCommandeMediaRow(result.rows[0]);
  }

  async getByIdForUpdate(idCommande, idMedia, db = pool) {
    const result = await db.query(
      `SELECT id_media,
              atelier_id,
              id_commande,
              type_media,
              source_type,
              chemin_original,
              chemin_thumbnail,
              nom_fichier_original,
              mime_type,
              extension_stockage,
              taille_originale_bytes,
              largeur,
              hauteur,
              note,
              position,
              is_primary,
              cree_par,
              date_creation
       FROM commande_media
       WHERE atelier_id = $1 AND id_commande = $2 AND id_media = $3
       FOR UPDATE`,
      [this.atelierId, idCommande, idMedia]
    );
    if (result.rowCount === 0) return null;
    return mapCommandeMediaRow(result.rows[0]);
  }

  async insert(media, db = pool) {
    const result = await db.query(
      `INSERT INTO commande_media (
         id_media,
         atelier_id,
         id_commande,
         type_media,
         source_type,
         chemin_original,
         chemin_thumbnail,
         nom_fichier_original,
         mime_type,
         extension_stockage,
         taille_originale_bytes,
         largeur,
         hauteur,
         note,
         position,
         is_primary,
         cree_par,
         date_creation
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW()
       )
       RETURNING id_media,
                 atelier_id,
                 id_commande,
                 type_media,
                 source_type,
                 chemin_original,
                 chemin_thumbnail,
                 nom_fichier_original,
                 mime_type,
                 extension_stockage,
                 taille_originale_bytes,
                 largeur,
                 hauteur,
                 note,
                 position,
                 is_primary,
                 cree_par,
                 date_creation`,
      [
        media.idMedia,
        this.atelierId,
        media.idCommande,
        media.typeMedia || "IMAGE",
        media.sourceType || "UPLOAD",
        media.cheminOriginal,
        media.cheminThumbnail,
        media.nomFichierOriginal || null,
        media.mimeType,
        media.extensionStockage || "webp",
        Number(media.tailleOriginaleBytes || 0),
        media.largeur === null || media.largeur === undefined ? null : Number(media.largeur),
        media.hauteur === null || media.hauteur === undefined ? null : Number(media.hauteur),
        media.note ? String(media.note) : null,
        Number(media.position || 1),
        media.isPrimary === true,
        media.creePar || null
      ]
    );
    return mapCommandeMediaRow(result.rows[0]);
  }

  async clearPrimaryForCommande(idCommande, db = pool) {
    await db.query(
      "UPDATE commande_media SET is_primary = false WHERE atelier_id = $1 AND id_commande = $2 AND is_primary = true",
      [this.atelierId, idCommande]
    );
  }

  async setPrimary(idCommande, idMedia, db = pool) {
    await this.clearPrimaryForCommande(idCommande, db);
    const result = await db.query(
      `UPDATE commande_media
       SET is_primary = true
       WHERE atelier_id = $1 AND id_commande = $2 AND id_media = $3
       RETURNING id_media,
                 atelier_id,
                 id_commande,
                 type_media,
                 source_type,
                 chemin_original,
                 chemin_thumbnail,
                 nom_fichier_original,
                 mime_type,
                 extension_stockage,
                 taille_originale_bytes,
                 largeur,
                 hauteur,
                 note,
                 position,
                 is_primary,
                 cree_par,
                 date_creation`,
      [this.atelierId, idCommande, idMedia]
    );
    if (result.rowCount === 0) return null;
    return mapCommandeMediaRow(result.rows[0]);
  }

  async updateMeta(idCommande, idMedia, patch = {}, db = pool) {
    const hasNote = Object.prototype.hasOwnProperty.call(patch, "note");
    const note = hasNote ? (patch.note ? String(patch.note) : null) : null;
    const hasPosition = Object.prototype.hasOwnProperty.call(patch, "position");
    const position = hasPosition ? Number(patch.position || 1) : null;
    const hasPrimary = Object.prototype.hasOwnProperty.call(patch, "isPrimary");
    const isPrimary = hasPrimary ? patch.isPrimary === true : null;
    const result = await db.query(
      `UPDATE commande_media
       SET note = CASE WHEN $4 THEN $5 ELSE note END,
           position = CASE WHEN $6 THEN $7 ELSE position END,
           is_primary = CASE WHEN $8 THEN $9 ELSE is_primary END
       WHERE atelier_id = $1 AND id_commande = $2 AND id_media = $3
       RETURNING id_media,
                 atelier_id,
                 id_commande,
                 type_media,
                 source_type,
                 chemin_original,
                 chemin_thumbnail,
                 nom_fichier_original,
                 mime_type,
                 extension_stockage,
                 taille_originale_bytes,
                 largeur,
                 hauteur,
                 note,
                 position,
                 is_primary,
                 cree_par,
                 date_creation`,
      [this.atelierId, idCommande, idMedia, hasNote, note, hasPosition, Number.isFinite(position) ? position : null, hasPrimary, isPrimary]
    );
    if (result.rowCount === 0) return null;
    return mapCommandeMediaRow(result.rows[0]);
  }

  async reorder(idCommande, orderedIds = [], db = pool) {
    const ids = orderedIds.filter(Boolean);
    if (ids.length === 0) return;
    const caseClauses = ids.map((_, index) => `WHEN $${index + 4} THEN ${index + 1}`).join(" ");
    await db.query(
      `UPDATE commande_media
       SET position = CASE id_media ${caseClauses} ELSE position END
       WHERE atelier_id = $1
         AND id_commande = $2
         AND id_media = ANY($3::text[])`,
      [this.atelierId, idCommande, ids, ...ids]
    );
  }

  async assignPrimaryToFirstRemaining(idCommande, db = pool) {
    const result = await db.query(
      `WITH first_media AS (
         SELECT id_media
         FROM commande_media
         WHERE atelier_id = $1 AND id_commande = $2
         ORDER BY position ASC, date_creation ASC
         LIMIT 1
       )
       UPDATE commande_media
       SET is_primary = true
       WHERE atelier_id = $1
         AND id_commande = $2
         AND id_media = (SELECT id_media FROM first_media)
       RETURNING id_media,
                 atelier_id,
                 id_commande,
                 type_media,
                 source_type,
                 chemin_original,
                 chemin_thumbnail,
                 nom_fichier_original,
                 mime_type,
                 extension_stockage,
                 taille_originale_bytes,
                 largeur,
                 hauteur,
                 note,
                 position,
                 is_primary,
                 cree_par,
                 date_creation`,
      [this.atelierId, idCommande]
    );
    if (result.rowCount === 0) return null;
    return mapCommandeMediaRow(result.rows[0]);
  }

  async delete(idCommande, idMedia, db = pool) {
    const result = await db.query(
      `DELETE FROM commande_media
       WHERE atelier_id = $1 AND id_commande = $2 AND id_media = $3
       RETURNING id_media,
                 atelier_id,
                 id_commande,
                 type_media,
                 source_type,
                 chemin_original,
                 chemin_thumbnail,
                 nom_fichier_original,
                 mime_type,
                 extension_stockage,
                 taille_originale_bytes,
                 largeur,
                 hauteur,
                 note,
                 position,
                 is_primary,
                 cree_par,
                 date_creation`,
      [this.atelierId, idCommande, idMedia]
    );
    if (result.rowCount === 0) return null;
    return mapCommandeMediaRow(result.rows[0]);
  }
}
