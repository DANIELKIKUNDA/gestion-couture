import { getAuthStore } from "./_store.js";

export class AuthSessionRepoPg {
  constructor() {
    this.store = getAuthStore();
  }

  async save(session) {
    this.store.sessions.set(String(session.refreshToken), { ...session });
  }

  async findByRefreshToken(refreshToken) {
    const row = this.store.sessions.get(String(refreshToken || ""));
    if (!row) return null;
    if (row.revokedAt) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) return null;
    return { ...row };
  }

  async revoke(refreshToken) {
    const row = this.store.sessions.get(String(refreshToken || ""));
    if (!row) return;
    row.revokedAt = new Date().toISOString();
  }
}
