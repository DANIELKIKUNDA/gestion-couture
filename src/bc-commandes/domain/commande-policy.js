function resolveAlias(value, fallback) {
  return value === undefined ? fallback : value;
}

export function resolveCommandePolicy(payload = null) {
  const commandes = payload?.commandes || payload || {};
  const mesuresObligatoiresRaw = resolveAlias(commandes.mesuresObligatoiresPourCommande, commandes.mesuresObligatoires);
  const interdireRaw = resolveAlias(commandes.interdireEnregistrementSansToutesMesuresUtiles, commandes.interdictionSansMesures);
  const mesuresObligatoiresPourCommande = mesuresObligatoiresRaw === undefined ? true : mesuresObligatoiresRaw === true;
  const interdireEnregistrementSansToutesMesuresUtiles = interdireRaw === undefined ? true : interdireRaw === true;
  const valeursDecimalesAutorisees = resolveAlias(commandes.valeursDecimalesAutorisees, commandes.decimalesAutorisees);
  const delaiParDefautCommande = Number(resolveAlias(commandes.delaiParDefautCommande, commandes.delaiDefautJours) || 0);
  const uniteMesure = String(commandes.uniteMesure || "cm").trim().toLowerCase();

  return {
    mesuresObligatoiresPourCommande,
    interdireEnregistrementSansToutesMesuresUtiles,
    uniteMesure: uniteMesure || "cm",
    valeursDecimalesAutorisees: valeursDecimalesAutorisees !== false,
    delaiParDefautCommande: Number.isFinite(delaiParDefautCommande) && delaiParDefautCommande >= 0 ? delaiParDefautCommande : 7,
    passageAutomatiqueEnCoursApresPremierPaiement: commandes.passageAutomatiqueEnCoursApresPremierPaiement !== false,
    livraisonAutoriseeSeulementSiPaiementTotal: commandes.livraisonAutoriseeSeulementSiPaiementTotal !== false,
    autoriserModificationMesuresApresCreation: commandes.autoriserModificationMesuresApresCreation !== false,
    autoriserAnnulationApresPaiement: commandes.autoriserAnnulationApresPaiement === true
  };
}

export function buildDatePrevueCommande({ dateCreation, datePrevue, policy = null }) {
  if (datePrevue) return datePrevue;
  const resolved = resolveCommandePolicy(policy);
  const base = new Date(dateCreation || new Date().toISOString());
  const days = Math.max(0, Number(resolved.delaiParDefautCommande || 0));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}
