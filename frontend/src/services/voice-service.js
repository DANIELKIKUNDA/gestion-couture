import { Capacitor, registerPlugin } from "@capacitor/core";

const VOICE_ENABLED =
  typeof import.meta !== "undefined" ? String(import.meta.env?.VITE_VOICE_ENABLED ?? "true").toLowerCase() !== "false" : true;

let nativeSpeechPlugin = null;
let nativeSpeechPluginResolved = false;

export function getNativeSpeechPlugin() {
  if (nativeSpeechPluginResolved) return nativeSpeechPlugin;
  nativeSpeechPluginResolved = true;
  const isNative =
    Boolean(Capacitor?.isNativePlatform?.()) ||
    Boolean(Capacitor?.getPlatform?.() && Capacitor.getPlatform() !== "web");
  if (!isNative || typeof registerPlugin !== "function") {
    nativeSpeechPlugin = null;
    return nativeSpeechPlugin;
  }
  nativeSpeechPlugin = registerPlugin("AtelierSpeech");
  return nativeSpeechPlugin;
}

function isNativePlatformSync() {
  return Boolean(Capacitor?.isNativePlatform?.() || (Capacitor?.getPlatform?.() && Capacitor.getPlatform() !== "web"));
}

const STATUS_WORDS = {
  prete: "TERMINEE",
  pretes: "TERMINEE",
  pret: "TERMINEE",
  terminee: "TERMINEE",
  terminees: "TERMINEE",
  encours: "EN_COURS",
  "en cours": "EN_COURS",
  livree: "LIVREE",
  livrees: "LIVREE",
  annulee: "ANNULEE",
  annulees: "ANNULEE",
  creee: "CREEE",
  creees: "CREEE"
};

const COMMON_MEASURE_ALIASES = {
  poitrine: ["poitrine", "tour de poitrine"],
  taille: ["taille", "tour de taille"],
  hanche: ["hanche", "hanches", "bassin"],
  bassin: ["bassin", "hanche", "hanches"],
  manche: ["manche", "longueur manche", "manches"],
  longueur: ["longueur", "longueur totale"],
  epaule: ["epaule", "epaules", "largeur epaule", "largeur epaules"],
  cou: ["cou", "tour de cou"],
  cuisse: ["cuisse", "tour de cuisse"],
  genou: ["genou", "tour de genou"],
  bas: ["bas", "tour de bas"]
};

export function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function getVoiceCapabilities() {
  const Recognition = getSpeechRecognitionConstructor();
  const secure = typeof window === "undefined" ? false : window.isSecureContext || window.location.hostname === "localhost";
  const native = isNativePlatformSync();
  return {
    enabled: VOICE_ENABLED,
    supported: Boolean(Recognition || native),
    secure: native || secure,
    native,
    available: Boolean(VOICE_ENABLED && ((Recognition && secure) || native))
  };
}

class NativeSpeechRecognizerAdapter {
  constructor({ lang = "fr-FR" } = {}) {
    this.lang = lang;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.onstart = null;
    this._plugin = null;
    this._listeners = [];
    this._active = false;
  }

  async start() {
    this._plugin = getNativeSpeechPlugin();
    if (!this._plugin) {
      throw new Error("Native speech unavailable");
    }

    await this._removeListeners();
    this._listeners = [
      await this._plugin.addListener("start", () => {
        this._active = true;
        if (typeof this.onstart === "function") this.onstart();
      }),
      await this._plugin.addListener("partial", (event) => this._emitResult(event?.transcript || "", false)),
      await this._plugin.addListener("result", (event) => this._emitResult(event?.transcript || "", true)),
      await this._plugin.addListener("error", (event) => {
        if (typeof this.onerror === "function") {
          this.onerror({ error: event?.code || "native-error", message: event?.message || "Voix indisponible" });
        }
      }),
      await this._plugin.addListener("end", () => {
        this._active = false;
        if (typeof this.onend === "function") this.onend();
        void this._removeListeners();
      })
    ];

    await this._plugin.start({ lang: this.lang });
    this._active = true;
  }

  async stop() {
    if (!this._plugin) return;
    try {
      await this._plugin.stop();
    } finally {
      this._active = false;
      if (typeof this.onend === "function") this.onend();
      await this._removeListeners();
    }
  }

  async abort() {
    await this.stop();
  }

  _emitResult(transcript, isFinal) {
    const value = String(transcript || "").trim();
    if (!value || typeof this.onresult !== "function") return;
    const result = [{ transcript: value }];
    result.isFinal = Boolean(isFinal);
    this.onresult({
      resultIndex: 0,
      results: [result]
    });
  }

  async _removeListeners() {
    const listeners = this._listeners || [];
    this._listeners = [];
    for (const listener of listeners) {
      try {
        await listener?.remove?.();
      } catch {}
    }
  }
}

export function createSpeechRecognizer({ lang = "fr-FR", interimResults = true } = {}) {
  if (isNativePlatformSync()) {
    return new NativeSpeechRecognizerAdapter({ lang, interimResults });
  }
  const Recognition = getSpeechRecognitionConstructor();
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = interimResults;
  recognition.maxAlternatives = 1;
  return recognition;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^\p{L}\p{N}\s.,-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAlias(value) {
  return normalizeText(value).replace(/[_-]+/g, " ").trim();
}

function fieldAliases(field) {
  const raw = [field?.label, field?.key, String(field?.key || "").replace(/([a-z])([A-Z])/g, "$1 $2")].filter(Boolean);
  const aliases = new Set(raw.map(normalizeAlias).filter(Boolean));
  for (const alias of Array.from(aliases)) {
    const common = COMMON_MEASURE_ALIASES[alias];
    if (common) common.forEach((item) => aliases.add(normalizeAlias(item)));
  }
  return Array.from(aliases).sort((a, b) => b.length - a.length);
}

function firstNumberAfterAlias(text, alias) {
  const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(alias)}(?:\\s|:|-)*(\\d+(?:[,.]\\d+)?)`, "i");
  const match = text.match(pattern);
  if (!match) return "";
  return match[1].replace(",", ".");
}

export function parseVoiceMeasures(transcript, fields = []) {
  const text = normalizeText(transcript);
  const sourceFields =
    Array.isArray(fields) && fields.length > 0
      ? fields
      : Object.keys(COMMON_MEASURE_ALIASES).map((key) => ({ key, label: key, inputType: "number" }));
  const values = {};
  const matchedLabels = [];
  for (const field of sourceFields) {
    for (const alias of fieldAliases(field)) {
      const value = firstNumberAfterAlias(text, alias);
      if (!value) continue;
      values[field.key] = value;
      matchedLabels.push(field.label || field.key);
      break;
    }
  }
  return {
    transcript: String(transcript || "").trim(),
    values,
    matchedLabels,
    count: Object.keys(values).length
  };
}

export function parseVoiceSearch(transcript) {
  const original = String(transcript || "").trim();
  const text = normalizeText(original);
  let status = "";
  for (const [word, value] of Object.entries(STATUS_WORDS)) {
    if (text.includes(word)) {
      status = value;
      break;
    }
  }
  const cleaned = text
    .replace(/\b(cherche|chercher|recherche|montre|ouvrir|ouvre|commande|commandes|retouche|retouches|du jour|aujourd hui)\b/g, " ")
    .replace(/\b(prete|pretes|pret|terminee|terminees|en cours|encours|livree|livrees|annulee|annulees|creee|creees)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    transcript: original,
    query: cleaned || original,
    status
  };
}

function extractAfter(text, keywords) {
  for (const keyword of keywords) {
    const pattern = new RegExp(`${escapeRegExp(keyword)}\\s+([^.,;]+)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function parseMoney(text) {
  const match = text.match(/(?:prix|montant|avance|acompte|paye|pay[eé])\s+(\d+(?:[,.]\d+)?)/i);
  return match?.[1]?.replace(",", ".") || "";
}

export function parseCommandeVoiceDraft(transcript) {
  const original = String(transcript || "").trim();
  const text = normalizeText(original);
  return {
    transcript: original,
    clientName: extractAfter(text, ["client"]),
    typeLabel: extractAfter(text, ["habit", "type", "commande"]),
    description: original.replace(/^\s*(commande|client)\s+/i, "").trim(),
    montant: parseMoney(text)
  };
}

export function parseRetoucheVoiceDraft(transcript) {
  const original = String(transcript || "").trim();
  const text = normalizeText(original);
  return {
    transcript: original,
    clientName: extractAfter(text, ["client"]),
    typeLabel: extractAfter(text, ["retouche", "type"]),
    description: original.replace(/^\s*(retouche|client)\s+/i, "").trim(),
    montant: parseMoney(text)
  };
}

export function parseDossierVoiceDraft(transcript) {
  const original = String(transcript || "").trim();
  const text = normalizeText(original);
  const type = text.includes("famille") ? "FAMILLE" : text.includes("groupe") ? "GROUPE" : "INDIVIDUEL";
  const rawName = extractAfter(text, ["responsable", "client", "dossier"]);
  const phoneMatch = original.match(/(?:telephone|tel|numero)\s+([+0-9\s-]{6,})/i);
  const nameWithoutPhone = rawName.replace(/\b(telephone|tel|numero)\b.*$/i, "").trim();
  const parts = nameWithoutPhone.split(/\s+/).filter(Boolean);
  return {
    transcript: original,
    typeDossier: type,
    nom: parts.slice(0, 1).join(" "),
    prenom: parts.slice(1).join(" "),
    telephone: phoneMatch?.[1]?.trim() || "",
    notes: original
  };
}
