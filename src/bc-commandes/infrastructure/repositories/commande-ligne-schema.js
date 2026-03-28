import { pool } from "../../../shared/infrastructure/db.js";

let cachedExists = null;
let pendingCheck = null;

async function queryCommandeLignesExists(db = pool) {
  const result = await db.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'commande_lignes'
     ) AS exists`
  );
  return result.rows[0]?.exists === true;
}

export async function hasCommandeLignesTable(db = pool) {
  const executor = db || pool;
  if (executor !== pool) {
    return queryCommandeLignesExists(executor);
  }
  if (cachedExists !== null) return cachedExists;
  if (pendingCheck) return pendingCheck;
  pendingCheck = queryCommandeLignesExists(pool)
    .then((exists) => {
      cachedExists = exists;
      return exists;
    })
    .finally(() => {
      pendingCheck = null;
    });
  return pendingCheck;
}

