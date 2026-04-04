export async function listerNotificationsAtelier({ notificationRepo, atelierId }) {
  return notificationRepo.listForAtelier(atelierId);
}
