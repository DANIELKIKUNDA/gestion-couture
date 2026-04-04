export class NotificationSystemeRepo {
  async save(_notification) {
    throw new Error("save(notification) non implemente");
  }

  async list() {
    throw new Error("list() non implemente");
  }

  async listForAtelier(_atelierId) {
    throw new Error("listForAtelier(atelierId) non implemente");
  }
}
