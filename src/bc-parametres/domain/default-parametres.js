function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  if (!base || typeof base !== "object") {
    return override === undefined ? base : override;
  }
  const out = { ...base };
  if (!override || typeof override !== "object") return out;
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] = current && value && typeof current === "object" && typeof value === "object" && !Array.isArray(current) && !Array.isArray(value)
      ? deepMerge(current, value)
      : value;
  }
  return out;
}

export function buildDefaultAtelierParametresPayload({ nomAtelier = "Atelier", overrides = null } = {}) {
  const base = {
    meta: {
      version: 1,
      lastSavedAt: new Date().toISOString()
    },
    identite: {
      nomAtelier,
      adresse: "",
      telephone: "",
      email: "",
      devise: "FC",
      logoUrl: ""
    },
    commandes: {
      mesuresObligatoires: true,
      interdictionSansMesures: true,
      uniteMesure: "cm",
      decimalesAutorisees: true,
      delaiDefautJours: 7,
      passageAutomatiqueEnCoursApresPremierPaiement: true,
      livraisonAutoriseeSeulementSiPaiementTotal: true,
      autoriserModificationMesuresApresCreation: true,
      autoriserAnnulationApresPaiement: false
    },
    retouches: {
      mesuresOptionnelles: true,
      saisiePartielle: true,
      descriptionObligatoire: false,
      typesRetouche: [
        {
          code: "OURLET",
          libelle: "Ourlet",
          actif: true,
          ordreAffichage: 1,
          necessiteMesures: true,
          descriptionObligatoire: false,
          habitsCompatibles: ["PANTALON", "ROBE", "*"],
          mesures: [
            { code: "longueur", label: "Longueur", unite: "cm", typeChamp: "number", obligatoire: true, actif: true, ordre: 1 }
          ]
        }
      ]
    },
    habits: {
      PANTALON: {
        label: "Pantalon",
        actif: true,
        ordre: 1,
        mesures: [
          { code: "longueur", label: "Longueur", obligatoire: true, actif: true, ordre: 1, typeChamp: "number" },
          { code: "tourTaille", label: "Tour taille", obligatoire: true, actif: true, ordre: 2, typeChamp: "number" },
          { code: "tourHanche", label: "Tour hanche", obligatoire: true, actif: true, ordre: 3, typeChamp: "number" },
          { code: "largeurBas", label: "Largeur bas", obligatoire: true, actif: true, ordre: 4, typeChamp: "number" },
          { code: "hauteurFourche", label: "Hauteur fourche", obligatoire: true, actif: true, ordre: 5, typeChamp: "number" }
        ]
      },
      ROBE: {
        label: "Robe",
        actif: true,
        ordre: 2,
        mesures: [
          { code: "poitrine", label: "Poitrine", obligatoire: true, actif: true, ordre: 1, typeChamp: "number" },
          { code: "taille", label: "Taille", obligatoire: true, actif: true, ordre: 2, typeChamp: "number" },
          { code: "hanche", label: "Hanche", obligatoire: true, actif: true, ordre: 3, typeChamp: "number" },
          { code: "longueur", label: "Longueur", obligatoire: true, actif: true, ordre: 4, typeChamp: "number" },
          { code: "largeurBas", label: "Largeur bas", obligatoire: false, actif: true, ordre: 5, typeChamp: "number" }
        ]
      }
    },
    caisse: {
      ouvertureAuto: "07:30",
      ouvertureDimanche: "08:00",
      clotureAutoMinuit: true,
      clotureAutoActive: true,
      heureClotureAuto: "00:00",
      paiementAvantLivraison: true,
      livraisonExpress: true
    },
    facturation: {
      prefixeNumero: "FAC",
      mentions: "Merci pour votre confiance.",
      afficherLogo: true
    },
    securite: {
      rolesAutorises: ["PROPRIETAIRE"],
      confirmationAvantSauvegarde: true,
      verrouillageActif: true,
      auditLog: []
    }
  };

  return deepMerge(base, overrides);
}
