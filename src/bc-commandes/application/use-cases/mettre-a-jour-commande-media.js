import { pool } from "../../../shared/infrastructure/db.js";

function normalizeNote(value) {
  const note = String(value || "").trim();
  return note ? note.slice(0, 500) : "";
}

function buildItemScopeClause(idItem, startIndex = 6, includeItemScope = true) {
  if (!includeItemScope) {
    return {
      clause: "",
      params: []
    };
  }
  const normalizedIdItem = String(idItem || "").trim();
  if (normalizedIdItem) {
    return {
      clause: ` AND COALESCE(id_item, '') = $${startIndex}`,
      params: [normalizedIdItem]
    };
  }
  return {
    clause: " AND COALESCE(id_item, '') = ''",
    params: []
  };
}

async function moveMediaToPosition({ atelierId, idCommande, idMedia, idItem, currentPosition, targetPosition, client, includeItemScope }) {
  const itemScope = buildItemScopeClause(idItem, 6, includeItemScope);
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
         AND position < $5${itemScope.clause}`,
      [atelierId, idCommande, idMedia, targetPosition, currentPosition, ...itemScope.params]
    );
  } else {
    await client.query(
      `UPDATE commande_media
       SET position = position - 1
       WHERE atelier_id = $1
         AND id_commande = $2
         AND id_media <> $3
         AND position <= $4
         AND position > $5${itemScope.clause}`,
      [atelierId, idCommande, idMedia, targetPosition, currentPosition, ...itemScope.params]
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

    const includeItemScope = await mediaRepo.hasItemColumn(client);
    const mediaScope = includeItemScope ? { idItem: current.idItem } : {};
    let ordered = await mediaRepo.listByCommande(idCommande, client, mediaScope);
    if (patch.position !== undefined && patch.position !== null) {
      const targetPosition = Math.min(Math.max(1, Number(patch.position || 1)), ordered.length);
      await moveMediaToPosition({
        atelierId,
        idCommande,
        idMedia,
        idItem: current.idItem,
        currentPosition: Number(current.position || 1),
        targetPosition,
        client,
        includeItemScope
      });
      ordered = await mediaRepo.listByCommande(idCommande, client, mediaScope);
      const refreshed = ordered.find((item) => item.idMedia === idMedia);
      if (refreshed) {
        current.position = refreshed.position;
      }
    }

    if (patch.isPrimary === true) {
      await mediaRepo.setPrimary(idCommande, idMedia, client, mediaScope);
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
