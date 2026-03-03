import { getAuthStore } from "./_store.js";

export class PasswordResetTokenRepoPg {
  constructor() {
    this.store = getAuthStore();
  }

  async save({ token, utilisateurId, expiresAt }) {
    this.store.resetTokens.set(String(token), {
      token: String(token),
      utilisateurId: String(utilisateurId),
      expiresAt: String(expiresAt),
      usedAt: null
    });
  }

  async findValid(token) {
    const row = this.store.resetTokens.get(String(token || ""));
    if (!row) return null;
    if (row.usedAt) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) return null;
    return { ...row };
  }

  async markUsed(token) {
    const row = this.store.resetTokens.get(String(token || ""));
    if (!row) return;
    row.usedAt = new Date().toISOString();
  }
}
