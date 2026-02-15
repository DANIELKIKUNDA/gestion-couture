import { randomUUID } from "crypto";

function compactUuid() {
  return randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
}

function buildId(prefix) {
  return `${prefix}-${compactUuid()}`;
}

export function generateClientId() {
  return buildId("CL");
}

export function generateSerieMesuresId() {
  return buildId("SM");
}

export function generateCommandeId() {
  return buildId("CMD");
}

export function generateRetoucheId() {
  return buildId("RET");
}

export function generateCaisseJourId() {
  return buildId("CJ");
}

export function generateOperationId() {
  return buildId("OP");
}

export function generateBilanCaisseId() {
  return buildId("BC");
}

export function generateArticleId() {
  return buildId("ART");
}

export function generateMouvementId() {
  return buildId("MVT");
}

export function generateVenteId() {
  return buildId("VTE");
}

export function generateVenteLigneId() {
  return buildId("VTL");
}

export function generateFactureId() {
  return buildId("F");
}

export function generateNumeroFacture(date = new Date()) {
  const year = date.getFullYear();
  const sequence = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `FAC-${year}-${sequence}`;
}
