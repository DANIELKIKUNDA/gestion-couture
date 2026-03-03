import { getAuthStore } from "./_store.js";

export class EvenementAuditRepoPg {
  constructor() {
    this.store = getAuthStore();
  }

  async save(event) {
    this.store.audits.push({ ...event, date: new Date().toISOString() });
  }
}
