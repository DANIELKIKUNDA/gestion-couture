import { TIMEZONE_KINSHASA } from "../../domain/horloge-kinshasa.js";
import { cloturerCaisseAutomatique } from "../use-cases/cloturer-caisse-automatique.js";
import { creerBilanHebdoSiFinSemaine, creerBilanMensuelSiFinMois } from "../use-cases/creer-bilan-caisse.js";

export async function executerAutomationsCaisse({
  caisseRepo,
  bilanRepo,
  now = new Date(),
  timeZone = TIMEZONE_KINSHASA,
  utilisateur = "system-auto"
}) {
  await cloturerCaisseAutomatique({ caisseRepo, now, timeZone, utilisateur });
  await creerBilanHebdoSiFinSemaine({ caisseRepo, bilanRepo, now, timeZone, utilisateur });
  await creerBilanMensuelSiFinMois({ caisseRepo, bilanRepo, now, timeZone, utilisateur });
}
