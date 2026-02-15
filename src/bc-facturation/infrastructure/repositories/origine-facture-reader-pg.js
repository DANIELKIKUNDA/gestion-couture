import { pool } from "../../../shared/infrastructure/db.js";

function clientSnapshot(row) {
  const nom = String(row.client_nom || "").trim();
  const contact = String(row.client_contact || "").trim();
  return {
    nom: nom || "Client comptoir",
    contact
  };
}

export class OrigineFactureReaderPg {
  async readCommande(idCommande) {
    const res = await pool.query(
      `SELECT c.id_commande,
              c.description,
              c.montant_total,
              cl.nom || ' ' || cl.prenom AS client_nom,
              cl.telephone AS client_contact
       FROM commandes c
       LEFT JOIN clients cl ON cl.id_client = c.id_client
       WHERE c.id_commande = $1`,
      [idCommande]
    );
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    return {
      typeOrigine: "COMMANDE",
      idOrigine: row.id_commande,
      client: clientSnapshot(row),
      montantTotal: Number(row.montant_total),
      referenceCaisse: null,
      lignes: [
        {
          description: row.description || "Commande atelier",
          quantite: 1,
          prix: Number(row.montant_total)
        }
      ]
    };
  }

  async readRetouche(idRetouche) {
    const res = await pool.query(
      `SELECT r.id_retouche,
              r.description,
              r.montant_total,
              cl.nom || ' ' || cl.prenom AS client_nom,
              cl.telephone AS client_contact
       FROM retouches r
       LEFT JOIN clients cl ON cl.id_client = r.id_client
       WHERE r.id_retouche = $1`,
      [idRetouche]
    );
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    return {
      typeOrigine: "RETOUCHE",
      idOrigine: row.id_retouche,
      client: clientSnapshot(row),
      montantTotal: Number(row.montant_total),
      referenceCaisse: null,
      lignes: [
        {
          description: row.description || "Retouche atelier",
          quantite: 1,
          prix: Number(row.montant_total)
        }
      ]
    };
  }

  async readVente(idVente) {
    const venteRes = await pool.query(
      `SELECT id_vente, total, reference_caisse
       FROM ventes
       WHERE id_vente = $1`,
      [idVente]
    );
    if (venteRes.rowCount === 0) return null;
    const lignesRes = await pool.query(
      `SELECT libelle_article, quantite, prix_unitaire
       FROM vente_lignes
       WHERE id_vente = $1
       ORDER BY id_ligne ASC`,
      [idVente]
    );

    const vente = venteRes.rows[0];
    return {
      typeOrigine: "VENTE",
      idOrigine: vente.id_vente,
      client: {
        nom: "Client comptoir",
        contact: ""
      },
      montantTotal: Number(vente.total),
      referenceCaisse: vente.reference_caisse || null,
      lignes: lignesRes.rows.map((row) => ({
        description: row.libelle_article || "Article",
        quantite: Number(row.quantite),
        prix: Number(row.prix_unitaire)
      }))
    };
  }
}
