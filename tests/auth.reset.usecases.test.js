import assert from "node:assert/strict";

import { reinitialiserMotDePasse } from "../src/bc-auth/application/use-cases/reinitialiser-mot-de-passe.js";
import { hashPassword, verifyPassword } from "../src/bc-auth/infrastructure/security/password-hasher.js";

async function testResetMetAJourHashEtTokenVersion() {
  const user = {
    id: "USR-1",
    motDePasseHash: hashPassword("OldPass1!"),
    tokenVersion: 2
  };

  let savedUser = null;
  let usedToken = null;
  const utilisateurRepo = {
    async getById(id) {
      assert.equal(id, "USR-1");
      return user;
    },
    async save(next) {
      savedUser = { ...next };
    }
  };
  const resetTokenRepo = {
    async findValid(token) {
      assert.equal(token, "reset-ok");
      return { utilisateurId: "USR-1" };
    },
    async markUsed(token) {
      usedToken = token;
    }
  };

  const result = await reinitialiserMotDePasse({
    utilisateurRepo,
    resetTokenRepo,
    token: "reset-ok",
    nouveauMotDePasse: "NewPass1!"
  });

  assert.equal(result, true);
  assert.equal(verifyPassword("NewPass1!", user.motDePasseHash), true, "nouveau mot de passe doit etre persiste");
  assert.equal(verifyPassword("OldPass1!", user.motDePasseHash), false, "ancien mot de passe ne doit plus matcher");
  assert.equal(user.tokenVersion, 3, "tokenVersion doit etre incremente");
  assert.equal(savedUser?.tokenVersion, 3, "utilisateur sauvegarde doit refleter le nouveau tokenVersion");
  assert.equal(usedToken, "reset-ok", "token doit etre marque utilise");
}

async function testResetRefuseTokenInvalide() {
  let saveCalled = false;
  let markUsedCalled = false;
  const utilisateurRepo = {
    async getById() {
      throw new Error("getById ne doit pas etre appele");
    },
    async save() {
      saveCalled = true;
    }
  };
  const resetTokenRepo = {
    async findValid(token) {
      assert.equal(token, "reset-ko");
      return null;
    },
    async markUsed() {
      markUsedCalled = true;
    }
  };

  await assert.rejects(
    () =>
      reinitialiserMotDePasse({
        utilisateurRepo,
        resetTokenRepo,
        token: "reset-ko",
        nouveauMotDePasse: "NewPass1!"
      }),
    /Token invalide ou expire/
  );

  assert.equal(saveCalled, false, "aucune sauvegarde utilisateur attendue");
  assert.equal(markUsedCalled, false, "aucun token ne doit etre marque utilise");
}

async function testResetRefuseMotDePasseFaible() {
  const originalHash = hashPassword("OldPass1!");
  const user = {
    id: "USR-2",
    motDePasseHash: originalHash,
    tokenVersion: 1
  };

  let saveCalled = false;
  let markUsedCalled = false;
  const utilisateurRepo = {
    async getById(id) {
      assert.equal(id, "USR-2");
      return user;
    },
    async save() {
      saveCalled = true;
    }
  };
  const resetTokenRepo = {
    async findValid(token) {
      assert.equal(token, "reset-weak");
      return { utilisateurId: "USR-2" };
    },
    async markUsed() {
      markUsedCalled = true;
    }
  };

  await assert.rejects(
    () =>
      reinitialiserMotDePasse({
        utilisateurRepo,
        resetTokenRepo,
        token: "reset-weak",
        nouveauMotDePasse: "weak"
      }),
    /Mot de passe trop court/
  );

  assert.equal(saveCalled, false, "mot de passe faible ne doit pas sauvegarder l'utilisateur");
  assert.equal(markUsedCalled, false, "mot de passe faible ne doit pas consommer le token");
  assert.equal(user.motDePasseHash, originalHash, "hash utilisateur ne doit pas changer");
  assert.equal(user.tokenVersion, 1, "tokenVersion ne doit pas changer");
}

await testResetMetAJourHashEtTokenVersion();
await testResetRefuseTokenInvalide();
await testResetRefuseMotDePasseFaible();
console.log("OK: auth reset use cases");
