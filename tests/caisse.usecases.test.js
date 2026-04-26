import assert from "assert";
import { CaisseJour } from "../src/bc-caisse/domain/caisse-jour.js";
import { StatutCaisse } from "../src/bc-caisse/domain/value-objects.js";
import { JustificationObligatoire, SoldeJournalierInsuffisant } from "../src/bc-caisse/domain/errors.js";
import { enregistrerEntreeManuelle } from "../src/bc-caisse/application/use-cases/enregistrer-entree-manuelle.js";

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
      justification: "Contribution stagiaire"
    },
    caisseRepo: repo
  });

  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0].typeOperation, "ENTREE");
  assert.equal(result.operations[0].motif, "ENTREE_MANUELLE");
  assert.equal(result.operations[0].justification, "Contribution stagiaire");
  assert.equal(result.soldeCourant(), 325);
  assert.equal(repo.saved, c);
}

run();
testSortieQuotidienneRefuseSiResultatJournalierInsuffisant();
testSortieExceptionnelleExigeJustificationEtNimpactePasLeResultatJournalier();
await testEntreeManuelleExigeJustificationEtResteUneEntreeStandard();
console.log("OK: caisse use cases");
