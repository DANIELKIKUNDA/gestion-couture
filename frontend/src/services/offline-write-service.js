import {
  ENTITY_SYNC_STATUSES,
  TABLE_NAMES,
  clientsStore,
  putScopedEntityRecord,
  runOfflineTransaction
} from "./local-db.js";
import { createLocalClientId, createLocalCommandeId, createLocalRetoucheId, isOfflineEntityId } from "./local-id.js";
import { enqueueInTransaction, findLatestActiveEntryByEntityLocalId } from "./sync-queue.js";

export const OFFLINE_WRITE_ACTIONS = Object.freeze({
  CREATE_CLIENT: "CREATE_CLIENT",
  CREATE_COMMANDE: "CREATE_COMMANDE",
  CREATE_RETOUCHE: "CREATE_RETOUCHE"
});

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function ensureAtelierId(atelierId) {
  const normalized = normalizeString(atelierId);
  if (!normalized) {
    throw new Error("atelierId obligatoire pour l'ecriture offline.");
  }
  return normalized;
}

function cloneSerializable(value) {
  if (value === null || value === undefined) return value;
  if (typeof globalThis !== "undefined" && typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function toNullableIsoTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Date invalide pour l'ecriture offline.");
  }
  return parsed.toISOString();
}

function normalizeMontant(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} invalide.`);
  }
  return parsed;
}

function buildClientDisplayName(client) {
  const nom = normalizeString(client?.nom);
  const prenom = normalizeString(client?.prenom);
  return `${nom} ${prenom}`.trim();
}

async function resolveClientRecord(atelierId, identifier) {
  const normalizedIdentifier = normalizeString(identifier);
  if (!normalizedIdentifier) return null;
  const byLocalId = await clientsStore.getByAtelierAndLocalId(atelierId, normalizedIdentifier);
  if (byLocalId) return byLocalId;
  return clientsStore.getByAtelierAndServerId(atelierId, normalizedIdentifier);
}

async function resolveClientDependencyQueueIds(atelierId, clientRecord, explicitQueueEntry = null) {
  if (explicitQueueEntry?.queueId) {
    return [explicitQueueEntry.queueId];
  }

  const clientServerId = normalizeString(clientRecord?.serverId);
  if (clientServerId) {
    return [];
  }

  const clientLocalId = normalizeString(clientRecord?.localId || clientRecord?.idClient);
  if (!clientLocalId) return [];
  if (!isOfflineEntityId(clientLocalId) && normalizeString(clientRecord?.idClient)) {
    return [];
  }

  const entry = await findLatestActiveEntryByEntityLocalId(atelierId, clientLocalId, {
    entityType: "client",
    actionType: OFFLINE_WRITE_ACTIONS.CREATE_CLIENT
  });
  return entry?.queueId ? [entry.queueId] : [];
}

function buildPendingEntityBase(localId, timestamp) {
  return {
    localId,
    serverId: "",
    syncStatus: ENTITY_SYNC_STATUSES.PENDING,
    updatedAt: timestamp,
    lastSyncedAt: null
  };
}

function buildClientRecord(input, timestamp) {
  const nom = normalizeString(input?.nom);
  const prenom = normalizeString(input?.prenom);
  const telephone = normalizeString(input?.telephone);
  if (!nom || !prenom || !telephone) {
    throw new Error("Nom, prenom et telephone sont obligatoires pour creer un client offline.");
  }

  const localId = createLocalClientId();
  return {
    ...buildPendingEntityBase(localId, timestamp),
    idClient: localId,
    nom,
    prenom,
    telephone,
    actif: true
  };
}

function buildCommandeRecord(input, clientRecord, timestamp) {
  const descriptionCommande = normalizeString(input?.descriptionCommande);
  const typeHabit = normalizeString(input?.typeHabit);
  const datePrevue = toNullableIsoTimestamp(input?.datePrevue);
  if (!descriptionCommande) {
    throw new Error("Description commande obligatoire.");
  }
  if (!typeHabit) {
    throw new Error("Type d'habit obligatoire.");
  }

  const localId = createLocalCommandeId();
  const clientLocalId = normalizeString(clientRecord?.localId);
  const clientServerId = normalizeString(clientRecord?.serverId);
  const resolvedClientId = clientServerId || clientLocalId || normalizeString(clientRecord?.idClient);

  return {
    ...buildPendingEntityBase(localId, timestamp),
    idCommande: localId,
    idClient: resolvedClientId,
    clientLocalId,
    clientServerId,
    clientNom: buildClientDisplayName(clientRecord),
    descriptionCommande,
    montantTotal: normalizeMontant(input?.montantTotal, "Montant total"),
    montantPaye: 0,
    typeHabit,
    mesuresHabit: cloneSerializable(input?.mesuresHabit || {}),
    statutCommande: "CREEE",
    dateCreation: timestamp,
    datePrevue
  };
}

function buildRetoucheRecord(input, clientRecord, timestamp) {
  const descriptionRetouche = normalizeString(input?.descriptionRetouche);
  const typeRetouche = normalizeString(input?.typeRetouche);
  const typeHabit = normalizeString(input?.typeHabit);
  const datePrevue = toNullableIsoTimestamp(input?.datePrevue);
  if (!typeRetouche) {
    throw new Error("Type de retouche obligatoire.");
  }
  if (!typeHabit) {
    throw new Error("Type d'habit obligatoire.");
  }

  const localId = createLocalRetoucheId();
  const clientLocalId = normalizeString(clientRecord?.localId);
  const clientServerId = normalizeString(clientRecord?.serverId);
  const resolvedClientId = clientServerId || clientLocalId || normalizeString(clientRecord?.idClient);

  return {
    ...buildPendingEntityBase(localId, timestamp),
    idRetouche: localId,
    idClient: resolvedClientId,
    clientLocalId,
    clientServerId,
    clientNom: buildClientDisplayName(clientRecord),
    descriptionRetouche,
    typeRetouche,
    montantTotal: normalizeMontant(input?.montantTotal, "Montant total"),
    montantPaye: 0,
    typeHabit,
    mesuresHabit: cloneSerializable(input?.mesuresHabit || {}),
    statutRetouche: "DEPOSEE",
    dateDepot: timestamp,
    datePrevue
  };
}

function buildCreateClientPayload(clientRecord) {
  return {
    nom: normalizeString(clientRecord?.nom),
    prenom: normalizeString(clientRecord?.prenom),
    telephone: normalizeString(clientRecord?.telephone)
  };
}

function buildCreateCommandePayload(commandeRecord) {
  return {
    idClient: normalizeString(commandeRecord?.clientServerId || commandeRecord?.clientLocalId || commandeRecord?.idClient),
    clientLocalId: normalizeString(commandeRecord?.clientLocalId),
    clientServerId: normalizeString(commandeRecord?.clientServerId),
    descriptionCommande: normalizeString(commandeRecord?.descriptionCommande),
    montantTotal: Number(commandeRecord?.montantTotal || 0),
    typeHabit: normalizeString(commandeRecord?.typeHabit),
    mesuresHabit: cloneSerializable(commandeRecord?.mesuresHabit || {}),
    datePrevue: commandeRecord?.datePrevue || null
  };
}

function buildCreateRetouchePayload(retoucheRecord) {
  return {
    idClient: normalizeString(retoucheRecord?.clientServerId || retoucheRecord?.clientLocalId || retoucheRecord?.idClient),
    clientLocalId: normalizeString(retoucheRecord?.clientLocalId),
    clientServerId: normalizeString(retoucheRecord?.clientServerId),
    descriptionRetouche: normalizeString(retoucheRecord?.descriptionRetouche),
    typeRetouche: normalizeString(retoucheRecord?.typeRetouche),
    montantTotal: Number(retoucheRecord?.montantTotal || 0),
    typeHabit: normalizeString(retoucheRecord?.typeHabit),
    mesuresHabit: cloneSerializable(retoucheRecord?.mesuresHabit || {}),
    datePrevue: retoucheRecord?.datePrevue || null
  };
}

export async function createOfflineClient({ atelierId, client } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const timestamp = nowIso();
  let createdClient = null;
  let queueEntry = null;

  await runOfflineTransaction("rw", [TABLE_NAMES.CLIENTS, TABLE_NAMES.SYNC_QUEUE], async () => {
    createdClient = await putScopedEntityRecord(TABLE_NAMES.CLIENTS, scopedAtelierId, buildClientRecord(client, timestamp));
    queueEntry = await enqueueInTransaction(scopedAtelierId, {
      status: "pending",
      entityType: "client",
      actionType: OFFLINE_WRITE_ACTIONS.CREATE_CLIENT,
      entityLocalId: createdClient.localId,
      entityServerId: "",
      dependsOn: [],
      payload: buildCreateClientPayload(createdClient)
    });
  });

  return {
    client: createdClient,
    queueEntry
  };
}

export async function createOfflineCommande({ atelierId, clientId, newClient, commande } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const timestamp = nowIso();
  let resolvedClient = null;
  let clientQueueEntry = null;
  let createdCommande = null;
  let queueEntry = null;

  await runOfflineTransaction("rw", [TABLE_NAMES.CLIENTS, TABLE_NAMES.COMMANDES, TABLE_NAMES.SYNC_QUEUE], async () => {
    if (newClient) {
      resolvedClient = await putScopedEntityRecord(TABLE_NAMES.CLIENTS, scopedAtelierId, buildClientRecord(newClient, timestamp));
      clientQueueEntry = await enqueueInTransaction(scopedAtelierId, {
        status: "pending",
        entityType: "client",
        actionType: OFFLINE_WRITE_ACTIONS.CREATE_CLIENT,
        entityLocalId: resolvedClient.localId,
        entityServerId: "",
        dependsOn: [],
        payload: buildCreateClientPayload(resolvedClient)
      });
    } else {
      resolvedClient = await resolveClientRecord(scopedAtelierId, clientId);
      if (!resolvedClient) {
        throw new Error("Client introuvable pour la creation offline de commande.");
      }
    }

    createdCommande = await putScopedEntityRecord(
      TABLE_NAMES.COMMANDES,
      scopedAtelierId,
      buildCommandeRecord(commande, resolvedClient, timestamp)
    );

    const dependsOn = await resolveClientDependencyQueueIds(scopedAtelierId, resolvedClient, clientQueueEntry);
    queueEntry = await enqueueInTransaction(scopedAtelierId, {
      status: "pending",
      entityType: "commande",
      actionType: OFFLINE_WRITE_ACTIONS.CREATE_COMMANDE,
      entityLocalId: createdCommande.localId,
      entityServerId: "",
      dependsOn,
      payload: buildCreateCommandePayload(createdCommande)
    });
  });

  return {
    client: resolvedClient,
    clientQueueEntry,
    commande: createdCommande,
    queueEntry
  };
}

export async function createOfflineRetouche({ atelierId, clientId, newClient, retouche } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const timestamp = nowIso();
  let resolvedClient = null;
  let clientQueueEntry = null;
  let createdRetouche = null;
  let queueEntry = null;

  await runOfflineTransaction("rw", [TABLE_NAMES.CLIENTS, TABLE_NAMES.RETOUCHES, TABLE_NAMES.SYNC_QUEUE], async () => {
    if (newClient) {
      resolvedClient = await putScopedEntityRecord(TABLE_NAMES.CLIENTS, scopedAtelierId, buildClientRecord(newClient, timestamp));
      clientQueueEntry = await enqueueInTransaction(scopedAtelierId, {
        status: "pending",
        entityType: "client",
        actionType: OFFLINE_WRITE_ACTIONS.CREATE_CLIENT,
        entityLocalId: resolvedClient.localId,
        entityServerId: "",
        dependsOn: [],
        payload: buildCreateClientPayload(resolvedClient)
      });
    } else {
      resolvedClient = await resolveClientRecord(scopedAtelierId, clientId);
      if (!resolvedClient) {
        throw new Error("Client introuvable pour la creation offline de retouche.");
      }
    }

    createdRetouche = await putScopedEntityRecord(
      TABLE_NAMES.RETOUCHES,
      scopedAtelierId,
      buildRetoucheRecord(retouche, resolvedClient, timestamp)
    );

    const dependsOn = await resolveClientDependencyQueueIds(scopedAtelierId, resolvedClient, clientQueueEntry);
    queueEntry = await enqueueInTransaction(scopedAtelierId, {
      status: "pending",
      entityType: "retouche",
      actionType: OFFLINE_WRITE_ACTIONS.CREATE_RETOUCHE,
      entityLocalId: createdRetouche.localId,
      entityServerId: "",
      dependsOn,
      payload: buildCreateRetouchePayload(createdRetouche)
    });
  });

  return {
    client: resolvedClient,
    clientQueueEntry,
    retouche: createdRetouche,
    queueEntry
  };
}
