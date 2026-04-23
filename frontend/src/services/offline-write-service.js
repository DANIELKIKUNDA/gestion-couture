import {
  ENTITY_SYNC_STATUSES,
  TABLE_NAMES,
  clientsStore,
  putScopedEntityRecord,
  runOfflineTransaction
} from "./local-db.js";
import { createLocalClientId, createLocalCommandeId, createLocalRetoucheId, isOfflineEntityId } from "./local-id.js";
import { createServerClientId } from "./server-id.js";
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
  if (!nom || !prenom) {
    throw new Error("Nom et prenom sont obligatoires pour creer un client offline.");
  }

  const localId = createLocalClientId();
  const idClient = normalizeString(input?.idClient) || createServerClientId();
  return {
    ...buildPendingEntityBase(localId, timestamp),
    idClient,
    nom,
    prenom,
    telephone,
    actif: true
  };
}

function buildCreateClientPayload(clientRecord) {
  return {
    idClient: normalizeString(clientRecord?.idClient),
    nom: normalizeString(clientRecord?.nom),
    prenom: normalizeString(clientRecord?.prenom),
    telephone: normalizeString(clientRecord?.telephone)
  };
}

function buildClientReferenceDraft(clientRecord) {
  return {
    idClient: normalizeString(clientRecord?.idClient),
    nom: normalizeString(clientRecord?.nom),
    prenom: normalizeString(clientRecord?.prenom),
    telephone: normalizeString(clientRecord?.telephone)
  };
}

function buildOfflineCommandeLine(input, clientRecord, timestamp) {
  const firstItem = Array.isArray(input?.items) && input.items.length > 0 ? input.items[0] : input;
  return {
    idLigne: `LIG-${String(timestamp).replace(/\D/g, "").slice(-12)}`,
    idClient: normalizeString(clientRecord?.idClient),
    clientLocalId: normalizeString(clientRecord?.localId),
    clientServerId: normalizeString(clientRecord?.serverId),
    role: "PAYEUR_BENEFICIAIRE",
    nomAffiche: normalizeString(clientRecord?.nom),
    prenomAffiche: normalizeString(clientRecord?.prenom),
    typeHabit: normalizeString(firstItem?.typeHabit || input?.typeHabit),
    mesuresHabit: cloneSerializable(firstItem?.mesures || input?.mesuresHabit || {}),
    ordreAffichage: 1
  };
}

function buildCommandeRecord(input, clientRecord, timestamp, options = {}) {
  const descriptionCommande = normalizeString(input?.descriptionCommande);
  const items = Array.isArray(input?.items)
    ? input.items.map((item, index) => ({
        idItem: normalizeString(item?.idItem) || `cmd-item-${index + 1}`,
        typeHabit: normalizeString(item?.typeHabit),
        description: normalizeString(item?.description),
        prix: Number(item?.prix || 0),
        mesures: cloneSerializable(item?.mesures || {}),
        ordreAffichage: index + 1
      })).filter((item) => item.typeHabit)
    : [];
  const primaryItem = items[0] || null;
  const typeHabit = normalizeString(primaryItem?.typeHabit || input?.typeHabit);
  const datePrevue = toNullableIsoTimestamp(input?.datePrevue);
  const priorite = normalizeString(input?.priorite).toUpperCase() || "NORMALE";
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
    dossierId: normalizeString(input?.idDossier),
    idClient: resolvedClientId,
    clientPayeurId: resolvedClientId,
    clientLocalId,
    clientServerId,
    clientPayeurLocalId: clientLocalId,
    clientPayeurServerId: clientServerId,
    clientNom: buildClientDisplayName(clientRecord),
    descriptionCommande,
    montantTotal: normalizeMontant(items.reduce((sum, item) => sum + Number(item.prix || 0), 0) || input?.montantTotal, "Montant total"),
    montantPaye: 0,
    typeHabit,
    items,
    mesuresHabit: cloneSerializable(primaryItem?.mesures || input?.mesuresHabit || {}),
    lignesCommande: [buildOfflineCommandeLine(input, clientRecord, timestamp)],
    statutCommande: "CREEE",
    dateCreation: timestamp,
    datePrevue,
    priorite,
    nouveauClient: options.isNewClient ? buildClientReferenceDraft(clientRecord) : null
  };
}

function buildRetoucheRecord(input, clientRecord, timestamp, options = {}) {
  const descriptionRetouche = normalizeString(input?.descriptionRetouche);
  const items = Array.isArray(input?.items)
    ? input.items.map((item, index) => ({
        idItem: normalizeString(item?.idItem) || `ret-item-${index + 1}`,
        typeRetouche: normalizeString(item?.typeRetouche),
        description: normalizeString(item?.description),
        prix: Number(item?.prix || 0),
        ordreAffichage: index + 1
      })).filter((item) => item.typeRetouche)
    : [];
  const primaryItem = items[0] || null;
  const typeRetouche = normalizeString(primaryItem?.typeRetouche || input?.typeRetouche);
  const typeHabit = normalizeString(input?.typeHabit);
  const datePrevue = toNullableIsoTimestamp(input?.datePrevue);
  const priorite = normalizeString(input?.priorite).toUpperCase() || "NORMALE";
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
    dossierId: normalizeString(input?.idDossier),
    idClient: resolvedClientId,
    clientLocalId,
    clientServerId,
    clientNom: buildClientDisplayName(clientRecord),
    descriptionRetouche,
    typeRetouche,
    montantTotal: normalizeMontant(items.reduce((sum, item) => sum + Number(item.prix || 0), 0) || input?.montantTotal, "Montant total"),
    montantPaye: 0,
    typeHabit,
    items,
    mesuresHabit: cloneSerializable(input?.mesuresHabit || {}),
    statutRetouche: "DEPOSEE",
    dateDepot: timestamp,
    datePrevue,
    priorite,
    nouveauClient: options.isNewClient ? buildClientReferenceDraft(clientRecord) : null
  };
}

function buildCreateCommandePayload(commandeRecord) {
  const requestPayload = {
    idDossier: normalizeString(commandeRecord?.dossierId),
    descriptionCommande: normalizeString(commandeRecord?.descriptionCommande),
    montantTotal: Number(commandeRecord?.montantTotal || 0),
    typeHabit: normalizeString(commandeRecord?.typeHabit),
    mesuresHabit: cloneSerializable(commandeRecord?.mesuresHabit || {}),
    items: cloneSerializable(commandeRecord?.items || [])
  };
  const payerServerId = normalizeString(commandeRecord?.clientPayeurServerId || commandeRecord?.clientServerId);
  const payerLocalId = normalizeString(commandeRecord?.clientPayeurLocalId || commandeRecord?.clientLocalId);
  if (commandeRecord?.nouveauClient && typeof commandeRecord.nouveauClient === "object") {
    requestPayload.nouveauClient = cloneSerializable(commandeRecord.nouveauClient);
  } else {
    requestPayload.idClient = payerServerId || payerLocalId || normalizeString(commandeRecord?.clientPayeurId || commandeRecord?.idClient);
    requestPayload.clientLocalId = payerLocalId;
    requestPayload.clientServerId = payerServerId;
  }
  if (commandeRecord?.datePrevue) {
    requestPayload.datePrevue = commandeRecord.datePrevue;
  }
  if (commandeRecord?.priorite) {
    requestPayload.priorite = normalizeString(commandeRecord.priorite).toUpperCase();
  }
  return requestPayload;
}

function buildCreateRetouchePayload(retoucheRecord) {
  const requestPayload = {
    idDossier: normalizeString(retoucheRecord?.dossierId),
    descriptionRetouche: normalizeString(retoucheRecord?.descriptionRetouche),
    typeRetouche: normalizeString(retoucheRecord?.typeRetouche),
    montantTotal: Number(retoucheRecord?.montantTotal || 0),
    typeHabit: normalizeString(retoucheRecord?.typeHabit),
    mesuresHabit: cloneSerializable(retoucheRecord?.mesuresHabit || {}),
    items: cloneSerializable(retoucheRecord?.items || [])
  };
  if (retoucheRecord?.nouveauClient && typeof retoucheRecord.nouveauClient === "object") {
    requestPayload.nouveauClient = cloneSerializable(retoucheRecord.nouveauClient);
  } else {
    requestPayload.idClient =
      normalizeString(retoucheRecord?.clientServerId) ||
      normalizeString(retoucheRecord?.clientLocalId) ||
      normalizeString(retoucheRecord?.idClient);
    requestPayload.clientLocalId = normalizeString(retoucheRecord?.clientLocalId);
    requestPayload.clientServerId = normalizeString(retoucheRecord?.clientServerId);
  }
  if (retoucheRecord?.datePrevue) {
    requestPayload.datePrevue = retoucheRecord.datePrevue;
  }
  if (retoucheRecord?.priorite) {
    requestPayload.priorite = normalizeString(retoucheRecord.priorite).toUpperCase();
  }
  return requestPayload;
}

async function createEmbeddedOfflineClient(scopedAtelierId, clientInput, timestamp) {
  return putScopedEntityRecord(TABLE_NAMES.CLIENTS, scopedAtelierId, buildClientRecord(clientInput, timestamp));
}

async function collectCommandeDependencyQueueIds(scopedAtelierId, payerRecord) {
  const dependencyIds = new Set(await resolveClientDependencyQueueIds(scopedAtelierId, payerRecord));
  return Array.from(dependencyIds);
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
  let relatedClients = [];
  let createdCommande = null;
  let queueEntry = null;

  await runOfflineTransaction("rw", [TABLE_NAMES.CLIENTS, TABLE_NAMES.COMMANDES, TABLE_NAMES.SYNC_QUEUE], async () => {
    if (newClient) {
      resolvedClient = await createEmbeddedOfflineClient(scopedAtelierId, newClient, timestamp);
      relatedClients = [resolvedClient];
    } else {
      resolvedClient = await resolveClientRecord(scopedAtelierId, clientId);
      if (!resolvedClient) {
        throw new Error("Client introuvable pour la creation offline de commande.");
      }
    }

    createdCommande = await putScopedEntityRecord(
      TABLE_NAMES.COMMANDES,
      scopedAtelierId,
      buildCommandeRecord(commande, resolvedClient, timestamp, { isNewClient: Boolean(newClient) })
    );

    const dependsOn = await collectCommandeDependencyQueueIds(scopedAtelierId, resolvedClient);
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
    relatedClients,
    commande: createdCommande,
    queueEntry
  };
}

export async function createOfflineRetouche({ atelierId, clientId, newClient, retouche } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const timestamp = nowIso();
  let resolvedClient = null;
  let createdRetouche = null;
  let queueEntry = null;

  await runOfflineTransaction("rw", [TABLE_NAMES.CLIENTS, TABLE_NAMES.RETOUCHES, TABLE_NAMES.SYNC_QUEUE], async () => {
    if (newClient) {
      resolvedClient = await createEmbeddedOfflineClient(scopedAtelierId, newClient, timestamp);
    } else {
      resolvedClient = await resolveClientRecord(scopedAtelierId, clientId);
      if (!resolvedClient) {
        throw new Error("Client introuvable pour la creation offline de retouche.");
      }
    }

    createdRetouche = await putScopedEntityRecord(
      TABLE_NAMES.RETOUCHES,
      scopedAtelierId,
      buildRetoucheRecord(retouche, resolvedClient, timestamp, { isNewClient: Boolean(newClient) })
    );

    const dependsOn = newClient ? [] : await resolveClientDependencyQueueIds(scopedAtelierId, resolvedClient);
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
    retouche: createdRetouche,
    queueEntry
  };
}
