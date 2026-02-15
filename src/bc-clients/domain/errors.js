// Domain errors for Clients & Mesures
export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ClientInvalide extends DomainError {}
export class ClientInexistant extends DomainError {}
export class TelephoneInvalide extends DomainError {}
export class MesureInvalide extends DomainError {}
export class SerieMesuresDejaActive extends DomainError {}
export class SerieMesuresInactive extends DomainError {}
