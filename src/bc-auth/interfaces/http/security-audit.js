import { EvenementAuditRepoPg } from "../../infrastructure/repositories/evenement-audit-repo-pg.js";

const auditRepo = new EvenementAuditRepoPg();

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
    await auditRepo.save({
      utilisateurId,
      role,
      atelierId,
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
