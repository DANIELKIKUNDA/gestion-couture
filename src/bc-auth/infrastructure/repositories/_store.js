const store = {
  users: new Map(),
  rolePermissions: new Map(),
  resetTokens: new Map(),
  sessions: new Map(),
  audits: []
};

export function getAuthStore() {
  return store;
}
