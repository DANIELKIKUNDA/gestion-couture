import assert from "assert";
import { cloturerCaisseAutomatique } from "../src/bc-caisse/application/use-cases/cloturer-caisse-automatique.js";
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

await testClotureLaDerniereCaisseOuverteJusquauJourCourant();
await testNeCloturePasAvant17hKinshasa();
await testRattrapeCaisseVeilleAvant17hKinshasa();
console.log("OK: caisse automations");
