// Domain errors for Retouche
export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PaiementExcedentaire extends DomainError {}
export class RetoucheDejaLivree extends DomainError {}
export class RetoucheNonTerminee extends DomainError {}
export class RetoucheNonPayee extends DomainError {}
export class RetoucheAnnulee extends DomainError {}
export class AvanceInsuffisante extends DomainError {}
