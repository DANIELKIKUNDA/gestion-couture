export async function marquerNotificationCommeLue({
  notificationLectureRepo,
  notificationRepo,
  notificationId,
  atelierId,
  luParUserId = null
}) {
  const notificationIdValue = String(notificationId || "").trim();
  const atelierIdValue = String(atelierId || "").trim();
  if (!notificationIdValue) throw new Error("notificationId requis");
  if (!atelierIdValue) throw new Error("atelierId requis");

  const notifications = await notificationRepo.listForAtelier(atelierIdValue);
  const notification = notifications.find((item) => item.idNotification === notificationIdValue);
  if (!notification) throw new Error("Notification introuvable");

  await notificationLectureRepo.markAsRead({
    notificationId: notificationIdValue,
    atelierId: atelierIdValue,
    luParUserId
  });

  return {
    idNotification: notificationIdValue,
    atelierId: atelierIdValue,
    estLue: true
  };
}
