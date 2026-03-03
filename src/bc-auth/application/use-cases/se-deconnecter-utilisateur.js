export async function seDeconnecterUtilisateur({ authSessionRepo, refreshToken }) {
  if (!refreshToken) return true;
  await authSessionRepo.revoke(refreshToken);
  return true;
}
