import { pool } from "../../../shared/infrastructure/db.js";
import { SerieMesures } from "../../domain/serie-mesures.js";

export class SerieMesuresRepoPg {
  async getById(idSerieMesures) {
    const res = await pool.query(
      "SELECT id_serie_mesures, id_client, type_vetement, ensemble_mesures, date_prise, prise_par, est_active, observations FROM series_mesures WHERE id_serie_mesures = $1",
      [idSerieMesures]
    );
    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    return new SerieMesures({
      idSerieMesures: row.id_serie_mesures,
      idClient: row.id_client,
      typeVetement: row.type_vetement,
      ensembleMesures: row.ensemble_mesures,
      datePrise: row.date_prise,
      prisePar: row.prise_par,
      estActive: row.est_active,
      observations: row.observations
    });
  }

  async getActiveByClientAndType(idClient, typeVetement) {
    const res = await pool.query(
      "SELECT id_serie_mesures, id_client, type_vetement, ensemble_mesures, date_prise, prise_par, est_active, observations FROM series_mesures WHERE id_client = $1 AND type_vetement = $2 AND est_active = true",
      [idClient, typeVetement]
    );
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    return new SerieMesures({
      idSerieMesures: row.id_serie_mesures,
      idClient: row.id_client,
      typeVetement: row.type_vetement,
      ensembleMesures: row.ensemble_mesures,
      datePrise: row.date_prise,
      prisePar: row.prise_par,
      estActive: row.est_active,
      observations: row.observations
    });
  }

  async save(serie) {
    await pool.query(
      `INSERT INTO series_mesures (id_serie_mesures, id_client, type_vetement, ensemble_mesures, date_prise, prise_par, est_active, observations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id_serie_mesures)
       DO UPDATE SET id_client=$2, type_vetement=$3, ensemble_mesures=$4, date_prise=$5, prise_par=$6, est_active=$7, observations=$8`,
      [
        serie.idSerieMesures,
        serie.idClient,
        serie.typeVetement,
        JSON.stringify(serie.ensembleMesures),
        serie.datePrise,
        serie.prisePar,
        serie.estActive,
        serie.observations
      ]
    );
  }
}
