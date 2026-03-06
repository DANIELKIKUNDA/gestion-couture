import { ACCOUNT_STATES, normalizeAccountState } from "../../domain/account-state.js";
import { Utilisateur } from "../../domain/utilisateur.js";

export async function changerStatutUtilisateur({ utilisateurRepo, id, etatCompte }) {
  const user = await utilisateurRepo.getById(id);
  if (!user) throw new Error("Utilisateur introuvable");

  const nextState = normalizeAccountState(etatCompte);
  if (![ACCOUNT_STATES.ACTIVE, ACCOUNT_STATES.SUSPENDED, ACCOUNT_STATES.DISABLED].includes(nextState)) {
    throw new Error("Etat de compte invalide");
  }

  const currentState = normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
  const tokenVersion = nextState === currentState ? Number(user.tokenVersion || 1) : Number(user.tokenVersion || 1) + 1;

  const nextUser = { ...user, etatCompte: nextState, tokenVersion };
  Object.setPrototypeOf(nextUser, Utilisateur.prototype);
  if (nextState === ACCOUNT_STATES.ACTIVE) nextUser.activer();
  else nextUser.desactiver();

  return utilisateurRepo.save(nextUser);
}
