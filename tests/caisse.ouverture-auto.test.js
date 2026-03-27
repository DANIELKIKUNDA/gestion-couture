import assert from "node:assert/strict";

import { ouvrirCaisseAutomatique } from "../src/bc-caisse/application/use-cases/ouvrir-caisse-automatique.js";
import { CaisseJour } from "../src/bc-caisse/domain/caisse-jour.js";
import { StatutCaisse } from "../src/bc-caisse/domain/value-objects.js";

async function testOuvreApresHeureConfigureeEtReporteLeSoldePrecedent() {
  let saved = null;
  const repo = {
    async getByDate(dateJour) {
      assert.equal(dateJour, "2026-05-25");
      return null;
    },
    async getLatestBeforeDate(dateJour) {
      assert.equal(dateJour, "2026-05-25");
      return {
        idCaisseJour: "CJ-OLD",
        date: "2026-05-24",
        statutCaisse: StatutCaisse.CLOTUREE,
        soldeCloture: 175
      };
    },
    async save(caisse) {
      saved = caisse;
    }
  };
  const parametresRepo = {
    async getCurrent() {
      return {
        payload: {
          caisse: {
            ouvertureAuto: "07:30",
            ouvertureDimanche: "09:00"
          }
        }
      };
    }
  };

  const opened = await ouvrirCaisseAutomatique({
    caisseRepo: repo,
    parametresRepo,
    utilisateur: "system-auto",
    now: new Date("2026-05-25T06:35:00.000Z")
  });

  assert.ok(opened, "une caisse doit etre ouverte apres l'heure configuree");
  assert.equal(opened.date, "2026-05-25");
  assert.equal(opened.statutCaisse, StatutCaisse.OUVERTE);
  assert.equal(opened.soldeOuverture, 175, "le solde cloture precedent doit etre reporte");
  assert.equal(opened.ouvertePar, "system-auto");
  assert.equal(opened.ouvertureAnticipee, false);
  assert.equal(saved, opened, "la caisse ouverte doit etre sauvegardee");
}

async function testNouverturePasAvantHeureDuDimanche() {
  let latestBeforeCalled = false;
  let saveCalled = false;
  const repo = {
    async getByDate(dateJour) {
      assert.equal(dateJour, "2026-05-31");
      return null;
    },
    async getLatestBeforeDate() {
      latestBeforeCalled = true;
      return null;
    },
    async save() {
      saveCalled = true;
    }
  };
  const parametresRepo = {
    async getCurrent() {
      return {
        payload: {
          caisse: {
            ouvertureAuto: "07:30",
            ouvertureDimanche: "09:00"
          }
        }
      };
    }
  };

  const opened = await ouvrirCaisseAutomatique({
    caisseRepo: repo,
    parametresRepo,
    utilisateur: "system-auto",
    now: new Date("2026-05-31T07:30:00.000Z")
  });

  assert.equal(opened, null, "aucune ouverture attendue avant l'heure du dimanche");
  assert.equal(latestBeforeCalled, false, "la verification du precedent ne doit pas avoir lieu avant l'heure");
  assert.equal(saveCalled, false, "aucune sauvegarde attendue");
}

async function testNouverturePasSiCaisseDuJourExiste() {
  let latestBeforeCalled = false;
  let saveCalled = false;
  const repo = {
    async getByDate(dateJour) {
      assert.equal(dateJour, "2026-05-26");
      return new CaisseJour({
        idCaisseJour: "CJ-DAY",
        date: "2026-05-26",
        statutCaisse: StatutCaisse.OUVERTE,
        soldeOuverture: 100
      });
    },
    async getLatestBeforeDate() {
      latestBeforeCalled = true;
      return null;
    },
    async save() {
      saveCalled = true;
    }
  };

  const opened = await ouvrirCaisseAutomatique({
    caisseRepo: repo,
    utilisateur: "system-auto",
    now: new Date("2026-05-26T08:00:00.000Z")
  });

  assert.equal(opened, null, "aucune ouverture attendue si la caisse du jour existe deja");
  assert.equal(latestBeforeCalled, false, "aucune recherche de precedente attendue");
  assert.equal(saveCalled, false, "aucune sauvegarde attendue");
}

async function testNouverturePasSiPrecedenteNonCloturee() {
  let saveCalled = false;
  const repo = {
    async getByDate(dateJour) {
      assert.equal(dateJour, "2026-05-27");
      return null;
    },
    async getLatestBeforeDate(dateJour) {
      assert.equal(dateJour, "2026-05-27");
      return {
        idCaisseJour: "CJ-PREV",
        date: "2026-05-26",
        statutCaisse: StatutCaisse.OUVERTE,
        soldeCloture: null
      };
    },
    async save() {
      saveCalled = true;
    }
  };

  const opened = await ouvrirCaisseAutomatique({
    caisseRepo: repo,
    utilisateur: "system-auto",
    now: new Date("2026-05-27T07:00:00.000Z")
  });

  assert.equal(opened, null, "aucune ouverture attendue si la precedente n'est pas cloturee");
  assert.equal(saveCalled, false, "aucune sauvegarde attendue");
}

async function testPremiereCaisseResteManuelle() {
  let saveCalled = false;
  let latestBeforeCalled = false;
  const repo = {
    async getByDate(dateJour) {
      assert.equal(dateJour, "2026-05-28");
      return null;
    },
    async getLatestBeforeDate(dateJour) {
      assert.equal(dateJour, "2026-05-28");
      latestBeforeCalled = true;
      return null;
    },
    async save() {
      saveCalled = true;
    }
  };

  const opened = await ouvrirCaisseAutomatique({
    caisseRepo: repo,
    utilisateur: "system-auto",
    now: new Date("2026-05-28T07:00:00.000Z")
  });

  assert.equal(opened, null, "la premiere caisse doit rester manuelle");
  assert.equal(latestBeforeCalled, true, "la verification de precedente doit bien etre faite");
  assert.equal(saveCalled, false, "aucune sauvegarde automatique n'est attendue");
}

await testOuvreApresHeureConfigureeEtReporteLeSoldePrecedent();
await testNouverturePasAvantHeureDuDimanche();
await testNouverturePasSiCaisseDuJourExiste();
await testNouverturePasSiPrecedenteNonCloturee();
await testPremiereCaisseResteManuelle();
console.log("OK: caisse ouverture auto");
