import assert from "node:assert/strict";

import { genererBilansApresCloture } from "../src/bc-caisse/application/use-cases/creer-bilan-caisse.js";
import { calculerBilanCaisse } from "../src/bc-caisse/domain/bilan-caisse.js";
import { CaisseJour } from "../src/bc-caisse/domain/caisse-jour.js";
import { StatutCaisse, StatutOperation, TypeBilan, TypeOperation } from "../src/bc-caisse/domain/value-objects.js";

function op({ id, type, montant, statut = StatutOperation.VALIDE }) {
  return {
    idOperation: id,
    typeOperation: type,
    montant,
    statutOperation: statut
  };
}

function closedCaisse({ id, date, soldeOuverture, soldeCloture, operations = [] }) {
  return new CaisseJour({
    idCaisseJour: id,
    date,
    statutCaisse: StatutCaisse.CLOTUREE,
    soldeOuverture,
    soldeCloture,
    operations
  });
}

function testCalculBilanIgnoreCaissesOuvertesEtOperationsAnnulees() {
  const closedOne = closedCaisse({
    id: "CJ-1",
    date: "2026-05-25",
    soldeOuverture: 100,
    soldeCloture: 130,
    operations: [
      op({ id: "OP-1", type: TypeOperation.ENTREE, montant: 50 }),
      op({ id: "OP-2", type: TypeOperation.SORTIE, montant: 20 }),
      op({ id: "OP-3", type: TypeOperation.ENTREE, montant: 10, statut: StatutOperation.ANNULEE })
    ]
  });
  const openDay = new CaisseJour({
    idCaisseJour: "CJ-OPEN",
    date: "2026-05-26",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 130,
    operations: [op({ id: "OP-OPEN", type: TypeOperation.ENTREE, montant: 999 })]
  });
  const closedTwo = closedCaisse({
    id: "CJ-2",
    date: "2026-05-27",
    soldeOuverture: 130,
    soldeCloture: 160,
    operations: [
      op({ id: "OP-4", type: TypeOperation.ENTREE, montant: 40 }),
      op({ id: "OP-5", type: TypeOperation.SORTIE, montant: 10 }),
      op({ id: "OP-6", type: TypeOperation.SORTIE, montant: 5, statut: StatutOperation.ANNULEE })
    ]
  });

  const bilan = calculerBilanCaisse({
    caisses: [closedTwo, openDay, closedOne],
    dateDebut: "2026-05-25",
    dateFin: "2026-05-27",
    typeBilan: TypeBilan.HEBDO
  });

  assert.deepEqual(bilan, {
    typeBilan: TypeBilan.HEBDO,
    dateDebut: "2026-05-25",
    dateFin: "2026-05-27",
    soldeOuverture: 100,
    totalEntrees: 90,
    totalSorties: 30,
    soldeCloture: 160,
    nombreJours: 2,
    nombreOperations: 4
  });
}

async function testGenerationHebdoEtMensuelleEnFinDeMois() {
  const caisses = [
    closedCaisse({
      id: "CJ-25",
      date: "2026-05-25",
      soldeOuverture: 100,
      soldeCloture: 140,
      operations: [
        op({ id: "OP-H1", type: TypeOperation.ENTREE, montant: 50 }),
        op({ id: "OP-H2", type: TypeOperation.SORTIE, montant: 10 }),
        op({ id: "OP-H3", type: TypeOperation.ENTREE, montant: 5, statut: StatutOperation.ANNULEE })
      ]
    }),
    closedCaisse({
      id: "CJ-31",
      date: "2026-05-31",
      soldeOuverture: 140,
      soldeCloture: 165,
      operations: [
        op({ id: "OP-H4", type: TypeOperation.ENTREE, montant: 30 }),
        op({ id: "OP-H5", type: TypeOperation.SORTIE, montant: 5 })
      ]
    })
  ];

  const saved = [];
  const caisseRepo = {
    async listByDateRange(dateDebut, dateFin) {
      assert.equal(
        ["2026-05-25->2026-05-31", "2026-05-01->2026-05-31"].includes(`${dateDebut}->${dateFin}`),
        true,
        "plage de dates inattendue"
      );
      return caisses;
    },
    async listBeforeDate(dateDebut) {
      if (dateDebut === "2026-05-25") {
        return [{ statutCaisse: StatutCaisse.CLOTUREE, soldeCloture: 80 }];
      }
      if (dateDebut === "2026-05-01") {
        return [{ statutCaisse: StatutCaisse.CLOTUREE, soldeCloture: 60 }];
      }
      return [];
    }
  };
  const bilanRepo = {
    async getByPeriod() {
      return null;
    },
    async save(bilan) {
      saved.push({ ...bilan });
    }
  };

  const result = await genererBilansApresCloture({
    caisseCloturee: { date: "2026-05-31", statutCaisse: StatutCaisse.CLOTUREE },
    caisseRepo,
    bilanRepo,
    utilisateur: "audit-system",
    now: new Date("2026-05-31T20:00:00.000Z")
  });

  assert.ok(result.hebdo, "bilan hebdo attendu");
  assert.ok(result.mensuel, "bilan mensuel attendu");
  assert.equal(result.annuel, null, "aucun bilan annuel attendu");
  assert.equal(saved.length, 2, "deux bilans doivent etre sauvegardes");

  assert.equal(result.hebdo.typeBilan, TypeBilan.HEBDO);
  assert.equal(result.hebdo.dateDebut, "2026-05-25");
  assert.equal(result.hebdo.dateFin, "2026-05-31");
  assert.equal(result.hebdo.soldeOuverture, 80);
  assert.equal(result.hebdo.totalEntrees, 80);
  assert.equal(result.hebdo.totalSorties, 15);
  assert.equal(result.hebdo.soldeCloture, 145);
  assert.equal(result.hebdo.nombreOperations, 4);

  assert.equal(result.mensuel.typeBilan, TypeBilan.MENSUEL);
  assert.equal(result.mensuel.dateDebut, "2026-05-01");
  assert.equal(result.mensuel.dateFin, "2026-05-31");
  assert.equal(result.mensuel.soldeOuverture, 60);
  assert.equal(result.mensuel.totalEntrees, 80);
  assert.equal(result.mensuel.totalSorties, 15);
  assert.equal(result.mensuel.soldeCloture, 125);
  assert.equal(result.mensuel.mois, 5);
  assert.equal(result.mensuel.annee, 2026);
}

async function testGenerationMensuelleEtAnnuelleEnFinDannee() {
  const decemberCaisse = closedCaisse({
    id: "CJ-DEC31",
    date: "2026-12-31",
    soldeOuverture: 230,
    soldeCloture: 245,
    operations: [
      op({ id: "OP-D1", type: TypeOperation.ENTREE, montant: 20 }),
      op({ id: "OP-D2", type: TypeOperation.SORTIE, montant: 5 })
    ]
  });
  const allYearCaisses = [
    closedCaisse({
      id: "CJ-JAN05",
      date: "2026-01-05",
      soldeOuverture: 200,
      soldeCloture: 230,
      operations: [
        op({ id: "OP-Y1", type: TypeOperation.ENTREE, montant: 40 }),
        op({ id: "OP-Y2", type: TypeOperation.SORTIE, montant: 10 })
      ]
    }),
    decemberCaisse
  ];

  const saved = [];
  const caisseRepo = {
    async listByDateRange(dateDebut, dateFin) {
      if (`${dateDebut}->${dateFin}` === "2026-12-01->2026-12-31") {
        return [decemberCaisse];
      }
      if (`${dateDebut}->${dateFin}` === "2026-01-01->2026-12-31") {
        return allYearCaisses;
      }
      throw new Error(`plage inattendue: ${dateDebut}->${dateFin}`);
    },
    async listBeforeDate(dateDebut) {
      assert.equal(dateDebut, "2026-12-01");
      return [{ statutCaisse: StatutCaisse.CLOTUREE, soldeCloture: 210 }];
    }
  };
  const bilanRepo = {
    async getByPeriod(typeBilan, dateDebut, dateFin) {
      if (typeBilan === TypeBilan.ANNUEL && dateDebut === "2025-01-01" && dateFin === "2025-12-31") {
        return { soldeCloture: 190 };
      }
      return null;
    },
    async save(bilan) {
      saved.push({ ...bilan });
    }
  };

  const result = await genererBilansApresCloture({
    caisseCloturee: { date: "2026-12-31", statutCaisse: StatutCaisse.CLOTUREE },
    caisseRepo,
    bilanRepo,
    utilisateur: "audit-system",
    now: new Date("2026-12-31T20:00:00.000Z")
  });

  assert.equal(result.hebdo, null, "aucun bilan hebdo attendu en fin d'annee si ce n'est pas fin de semaine");
  assert.ok(result.mensuel, "bilan mensuel attendu");
  assert.ok(result.annuel, "bilan annuel attendu");
  assert.equal(saved.length, 2, "deux bilans doivent etre sauvegardes");

  assert.equal(result.mensuel.typeBilan, TypeBilan.MENSUEL);
  assert.equal(result.mensuel.soldeOuverture, 210);
  assert.equal(result.mensuel.totalEntrees, 20);
  assert.equal(result.mensuel.totalSorties, 5);
  assert.equal(result.mensuel.soldeCloture, 225);
  assert.equal(result.mensuel.mois, 12);
  assert.equal(result.mensuel.annee, 2026);

  assert.equal(result.annuel.typeBilan, TypeBilan.ANNUEL);
  assert.equal(result.annuel.dateDebut, "2026-01-01");
  assert.equal(result.annuel.dateFin, "2026-12-31");
  assert.equal(result.annuel.soldeOuverture, 190);
  assert.equal(result.annuel.totalEntrees, 60);
  assert.equal(result.annuel.totalSorties, 15);
  assert.equal(result.annuel.soldeCloture, 235);
  assert.equal(result.annuel.annee, 2026);
}

testCalculBilanIgnoreCaissesOuvertesEtOperationsAnnulees();
await testGenerationHebdoEtMensuelleEnFinDeMois();
await testGenerationMensuelleEtAnnuelleEnFinDannee();
console.log("OK: caisse bilans audit");
