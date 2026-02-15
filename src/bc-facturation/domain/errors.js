export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class OrigineFactureIntrouvable extends DomainError {}
export class FactureIntrouvable extends DomainError {}
export class FactureImmuable extends DomainError {}
