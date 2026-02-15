export async function modifierClient({ idClient, input, clientRepo }) {
  const client = await clientRepo.getById(idClient);
  if (!client) throw new Error("Client introuvable");
  client.modifier(input);
  await clientRepo.save(client);
  return client;
}
