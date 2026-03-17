import express from "express";
import { requireFields, validateSchema } from "../../../shared/interfaces/validation.js";
import { emettreFacture } from "../../application/use-cases/emettre-facture.js";
import { listerFactures, obtenirFacture } from "../../application/use-cases/lister-factures.js";
import { FactureRepoPg } from "../../infrastructure/repositories/facture-repo-pg.js";
import { OrigineFactureReaderPg } from "../../infrastructure/repositories/origine-facture-reader-pg.js";
import { AtelierParametresRepoPg } from "../../../bc-parametres/infrastructure/repositories/atelier-parametres-repo-pg.js";
import { z } from "zod";
import { PERMISSIONS } from "../../../bc-auth/domain/permissions.js";
import { requirePermission } from "../../../bc-auth/interfaces/http/middlewares/require-permission.js";

const router = express.Router();
const factureRepo = new FactureRepoPg();
const origineReader = new OrigineFactureReaderPg();
const parametresRepo = new AtelierParametresRepoPg();

function buildAtelierConfig(payload = {}) {
  const identite = payload?.identite || {};
  const facturation = payload?.facturation || {};
  return {
    nom: String(identite.nomAtelier || "").trim(),
    adresse: String(identite.adresse || "").trim(),
    telephone: String(identite.telephone || "").trim(),
    email: String(identite.email || "").trim(),
    logoUrl: String(identite.logoUrl || "").trim(),
    devise: String(identite.devise || "").trim().toUpperCase(),
    prefixeNumero: String(facturation.prefixeNumero || "").trim().toUpperCase() || "FAC",
    mentions: String(facturation.mentions || "").trim(),
    afficherLogo: facturation.afficherLogo === true
  };
}

function atelierIdFromReq(req) {
  return String(req.auth?.atelierId || "ATELIER");
}

function scopedFactureRepo(req) {
  return factureRepo.forAtelier(atelierIdFromReq(req));
}

function scopedOrigineReader(req) {
  return origineReader.forAtelier(atelierIdFromReq(req));
}

function scopedParametresRepo(req) {
  return parametresRepo.forAtelier(atelierIdFromReq(req));
}

async function resolveAtelierConfig(req = null) {
  try {
    const current = await (req ? scopedParametresRepo(req) : parametresRepo).getCurrent();
    return buildAtelierConfig(current?.payload || {});
  } catch {
    return buildAtelierConfig();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(value, devise = "") {
  const amount = new Intl.NumberFormat("fr-FR").format(Number(value || 0));
  return devise ? `${amount} ${escapeHtml(devise)}` : amount;
}

function formatFactureDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(String(value));
  const moisFr = [
    "janvier",
    "fevrier",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "aout",
    "septembre",
    "octobre",
    "novembre",
    "decembre"
  ];
  const jour = String(date.getDate()).padStart(2, "0");
  const mois = moisFr[date.getMonth()] || "";
  const annee = date.getFullYear();
  return escapeHtml(`${jour} ${mois} ${annee}`);
}

function facturePdfHtml(facture, autoPrint = false, atelierConfig = buildAtelierConfig()) {
  const shouldShowLogo = atelierConfig.afficherLogo === true && String(atelierConfig.logoUrl || "").trim() !== "";
  const mentions = String(atelierConfig.mentions || "").trim();
  const atelierContactLine = [atelierConfig.telephone, atelierConfig.email].filter(Boolean).join(" | ");
  const lignes = facture.lignes
    .map(
      (ligne) => `
      <tr>
        <td>${escapeHtml(ligne.description)}</td>
        <td style="text-align:right">${escapeHtml(ligne.quantite)}</td>
        <td style="text-align:right">${formatCurrency(ligne.prix, atelierConfig.devise)}</td>
        <td style="text-align:right">${formatCurrency(ligne.montant, atelierConfig.devise)}</td>
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
        .logo { width: 84px; height: 84px; object-fit: contain; border: 1px solid #ddd; border-radius: 8px; padding: 4px; background: #fff; }
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
          ${shouldShowLogo ? `<p><img class="logo" src="${escapeHtml(atelierConfig.logoUrl)}" alt="Logo atelier" /></p>` : ""}
          <h1>FACTURE ${escapeHtml(facture.numeroFacture)}</h1>
          ${atelierConfig.nom ? `<p><strong>${escapeHtml(atelierConfig.nom)}</strong></p>` : ""}
          ${atelierConfig.adresse ? `<p>${escapeHtml(atelierConfig.adresse)}</p>` : ""}
          ${atelierContactLine ? `<p>${escapeHtml(atelierContactLine)}</p>` : ""}
        </div>
        <div class="meta">
          <div><strong>Date emission:</strong> ${formatFactureDate(facture.dateEmission)}</div>
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
          <tr><td class="label">Total</td><td class="val">${formatCurrency(facture.montantTotal, atelierConfig.devise)}</td></tr>
          <tr><td class="label">Paye</td><td class="val">${formatCurrency(facture.montantPaye, atelierConfig.devise)}</td></tr>
          <tr><td class="label">Solde</td><td class="val">${formatCurrency(facture.solde, atelierConfig.devise)}</td></tr>
          <tr><td class="label">Statut</td><td class="val"><span class="badge">${escapeHtml(facture.statut)}</span></td></tr>
        </tbody>
      </table>
      ${mentions ? `<p class="foot"><strong>Mentions:</strong> ${escapeHtml(mentions)}</p>` : ""}
      ${autoPrint ? "<script>window.addEventListener('load', () => window.print());</script>" : ""}
    </body>
  </html>`;
}

router.get("/factures", async (req, res) => {
  try {
    const factures = await listerFactures({ factureRepo: scopedFactureRepo(req) });
    res.json(factures);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/factures/:id", async (req, res) => {
  try {
    const facture = await obtenirFacture({ idFacture: req.params.id, factureRepo: scopedFactureRepo(req) });
    res.json(facture);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/factures/emettre", async (req, res) => {
  const schema = z
    .object({
      typeOrigine: z.string().min(1),
      idOrigine: z.string().min(1)
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const required = requireFields(body, ["typeOrigine", "idOrigine"]);
  if (!required.ok) return res.status(400).json({ error: required.error });
  try {
    const atelierConfig = await resolveAtelierConfig(req);
    const facture = await emettreFacture({
      input: {
        ...body,
        prefixeNumero: atelierConfig.prefixeNumero
      },
      factureRepo: scopedFactureRepo(req),
      origineReader: scopedOrigineReader(req)
    });
    const detail = await obtenirFacture({ idFacture: facture.idFacture, factureRepo: scopedFactureRepo(req) });
    res.status(201).json(detail);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/factures/:id/pdf", async (req, res) => {
  try {
    const facture = await obtenirFacture({ idFacture: req.params.id, factureRepo: scopedFactureRepo(req) });
    const atelierConfig = await resolveAtelierConfig(req);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(facturePdfHtml(facture, req.query.autoprint === "1", atelierConfig));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get("/audit/factures", requirePermission(PERMISSIONS.VOIR_BILANS_GLOBAUX), async (req, res) => {
  try {
    const factures = await listerFactures({ factureRepo: scopedFactureRepo(req) });
    res.json(factures);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
