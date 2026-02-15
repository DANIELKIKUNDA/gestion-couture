function assertString(value, label, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === "")) return;
  if (typeof value !== "string") throw new Error(`${label} doit etre une chaine`);
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") throw new Error(`${label} doit etre un booleen`);
}

function assertNumber(value, label, { min = null } = {}) {
  if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`${label} doit etre un nombre`);
  if (min !== null && value < min) throw new Error(`${label} doit etre >= ${min}`);
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} doit etre un tableau`);
}

function assertTime(value, label) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    throw new Error(`${label} doit etre au format HH:MM`);
  }
}

export function validateParametresPayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Payload invalide");

  if (payload.meta) {
    if (payload.meta.version !== undefined) assertNumber(payload.meta.version, "Meta.version", { min: 1 });
  }

  const identite = payload.identite || {};
  assertString(identite.nomAtelier, "Identite.nomAtelier");
  assertString(identite.adresse, "Identite.adresse", { optional: true });
  assertString(identite.telephone, "Identite.telephone", { optional: true });
  assertString(identite.devise, "Identite.devise");
  assertString(identite.logoUrl, "Identite.logoUrl", { optional: true });

  const commandes = payload.commandes || {};
  assertBoolean(commandes.mesuresObligatoires, "Commandes.mesuresObligatoires");
  assertBoolean(commandes.interdictionSansMesures, "Commandes.interdictionSansMesures");
  assertString(commandes.uniteMesure, "Commandes.uniteMesure");
  if (commandes.uniteMesure !== "cm") throw new Error("Commandes.uniteMesure doit etre 'cm'");
  assertBoolean(commandes.decimalesAutorisees, "Commandes.decimalesAutorisees");
  assertNumber(commandes.delaiDefautJours, "Commandes.delaiDefautJours", { min: 0 });

  const retouches = payload.retouches || {};
  assertBoolean(retouches.mesuresOptionnelles, "Retouches.mesuresOptionnelles");
  assertBoolean(retouches.saisiePartielle, "Retouches.saisiePartielle");
  assertBoolean(retouches.descriptionObligatoire, "Retouches.descriptionObligatoire");

  const habits = payload.habits || {};
  if (typeof habits !== "object") throw new Error("Habits doit etre un objet");
  for (const [key, habit] of Object.entries(habits)) {
    if (!habit || typeof habit !== "object") throw new Error(`Habit ${key} invalide`);
    assertString(habit.label, `Habit.${key}.label`);
    assertArray(habit.mesures, `Habit.${key}.mesures`);
    for (const mesure of habit.mesures) {
      assertString(mesure.code, `Habit.${key}.mesure.code`);
      assertString(mesure.label, `Habit.${key}.mesure.label`);
      assertBoolean(mesure.obligatoire, `Habit.${key}.mesure.obligatoire`);
    }
  }

  const caisse = payload.caisse || {};
  assertTime(caisse.ouvertureAuto, "Caisse.ouvertureAuto");
  assertTime(caisse.ouvertureDimanche, "Caisse.ouvertureDimanche");
  assertBoolean(caisse.clotureAutoMinuit, "Caisse.clotureAutoMinuit");
  assertBoolean(caisse.paiementAvantLivraison, "Caisse.paiementAvantLivraison");
  assertBoolean(caisse.livraisonExpress, "Caisse.livraisonExpress");

  const facturation = payload.facturation || {};
  assertString(facturation.prefixeNumero, "Facturation.prefixeNumero");
  assertNumber(facturation.prochainNumero, "Facturation.prochainNumero", { min: 1 });
  assertString(facturation.mentions, "Facturation.mentions", { optional: true });
  assertBoolean(facturation.afficherLogo, "Facturation.afficherLogo");

  const securite = payload.securite || {};
  assertArray(securite.rolesAutorises, "Securite.rolesAutorises");
  assertBoolean(securite.confirmationAvantSauvegarde, "Securite.confirmationAvantSauvegarde");
  assertBoolean(securite.verrouillageActif, "Securite.verrouillageActif");
  if (securite.auditLog) assertArray(securite.auditLog, "Securite.auditLog");
}
