export async function listerContactsAteliers({ atelierContactQuery, input = {} }) {
  return atelierContactQuery.list({
    search: input.search || "",
    atelierId: input.atelierId || null,
    includeInactive: input.includeInactive === true
  });
}
