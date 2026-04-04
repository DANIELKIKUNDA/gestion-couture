export async function listerNotificationsPourAtelier({ notificationLectureRepo, atelierId }) {
  const atelierIdValue = String(atelierId || "").trim();
  if (!atelierIdValue) throw new Error("atelierId requis");
  return notificationLectureRepo.listForAtelier(atelierIdValue);
}
