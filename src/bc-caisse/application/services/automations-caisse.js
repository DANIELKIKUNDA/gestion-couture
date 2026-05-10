import { TIMEZONE_KINSHASA } from "../../domain/horloge-kinshasa.js";
import { ouvrirCaisseAutomatique } from "../use-cases/ouvrir-caisse-automatique.js";
import { cloturerCaisseAutomatique } from "../use-cases/cloturer-caisse-automatique.js";
import { creerCaisseDuJourClotureeAutomatique } from "../use-cases/creer-caisse-du-jour-cloturee-automatique.js";
import { genererBilansApresCloture } from "../use-cases/creer-bilan-caisse.js";
import { enregistrerEvenementAudit } from "../../../shared/infrastructure/audit-log.js";
import { getKinshasaParts } from "../../domain/horloge-kinshasa.js";
import { heureClotureDuJourAtteinte, resolveClotureAutoConfig } from "../../domain/cloture-automatique-policy.js";

export async function executerAutomationsCaisse({
  atelierId = "",
  caisseRepo,
  bilanRepo,
  parametresRepo = null,
  now = new Date(),
  timeZone = TIMEZONE_KINSHASA,
  utilisateur = "system-auto"
}) {
  const resolvedAtelierId =
    String(atelierId || "").trim() ||
    String(caisseRepo?.atelierId || "").trim() ||
    String(parametresRepo?.atelierId || "").trim() ||
    "ATELIER";

  const logAutomation = (phase, details = {}) => {
    const suffix = Object.entries(details)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    console.log(`[AUTO-CAISSE] atelier=${resolvedAtelierId} phase=${phase}${suffix ? ` ${suffix}` : ""}`);
  };

  const caisseCloturee = await cloturerCaisseAutomatique({
    atelierId: resolvedAtelierId,
    caisseRepo,
    parametresRepo,
    now,
    timeZone,
    utilisateur,
    logAutomation
  });
  if (caisseCloturee) {
    const iso = String(caisseCloturee.dateCloture || now.toISOString());
    await enregistrerEvenementAudit({
      utilisateurId: null,
      role: "SYSTEME",
      atelierId: resolvedAtelierId,
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

  const parametres = parametresRepo && typeof parametresRepo.getCurrent === "function" ? await parametresRepo.getCurrent() : null;
  const clotureAuto = resolveClotureAutoConfig(parametres?.payload || null);
  if (heureClotureDuJourAtteinte(getKinshasaParts(now, timeZone), clotureAuto)) {
    const caisseClotureeDuJour = await creerCaisseDuJourClotureeAutomatique({
      caisseRepo,
      now,
      timeZone,
      utilisateur
    });
    if (caisseClotureeDuJour) {
      logAutomation("closed-day-created", {
        idCaisseJour: caisseClotureeDuJour.idCaisseJour,
        dateJour: caisseClotureeDuJour.date,
        reason: "heure-cloture-deja-atteinte"
      });
      await genererBilansApresCloture({
        caisseCloturee: caisseClotureeDuJour,
        caisseRepo,
        bilanRepo,
        parametresRepo,
        now,
        timeZone,
        utilisateur
      });
    }
    return;
  }

  const caisseOuverte = await ouvrirCaisseAutomatique({
    atelierId: resolvedAtelierId,
    caisseRepo,
    parametresRepo,
    now,
    timeZone,
    utilisateur,
    logAutomation
  });
  if (caisseOuverte) {
    logAutomation("open-success", {
      idCaisseJour: caisseOuverte.idCaisseJour,
      dateJour: caisseOuverte.date,
      openedAt: now.toISOString(),
      timeZone
    });
  }
}
