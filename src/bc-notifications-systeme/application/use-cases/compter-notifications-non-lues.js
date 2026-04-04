export async function compterNotificationsNonLues({ notificationLectureRepo, atelierId }) {
  const atelierIdValue = String(atelierId || "").trim();
  if (!atelierIdValue) throw new Error("atelierId requis");
  return notificationLectureRepo.countUnreadForAtelier(atelierIdValue);
}
