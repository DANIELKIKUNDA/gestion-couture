import { randomUUID } from "node:crypto";
import { NotificationSysteme } from "../../domain/notification-systeme.js";

export async function envoyerNotificationSysteme({
  notificationRepo,
  atelierContactQuery = null,
  input,
  actor
}) {
  const portee = String(input?.portee || "").trim().toUpperCase();
  const atelierId = input?.atelierId ? String(input.atelierId).trim() : null;

  if (portee === "ATELIER" && atelierContactQuery) {
    const contacts = await atelierContactQuery.list({ atelierId, includeInactive: true });
    if (!contacts.some((row) => row.idAtelier === atelierId)) {
      throw new Error("Atelier cible introuvable");
    }
  }

  const notification = new NotificationSysteme({
    idNotification: `NOTIF-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    portee,
    atelierId,
    titre: input?.titre,
    message: input?.message,
    canal: "IN_APP",
    statut: "ENVOYEE",
    creeParUserId: actor?.id,
    creeParNom: actor?.nom,
    dateEnvoi: new Date().toISOString()
  });

  return notificationRepo.save(notification);
}
