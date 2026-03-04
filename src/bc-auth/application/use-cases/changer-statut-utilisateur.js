import { ACCOUNT_STATES, normalizeAccountState } from "../../domain/account-state.js";

export async function changerStatutUtilisateur({ utilisateurRepo, id, etatCompte }) {
  const user = await utilisateurRepo.getById(id);
  if (!user) throw new Error("Utilisateur introuvable");

  const nextState = normalizeAccountState(etatCompte);
  if (![ACCOUNT_STATES.ACTIVE, ACCOUNT_STATES.SUSPENDED, ACCOUNT_STATES.DISABLED].includes(nextState)) {
    throw new Error("Etat de compte invalide");
  }

  const currentState = normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
  const tokenVersion = nextState === currentState ? Number(user.tokenVersion || 1) : Number(user.tokenVersion || 1) + 1;

  return utilisateurRepo.save({
    ...user,
    etatCompte: nextState,
    actif: nextState === ACCOUNT_STATES.ACTIVE,
    tokenVersion
  });
}
