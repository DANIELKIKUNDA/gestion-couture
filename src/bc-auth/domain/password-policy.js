export function validatePasswordPolicy(password) {
  const value = String(password || "");
  if (value.length < 8) throw new Error("Mot de passe trop court (min 8 caracteres)");
  if (!/[A-Z]/.test(value)) throw new Error("Mot de passe: au moins une majuscule requise");
  if (!/[a-z]/.test(value)) throw new Error("Mot de passe: au moins une minuscule requise");
  if (!/[0-9]/.test(value)) throw new Error("Mot de passe: au moins un chiffre requis");
  return true;
}
