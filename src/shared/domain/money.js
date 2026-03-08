// Placeholder for shared Money value object
export class Money {
  constructor(amount, currency = "XOF") {
    if (amount < 0) throw new Error("Le montant doit etre >= 0");
    this.amount = amount;
    this.currency = currency;
    Object.freeze(this);
  }
}
