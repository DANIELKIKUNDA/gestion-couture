export async function listerNotificationsSysteme({ notificationRepo }) {
  return notificationRepo.list();
}
