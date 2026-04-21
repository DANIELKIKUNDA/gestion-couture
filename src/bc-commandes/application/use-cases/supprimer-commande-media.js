import { pool } from "../../../shared/infrastructure/db.js";

export async function supprimerCommandeMedia({
  atelierId,
  idCommande,
  idMedia,
  mediaRepo,
  storage
}) {
  const client = await pool.connect();
  let deleted = null;

  try {
    await client.query("BEGIN");
    const commandeResult = await client.query(
      "SELECT id_commande FROM commandes WHERE atelier_id = $1 AND id_commande = $2 FOR UPDATE",
      [atelierId, idCommande]
    );
    if (commandeResult.rowCount === 0) {
      throw new Error("Commande introuvable");
    }

    deleted = await mediaRepo.getByIdForUpdate(idCommande, idMedia, client);
    if (!deleted) {
      throw new Error("Media commande introuvable");
    }

    await mediaRepo.delete(idCommande, idMedia, client);
    const mediaScope = { scope: true, idItem: deleted.idItem };
    const remaining = await mediaRepo.listByCommande(idCommande, client, mediaScope);
    await mediaRepo.reorder(
      idCommande,
      remaining.map((item) => item.idMedia),
      client
    );
    if (deleted.isPrimary) {
      await mediaRepo.assignPrimaryToFirstRemaining(idCommande, client, mediaScope);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (deleted) {
    await storage.deleteStoredMedia(deleted).catch(() => {});
  }

  return deleted;
}
