import { pool } from "../../../shared/infrastructure/db.js";

function mapStockMovementRow(row) {
  const quantite = Number(row.quantite || 0);
  const prixUnitaire = Number(row.prix_vente_unitaire || 0);

  return {
    idMouvement: row.id_mouvement,
    idArticle: row.id_article,
    nomArticle: row.nom_article,
    typeMouvement: row.type_mouvement,
    quantite,
    motif: row.motif,
    dateMouvement: row.date_mouvement,
    utilisateur: row.effectue_par,
    referenceMetier: row.reference_metier,
    fournisseurId: row.fournisseur_id || null,
    fournisseur: row.nom_fournisseur || row.fournisseur || null,
    referenceAchat: row.reference_achat || null,
    prixAchatUnitaire: row.prix_achat_unitaire === null ? null : Number(row.prix_achat_unitaire),
    montantAchatTotal: row.montant_achat_total === null ? null : Number(row.montant_achat_total),
    montantUnitaire: prixUnitaire,
    montantEstime: row.montant_achat_total === null ? quantite * prixUnitaire : Number(row.montant_achat_total),
    montantEncaisse: row.montant_encaisse === null ? null : Number(row.montant_encaisse),
    idCaisseJour: row.id_caisse_jour || null
  };
}

const MOVEMENT_SELECT = `SELECT
  m.id_mouvement,
  m.id_article,
  m.type_mouvement,
  m.quantite,
  m.motif,
  m.date_mouvement,
  m.effectue_par,
  m.reference_metier,
  m.fournisseur_id,
  m.fournisseur,
  m.reference_achat,
  m.prix_achat_unitaire,
  m.montant_achat_total,
  a.nom_article,
  a.prix_vente_unitaire,
  f.nom_fournisseur,
  op.id_caisse_jour,
  op.montant AS montant_encaisse
FROM mouvements_stock m
INNER JOIN articles a ON a.id_article = m.id_article
LEFT JOIN fournisseurs f ON f.id_fournisseur = m.fournisseur_id
LEFT JOIN LATERAL (
  SELECT id_caisse_jour, montant
  FROM caisse_operation
  WHERE statut_operation <> 'ANNULEE'
    AND (
      reference_metier = m.reference_metier
      OR reference_metier = m.id_mouvement
    )
    AND motif IN ('VENTE_STOCK', 'PAIEMENT_STOCK')
  ORDER BY date_operation DESC
  LIMIT 1
) op ON TRUE`;

export class StockReadRepoPg {
  async listAuditStockVentes() {
    const result = await pool.query(`${MOVEMENT_SELECT} ORDER BY m.date_mouvement DESC`);
    return result.rows.map(mapStockMovementRow);
  }

  async getStockMouvementById(idMouvement) {
    const result = await pool.query(`${MOVEMENT_SELECT} WHERE m.id_mouvement = $1 LIMIT 1`, [idMouvement]);
    if (result.rowCount === 0) return null;
    return mapStockMovementRow(result.rows[0]);
  }
}
