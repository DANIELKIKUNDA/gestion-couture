export class AuthError extends Error {
  constructor(message = "Authentification invalide") {
    super(message);
    this.name = "AuthError";
  }
}

export class PermissionError extends Error {
  constructor(message = "Permission insuffisante") {
    super(message);
    this.name = "PermissionError";
  }
}
