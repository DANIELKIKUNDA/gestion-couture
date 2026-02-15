export async function desactiverSerieMesures({ idSerieMesures, serieRepo }) {
  const serie = await serieRepo.getById(idSerieMesures);
  if (!serie) throw new Error("Serie introuvable");
  serie.desactiver();
  await serieRepo.save(serie);
  return serie;
}
