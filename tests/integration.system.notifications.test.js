import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";
import { Utilisateur } from "../src/bc-auth/domain/utilisateur.js";
import { ROLES } from "../src/bc-auth/domain/roles.js";
import { ACCOUNT_STATES } from "../src/bc-auth/domain/account-state.js";
import { PERMISSIONS } from "../src/bc-auth/domain/permissions.js";
import { hashPassword } from "../src/bc-auth/infrastructure/security/password-hasher.js";
import { UtilisateurRepoPg } from "../src/bc-auth/infrastructure/repositories/utilisateur-repo-pg.js";
import { RolePermissionAtelierRepoPg } from "../src/bc-auth/infrastructure/repositories/role-permission-atelier-repo-pg.js";
import { ensureAtelier, withAuth } from "./helpers/integration-fixtures.js";

async function run() {
  const app = createApp();
  const client = request(app);
  const utilisateurRepo = new UtilisateurRepoPg();
  const rolePermissionRepo = new RolePermissionAtelierRepoPg();

  await ensureAtelier("SYSTEME", "systeme-interne", "Administration systeme");
  await rolePermissionRepo.save({
    atelierId: "SYSTEME",
    role: ROLES.MANAGER_SYSTEME,
    permissions: [PERMISSIONS.GERER_ATELIERS],
    updatedBy: "integration-test"
  });

  const managerEmail = `manager.system.notifications.${Date.now()}@atelier.local`;
  const managerPassword = "Passw0rd!SystemNotif";
  await utilisateurRepo.save(
    new Utilisateur({
      id: randomUUID(),
      nom: "Manager Systeme Notifications",
      email: managerEmail,
      roleId: ROLES.MANAGER_SYSTEME,
      actif: true,
      etatCompte: ACCOUNT_STATES.ACTIVE,
      atelierId: "SYSTEME",
      motDePasseHash: hashPassword(managerPassword)
    })
  );

  const managerLogin = await client.post("/api/auth/login").send({
    email: managerEmail,
    motDePasse: managerPassword
  });
  assert.equal(managerLogin.status, 200);
  const managerToken = String(managerLogin.body?.token || "");
  assert.ok(managerToken);

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const ownerEmail = `owner.notifications.${suffix}@atelier.local`;
  const ownerTelephone = "+243810001111";
  const atelierCreate = await withAuth(client.post("/api/system/ateliers"), managerToken).send({
    nomAtelier: "Atelier Notifications",
    slug: `atelier-notif-${suffix}`,
    proprietaire: {
      nom: "Owner Notifications",
      email: ownerEmail,
      telephone: ownerTelephone,
      motDePasse: "Passw0rd!OwnerNotif"
    }
  });
  assert.equal(atelierCreate.status, 201);
  const atelierId = String(atelierCreate.body?.atelier?.idAtelier || "");
  assert.ok(atelierId);

  const contacts = await withAuth(client.get("/api/system/ateliers/contacts"), managerToken);
  assert.equal(contacts.status, 200);
  assert.equal(Array.isArray(contacts.body?.items), true);
  assert.equal(contacts.body.items.some((row) => row.idAtelier === atelierId), true);

  const globalNotif = await withAuth(client.post("/api/system/notifications"), managerToken).send({
    portee: "GLOBAL",
    titre: "Maintenance",
    message: "Maintenance plateforme ce soir."
  });
  assert.equal(globalNotif.status, 201);

  const atelierNotif = await withAuth(client.post("/api/system/notifications"), managerToken).send({
    portee: "ATELIER",
    atelierId,
    titre: "Contact atelier",
    message: "Merci de verifier votre fiche contact."
  });
  assert.equal(atelierNotif.status, 201);

  const notifications = await withAuth(client.get("/api/system/notifications"), managerToken);
  assert.equal(notifications.status, 200);
  assert.equal(Array.isArray(notifications.body?.items), true);
  assert.equal(
    notifications.body.items.some((row) => row.portee === "GLOBAL" && row.titre === "Maintenance"),
    true
  );
  assert.equal(
    notifications.body.items.some((row) => row.portee === "ATELIER" && row.atelierId === atelierId),
    true
  );
}

run()
  .then(() => {
    console.log("OK: integration system notifications");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
