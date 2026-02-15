import assert from "assert";
import { creerClient } from "../src/bc-clients/application/use-cases/creer-client.js";
import { enregistrerSerieMesures } from "../src/bc-clients/application/use-cases/enregistrer-serie-mesures.js";

function run() {
  const c = creerClient({
    idClient: "CL-1",
    nom: "Doe",
    prenom: "Jane",
    telephone: "+221771234567"
  });
  assert.equal(c.nom, "Doe");

  const serie = enregistrerSerieMesures({
    idSerieMesures: "SM-1",
    idClient: "CL-1",
    typeVetement: "ROBE",
    ensembleMesures: [
      { nomMesure: "poitrine", valeur: 90 },
      { nomMesure: "taille", valeur: 70 }
    ]
  });
  assert.equal(serie.typeVetement, "ROBE");
}

run();
console.log("OK: clients use cases");
