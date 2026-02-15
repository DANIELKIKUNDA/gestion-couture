import { Facture } from "../../domain/facture.js";
import { OrigineFactureIntrouvable } from "../../domain/errors.js";
import { readerMethodByTypeOrigine } from "../../domain/policies.js";

export async function emettreFacture({ input, factureRepo, origineReader, now = new Date() }) {
  const typeOrigine = String(input.typeOrigine || "").toUpperCase();
  const idOrigine = String(input.idOrigine || "").trim();
  if (!idOrigine) throw new Error("idOrigine requis");

  const readerMethod = readerMethodByTypeOrigine(typeOrigine);
  const origine =
    typeof origineReader?.[readerMethod] === "function"
      ? await origineReader[readerMethod](idOrigine)
      : await origineReader.read(typeOrigine, idOrigine);
  if (!origine) throw new OrigineFactureIntrouvable("Origine introuvable");

  const existante = await factureRepo.getByOrigine(typeOrigine, idOrigine);
  if (existante) return existante;

  const facture = new Facture({
    idFacture: await factureRepo.nextFactureId(),
    numeroFacture: await factureRepo.nextNumeroFacture(now),
    typeOrigine,
    idOrigine,
    client: origine.client,
    dateEmission: now.toISOString(),
    montantTotal: Number(origine.montantTotal),
    referenceCaisse: origine.referenceCaisse || null,
    lignes: origine.lignes
  });

  await factureRepo.save(facture);
  return facture;
}
