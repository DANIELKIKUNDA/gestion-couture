// Domain errors for Stock
export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class StockInsuffisant extends DomainError {}
export class ArticleInactif extends DomainError {}
export class QuantiteInvalide extends DomainError {}
export class ArticleInexistant extends DomainError {}
export class VenteDejaValidee extends DomainError {}
export class VenteInvalide extends DomainError {}
export class VenteIntrouvable extends DomainError {}
export class VenteDejaAnnulee extends DomainError {}
