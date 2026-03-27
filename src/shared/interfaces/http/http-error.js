const INTERNAL_ERROR_MESSAGE = "Une erreur est survenue. Veuillez reessayer.";

const DEFAULT_STATUS_MESSAGES = {
  400: "La requete est invalide.",
  401: "Session invalide.",
  403: "Action non autorisee.",
  404: "Element introuvable.",
  409: "Operation impossible pour le moment.",
  422: "Les donnees fournies sont invalides.",
  500: INTERNAL_ERROR_MESSAGE
};

const DEFAULT_STATUS_CODES = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  500: "INTERNAL_ERROR"
};

const TECHNICAL_MESSAGE_PATTERNS = [
  /syntax error at or near/i,
  /\bcolumn\b.+\bdoes not exist\b/i,
  /\brelation\b.+\bdoes not exist\b/i,
  /\btable\b.+\bdoes not exist\b/i,
  /\bschema\b.+\bdoes not exist\b/i,
  /\bduplicate key value violates\b/i,
  /\bviolates\b.+\bconstraint\b/i,
  /\bnull value in column\b/i,
  /\binvalid input syntax\b/i,
  /\balter table\b/i,
  /\bcreate table\b/i,
  /\bcreate index\b/i,
  /\binsert into\b/i,
  /\bupdate\b.+\bset\b/i,
  /\bdelete from\b/i,
  /\bselect\b.+\bfrom\b/i,
  /\bpostgres\b/i,
  /\bpg_/i,
  /\bstack\b/i,
  /\bnode:/i
];

function normalizeMessage(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStatus(value, fallback = 500) {
  const status = Number(value);
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    return fallback;
  }
  return status;
}

function isPostgresDriverCode(value) {
  return /^[0-9A-Z]{5}$/.test(String(value || "").trim().toUpperCase());
}

function isSafePublicCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return Boolean(code) && /^[A-Z][A-Z0-9_]*$/.test(code) && !isPostgresDriverCode(code);
}

function isTechnicalError(err, message) {
  if (isPostgresDriverCode(err?.code)) return true;
  if (err?.severity || err?.detail || err?.hint || err?.position || err?.routine || err?.schema || err?.table || err?.column) {
    return true;
  }

  const normalizedMessage = normalizeMessage(message).toLowerCase();
  if (!normalizedMessage) return false;
  return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
}

function resolveStatus(err, fallbackStatus, technical) {
  const baseStatus = normalizeStatus(err?.statusCode ?? err?.status ?? fallbackStatus, 500);
  if (technical && baseStatus < 500) return 500;
  return baseStatus;
}

function resolveCode(err, status, technical) {
  if (technical) return DEFAULT_STATUS_CODES[500];
  if (isSafePublicCode(err?.code)) return String(err.code).trim().toUpperCase();
  return DEFAULT_STATUS_CODES[status] || "REQUEST_ERROR";
}

function resolveMessage(message, status, technical) {
  if (technical) return INTERNAL_ERROR_MESSAGE;
  return normalizeMessage(message) || DEFAULT_STATUS_MESSAGES[status] || INTERNAL_ERROR_MESSAGE;
}

export function normalizeHttpError(err, fallbackStatus = 500) {
  const rawMessage = normalizeMessage(err?.message ?? err?.error ?? "");
  const technical = isTechnicalError(err, rawMessage);
  const status = resolveStatus(err, fallbackStatus, technical);
  return {
    status,
    technical,
    payload: {
      code: resolveCode(err, status, technical),
      message: resolveMessage(rawMessage, status, technical)
    }
  };
}

export function logTechnicalError(err, req = null, status = 500) {
  console.error("[http:error]", {
    status,
    method: String(req?.method || "").trim(),
    path: String(req?.originalUrl || req?.url || "").trim(),
    code: String(err?.code || "").trim(),
    message: normalizeMessage(err?.message ?? err?.error ?? ""),
    detail: err?.detail || "",
    hint: err?.hint || "",
    stack: err?.stack || ""
  });
}

export function sendHttpError(res, err, fallbackStatus = 500, req = null) {
  const normalized = normalizeHttpError(err, fallbackStatus);
  if (normalized.technical) {
    logTechnicalError(err, req, normalized.status);
  }
  return res.status(normalized.status).json(normalized.payload);
}

export function normalizeHttpErrorResponse(statusCode, body, req = null) {
  if (normalizeStatus(statusCode, 200) < 400) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  if (typeof body.error !== "string") return body;

  const normalized = normalizeHttpError(
    {
      code: typeof body.code === "string" ? body.code : "",
      message: body.error
    },
    statusCode
  );

  if (normalized.technical) {
    logTechnicalError({ code: body.code, message: body.error }, req, normalized.status);
  }

  return normalized.payload;
}
