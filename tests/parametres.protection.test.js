import assert from "assert";
import { buildDefaultAtelierParametresPayload } from "../src/bc-parametres/domain/default-parametres.js";
import { saveParametresAtelier } from "../src/bc-parametres/application/use-cases/save-parametres.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function shouldReject(fn, expectedMessagePart) {
  let error = null;
  try {
    await fn();
  } catch (err) {
    error = err;
  }
  assert.ok(error, "Une erreur etait attendue.");
  if (expectedMessagePart) {
    assert.ok(String(error.message || "").includes(expectedMessagePart), `Message attendu: ${expectedMessagePart}, recu: ${error.message}`);
  }
}

async function run() {
  const currentPayload = buildDefaultAtelierParametresPayload({
    nomAtelier: "Atelier Test Parametres",
    overrides: {
      retouches: {
        typesRetouche: [
          {
            code: "OURLET_PANTALON",
            libelle: "Ourlet pantalon",
            actif: true,
            ordreAffichage: 1,
            necessiteMesures: true,
            descriptionObligatoire: false,
            habitsCompatibles: ["PANTALON"],
            mesures: [
              { code: "longueur", label: "Longueur", unite: "cm", typeChamp: "number", obligatoire: true, actif: true, ordre: 1 }
            ]
          }
        ]
      }
    }
  });

  const repo = {
    async getCurrent() {
      return { payload: clone(currentPayload), version: 1 };
    },
    async save({ payload }) {
      return { payload, version: 2 };
    }
  };

  const usedCommandeRepo = {
    async existsByTypeHabit(typeHabit) {
      return String(typeHabit) === "PANTALON";
    },
    async existsByMeasureCode(measureCode, { typeHabit } = {}) {
      return String(typeHabit || "") === "PANTALON" && String(measureCode || "") === "longueur";
    }
  };

  const usedRetoucheRepo = {
    async existsByTypeHabit(typeHabit) {
      return String(typeHabit) === "PANTALON";
    },
    async existsByTypeRetouche(typeRetouche) {
      return String(typeRetouche) === "OURLET_PANTALON";
    },
    async existsByMeasureCode(measureCode, { typeRetouche } = {}) {
      return String(typeRetouche || "") === "OURLET_PANTALON" && String(measureCode || "") === "longueur";
    }
  };

  const usedSerieRepo = {
    async existsByTypeVetement(typeVetement) {
      return String(typeVetement) === "PANTALON";
    },
    async existsByMeasureCode(measureCode, { typeVetement } = {}) {
      return String(typeVetement || "") === "PANTALON" && String(measureCode || "") === "longueur";
    }
  };

  const archiveHabitPayload = clone(currentPayload);
  archiveHabitPayload.habits.PANTALON.actif = false;
  const archivedHabit = await saveParametresAtelier({
    repo,
    payload: archiveHabitPayload,
    commandeRepo: usedCommandeRepo,
    retoucheRepo: usedRetoucheRepo,
    serieRepo: usedSerieRepo
  });
  assert.equal(archivedHabit.version, 2);

  const removeHabitPayload = clone(currentPayload);
  delete removeHabitPayload.habits.PANTALON;
  await shouldReject(
    () =>
      saveParametresAtelier({
        repo,
        payload: removeHabitPayload,
        commandeRepo: usedCommandeRepo,
        retoucheRepo: usedRetoucheRepo,
        serieRepo: usedSerieRepo
      }),
    "Impossible de supprimer le type d'habit"
  );

  const removeHabitMeasurePayload = clone(currentPayload);
  removeHabitMeasurePayload.habits.PANTALON.mesures = removeHabitMeasurePayload.habits.PANTALON.mesures.filter((row) => row.code !== "longueur");
  await shouldReject(
    () =>
      saveParametresAtelier({
        repo,
        payload: removeHabitMeasurePayload,
        commandeRepo: usedCommandeRepo,
        retoucheRepo: usedRetoucheRepo,
        serieRepo: usedSerieRepo
      }),
    "Impossible de supprimer la mesure longueur du type Pantalon"
  );

  const removeRetoucheTypePayload = clone(currentPayload);
  removeRetoucheTypePayload.retouches.typesRetouche = [];
  await shouldReject(
    () =>
      saveParametresAtelier({
        repo,
        payload: removeRetoucheTypePayload,
        commandeRepo: usedCommandeRepo,
        retoucheRepo: usedRetoucheRepo,
        serieRepo: usedSerieRepo
      }),
    "Impossible de supprimer le type de retouche"
  );

  const removeRetoucheMeasurePayload = clone(currentPayload);
  removeRetoucheMeasurePayload.retouches.typesRetouche[0].mesures = [];
  await shouldReject(
    () =>
      saveParametresAtelier({
        repo,
        payload: removeRetoucheMeasurePayload,
        commandeRepo: usedCommandeRepo,
        retoucheRepo: usedRetoucheRepo,
        serieRepo: usedSerieRepo
      }),
    "Impossible de supprimer la mesure longueur du type de retouche"
  );

  const removablePayload = clone(currentPayload);
  removablePayload.habits.PANTALON.mesures.push({
    code: "ceinture",
    label: "Ceinture",
    obligatoire: false,
    actif: false,
    ordre: 6,
    typeChamp: "number"
  });
  const removableRepo = {
    async getCurrent() {
      return { payload: clone(removablePayload), version: 2 };
    },
    async save({ payload }) {
      return { payload, version: 3 };
    }
  };
  const removableNextPayload = clone(removablePayload);
  removableNextPayload.habits.PANTALON.mesures = removableNextPayload.habits.PANTALON.mesures.filter((row) => row.code !== "ceinture");
  const saved = await saveParametresAtelier({
    repo: removableRepo,
    payload: removableNextPayload,
    commandeRepo: usedCommandeRepo,
    retoucheRepo: usedRetoucheRepo,
    serieRepo: usedSerieRepo
  });
  assert.equal(saved.version, 3);

  console.log("OK: parametres protection");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
