import assert from "assert";
import { CaisseJour } from "../src/bc-caisse/domain/caisse-jour.js";
import { ActiviteCaisse, StatutCaisse } from "../src/bc-caisse/domain/value-objects.js";
import { ActiviteCaisseInvalide, JustificationObligatoire, SoldeJournalierInsuffisant } from "../src/bc-caisse/domain/errors.js";
import { enregistrerEntreeManuelle } from "../src/bc-caisse/application/use-cases/enregistrer-entree-manuelle.js";
import { IdempotencyConflict } from "../src/bc-caisse/application/services/idempotency.js";

function run() {
  const c = new CaisseJour({
    idCaisseJour: "2026-02-10",
    date: "2026-02-10",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 100
  });

  c.enregistrerEntree({
    idOperation: "OP-1",
    montant: 50,
    modePaiement: "CASH",
    motif: "PAIEMENT_COMMANDE",
    referenceMetier: "CMD-1",
    utilisateur: "user1"
  });

  c.enregistrerSortie({
    idOperation: "OP-2",
    montant: 20,
    motif: "DEPENSE_ATELIER",
    utilisateur: "user1",
    typeDepense: "QUOTIDIENNE"
  });

  assert.equal(c.soldeCourant(), 130);
  assert.equal(c.operations[0].activite, ActiviteCaisse.ATELIER);
  assert.equal(c.operations[1].activite, ActiviteCaisse.ATELIER);

  c.annulerOperation({
    idOperation: "OP-2",
    motifAnnulation: "erreur",
    utilisateur: "user1"
  });

  assert.equal(c.soldeCourant(), 150);

  c.cloturerCaisse({ utilisateur: "user1" });
  assert.equal(c.statutCaisse, StatutCaisse.CLOTUREE);

  const totals = c.totauxJour();
  assert.equal(totals.totalEntrees, 50);
  assert.equal(totals.totalSortiesQuotidiennes, 0);
  assert.equal(totals.resultatJournalier, 50);
}

function testSortieQuotidienneRefuseSiResultatJournalierInsuffisant() {
  const c = new CaisseJour({
    idCaisseJour: "2026-02-11",
    date: "2026-02-11",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 100
  });

  assert.throws(
    () =>
      c.enregistrerSortie({
        idOperation: "OP-Q1",
        montant: 10,
        motif: "DEPENSE_ATELIER",
        utilisateur: "user1",
        typeDepense: "QUOTIDIENNE"
      }),
    SoldeJournalierInsuffisant
  );
}

function testSortieExceptionnelleExigeJustificationEtNimpactePasLeResultatJournalier() {
  const c = new CaisseJour({
    idCaisseJour: "2026-02-12",
    date: "2026-02-12",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 200
  });

  c.enregistrerEntree({
    idOperation: "OP-E1",
    montant: 40,
    modePaiement: "CASH",
    motif: "PAIEMENT_COMMANDE",
    referenceMetier: "CMD-2",
    utilisateur: "user1"
  });

  assert.throws(
    () =>
      c.enregistrerSortie({
        idOperation: "OP-E2",
        montant: 30,
        motif: "DEPENSE_ATELIER",
        utilisateur: "user1",
        typeDepense: "EXCEPTIONNELLE",
        role: "ADMIN",
        rolesAutorises: []
      }),
    JustificationObligatoire
  );

  c.enregistrerSortie({
    idOperation: "OP-E3",
    montant: 30,
    motif: "DEPENSE_ATELIER",
    utilisateur: "user1",
    typeDepense: "EXCEPTIONNELLE",
    justification: "Achat machine",
    role: "ADMIN",
    rolesAutorises: []
  });

  const totals = c.totauxJour();
  assert.equal(totals.totalEntrees, 40);
  assert.equal(totals.totalSortiesQuotidiennes, 0);
  assert.equal(totals.resultatJournalier, 40);
  assert.equal(c.soldeCourant(), 210);
}

function testActiviteCaisseAccepteSeulementAtelierOuStock() {
  const c = new CaisseJour({
    idCaisseJour: "2026-02-14",
    date: "2026-02-14",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 100
  });

  c.enregistrerEntree({
    idOperation: "OP-A1",
    montant: 10,
    modePaiement: "CASH",
    motif: "VENTE_STOCK",
    referenceMetier: "V-1",
    utilisateur: "user1",
    activite: "STOCK"
  });
  assert.equal(c.operations[0].activite, ActiviteCaisse.STOCK);

  assert.throws(
    () =>
      c.enregistrerSortie({
        idOperation: "OP-A2",
        montant: 10,
        motif: "DEPENSE",
        utilisateur: "user1",
        typeDepense: "QUOTIDIENNE",
        activite: "AUTRE"
      }),
    ActiviteCaisseInvalide
  );
}

async function testEntreeManuelleExigeJustificationEtResteUneEntreeStandard() {
  const c = new CaisseJour({
    idCaisseJour: "2026-02-13",
    date: "2026-02-13",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 300
  });

  const repo = {
    saved: null,
    async getById(id) {
      assert.equal(id, "2026-02-13");
      return c;
    },
    async save(caisse) {
      this.saved = caisse;
    }
  };

  await assert.rejects(
    () =>
      enregistrerEntreeManuelle({
        idCaisseJour: "2026-02-13",
        input: {
          idOperation: "OP-M0",
          montant: 25,
          modePaiement: "CASH",
          utilisateur: "user1",
          justification: ""
        },
        caisseRepo: repo
      }),
    /Justification obligatoire/
  );

  const result = await enregistrerEntreeManuelle({
    idCaisseJour: "2026-02-13",
    input: {
      idOperation: "OP-M1",
      montant: 25,
        modePaiement: "CASH",
        utilisateur: "user1",
        justification: "Contribution stagiaire",
        activite: "STOCK"
      },
      caisseRepo: repo
  });

  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0].typeOperation, "ENTREE");
  assert.equal(result.operations[0].motif, "ENTREE_MANUELLE");
  assert.equal(result.operations[0].justification, "Contribution stagiaire");
  assert.equal(result.operations[0].activite, ActiviteCaisse.STOCK);
  assert.equal(result.soldeCourant(), 325);
  assert.equal(repo.saved, c);
}

async function testEntreeManuelleRefuseCaissePasseeQuandControleJourActif() {
  const c = new CaisseJour({
    idCaisseJour: "2026-02-13",
    date: "2026-02-13",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 300
  });
  const repo = {
    async getById() {
      return c;
    },
    async save() {
      throw new Error("save ne doit pas etre appele");
    }
  };

  await assert.rejects(
    () =>
      enregistrerEntreeManuelle({
        idCaisseJour: "2026-02-13",
        input: {
          idOperation: "OP-OLD",
          montant: 25,
          modePaiement: "CASH",
          utilisateur: "user1",
          justification: "Correction interdite"
        },
        caisseRepo: repo,
        enforceDateDuJour: true,
        now: new Date("2026-02-14T08:00:00.000Z")
      }),
    /seule la caisse du jour/
  );
}

async function testEntreeManuelleIdempotenteAvecMemeCle() {
  const c = new CaisseJour({
    idCaisseJour: "2026-02-15",
    date: "2026-02-15",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 300
  });
  let saveCount = 0;
  const repo = {
    async getById() {
      return c;
    },
    async save(caisse) {
      saveCount += 1;
      this.saved = caisse;
    }
  };

  const input = {
    idOperation: "OP-IDEM-1",
    montant: 25,
    modePaiement: "CASH",
    utilisateur: "user1",
    justification: "Contribution",
    idempotencyKey: "idem-caisse-1"
  };

  await enregistrerEntreeManuelle({ idCaisseJour: "2026-02-15", input, caisseRepo: repo });
  await enregistrerEntreeManuelle({
    idCaisseJour: "2026-02-15",
    input: { ...input, idOperation: "OP-IDEM-2" },
    caisseRepo: repo
  });

  assert.equal(c.operations.length, 1);
  assert.equal(c.operations[0].idOperation, "OP-IDEM-1");
  assert.equal(c.operations[0].idempotencyKey, "idem-caisse-1");
  assert.equal(c.soldeCourant(), 325);
  assert.equal(saveCount, 1);
}

async function testEntreeManuelleRefuseMemeClePayloadDifferent() {
  const c = new CaisseJour({
    idCaisseJour: "2026-02-16",
    date: "2026-02-16",
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 300
  });
  const repo = {
    async getById() {
      return c;
    },
    async save() {}
  };

  await enregistrerEntreeManuelle({
    idCaisseJour: "2026-02-16",
    input: {
      idOperation: "OP-CONFLICT-1",
      montant: 25,
      modePaiement: "CASH",
      utilisateur: "user1",
      justification: "Contribution",
      idempotencyKey: "idem-caisse-conflict"
    },
    caisseRepo: repo
  });

  await assert.rejects(
    () =>
      enregistrerEntreeManuelle({
        idCaisseJour: "2026-02-16",
        input: {
          idOperation: "OP-CONFLICT-2",
          montant: 30,
          modePaiement: "CASH",
          utilisateur: "user1",
          justification: "Contribution",
          idempotencyKey: "idem-caisse-conflict"
        },
        caisseRepo: repo
      }),
    IdempotencyConflict
  );
  assert.equal(c.operations.length, 1);
}

run();
testSortieQuotidienneRefuseSiResultatJournalierInsuffisant();
testSortieExceptionnelleExigeJustificationEtNimpactePasLeResultatJournalier();
testActiviteCaisseAccepteSeulementAtelierOuStock();
await testEntreeManuelleExigeJustificationEtResteUneEntreeStandard();
await testEntreeManuelleRefuseCaissePasseeQuandControleJourActif();
await testEntreeManuelleIdempotenteAvecMemeCle();
await testEntreeManuelleRefuseMemeClePayloadDifferent();
console.log("OK: caisse use cases");
