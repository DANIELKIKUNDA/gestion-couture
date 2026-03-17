import { getAuthStore } from "./_store.js";
import { enregistrerEvenementAudit } from "../../../shared/infrastructure/audit-log.js";

export class EvenementAuditRepoPg {
  constructor() {
    this.store = getAuthStore();
  }

  async save(event) {
    const payload = {
      succes: Boolean(event?.succes),
      raison: event?.raison || null,
      details: event?.details || null
    };
    this.store.audits.push({ ...event, payload, date: new Date().toISOString() });
    await enregistrerEvenementAudit({
      utilisateurId: event?.utilisateurId || null,
      role: event?.role || null,
      atelierId: event?.atelierId || null,
      action: event?.action || "SECURITY_ACTION",
      entite: event?.entite || "auth",
      entiteId: event?.entiteId || null,
      payload
    });
  }
}
