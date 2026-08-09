import { pool } from "../../../shared/infrastructure/db.js";
import { calculateActivityBalances } from "../../domain/activity-balances.js";

let schemaReady = false;

async function ensureSchema(db = pool) {
  if (schemaReady && db === pool) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS caisse_repartition_initiale (
      atelier_id TEXT PRIMARY KEY,
      date_reference DATE NOT NULL,
      solde_ouverture_initial NUMERIC(14,2) NOT NULL,
      solde_atelier_initial NUMERIC(14,2) NOT NULL,
      solde_stock_initial NUMERIC(14,2) NOT NULL,
      configuree_par TEXT NULL,
      date_configuration TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  if (db === pool) schemaReady = true;
}

function dateOnly(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || "").trim());
  return match ? match[1] : String(value || "").trim();
}

function mapAllocation(row) {
  if (!row) return null;
  return {
    configured: true,
    dateReference: dateOnly(row.date_reference),
    soldeOuvertureInitial: Number(row.solde_ouverture_initial || 0),
    soldeAtelierInitial: Number(row.solde_atelier_initial || 0),
    soldeStockInitial: Number(row.solde_stock_initial || 0),
    configuredBy: row.configuree_par || null,
    configuredAt: row.date_configuration ? new Date(row.date_configuration).toISOString() : null
  };
}

export class CaisseActivityBalanceRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new CaisseActivityBalanceRepoPg(atelierId, this.db);
  }

  async getAllocation() {
    await ensureSchema(this.db);
    const result = await this.db.query(
      `SELECT to_char(date_reference, 'YYYY-MM-DD') AS date_reference,
              solde_ouverture_initial, solde_atelier_initial, solde_stock_initial,
              configuree_par, date_configuration
       FROM caisse_repartition_initiale
       WHERE atelier_id = $1
       LIMIT 1`,
      [this.atelierId]
    );
    return mapAllocation(result.rows[0] || null);
  }

  async getReferenceCaisse(dateReference = null) {
    const params = [this.atelierId];
    let filter = "";
    if (dateReference) {
      params.push(dateOnly(dateReference));
      filter = `AND date_jour = $2::date`;
    }
    const result = await this.db.query(
      `SELECT to_char(date_jour, 'YYYY-MM-DD') AS date_jour, solde_ouverture
       FROM caisse_jour
       WHERE atelier_id = $1
         ${filter}
       ORDER BY date_jour DESC
       LIMIT 1`,
      params
    );
    const row = result.rows[0] || null;
    return row
      ? { dateReference: dateOnly(row.date_jour), openingBalance: Number(row.solde_ouverture || 0) }
      : null;
  }

  async getBalances({ dateFin = null } = {}) {
    const requestedEndDate = dateFin ? dateOnly(dateFin) : null;
    const allocation = await this.getAllocation();

    if (!allocation) {
      const suggestedReference = await this.getReferenceCaisse(requestedEndDate);
      if (!suggestedReference) {
        return {
          hasCaisse: false,
          available: false,
          allocationConfigured: false,
          beforeReference: false,
          dateReference: null,
          dateFin: requestedEndDate,
          soldeOuvertureInitial: 0,
          soldeAtelierInitial: 0,
          soldeStockInitial: 0,
          soldeNonReparti: 0,
          soldeAtelier: null,
          soldeStock: null,
          soldeGlobalCalcule: null
        };
      }
      return {
        hasCaisse: true,
        available: false,
        allocationConfigured: false,
        beforeReference: false,
        dateReference: suggestedReference.dateReference,
        dateFin: requestedEndDate,
        soldeOuvertureInitial: suggestedReference.openingBalance,
        soldeAtelierInitial: 0,
        soldeStockInitial: 0,
        soldeNonReparti: suggestedReference.openingBalance,
        soldeAtelier: null,
        soldeStock: null,
        soldeGlobalCalcule: null,
        totalEntreesAtelier: 0,
        totalSortiesAtelier: 0,
        totalEntreesStock: 0,
        totalSortiesStock: 0
      };
    }

    if (requestedEndDate && requestedEndDate < allocation.dateReference) {
      return {
        hasCaisse: true,
        available: false,
        allocationConfigured: true,
        beforeReference: true,
        dateReference: allocation.dateReference,
        dateFin: requestedEndDate,
        soldeOuvertureInitial: allocation.soldeOuvertureInitial,
        soldeAtelierInitial: allocation.soldeAtelierInitial,
        soldeStockInitial: allocation.soldeStockInitial,
        soldeNonReparti: 0,
        soldeAtelier: null,
        soldeStock: null,
        soldeGlobalCalcule: null,
        configuredBy: allocation.configuredBy,
        configuredAt: allocation.configuredAt
      };
    }

    const params = [this.atelierId, allocation.dateReference];
    let dateEndFilter = "";
    if (requestedEndDate) {
      params.push(requestedEndDate);
      dateEndFilter = ` AND cj.date_jour <= $${params.length}::date`;
    }
    const operationsResult = await this.db.query(
      `SELECT op.type_operation, op.montant, op.statut_operation, op.activite
       FROM caisse_operation op
       JOIN caisse_jour cj
         ON cj.id_caisse_jour = op.id_caisse_jour
        AND cj.atelier_id = op.atelier_id
       WHERE op.atelier_id = $1
         AND cj.date_jour >= $2::date
         ${dateEndFilter}
       ORDER BY cj.date_jour ASC, op.date_operation ASC`,
      params
    );

    const balances = calculateActivityBalances({
      openingBalance: allocation.soldeOuvertureInitial,
      initialAllocation: allocation,
      operations: operationsResult.rows
    });

    return {
      ...balances,
      hasCaisse: true,
      available: true,
      beforeReference: false,
      dateReference: allocation.dateReference,
      dateFin: requestedEndDate,
      configuredBy: allocation.configuredBy,
      configuredAt: allocation.configuredAt
    };
  }

  async saveInitialAllocation({ dateReference = null, soldeAtelierInitial, soldeStockInitial, configuredBy = null } = {}) {
    await ensureSchema(this.db);
    const existing = await this.getAllocation();
    const suppliedReference = dateOnly(dateReference || "");
    if (existing && suppliedReference && suppliedReference !== existing.dateReference) {
      throw new Error("La date de reference d'une repartition existante ne peut pas etre modifiee");
    }
    const requestedReference = existing?.dateReference || suppliedReference;
    const referenceCaisse = await this.getReferenceCaisse(requestedReference || null);
    if (!referenceCaisse) throw new Error("Aucune caisse disponible pour definir la repartition initiale");

    const atelier = Number(soldeAtelierInitial ?? 0);
    const stock = Number(soldeStockInitial ?? 0);
    const opening = Number(existing?.soldeOuvertureInitial ?? referenceCaisse.openingBalance ?? 0);
    if (!Number.isFinite(atelier) || !Number.isFinite(stock) || atelier < 0 || stock < 0) {
      throw new Error("La repartition initiale doit contenir des montants positifs ou nuls");
    }
    if (Math.abs(atelier + stock - opening) > 0.005) {
      throw new Error("Le solde Atelier + le solde Stock doit etre egal au solde d'ouverture de la caisse de reference");
    }

    const effectiveReference = existing?.dateReference || referenceCaisse.dateReference;
    await this.db.query(
      `INSERT INTO caisse_repartition_initiale (
         atelier_id, date_reference, solde_ouverture_initial,
         solde_atelier_initial, solde_stock_initial, configuree_par, date_configuration
       ) VALUES ($1, $2::date, $3, $4, $5, $6, NOW())
       ON CONFLICT (atelier_id)
       DO UPDATE SET
         solde_atelier_initial = EXCLUDED.solde_atelier_initial,
         solde_stock_initial = EXCLUDED.solde_stock_initial,
         configuree_par = EXCLUDED.configuree_par,
         date_configuration = NOW()`,
      [this.atelierId, effectiveReference, opening, atelier, stock, configuredBy]
    );
    return this.getBalances();
  }
}
