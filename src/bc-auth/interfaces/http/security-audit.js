import { EvenementAuditRepoPg } from "../../infrastructure/repositories/evenement-audit-repo-pg.js";
import { UtilisateurRepoPg } from "../../infrastructure/repositories/utilisateur-repo-pg.js";

const auditRepo = new EvenementAuditRepoPg();
const utilisateurRepo = new UtilisateurRepoPg();

async function resolveAuditAtelierId({ atelierId = null, utilisateurId = null } = {}) {
  const explicit = String(atelierId || "").trim();
  if (explicit) return explicit;
  const userId = String(utilisateurId || "").trim();
  if (!userId) return null;
  try {
    const user = await utilisateurRepo.getById(userId);
    return String(user?.atelierId || "").trim() || null;
  } catch {
    return null;
  }
}

export async function logSecurityAudit({
  utilisateurId = null,
  role = null,
  atelierId = null,
  action,
  entite = null,
  entiteId = null,
  succes,
  raison = null,
  details = null
}) {
  try {
    const resolvedAtelierId = await resolveAuditAtelierId({ atelierId, utilisateurId });
    await auditRepo.save({
      utilisateurId,
      role,
      atelierId: resolvedAtelierId,
      action: String(action || "SECURITY_ACTION"),
      date: new Date().toISOString(),
      entite,
      entiteId,
      succes: Boolean(succes),
      raison: raison || null,
      details: details || null
    });
  } catch {
    // Non bloquant par design
  }
}
