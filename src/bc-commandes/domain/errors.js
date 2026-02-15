// Domain errors for Commande
export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PaiementExcedentaire extends DomainError {}
export class CommandeDejaLivree extends DomainError {}
export class CommandeNonTerminee extends DomainError {}
export class CommandeNonPayee extends DomainError {}
export class CommandeAnnulee extends DomainError {}
export class AvanceInsuffisante extends DomainError {}
