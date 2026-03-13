export const PASSWORD_POLICY_HINTS = [
  "Au moins 8 caracteres",
  "Au moins une majuscule",
  "Au moins une minuscule",
  "Au moins un chiffre",
  'Au moins un caractere special (!@#$%^&*(),.?":{}|<>)'
];

const SPECIAL_CHAR_PATTERN = /[!@#$%^&*(),.?":{}|<>]/;

export function getPasswordPolicyError(password) {
  const value = String(password || "");
  if (value.length < 8) return "Le mot de passe doit contenir au moins 8 caracteres.";
  if (!/[A-Z]/.test(value)) return "Le mot de passe doit contenir au moins une majuscule.";
  if (!/[a-z]/.test(value)) return "Le mot de passe doit contenir au moins une minuscule.";
  if (!/[0-9]/.test(value)) return "Le mot de passe doit contenir au moins un chiffre.";
  if (!SPECIAL_CHAR_PATTERN.test(value)) {
    return 'Le mot de passe doit contenir au moins un caractere special (!@#$%^&*(),.?":{}|<>).';
  }
  return "";
}
