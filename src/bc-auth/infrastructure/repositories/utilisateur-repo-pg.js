import { getAuthStore } from "./_store.js";

export class UtilisateurRepoPg {
  constructor() {
    this.store = getAuthStore();
  }

  async findByEmail(email) {
    const target = String(email || "").trim().toLowerCase();
    for (const user of this.store.users.values()) {
      if (user.email === target) return { ...user };
    }
    return null;
  }

  async getById(id) {
    const user = this.store.users.get(String(id || ""));
    return user ? { ...user } : null;
  }

  async list() {
    return Array.from(this.store.users.values()).map((u) => ({ ...u }));
  }

  async save(user) {
    this.store.users.set(String(user.id), { ...user });
    return { ...user };
  }

  async hasAnyOwner() {
    return Array.from(this.store.users.values()).some((u) => String(u.roleId || "").toUpperCase() === "PROPRIETAIRE");
  }
}
