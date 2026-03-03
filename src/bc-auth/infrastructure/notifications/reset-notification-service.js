export async function sendPasswordResetNotification({ email, token }) {
  console.log(`[AUTH] reset token for ${email}: ${token}`);
}
