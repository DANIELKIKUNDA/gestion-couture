import { SerieMesuresDejaActive } from "../../domain/errors.js";

// Ensure only one active serie per client/type
export async function activerSerieMesures({ idClient, typeVetement, serieRepo, idSerieMesures }) {
  const active = await serieRepo.getActiveByClientAndType(idClient, typeVetement);
  if (active && active.idSerieMesures !== idSerieMesures) {
    // deactivate previous
    active.desactiver();
    await serieRepo.save(active);
  } else if (active && active.idSerieMesures === idSerieMesures) {
    throw new SerieMesuresDejaActive("Serie already active");
  }

  const target = await serieRepo.getById(idSerieMesures);
  if (!target) throw new Error("Serie introuvable");
  target.activer();
  await serieRepo.save(target);
  return target;
}
