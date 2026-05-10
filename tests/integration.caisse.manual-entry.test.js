import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";
import { Utilisateur } from "../src/bc-auth/domain/utilisateur.js";
import { ROLES } from "../src/bc-auth/domain/roles.js";
import { ACCOUNT_STATES } from "../src/bc-auth/domain/account-state.js";
import { hashPassword } from "../src/bc-auth/infrastructure/security/password-hasher.js";
import { UtilisateurRepoPg } from "../src/bc-auth/infrastructure/repositories/utilisateur-repo-pg.js";
import { RolePermissionAtelierRepoPg } from "../src/bc-auth/infrastructure/repositories/role-permission-atelier-repo-pg.js";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/bc-auth/domain/default-role-permissions.js";
import { CaisseRepoPg } from "../src/bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { CaisseJour } from "../src/bc-caisse/domain/caisse-jour.js";
import { StatutCaisse } from "../src/bc-caisse/domain/value-objects.js";

async function createUser({ utilisateurRepo, rolePermissionRepo, roleId, suffix }) {
  await rolePermissionRepo.save({
    atelierId: "ATELIER",
    role: roleId,
    permissions: DEFAULT_ROLE_PERMISSIONS[roleId] || [],
    updatedBy: "integration-test"
  });

  const password = "Passw0rd!123";
  const email = `${suffix}.${Date.now()}@atelier.local`;
  const user = new Utilisateur({
    id: randomUUID(),
    nom: `${roleId} Test`,
    email,
    roleId,
    actif: true,
    etatCompte: ACCOUNT_STATES.ACTIVE,
    atelierId: "ATELIER",
    motDePasseHash: hashPassword(password)
  });
  await utilisateurRepo.save(user);

  return { user, email, password };
}

async function login(client, email, motDePasse) {
  const response = await client.post("/api/auth/login").send({ email, motDePasse });
  assert.equal(response.status, 200);
  return String(response.body?.token || "");
}

async function run() {
  const app = createApp();
  const client = request(app);
  const utilisateurRepo = new UtilisateurRepoPg();
  const rolePermissionRepo = new RolePermissionAtelierRepoPg();
  const caisseRepo = new CaisseRepoPg().forAtelier("ATELIER");

  const seed = Date.now();
  const testDate = `2099-${String((seed % 12) + 1).padStart(2, "0")}-${String((Math.floor(seed / 12) % 28) + 1).padStart(2, "0")}`;
  const caisse = new CaisseJour({
    idCaisseJour: `CJ-MANUAL-${Date.now()}`,
    date: testDate,
    statutCaisse: StatutCaisse.OUVERTE,
    soldeOuverture: 100
  });
  await caisseRepo.save(caisse);

  const owner = await createUser({ utilisateurRepo, rolePermissionRepo, roleId: ROLES.PROPRIETAIRE, suffix: "owner.manual.caisse" });
  const cashier = await createUser({ utilisateurRepo, rolePermissionRepo, roleId: ROLES.CAISSIER, suffix: "cashier.manual.caisse" });
  const tailor = await createUser({ utilisateurRepo, rolePermissionRepo, roleId: ROLES.COUTURIER, suffix: "tailor.manual.caisse" });

  const ownerToken = await login(client, owner.email, owner.password);
  const cashierToken = await login(client, cashier.email, cashier.password);
  const tailorToken = await login(client, tailor.email, tailor.password);

  const ownerEntry = await client
    .post(`/api/caisse/${encodeURIComponent(caisse.idCaisseJour)}/entrees/manuelles`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ montant: 50, justification: "Contribution formation" });
  assert.equal(ownerEntry.status, 200);
  assert.equal(ownerEntry.body?.totauxParSource?.totalEntreesManuelles, 50);
  assert.equal(ownerEntry.body?.operations?.some((op) => op.motif === "ENTREE_MANUELLE" && op.sourceFlux === "MANUEL"), true);

  const cashierEntry = await client
    .post(`/api/caisse/${encodeURIComponent(caisse.idCaisseJour)}/entrees/manuelles`)
    .set("Authorization", `Bearer ${cashierToken}`)
    .send({ montant: 25, justification: "Paiement stagiaire" });
  assert.equal(cashierEntry.status, 200);
  assert.equal(cashierEntry.body?.totauxParSource?.totalEntreesManuelles, 75);

  const tailorEntry = await client
    .post(`/api/caisse/${encodeURIComponent(caisse.idCaisseJour)}/entrees/manuelles`)
    .set("Authorization", `Bearer ${tailorToken}`)
    .send({ montant: 15, justification: "Ne doit pas passer" });
  assert.equal(tailorEntry.status, 403);
  assert.equal(tailorEntry.body?.error || tailorEntry.body?.message, "Acces non autorise");
}

run()
  .then(() => {
    console.log("OK: integration caisse manual entry");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
