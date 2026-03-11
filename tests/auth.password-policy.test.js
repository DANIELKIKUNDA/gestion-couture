import assert from "node:assert/strict";

import { validatePasswordPolicy } from "../src/bc-auth/domain/password-policy.js";

function assertThrows(fn, fragment) {
  assert.throws(fn, (err) => {
    assert.equal(String(err?.message || "").toLowerCase().includes(fragment.toLowerCase()), true);
    return true;
  });
}

function run() {
  assert.equal(validatePasswordPolicy("Passw0rd!"), true, "mot de passe valide attendu");
  assert.equal(validatePasswordPolicy("Atelier#2026"), true, "mot de passe valide avec autre special attendu");

  assertThrows(() => validatePasswordPolicy("Aa1!abc"), "trop court");
  assertThrows(() => validatePasswordPolicy("passw0rd!"), "majuscule");
  assertThrows(() => validatePasswordPolicy("PASSW0RD!"), "minuscule");
  assertThrows(() => validatePasswordPolicy("Password!"), "chiffre");
  assertThrows(() => validatePasswordPolicy("Password1"), "caract");
}

run();
console.log("OK: auth password policy");
