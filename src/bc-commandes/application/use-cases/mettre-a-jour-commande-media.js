import { pool } from "../../../shared/infrastructure/db.js";

function normalizeNote(value) {
  const note = String(value || "").trim();
  return note ? note.slice(0, 500) : "";
}

async function moveMediaToPosition({ atelierId, idCommande, idMedia, currentPosition, targetPosition, client }) {
  if (targetPosition === currentPosition) return;
  await client.query(
    "UPDATE commande_media SET position = 0 WHERE atelier_id = $1 AND id_commande = $2 AND id_media = $3",
    [atelierId, idCommande, idMedia]
  );
  if (targetPosition < currentPosition) {
    await client.query(
      `UPDATE commande_media
       SET position = position + 1
       WHERE atelier_id = $1
         AND id_commande = $2
         AND id_media <> $3
         AND position >= $4
         AND position < $5`,
      [atelierId, idCommande, idMedia, targetPosition, currentPosition]
    );
  } else {
    await client.query(
      `UPDATE commande_media
       SET position = position - 1
       WHERE atelier_id = $1
         AND id_commande = $2
         AND id_media <> $3
         AND position <= $4
         AND position > $5`,
      [atelierId, idCommande, idMedia, targetPosition, currentPosition]
    );
  }
  await client.query(
    "UPDATE commande_media SET position = $4 WHERE atelier_id = $1 AND id_commande = $2 AND id_media = $3",
    [atelierId, idCommande, idMedia, targetPosition]
  );
}

export async function mettreAJourCommandeMedia({
  atelierId,
  idCommande,
  idMedia,
  mediaRepo,
  patch = {}
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const commandeResult = await client.query(
      "SELECT id_commande FROM commandes WHERE atelier_id = $1 AND id_commande = $2 FOR UPDATE",
      [atelierId, idCommande]
    );
    if (commandeResult.rowCount === 0) {
      throw new Error("Commande introuvable");
    }

    const current = await mediaRepo.getByIdForUpdate(idCommande, idMedia, client);
    if (!current) {
      throw new Error("Media commande introuvable");
    }

    let ordered = await mediaRepo.listByCommande(idCommande, client);
    if (patch.position !== undefined && patch.position !== null) {
      const targetPosition = Math.min(Math.max(1, Number(patch.position || 1)), ordered.length);
      await moveMediaToPosition({
        atelierId,
        idCommande,
        idMedia,
        currentPosition: Number(current.position || 1),
        targetPosition,
        client
      });
      ordered = await mediaRepo.listByCommande(idCommande, client);
      const refreshed = ordered.find((item) => item.idMedia === idMedia);
      if (refreshed) {
        current.position = refreshed.position;
      }
    }

    if (patch.isPrimary === true) {
      await mediaRepo.setPrimary(idCommande, idMedia, client);
    }

    const hasMetaPatch =
      Object.prototype.hasOwnProperty.call(patch, "note") ||
      Object.prototype.hasOwnProperty.call(patch, "idItem");
    if (hasMetaPatch) {
      await mediaRepo.updateMeta(
        idCommande,
        idMedia,
        {
          ...(Object.prototype.hasOwnProperty.call(patch, "note") ? { note: normalizeNote(patch.note) } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, "idItem") ? { idItem: patch.idItem || null } : {})
        },
        client
      );
    }

    const updated = await mediaRepo.getById(idCommande, idMedia, client);
    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
