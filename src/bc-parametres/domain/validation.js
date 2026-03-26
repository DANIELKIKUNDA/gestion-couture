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

function assertOneOf(value, label, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw new Error(`${label} invalide`);
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
  assertString(identite.email, "Identite.email", { optional: true });
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
  if (retouches.typesRetouche !== undefined) {
    assertArray(retouches.typesRetouche, "Retouches.typesRetouche");
    const typeCodes = new Set();
    const typeOrders = new Set();
    for (const row of retouches.typesRetouche) {
      if (!row || typeof row !== "object") throw new Error("Retouches.typesRetouche contient un element invalide");
      assertString(row.code, "Retouches.typesRetouche.code");
      assertString(row.libelle, "Retouches.typesRetouche.libelle");
      assertBoolean(row.actif, "Retouches.typesRetouche.actif");
      assertNumber(row.ordreAffichage, "Retouches.typesRetouche.ordreAffichage", { min: 1 });
      assertBoolean(row.necessiteMesures, "Retouches.typesRetouche.necessiteMesures");
      assertBoolean(row.descriptionObligatoire, "Retouches.typesRetouche.descriptionObligatoire");
      assertArray(row.habitsCompatibles, "Retouches.typesRetouche.habitsCompatibles");
      if (typeCodes.has(row.code)) throw new Error(`Retouches.typesRetouche.code duplique: ${row.code}`);
      if (typeOrders.has(row.ordreAffichage)) throw new Error(`Retouches.typesRetouche.ordreAffichage duplique: ${row.ordreAffichage}`);
      typeCodes.add(row.code);
      typeOrders.add(row.ordreAffichage);
      const mesures = row.mesures !== undefined ? row.mesures : row.mesuresCibles !== undefined ? row.mesuresCibles : [];
      assertArray(mesures, `Retouches.typesRetouche.${row.code}.mesures`);
      const mesureCodes = new Set();
      const mesureOrdres = new Set();
      for (const mesure of mesures) {
        if (typeof mesure === "string") {
          assertString(mesure, `Retouches.typesRetouche.${row.code}.mesures`);
          if (mesureCodes.has(mesure)) throw new Error(`Retouches.typesRetouche.${row.code}.mesures duplique: ${mesure}`);
          mesureCodes.add(mesure);
          continue;
        }
        if (!mesure || typeof mesure !== "object") throw new Error(`Retouches.typesRetouche.${row.code}.mesures contient un element invalide`);
        assertString(mesure.code, `Retouches.typesRetouche.${row.code}.mesures.code`);
        assertString(mesure.label, `Retouches.typesRetouche.${row.code}.mesures.label`);
        assertString(mesure.unite, `Retouches.typesRetouche.${row.code}.mesures.unite`);
        assertString(mesure.typeChamp, `Retouches.typesRetouche.${row.code}.mesures.typeChamp`);
        assertBoolean(mesure.obligatoire, `Retouches.typesRetouche.${row.code}.mesures.obligatoire`);
        assertBoolean(mesure.actif, `Retouches.typesRetouche.${row.code}.mesures.actif`);
        assertNumber(mesure.ordre, `Retouches.typesRetouche.${row.code}.mesures.ordre`, { min: 1 });
        if (mesureCodes.has(mesure.code)) throw new Error(`Retouches.typesRetouche.${row.code}.mesures.code duplique: ${mesure.code}`);
        if (mesureOrdres.has(mesure.ordre)) throw new Error(`Retouches.typesRetouche.${row.code}.mesures.ordre duplique: ${mesure.ordre}`);
        mesureCodes.add(mesure.code);
        mesureOrdres.add(mesure.ordre);
      }
      const habitsCompatibles = new Set();
      for (const habit of row.habitsCompatibles) {
        assertString(habit, `Retouches.typesRetouche.${row.code}.habitsCompatibles`);
        if (habitsCompatibles.has(habit)) throw new Error(`Retouches.typesRetouche.${row.code}.habitsCompatibles duplique: ${habit}`);
        habitsCompatibles.add(habit);
      }
    }
  }

  const habits = payload.habits || {};
  if (typeof habits !== "object") throw new Error("Habits doit etre un objet");
  const habitOrders = new Set();
  for (const [key, habit] of Object.entries(habits)) {
    if (!habit || typeof habit !== "object") throw new Error(`Habit ${key} invalide`);
    assertString(habit.label, `Habit.${key}.label`);
    if (habit.actif !== undefined) assertBoolean(habit.actif, `Habit.${key}.actif`);
    if (habit.ordre !== undefined) {
      assertNumber(habit.ordre, `Habit.${key}.ordre`, { min: 0 });
      if (habitOrders.has(habit.ordre)) throw new Error(`Habit.${key}.ordre duplique`);
      habitOrders.add(habit.ordre);
    }
    assertArray(habit.mesures, `Habit.${key}.mesures`);
    const mesureCodes = new Set();
    const mesureOrdres = new Set();
    for (const mesure of habit.mesures) {
      assertString(mesure.code, `Habit.${key}.mesure.code`);
      if (mesureCodes.has(mesure.code)) throw new Error(`Habit.${key}.mesure.code duplique: ${mesure.code}`);
      mesureCodes.add(mesure.code);
      assertString(mesure.label, `Habit.${key}.mesure.label`);
      assertBoolean(mesure.obligatoire, `Habit.${key}.mesure.obligatoire`);
      if (mesure.actif !== undefined) assertBoolean(mesure.actif, `Habit.${key}.mesure.actif`);
      if (mesure.ordre !== undefined) {
        assertNumber(mesure.ordre, `Habit.${key}.mesure.ordre`, { min: 0 });
        if (mesureOrdres.has(mesure.ordre)) throw new Error(`Habit.${key}.mesure.ordre duplique: ${mesure.ordre}`);
        mesureOrdres.add(mesure.ordre);
      }
      if (mesure.typeChamp !== undefined) {
        assertString(mesure.typeChamp, `Habit.${key}.mesure.typeChamp`);
        const type = String(mesure.typeChamp || "").trim().toLowerCase();
        if (type !== "number" && type !== "text" && type !== "select") {
          throw new Error(`Habit.${key}.mesure.typeChamp invalide`);
        }
      }
    }
  }

  const caisse = payload.caisse || {};
  assertTime(caisse.ouvertureAuto, "Caisse.ouvertureAuto");
  assertTime(caisse.ouvertureDimanche, "Caisse.ouvertureDimanche");
  assertString(caisse.finSemaineComptable, "Caisse.finSemaineComptable");
  assertOneOf(caisse.finSemaineComptable, "Caisse.finSemaineComptable", ["SAMEDI", "DIMANCHE"]);
  if (caisse.clotureAutoMinuit !== undefined) assertBoolean(caisse.clotureAutoMinuit, "Caisse.clotureAutoMinuit");
  assertBoolean(caisse.clotureAutoActive, "Caisse.clotureAutoActive");
  assertTime(caisse.heureClotureAuto, "Caisse.heureClotureAuto");
  assertBoolean(caisse.paiementAvantLivraison, "Caisse.paiementAvantLivraison");
  assertBoolean(caisse.livraisonExpress, "Caisse.livraisonExpress");

  const facturation = payload.facturation || {};
  assertString(facturation.prefixeNumero, "Facturation.prefixeNumero");
  assertString(facturation.mentions, "Facturation.mentions", { optional: true });
  assertBoolean(facturation.afficherLogo, "Facturation.afficherLogo");

  const contactClient = payload.contactClient || {};
  assertBoolean(contactClient.signatureAuto, "ContactClient.signatureAuto");
  const contactTemplates = contactClient.templates || {};
  if (!contactTemplates || typeof contactTemplates !== "object" || Array.isArray(contactTemplates)) {
    throw new Error("ContactClient.templates doit etre un objet");
  }
  const expectedContactTemplateKeys = [
    "commandePrete",
    "commandeSuivi",
    "commandeSolde",
    "commandeRetard",
    "retouchePrete",
    "retoucheSuivi",
    "retoucheSolde",
    "retoucheDelai",
    "clientBonjour",
    "clientRendezVous",
    "clientMerci"
  ];
  for (const key of expectedContactTemplateKeys) {
    assertString(contactTemplates[key], `ContactClient.templates.${key}`);
  }

  const securite = payload.securite || {};
  assertArray(securite.rolesAutorises, "Securite.rolesAutorises");
  assertBoolean(securite.confirmationAvantSauvegarde, "Securite.confirmationAvantSauvegarde");
  assertBoolean(securite.verrouillageActif, "Securite.verrouillageActif");
  if (securite.auditLog) assertArray(securite.auditLog, "Securite.auditLog");
}
