import { TIMEZONE_KINSHASA } from "../../domain/horloge-kinshasa.js";
import { ouvrirCaisseAutomatique } from "../use-cases/ouvrir-caisse-automatique.js";
import { cloturerCaisseAutomatique } from "../use-cases/cloturer-caisse-automatique.js";
import { genererBilansApresCloture } from "../use-cases/creer-bilan-caisse.js";
import { enregistrerEvenementAudit } from "../../../shared/infrastructure/audit-log.js";

export async function executerAutomationsCaisse({
  caisseRepo,
  bilanRepo,
  parametresRepo = null,
  now = new Date(),
  timeZone = TIMEZONE_KINSHASA,
  utilisateur = "system-auto"
}) {
  const caisseOuverte = await ouvrirCaisseAutomatique({ caisseRepo, parametresRepo, now, timeZone, utilisateur });
  if (caisseOuverte) {
    console.log(
      `[AUTO-OPEN] id=${caisseOuverte.idCaisseJour} dateJour=${caisseOuverte.date} openedAt=${now.toISOString()} timeZone=${timeZone}`
    );
  }
  const caisseCloturee = await cloturerCaisseAutomatique({ caisseRepo, parametresRepo, now, timeZone, utilisateur });
  if (caisseCloturee) {
    const iso = String(caisseCloturee.dateCloture || now.toISOString());
    await enregistrerEvenementAudit({
      utilisateurId: null,
      role: "SYSTEME",
      action: "CLOTURE_AUTO",
      entite: "CAISSE_JOUR",
      entiteId: caisseCloturee.idCaisseJour,
      payload: {
        utilisateurNom: utilisateur,
        systeme: true,
        date: iso.slice(0, 10),
        heure: iso.slice(11, 16)
      }
    });
  }
  await genererBilansApresCloture({
    caisseCloturee,
    caisseRepo,
    bilanRepo,
    parametresRepo,
    now,
    timeZone,
    utilisateur
  });
}
