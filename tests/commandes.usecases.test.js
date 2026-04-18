import assert from "assert";
import { creerCommande } from "../src/bc-commandes/application/use-cases/creer-commande.js";
import { StatutCommande } from "../src/bc-commandes/domain/value-objects.js";

function shouldFail(fn) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
}

function run() {
  const basePolicy = {
    commandes: {
      mesuresObligatoiresPourCommande: true,
      interdireEnregistrementSansToutesMesuresUtiles: true,
      valeursDecimalesAutorisees: true,
      uniteMesure: "cm",
      delaiParDefautCommande: 7,
      passageAutomatiqueEnCoursApresPremierPaiement: true,
      livraisonAutoriseeSeulementSiPaiementTotal: true,
      autoriserModificationMesuresApresCreation: true,
      autoriserAnnulationApresPaiement: true
    }
  };

  // Create with explicit measures
  const c = creerCommande(
    {
      idCommande: "CMD-1",
      idClient: "CL-1",
      descriptionCommande: "Robe simple",
      datePrevue: new Date().toISOString(),
      montantTotal: 100,
      typeHabit: "ROBE",
      mesuresHabit: {
        poitrine: 88.5,
        taille: 70,
        hanche: 95,
        longueur: 110
      }
    },
    { policy: basePolicy }
  );
  assert.equal(c.statutCommande, StatutCommande.CREEE);

  shouldFail(() => c.terminerTravail());

  // Payment with auto status
  c.appliquerPaiement(50, { policy: basePolicy });
  assert.equal(c.statutCommande, StatutCommande.EN_COURS);
  assert.equal(c.montantPaye, 50);
  assert.equal(c.resteAPayer(), 50);

  // Finish work then deliver should fail because not paid
  c.terminerTravail();
  assert.equal(c.statutCommande, StatutCommande.TERMINEE);
  shouldFail(() => c.livrerCommande({ policy: basePolicy }));

  // Pay remaining and deliver
  c.appliquerPaiement(50, { policy: basePolicy });
  c.livrerCommande({ policy: basePolicy });
  assert.equal(c.statutCommande, StatutCommande.LIVREE);

  // Cannot pay after delivery
  shouldFail(() => c.appliquerPaiement(1, { policy: basePolicy }));

  // Delai par defaut applique
  const createdAt = "2026-01-01T00:00:00.000Z";
  const cDelai = creerCommande(
    {
      idCommande: "CMD-DEL",
      idClient: "CL-1",
      descriptionCommande: "Robe delai",
      dateCreation: createdAt,
      montantTotal: 100,
      typeHabit: "ROBE",
      mesuresHabit: {
        poitrine: 88,
        taille: 70,
        hanche: 95,
        longueur: 110
      }
    },
    {
      policy: {
        commandes: {
          ...basePolicy.commandes,
          delaiParDefautCommande: 5
        }
      }
    }
  );
  assert.equal(cDelai.datePrevue.slice(0, 10), "2026-01-06");

  // Mesures obligatoires desactivees -> commande possible sans mesures
  const cSansMesures = creerCommande(
    {
      idCommande: "CMD-NO-MES",
      idClient: "CL-1",
      descriptionCommande: "Sans mesures",
      montantTotal: 80
    },
    {
      policy: {
        commandes: {
          ...basePolicy.commandes,
          mesuresObligatoiresPourCommande: false
        }
      }
    }
  );
  assert.equal(cSansMesures.typeHabit, null);
  assert.equal(cSansMesures.mesuresHabit, null);

  // Habits config (parametres) pilote les mesures attendues en creation
  const cConfigHabits = creerCommande(
    {
      idCommande: "CMD-CONF-HABIT",
      idClient: "CL-1",
      descriptionCommande: "Pantalon config custom",
      montantTotal: 95,
      typeHabit: "PANTALON",
      mesuresHabit: {
        longueur: 104,
        tourTaille: 86
      }
    },
    {
      policy: {
        commandes: {
          ...basePolicy.commandes
        },
        habits: {
          PANTALON: {
            label: "Pantalon",
            mesures: [
              { code: "longueur", label: "Longueur", obligatoire: true },
              { code: "tourTaille", label: "Tour taille", obligatoire: true }
            ]
          }
        }
      }
    }
  );
  assert.equal(cConfigHabits.typeHabit, "PANTALON");
  assert.equal(Number(cConfigHabits.mesuresHabit.valeurs.longueur), 104);
  assert.equal(Number(cConfigHabits.mesuresHabit.valeurs.tourTaille), 86);

  // Interdiction sans toutes mesures utiles desactivee -> mesures partielles autorisees
  const cPartielle = creerCommande(
    {
      idCommande: "CMD-PART",
      idClient: "CL-1",
      descriptionCommande: "Mesures partielles",
      montantTotal: 140,
      typeHabit: "ROBE",
      mesuresHabit: {
        poitrine: 91
      }
    },
    {
      policy: {
        commandes: {
          ...basePolicy.commandes,
          interdireEnregistrementSansToutesMesuresUtiles: false
        }
      }
    }
  );
  assert.equal(cPartielle.typeHabit, "ROBE");
  assert.equal(Number(cPartielle.mesuresHabit.valeurs.poitrine), 91);

  const cItems = creerCommande(
    {
      idCommande: "CMD-ITEMS",
      idClient: "CL-1",
      descriptionCommande: "Commande multi-items",
      montantTotal: 55,
      typeHabit: "CHEMISE",
      mesuresHabit: {
        poitrine: 92,
        longueurChemise: 72,
        typeManches: "longues",
        poignet: 19,
        carrure: 44,
        longueurManches: 61
      },
      items: [
        {
          idItem: "ITEM-CHEMISE",
          typeHabit: "CHEMISE",
          description: "Chemise blanche",
          prix: 25,
          mesures: {
            poitrine: 92,
            longueurChemise: 72,
            typeManches: "longues",
            poignet: 19,
            carrure: 44,
            longueurManches: 61
          }
        },
        {
          idItem: "ITEM-PANTALON",
          typeHabit: "PANTALON",
          description: "Pantalon bleu",
          prix: 30,
          mesures: {
            longueur: 106,
            tourTaille: 84,
            tourHanche: 98,
            largeurBas: 18,
            hauteurFourche: 29
          }
        }
      ]
    },
    { policy: basePolicy }
  );
  assert.equal(cItems.items.length, 2);
  assert.equal(cItems.items[0].typeHabit, "CHEMISE");
  assert.equal(cItems.items[1].typeHabit, "PANTALON");
  assert.equal(Number(cItems.items[1].mesures.valeurs.longueur), 106);

  const cMesuresLibres = creerCommande(
    {
      idCommande: "CMD-MESURES-LIBRES",
      idClient: "CL-1",
      descriptionCommande: "Commande avec mesures libres",
      montantTotal: 45,
      typeHabit: "AUTRES",
      mesuresHabit: {
        longueurSpeciale: 72,
        repere: "epaule gauche"
      }
    },
    { policy: basePolicy }
  );
  assert.equal(cMesuresLibres.typeHabit, "AUTRES");
  assert.equal(Number(cMesuresLibres.mesuresHabit.valeurs.longueurSpeciale), 72);
  assert.equal(cMesuresLibres.mesuresHabit.valeurs.repere, "epaule gauche");

  // Valeurs decimales interdites
  shouldFail(() =>
    creerCommande(
      {
        idCommande: "CMD-DEC",
        idClient: "CL-1",
        descriptionCommande: "Decimales interdites",
        montantTotal: 150,
        typeHabit: "ROBE",
        mesuresHabit: {
          poitrine: 88.5,
          taille: 70,
          hanche: 95,
          longueur: 110
        }
      },
      {
        policy: {
          commandes: {
            ...basePolicy.commandes,
            valeursDecimalesAutorisees: false
          }
        }
      }
    )
  );

  // Unite mesure invalide
  shouldFail(() =>
    creerCommande(
      {
        idCommande: "CMD-UNIT",
        idClient: "CL-1",
        descriptionCommande: "Unite invalide",
        montantTotal: 200,
        typeHabit: "ROBE",
        mesuresHabit: {
          poitrine: 88,
          taille: 70,
          hanche: 95,
          longueur: 110
        }
      },
      {
        policy: {
          commandes: {
            ...basePolicy.commandes,
            uniteMesure: "inch"
          }
        }
      }
    )
  );

  // Paiement sans passage auto EN_COURS
  const cNoAuto = creerCommande(
    {
      idCommande: "CMD-NOAUTO",
      idClient: "CL-1",
      descriptionCommande: "Sans passage auto",
      montantTotal: 100,
      typeHabit: "ROBE",
      mesuresHabit: {
        poitrine: 88,
        taille: 70,
        hanche: 95,
        longueur: 110
      }
    },
    { policy: basePolicy }
  );
  cNoAuto.appliquerPaiement(20, {
    policy: {
      commandes: {
        ...basePolicy.commandes,
        passageAutomatiqueEnCoursApresPremierPaiement: false
      }
    }
  });
  assert.equal(cNoAuto.statutCommande, StatutCommande.CREEE);

  // Livraison autorisee sans paiement total si policy desactivee
  const cLivraisonSouple = creerCommande(
    {
      idCommande: "CMD-LIV",
      idClient: "CL-1",
      descriptionCommande: "Livraison souple",
      montantTotal: 100,
      typeHabit: "ROBE",
      mesuresHabit: {
        poitrine: 88,
        taille: 70,
        hanche: 95,
        longueur: 110
      }
    },
    { policy: basePolicy }
  );
  cLivraisonSouple.appliquerPaiement(20, { policy: basePolicy });
  cLivraisonSouple.terminerTravail();
  cLivraisonSouple.livrerCommande({
    policy: {
      commandes: {
        ...basePolicy.commandes,
        livraisonAutoriseeSeulementSiPaiementTotal: false
      }
    }
  });
  assert.equal(cLivraisonSouple.statutCommande, StatutCommande.LIVREE);

  // Modification mesures interdite apres creation
  const cMes = creerCommande(
    {
      idCommande: "CMD-MES",
      idClient: "CL-1",
      descriptionCommande: "Maj mesures",
      montantTotal: 110,
      typeHabit: "ROBE",
      mesuresHabit: {
        poitrine: 88,
        taille: 70,
        hanche: 95,
        longueur: 110
      }
    },
    { policy: basePolicy }
  );
  cMes.appliquerPaiement(10, { policy: basePolicy });
  shouldFail(() =>
    cMes.mettreAJourMesures({
      typeHabit: "ROBE",
      mesuresHabit: {
        poitrine: 90,
        taille: 72,
        hanche: 98,
        longueur: 112
      },
      policy: {
        commandes: {
          ...basePolicy.commandes,
          autoriserModificationMesuresApresCreation: false
        }
      }
    })
  );

  // Annulation apres paiement autorisee tant que le statut reste annulable
  const cNoCancelAfterPay = creerCommande(
    {
      idCommande: "CMD-NOCANCEL",
      idClient: "CL-1",
      descriptionCommande: "Annulation stricte",
      montantTotal: 90,
      typeHabit: "ROBE",
      mesuresHabit: {
        poitrine: 88,
        taille: 70,
        hanche: 95,
        longueur: 110
      }
    },
    { policy: basePolicy }
  );
  cNoCancelAfterPay.appliquerPaiement(10, { policy: basePolicy });
  cNoCancelAfterPay.annulerCommande({
    policy: {
      commandes: {
        ...basePolicy.commandes,
        autoriserAnnulationApresPaiement: false
      }
    }
  });
  assert.equal(cNoCancelAfterPay.statutCommande, StatutCommande.ANNULEE);

  // Annulation interdite en TERMINEE
  const cTerminee = creerCommande(
    {
      idCommande: "CMD-TERM-CANCEL",
      idClient: "CL-1",
      descriptionCommande: "Annulation terminee",
      montantTotal: 120,
      typeHabit: "ROBE",
      mesuresHabit: {
        poitrine: 88,
        taille: 70,
        hanche: 95,
        longueur: 110
      }
    },
    { policy: basePolicy }
  );
  cTerminee.appliquerPaiement(20, { policy: basePolicy });
  cTerminee.terminerTravail();
  shouldFail(() => cTerminee.annulerCommande({ policy: basePolicy }));
}

run();
console.log("OK: commandes use cases");
