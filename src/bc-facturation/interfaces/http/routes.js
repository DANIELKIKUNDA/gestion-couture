import express from "express";
import { requireFields } from "../../../shared/interfaces/validation.js";
import { emettreFacture } from "../../application/use-cases/emettre-facture.js";
import { listerFactures, obtenirFacture } from "../../application/use-cases/lister-factures.js";
import { FactureRepoPg } from "../../infrastructure/repositories/facture-repo-pg.js";
import { OrigineFactureReaderPg } from "../../infrastructure/repositories/origine-facture-reader-pg.js";

const router = express.Router();
const factureRepo = new FactureRepoPg();
const origineReader = new OrigineFactureReaderPg();
const atelierConfig = {
  nom: process.env.ATELIER_NOM || "Atelier de Couture",
  adresse: process.env.ATELIER_ADRESSE || "Adresse atelier",
  telephone: process.env.ATELIER_TELEPHONE || "Telephone atelier",
  email: process.env.ATELIER_EMAIL || "contact@atelier.local"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat("fr-FR").format(Number(value || 0))} FC`;
}

function facturePdfHtml(facture, autoPrint = false) {
  const lignes = facture.lignes
    .map(
      (ligne) => `
      <tr>
        <td>${escapeHtml(ligne.description)}</td>
        <td style="text-align:right">${escapeHtml(ligne.quantite)}</td>
        <td style="text-align:right">${formatCurrency(ligne.prix)}</td>
        <td style="text-align:right">${formatCurrency(ligne.montant)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <title>Facture ${escapeHtml(facture.numeroFacture)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 28px; color: #111; }
        .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
        .brand h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: 0.5px; }
        .brand p { margin: 0; line-height: 1.45; font-size: 13px; color: #444; }
        .meta { text-align: right; font-size: 13px; line-height: 1.5; }
        .client { margin: 18px 0; padding: 10px 12px; border: 1px solid #e6e6e6; background: #fafafa; }
        .client h3 { margin: 0 0 6px; font-size: 13px; }
        .client p { margin: 0; line-height: 1.45; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
        th { background: #f4f4f4; text-align: left; }
        .totaux { margin-top: 14px; width: 300px; margin-left: auto; }
        .totaux td { border: 1px solid #ddd; }
        .totaux .label { font-weight: 700; background: #f8f8f8; }
        .totaux .val { text-align: right; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #ececec; font-size: 12px; }
        .foot { margin-top: 24px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="head">
        <div class="brand">
          <h1>FACTURE ${escapeHtml(facture.numeroFacture)}</h1>
          <p><strong>${escapeHtml(atelierConfig.nom)}</strong></p>
          <p>${escapeHtml(atelierConfig.adresse)}</p>
          <p>${escapeHtml(atelierConfig.telephone)} | ${escapeHtml(atelierConfig.email)}</p>
        </div>
        <div class="meta">
          <div><strong>Date emission:</strong> ${escapeHtml(String(facture.dateEmission).slice(0, 10))}</div>
          <div><strong>Origine:</strong> ${escapeHtml(facture.typeOrigine)} / ${escapeHtml(facture.idOrigine)}</div>
          <div><strong>Reference caisse:</strong> ${escapeHtml(facture.referenceCaisse || "-")}</div>
        </div>
      </div>

      <div class="client">
        <h3>Client</h3>
        <p>${escapeHtml(facture.client.nom)}</p>
        <p>${escapeHtml(facture.client.contact || "-")}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantite</th>
            <th>Prix</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>${lignes}</tbody>
      </table>
      <table class="totaux">
        <tbody>
          <tr><td class="label">Total</td><td class="val">${formatCurrency(facture.montantTotal)}</td></tr>
          <tr><td class="label">Paye</td><td class="val">${formatCurrency(facture.montantPaye)}</td></tr>
          <tr><td class="label">Solde</td><td class="val">${formatCurrency(facture.solde)}</td></tr>
          <tr><td class="label">Statut</td><td class="val"><span class="badge">${escapeHtml(facture.statut)}</span></td></tr>
        </tbody>
      </table>
      <p class="foot">Facture generee automatiquement</p>
      ${autoPrint ? "<script>window.addEventListener('load', () => window.print());</script>" : ""}
    </body>
  </html>`;
}

router.get("/factures", async (req, res) => {
  try {
    const factures = await listerFactures({ factureRepo });
    res.json(factures);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/factures/:id", async (req, res) => {
  try {
    const facture = await obtenirFacture({ idFacture: req.params.id, factureRepo });
    res.json(facture);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/factures/emettre", async (req, res) => {
  const required = requireFields(req.body, ["typeOrigine", "idOrigine"]);
  if (!required.ok) return res.status(400).json({ error: required.error });
  try {
    const facture = await emettreFacture({
      input: req.body,
      factureRepo,
      origineReader
    });
    const detail = await obtenirFacture({ idFacture: facture.idFacture, factureRepo });
    res.status(201).json(detail);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/factures/:id/pdf", async (req, res) => {
  try {
    const facture = await obtenirFacture({ idFacture: req.params.id, factureRepo });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(facturePdfHtml(facture, req.query.autoprint === "1"));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get("/audit/factures", async (req, res) => {
  try {
    const factures = await listerFactures({ factureRepo });
    res.json(factures);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
