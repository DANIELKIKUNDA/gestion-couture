// Domain errors for Caisse
export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class CaisseCloturee extends DomainError {}
export class SoldeInsuffisant extends DomainError {}
export class MontantInvalide extends DomainError {}
export class OperationInexistante extends DomainError {}
export class OperationDejaAnnulee extends DomainError {}
export class OuvertureInterdite extends DomainError {}
export class CaisseDejaCreeeJour extends DomainError {}
export class CaissePrecedenteNonCloturee extends DomainError {}
export class BilanDejaCree extends DomainError {}
export class TypeDepenseInvalide extends DomainError {}
export class JustificationObligatoire extends DomainError {}
export class PermissionInsuffisante extends DomainError {}
export class SoldeJournalierInsuffisant extends DomainError {}
