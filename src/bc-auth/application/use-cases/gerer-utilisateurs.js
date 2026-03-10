import { randomUUID } from "node:crypto";
import { Utilisateur } from "../../domain/utilisateur.js";
import { hashPassword } from "../../infrastructure/security/password-hasher.js";
import { validatePasswordPolicy } from "../../domain/password-policy.js";

export async function gererUtilisateurs({ utilisateurRepo, input }) {
  if (input.action === "list") {
    if (input.atelierId) return utilisateurRepo.listByAtelier(input.atelierId);
    return utilisateurRepo.list();
  }

  if (input.action === "create") {
    const email = String(input.email || "").trim().toLowerCase();
    const exists = await utilisateurRepo.findByEmail(email);
    if (exists) throw new Error("Email deja utilise");
    validatePasswordPolicy(input.motDePasse);
    const user = new Utilisateur({
      id: randomUUID(),
      nom: input.nom,
      email,
      roleId: input.roleId,
      atelierId: input.atelierId || "ATELIER",
      actif: true,
      motDePasseHash: hashPassword(input.motDePasse)
    });
    if (input.actif === false) user.desactiver();
    else user.activer();
    return utilisateurRepo.save(user);
  }

  if (input.action === "update") {
    const current = await utilisateurRepo.getById(input.id);
    if (!current) throw new Error("Utilisateur introuvable");
    const next = {
      ...current,
      nom: input.nom ?? current.nom,
      roleId: input.roleId ?? current.roleId,
      atelierId: current.atelierId || "ATELIER"
    };
    Object.setPrototypeOf(next, Utilisateur.prototype);
    if (input.actif === true) next.activer();
    if (input.actif === false) next.desactiver();
    return utilisateurRepo.save(next);
  }

  throw new Error("Action utilisateur invalide");
}
