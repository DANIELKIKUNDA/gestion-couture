import { pool } from "../../../shared/infrastructure/db.js";
import { SerieMesures } from "../../domain/serie-mesures.js";

export class SerieMesuresRepoPg {
  constructor(atelierId = "ATELIER") {
    this.atelierId = String(atelierId || "ATELIER");
  }

  forAtelier(atelierId) {
    return new SerieMesuresRepoPg(atelierId);
  }

  async getById(idSerieMesures) {
    const res = await pool.query(
      "SELECT id_serie_mesures, id_client, type_vetement, ensemble_mesures, date_prise, prise_par, est_active, observations FROM series_mesures WHERE id_serie_mesures = $1 AND atelier_id = $2",
      [idSerieMesures, this.atelierId]
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
      "SELECT id_serie_mesures, id_client, type_vetement, ensemble_mesures, date_prise, prise_par, est_active, observations FROM series_mesures WHERE id_client = $1 AND type_vetement = $2 AND est_active = true AND atelier_id = $3",
      [idClient, typeVetement, this.atelierId]
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
      `INSERT INTO series_mesures (id_serie_mesures, atelier_id, id_client, type_vetement, ensemble_mesures, date_prise, prise_par, est_active, observations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id_serie_mesures)
       DO UPDATE SET atelier_id=$2, id_client=$3, type_vetement=$4, ensemble_mesures=$5, date_prise=$6, prise_par=$7, est_active=$8, observations=$9`,
      [
        serie.idSerieMesures,
        this.atelierId,
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
