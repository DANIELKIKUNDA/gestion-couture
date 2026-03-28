import { creerClient } from "../use-cases/creer-client.js";
import { generateClientId } from "../../../shared/domain/id-generator.js";

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function buildClientLabel(client) {
  const nomComplet = `${client?.nom || ""} ${client?.prenom || ""}`.trim();
  return nomComplet || client?.telephone || client?.idClient || "Client existant";
}

function mapClientSummary(client) {
  if (!client?.idClient) return null;
  return {
    idClient: client.idClient,
    nom: String(client.nom || "").trim(),
    prenom: String(client.prenom || "").trim(),
    telephone: String(client.telephone || "").trim(),
    nomComplet: buildClientLabel(client)
  };
}

function createClientCreationError(status, code, message, details = {}) {
  const err = new Error(message);
  err.status = Number(status || 400);
  err.code = String(code || "BAD_REQUEST").trim().toUpperCase();
  err.details = details;
  return err;
}

function buildDuplicatePhoneError(client) {
  const existingClient = mapClientSummary(client);
  return createClientCreationError(
    409,
    "CLIENT_DUPLICATE_PHONE",
    `Ce numero appartient deja a ${existingClient?.nomComplet || "un client existant"}. Utilisez ce client pour continuer.`,
    {
      existingClient
    }
  );
}

function buildProbableDuplicateError(clients = []) {
  const probableDuplicates = clients.map(mapClientSummary).filter(Boolean);
  return createClientCreationError(
    409,
    "CLIENT_DUPLICATE_POSSIBLE",
    "Un client au nom similaire existe deja. Verifiez avant de creer un doublon.",
    {
      probableDuplicates
    }
  );
}

function normalizeNewClientPayload(nouveauClient = null) {
  if (!nouveauClient || typeof nouveauClient !== "object") return null;
  return {
    idClient: normalizeText(nouveauClient.idClient),
    nom: normalizeText(nouveauClient.nom),
    prenom: normalizeText(nouveauClient.prenom),
    telephone: normalizeText(nouveauClient.telephone)
  };
}

function normalizeDuplicateDecision(doublonDecision = null) {
  if (!doublonDecision || typeof doublonDecision !== "object") {
    return {
      action: "",
      idClient: ""
    };
  }

  return {
    action: normalizeText(doublonDecision.action).toUpperCase(),
    idClient: normalizeText(doublonDecision.idClient)
  };
}

async function selectTargetDuplicateClient(candidates, idClient, clientRepo) {
  const requestedId = normalizeText(idClient);
  if (!requestedId) {
    return candidates.length === 1 ? candidates[0] : null;
  }

  const fromCandidates = candidates.find((client) => client.idClient === requestedId);
  if (fromCandidates) return fromCandidates;
  return clientRepo.getById(requestedId);
}

export async function resolveClientForCreation({
  idClient = "",
  nouveauClient = null,
  doublonDecision = null,
  clientRepo
} = {}) {
  const requestedClientId = normalizeText(idClient);
  if (requestedClientId) {
    const existingClient = await clientRepo.getById(requestedClientId);
    if (!existingClient) {
      throw createClientCreationError(404, "CLIENT_NOT_FOUND", "Client introuvable.");
    }
    return {
      idClient: existingClient.idClient,
      client: existingClient,
      strategy: "EXISTING"
    };
  }

  const normalizedClient = normalizeNewClientPayload(nouveauClient);
  if (!normalizedClient?.nom || !normalizedClient?.prenom || !normalizedClient?.telephone) {
    throw createClientCreationError(400, "CLIENT_DATA_INVALID", "Completez nom, prenom et telephone.");
  }

  const decision = normalizeDuplicateDecision(doublonDecision);
  const exactPhoneMatch = await clientRepo.findByTelephone(normalizedClient.telephone);
  if (exactPhoneMatch) {
    if (decision.action === "USE_EXISTING" && (!decision.idClient || decision.idClient === exactPhoneMatch.idClient)) {
      return {
        idClient: exactPhoneMatch.idClient,
        client: exactPhoneMatch,
        strategy: "USE_EXISTING"
      };
    }
    throw buildDuplicatePhoneError(exactPhoneMatch);
  }

  const probableDuplicates = (await clientRepo.findProbableDuplicates({
    nom: normalizedClient.nom,
    prenom: normalizedClient.prenom
  })).filter((client) => normalizePhoneDigits(client.telephone) !== normalizePhoneDigits(normalizedClient.telephone));

  if (probableDuplicates.length > 0) {
    if (decision.action === "USE_EXISTING") {
      const target = await selectTargetDuplicateClient(probableDuplicates, decision.idClient, clientRepo);
      if (!target) {
        throw buildProbableDuplicateError(probableDuplicates);
      }
      return {
        idClient: target.idClient,
        client: target,
        strategy: "USE_EXISTING"
      };
    }

    if (decision.action === "UPDATE_EXISTING_PHONE") {
      const target = await selectTargetDuplicateClient(probableDuplicates, decision.idClient, clientRepo);
      if (!target) {
        throw buildProbableDuplicateError(probableDuplicates);
      }
      const phoneOwner = await clientRepo.findByTelephone(normalizedClient.telephone);
      if (phoneOwner && phoneOwner.idClient !== target.idClient) {
        throw buildDuplicatePhoneError(phoneOwner);
      }
      target.modifier({
        nom: normalizedClient.nom,
        prenom: normalizedClient.prenom,
        telephone: normalizedClient.telephone
      });
      await clientRepo.save(target);
      return {
        idClient: target.idClient,
        client: target,
        strategy: "UPDATED_EXISTING_PHONE"
      };
    }

    if (decision.action !== "CONFIRM_NEW") {
      throw buildProbableDuplicateError(probableDuplicates);
    }
  }

  const client = creerClient({
    idClient: normalizedClient.idClient || generateClientId(),
    nom: normalizedClient.nom,
    prenom: normalizedClient.prenom,
    telephone: normalizedClient.telephone
  });
  await clientRepo.save(client);

  return {
    idClient: client.idClient,
    client,
    strategy: "CREATED_NEW"
  };
}

export function serializeClientCreationConflict(err) {
  return {
    code: String(err?.code || "CONFLICT").trim().toUpperCase(),
    message: String(err?.message || "Operation impossible pour le moment.").trim(),
    ...(err?.details && typeof err.details === "object" ? err.details : {})
  };
}
