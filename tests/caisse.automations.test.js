import assert from "assert";
import { cloturerCaisseAutomatique } from "../src/bc-caisse/application/use-cases/cloturer-caisse-automatique.js";
import { executerAutomationsCaisse } from "../src/bc-caisse/application/services/automations-caisse.js";
import { CaisseJour } from "../src/bc-caisse/domain/caisse-jour.js";
import { StatutCaisse } from "../src/bc-caisse/domain/value-objects.js";

async function testClotureLaDerniereCaisseOuverteJusquauJourCourant() {
  const caisseVeille = new CaisseJour({
    idCaisseJour: "CJ-VEILLE",
    date: "2026-02-14",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 1000
  });

  const repo = {
    saved: null,
    async getByDate(dateJour) {
      assert.equal(dateJour, "2026-02-15");
      return caisseVeille;
    },
    async listBeforeDate() {
      return [];
    },
    async save(caisse) {
      this.saved = caisse;
    }
  };

  const now = new Date("2026-02-15T16:05:00.000Z"); // 17:05 a Kinshasa
  const res = await cloturerCaisseAutomatique({
    caisseRepo: repo,
    utilisateur: "system-auto",
    now
  });

  assert.ok(res);
  assert.equal(res.idCaisseJour, "CJ-VEILLE");
  assert.equal(res.statutCaisse, StatutCaisse.CLOTUREE);
  assert.equal(res.clotureePar, "system-auto");
  assert.ok(repo.saved);
}

async function testNeCloturePasAvant17hKinshasa() {
  const repo = {
    called: false,
    async getByDate() {
      this.called = true;
      return null;
    },
    async listBeforeDate() {
      this.called = true;
      return [];
    },
    async save() {}
  };

  const now = new Date("2026-02-15T15:30:00.000Z"); // 16:30 a Kinshasa
  const res = await cloturerCaisseAutomatique({
    caisseRepo: repo,
    utilisateur: "system-auto",
    now
  });

  assert.equal(res, null);
  assert.equal(repo.called, true);
}

async function testRattrapeCaisseVeilleAvant17hKinshasa() {
  const caisseVeille = new CaisseJour({
    idCaisseJour: "CJ-RETARD",
    date: "2026-02-14",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 200
  });

  const repo = {
    saved: null,
    async getByDate(dateJour) {
      assert.equal(dateJour, "2026-02-15");
      return null;
    },
    async listBeforeDate(dateJour) {
      assert.equal(dateJour, "2026-02-15");
      return [caisseVeille];
    },
    async save(caisse) {
      this.saved = caisse;
    }
  };

  const now = new Date("2026-02-15T10:00:00.000Z"); // 11:00 a Kinshasa
  const res = await cloturerCaisseAutomatique({
    caisseRepo: repo,
    utilisateur: "system-auto",
    now
  });

  assert.ok(res);
  assert.equal(res.idCaisseJour, "CJ-RETARD");
  assert.equal(res.statutCaisse, StatutCaisse.CLOTUREE);
  assert.ok(repo.saved);
}

async function testDesactiveClotureAutoNeFermeRien() {
  const caisseDuJour = new CaisseJour({
    idCaisseJour: "CJ-OPEN",
    date: "2026-02-15",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 100
  });
  const repo = {
    saved: null,
    async getByDate() {
      return caisseDuJour;
    },
    async listBeforeDate() {
      return [];
    },
    async save(caisse) {
      this.saved = caisse;
    }
  };
  const parametresRepo = {
    async getCurrent() {
      return { payload: { caisse: { clotureAutoActive: false } } };
    }
  };

  const now = new Date("2026-02-15T20:00:00.000Z");
  const res = await cloturerCaisseAutomatique({
    caisseRepo: repo,
    parametresRepo,
    utilisateur: "system-auto",
    now
  });

  assert.equal(res, null);
  assert.equal(repo.saved, null);
}

async function testHeureClotureAutoConfigurable() {
  const caisseDuJour = new CaisseJour({
    idCaisseJour: "CJ-CONFIG",
    date: "2026-02-15",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 100
  });
  const repo = {
    saved: null,
    async getByDate() {
      return caisseDuJour;
    },
    async listBeforeDate() {
      return [];
    },
    async save(caisse) {
      this.saved = caisse;
    }
  };
  const parametresRepo = {
    async getCurrent() {
      return { payload: { caisse: { clotureAutoActive: true, heureClotureAuto: "20:30" } } };
    }
  };

  const tooEarly = new Date("2026-02-15T19:00:00.000Z"); // 20:00 Kinshasa
  const resEarly = await cloturerCaisseAutomatique({
    caisseRepo: repo,
    parametresRepo,
    utilisateur: "system-auto",
    now: tooEarly
  });
  assert.equal(resEarly, null);
  assert.equal(repo.saved, null);

  const atTime = new Date("2026-02-15T19:30:00.000Z"); // 20:30 Kinshasa
  const resAtTime = await cloturerCaisseAutomatique({
    caisseRepo: repo,
    parametresRepo,
    utilisateur: "system-auto",
    now: atTime
  });
  assert.ok(resAtTime);
  assert.equal(resAtTime.idCaisseJour, "CJ-CONFIG");
  assert.ok(repo.saved);
}

async function testMinuitNeCloturePasLaCaisseDuJourLeMemeJour() {
  const caisseDuJour = new CaisseJour({
    idCaisseJour: "CJ-MINUIT",
    date: "2026-02-15",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 100
  });
  const repo = {
    saved: null,
    async getByDate() {
      return caisseDuJour;
    },
    async listBeforeDate() {
      return [];
    },
    async save(caisse) {
      this.saved = caisse;
    }
  };
  const parametresRepo = {
    async getCurrent() {
      return { payload: { caisse: { clotureAutoActive: true, heureClotureAuto: "00:00" } } };
    }
  };

  const now = new Date("2026-02-15T06:30:00.000Z"); // 07:30 Kinshasa
  const res = await cloturerCaisseAutomatique({
    caisseRepo: repo,
    parametresRepo,
    utilisateur: "system-auto",
    now
  });

  assert.equal(res, null, "une cloture a minuit ne doit pas fermer la caisse du jour le matin");
  assert.equal(repo.saved, null, "aucune sauvegarde de cloture n'est attendue");
}

async function testLeSchedulerNeCloturePasUneCaisseOuverteDansLeMemeCycle() {
  const saved = [];
  let currentDay = null;
  const repo = {
    async getByDate(dateJour) {
      assert.equal(dateJour, "2026-05-25");
      return currentDay;
    },
    async getLatestBeforeDate(dateJour) {
      assert.equal(dateJour, "2026-05-25");
      return {
        idCaisseJour: "CJ-OLD",
        date: "2026-05-24",
        statutCaisse: StatutCaisse.CLOTUREE,
        soldeCloture: 120
      };
    },
    async listBeforeDate(dateJour) {
      assert.equal(dateJour, "2026-05-25");
      return [];
    },
    async save(caisse) {
      currentDay = caisse;
      saved.push(caisse);
    }
  };
  const parametresRepo = {
    async getCurrent() {
      return {
        payload: {
          caisse: {
            ouvertureAuto: "07:30",
            clotureAutoActive: true,
            heureClotureAuto: "07:30"
          }
        }
      };
    }
  };
  const bilanRepo = {
    async getByTypeAndRange() {
      return null;
    },
    async save() {}
  };

  await executerAutomationsCaisse({
    atelierId: "ATELIER",
    caisseRepo: repo,
    bilanRepo,
    parametresRepo,
    utilisateur: "system-auto",
    now: new Date("2026-05-25T06:30:00.000Z")
  });

  assert.equal(saved.length, 1, "une seule sauvegarde d'ouverture est attendue");
  assert.ok(currentDay, "la caisse du jour doit exister");
  assert.equal(currentDay.statutCaisse, StatutCaisse.OUVERTE, "la caisse ne doit pas etre cloturee dans le meme cycle");
}

await testClotureLaDerniereCaisseOuverteJusquauJourCourant();
await testNeCloturePasAvant17hKinshasa();
await testRattrapeCaisseVeilleAvant17hKinshasa();
await testDesactiveClotureAutoNeFermeRien();
await testHeureClotureAutoConfigurable();
await testMinuitNeCloturePasLaCaisseDuJourLeMemeJour();
await testLeSchedulerNeCloturePasUneCaisseOuverteDansLeMemeCycle();
console.log("OK: caisse automations");
