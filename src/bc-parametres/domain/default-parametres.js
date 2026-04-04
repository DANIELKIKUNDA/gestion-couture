import { cloneDefaultRetoucheTypes } from "../../bc-retouches/domain/retouche-policy.js";

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
      typesRetouche: cloneDefaultRetoucheTypes()
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
      finSemaineComptable: "DIMANCHE",
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
    contactClient: {
      signatureAuto: true,
      templates: {
        commandePrete: "{salutation}\nVotre commande {reference} est prete. Merci de passer a l'atelier quand vous etes disponible.\n\n{signature}",
        commandeSuivi: "{salutation}\nVotre commande {reference} est en cours de traitement. Nous vous recontacterons des qu'elle sera prete.\n\n{signature}",
        commandeSolde: "{salutation}\nIl reste un solde de {montantRestant} pour votre commande {reference}. Merci pour votre confiance.\n\n{signature}",
        commandeRetard: "{salutation}\nVotre commande {reference} demande un peu plus de temps. Nous vous informerons du nouveau delai au plus vite.\n\n{signature}",
        retouchePrete: "{salutation}\nVotre retouche {reference} est prete. Vous pouvez passer a l'atelier quand vous voulez.\n\n{signature}",
        retoucheSuivi: "{salutation}\nVotre retouche {reference} est en cours de traitement. Nous vous informerons des qu'elle sera finalisee.\n\n{signature}",
        retoucheSolde: "{salutation}\nIl reste un solde de {montantRestant} pour votre retouche {reference}. Merci pour votre confiance.\n\n{signature}",
        retoucheDelai: "{salutation}\nVotre retouche {reference} suit son traitement. Nous reviendrons vers vous avec la date prevue de retrait.\n\n{signature}",
        clientBonjour: "{salutation}\nNous vous contactons depuis l'atelier pour faire le suivi de votre dossier.\n\n{signature}",
        clientRendezVous: "{salutation}\nMerci de nous confirmer votre disponibilite pour votre prochain passage a l'atelier.\n\n{signature}",
        clientMerci: "{salutation}\nMerci pour votre confiance. Nous restons disponibles si vous avez besoin d'un suivi complementaire.\n\n{signature}"
      }
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
