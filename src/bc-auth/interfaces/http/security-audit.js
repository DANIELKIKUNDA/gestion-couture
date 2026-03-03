import { EvenementAuditRepoPg } from "../../infrastructure/repositories/evenement-audit-repo-pg.js";

const auditRepo = new EvenementAuditRepoPg();

export async function logSecurityAudit({
  utilisateurId = null,
  role = null,
  action,
  entite = null,
  succes,
  raison = null
}) {
  try {
    await auditRepo.save({
      utilisateurId,
      role,
      action: String(action || "SECURITY_ACTION"),
      date: new Date().toISOString(),
      entite,
      succes: Boolean(succes),
      raison: raison || null
    });
  } catch {
    // Non bloquant par design
  }
}
