export async function desactiverClient({ idClient, clientRepo }) {
  const client = await clientRepo.getById(idClient);
  if (!client) throw new Error("Client introuvable");
  client.desactiver();
  await clientRepo.save(client);
  return client;
}
