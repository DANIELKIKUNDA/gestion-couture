import { buildDateJour, getKinshasaParts } from "../../domain/horloge-kinshasa.js";
import { resolveClotureAutoConfig, selectionnerCaisseACloturer } from "../../domain/cloture-automatique-policy.js";

export async function cloturerCaisseAutomatique({
  atelierId = "",
  caisseRepo,
  parametresRepo = null,
  utilisateur = "system",
  now = new Date(),
  timeZone,
  logAutomation = null
}) {
  const scopedAtelierId =
    String(atelierId || "").trim() ||
    String(caisseRepo?.atelierId || "").trim() ||
    String(parametresRepo?.atelierId || "").trim() ||
    "ATELIER";
  const log = (reason, details = {}) => {
    if (typeof logAutomation !== "function") return;
    logAutomation(reason, { atelierId: scopedAtelierId, ...details });
  };
  const parts = getKinshasaParts(now, timeZone);
  const dateJour = buildDateJour(parts);
  const parametres = parametresRepo && typeof parametresRepo.getCurrent === "function"
    ? await parametresRepo.getCurrent()
    : null;
  const clotureAuto = resolveClotureAutoConfig(parametres?.payload || null);
  const caisseDuJour = await caisseRepo.getByDate(dateJour);
  const caissesAnterieures = typeof caisseRepo.listBeforeDate === "function"
    ? await caisseRepo.listBeforeDate(dateJour, 60)
    : [];
  const caisse = selectionnerCaisseACloturer({
    parts,
    caisseDuJour,
    caissesAnterieures,
    clotureAuto
  });
  if (!caisse) {
    const retardOuvert = (caissesAnterieures || []).find((item) => item?.statutCaisse === "OUVERTE");
    log("close-skip", {
      reason: clotureAuto?.active === false ? "cloture-auto-desactivee" : "aucune-caisse-a-cloturer",
      dateJour,
      heureCloture: `${String(clotureAuto?.hour ?? "").padStart(2, "0")}:${String(clotureAuto?.minute ?? "").padStart(2, "0")}`,
      heureCourante: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
      caisseDuJourStatut: caisseDuJour?.statutCaisse || "AUCUNE",
      caisseRetardId: retardOuvert?.idCaisseJour || null
    });
    return null;
  }

  caisse.cloturerCaisse({ utilisateur, dateCloture: now.toISOString() });
  await caisseRepo.save(caisse);
  log("close-success", {
    idCaisseJour: caisse.idCaisseJour,
    dateJour: caisse.date,
    closedAt: now.toISOString()
  });
  return caisse;
}
