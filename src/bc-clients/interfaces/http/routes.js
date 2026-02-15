import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { ClientRepoPg } from "../../infrastructure/repositories/client-repo-pg.js";
import { SerieMesuresRepoPg } from "../../infrastructure/repositories/serie-mesures-repo-pg.js";
import { creerClient } from "../../application/use-cases/creer-client.js";
import { modifierClient } from "../../application/use-cases/modifier-client.js";
import { desactiverClient } from "../../application/use-cases/desactiver-client.js";
import { enregistrerSerieMesures } from "../../application/use-cases/enregistrer-serie-mesures.js";
import { activerSerieMesures } from "../../application/use-cases/activer-serie-mesures.js";
import { desactiverSerieMesures } from "../../application/use-cases/desactiver-serie-mesures.js";
import { DomainError } from "../../domain/errors.js";
import { requireFields } from "../../../shared/interfaces/validation.js";
import { generateClientId, generateSerieMesuresId } from "../../../shared/domain/id-generator.js";
import {
  positiveInt,
  paginateRows,
  toIsoDate
} from "../../application/services/consultation-client.js";
import {
  normalizeMesuresSnapshot,
  filterHistoriques,
  statutFidelite
} from "../../domain/consultation-client.js";

const router = express.Router();
const clientRepo = new ClientRepoPg();
const serieRepo = new SerieMesuresRepoPg();
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

function consultationPdfHtml(payload, autoPrint = false) {
  const client = payload.client || {};
  const synthese = payload.synthese || {};
  const historique = payload.historique || {};

  const commandesRows = (historique.commandes || [])
    .map(
      (row) => `<tr>
        <td>${escapeHtml(toIsoDate(row.date) || "-")}</td>
        <td>${escapeHtml(row.typeHabit || "-")}</td>
        <td>${escapeHtml(row.statut || "-")}</td>
        <td style="text-align:right">${formatCurrency(row.montant)}</td>
      </tr>`
    )
    .join("");

  const retouchesRows = (historique.retouches || [])
    .map(
      (row) => `<tr>
        <td>${escapeHtml(toIsoDate(row.date) || "-")}</td>
        <td>${escapeHtml(row.typeHabit || "-")}</td>
        <td>${escapeHtml(row.typeRetouche || "-")}</td>
        <td>${escapeHtml(row.statut || "-")}</td>
        <td style="text-align:right">${formatCurrency(row.montant)}</td>
      </tr>`
    )
    .join("");

  const mesuresRows = (historique.mesures || [])
    .map((row) => {
      const normalized = normalizeMesuresSnapshot(row.mesures, row.typeHabit);
      const lines = normalized
        ? Object.entries(normalized.valeurs)
            .map(([k, v]) => (k === "typeManches" ? `${k}: ${escapeHtml(v)}` : `${k}: ${escapeHtml(v)} cm`))
            .join(" | ")
        : "Aucune mesure";
      return `<tr>
        <td>${escapeHtml(toIsoDate(row.datePrise) || "-")}</td>
        <td>${escapeHtml(row.typeHabit || "-")}</td>
        <td>${escapeHtml(row.source || "-")}</td>
        <td>${lines}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <title>Fiche client ${escapeHtml(client.nomComplet || client.idClient || "")}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
        .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .brand h1 { margin: 0 0 8px; font-size: 22px; }
        .brand p { margin: 0; line-height: 1.45; font-size: 13px; color: #444; }
        .meta { font-size: 13px; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 16px; }
        th, td { border: 1px solid #ddd; padding: 7px; font-size: 12px; vertical-align: top; }
        th { background: #f5f5f5; text-align: left; }
        .section { margin-top: 14px; }
        .foot { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="head">
        <div class="brand">
          <h1>FICHE CLIENT - CONSULTATION</h1>
          <p><strong>${escapeHtml(atelierConfig.nom)}</strong></p>
          <p>${escapeHtml(atelierConfig.adresse)}</p>
          <p>${escapeHtml(atelierConfig.telephone)} | ${escapeHtml(atelierConfig.email)}</p>
        </div>
        <div class="meta">
          <div><strong>Client:</strong> ${escapeHtml(client.nomComplet || "-")}</div>
          <div><strong>Contact:</strong> ${escapeHtml(client.telephone || "-")}</div>
          <div><strong>Premier passage:</strong> ${escapeHtml(toIsoDate(client.datePremierPassage) || "-")}</div>
          <div><strong>Dernier passage:</strong> ${escapeHtml(toIsoDate(client.dateDernierPassage) || "-")}</div>
          <div><strong>Statut:</strong> ${escapeHtml(client.statutVisuel || "-")}</div>
          <div><strong>Total depense:</strong> ${formatCurrency(synthese.montantTotalDepense)}</div>
        </div>
      </div>

      <div class="section">
        <h3>Historique commandes</h3>
        <table>
          <thead><tr><th>Date</th><th>Type habit</th><th>Statut</th><th>Montant</th></tr></thead>
          <tbody>${commandesRows || '<tr><td colspan="4">Aucune commande</td></tr>'}</tbody>
        </table>
      </div>

      <div class="section">
        <h3>Historique retouches</h3>
        <table>
          <thead><tr><th>Date</th><th>Type habit</th><th>Type retouche</th><th>Statut</th><th>Montant</th></tr></thead>
          <tbody>${retouchesRows || '<tr><td colspan="5">Aucune retouche</td></tr>'}</tbody>
        </table>
      </div>

      <div class="section">
        <h3>Historique mesures</h3>
        <table>
          <thead><tr><th>Date</th><th>Type habit</th><th>Source</th><th>Mesures</th></tr></thead>
          <tbody>${mesuresRows || '<tr><td colspan="4">Aucune mesure</td></tr>'}</tbody>
        </table>
      </div>
      <p class="foot">Document de consultation genere automatiquement</p>
      ${autoPrint ? "<script>window.addEventListener('load', () => window.print());</script>" : ""}
    </body>
  </html>`;
}

// List clients
router.get("/clients", async (req, res) => {
  try {
    const clients = await clientRepo.listAll();
    res.json(clients);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// Consultation client (read-only)
router.get("/clients/:id/consultation", async (req, res) => {
  const idClient = req.params.id;
  const source = String(req.query.source || "ALL").toUpperCase();
  const typeHabit = String(req.query.typeHabit || "ALL").toUpperCase();
  const periode = String(req.query.periode || "ALL").toUpperCase();
  const size = positiveInt(req.query.size, 20, 200);
  const pageCommandes = positiveInt(req.query.pageCommandes, 1, 5000);
  const pageRetouches = positiveInt(req.query.pageRetouches, 1, 5000);
  const pageMesures = positiveInt(req.query.pageMesures, 1, 5000);

  try {
    const clientResult = await pool.query(
      `SELECT id_client, nom, prenom, telephone, date_creation
       FROM clients
       WHERE id_client = $1`,
      [idClient]
    );

    if (clientResult.rowCount === 0) {
      return res.status(404).json({ error: "Client introuvable" });
    }

    const commandesResult = await pool.query(
      `SELECT id_commande, date_creation, type_habit, statut, montant_total, montant_paye, mesures_habit_snapshot
       FROM commandes
       WHERE id_client = $1
       ORDER BY date_creation DESC`,
      [idClient]
    );

    const retouchesResult = await pool.query(
      `SELECT id_retouche, date_depot, type_habit, type_retouche, statut, montant_total, montant_paye, mesures_habit_snapshot
       FROM retouches
       WHERE id_client = $1
       ORDER BY date_depot DESC`,
      [idClient]
    );

    const client = clientResult.rows[0];
    const commandes = commandesResult.rows.map((row) => ({
      idCommande: row.id_commande,
      date: row.date_creation,
      typeHabit: row.type_habit || "",
      statut: row.statut,
      montant: Number(row.montant_total || 0),
      montantPaye: Number(row.montant_paye || 0)
    }));
    const retouches = retouchesResult.rows.map((row) => ({
      idRetouche: row.id_retouche,
      date: row.date_depot,
      typeHabit: row.type_habit || "",
      typeRetouche: row.type_retouche || "",
      statut: row.statut,
      montant: Number(row.montant_total || 0),
      montantPaye: Number(row.montant_paye || 0)
    }));

    const mesuresCommandes = commandesResult.rows
      .filter((row) => row.mesures_habit_snapshot && typeof row.mesures_habit_snapshot === "object")
      .map((row) => ({
        datePrise: row.date_creation,
        typeHabit: row.type_habit || "",
        mesures: normalizeMesuresSnapshot(row.mesures_habit_snapshot, row.type_habit),
        unite: "cm",
        source: "COMMANDE",
        idOrigine: row.id_commande
      }))
      .filter((row) => row.mesures);

    const mesuresRetouches = retouchesResult.rows
      .filter((row) => row.mesures_habit_snapshot && typeof row.mesures_habit_snapshot === "object")
      .map((row) => ({
        datePrise: row.date_depot,
        typeHabit: row.type_habit || "",
        mesures: normalizeMesuresSnapshot(row.mesures_habit_snapshot, row.type_habit),
        unite: "cm",
        source: "RETOUCHE",
        idOrigine: row.id_retouche
      }))
      .filter((row) => row.mesures);

    const mesures = [...mesuresCommandes, ...mesuresRetouches].sort((a, b) =>
      String(b.datePrise || "").localeCompare(String(a.datePrise || ""))
    );

    const datesActivite = [
      ...commandes.map((item) => item.date).filter(Boolean),
      ...retouches.map((item) => item.date).filter(Boolean)
    ].sort((a, b) => String(a).localeCompare(String(b)));

    const datePremierPassage = datesActivite[0] || client.date_creation || null;
    const dateDerniereActivite = datesActivite.length > 0 ? datesActivite[datesActivite.length - 1] : null;
    const totalInteractions = commandes.length + retouches.length;
    const montantTotalDepense =
      commandes.reduce((sum, item) => sum + Number(item.montant || 0), 0) + retouches.reduce((sum, item) => sum + Number(item.montant || 0), 0);

    const filtered = filterHistoriques({
      commandes,
      retouches,
      mesures,
      source,
      typeHabit,
      periode
    });

    const pagedCommandes = paginateRows(filtered.commandes, pageCommandes, size);
    const pagedRetouches = paginateRows(filtered.retouches, pageRetouches, size);
    const pagedMesures = paginateRows(filtered.mesures, pageMesures, size);

    res.json({
      client: {
        idClient: client.id_client,
        nomComplet: `${client.nom || ""} ${client.prenom || ""}`.trim(),
        telephone: client.telephone || "",
        datePremierPassage,
        dateDernierPassage: dateDerniereActivite,
        statutVisuel: statutFidelite(totalInteractions)
      },
      synthese: {
        totalCommandes: commandes.length,
        totalRetouches: retouches.length,
        dateDerniereActivite,
        montantTotalDepense: Number(montantTotalDepense || 0)
      },
      historique: {
        commandes: pagedCommandes.rows,
        retouches: pagedRetouches.rows,
        mesures: pagedMesures.rows,
        pagination: {
          commandes: {
            page: pagedCommandes.page,
            size: pagedCommandes.size,
            total: pagedCommandes.total,
            totalPages: pagedCommandes.totalPages
          },
          retouches: {
            page: pagedRetouches.page,
            size: pagedRetouches.size,
            total: pagedRetouches.total,
            totalPages: pagedRetouches.totalPages
          },
          mesures: {
            page: pagedMesures.page,
            size: pagedMesures.size,
            total: pagedMesures.total,
            totalPages: pagedMesures.totalPages
          }
        },
        resultats: {
          commandes: pagedCommandes.total,
          retouches: pagedRetouches.total,
          mesures: pagedMesures.total
        },
        filtres: {
          source,
          typeHabit,
          periode
        }
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/clients/:id/consultation/pdf", async (req, res) => {
  try {
    const query = {
      ...req.query,
      size: req.query.size || "200"
    };
    req.query = query;

    const idClient = req.params.id;
    const source = String(req.query.source || "ALL").toUpperCase();
    const typeHabit = String(req.query.typeHabit || "ALL").toUpperCase();
    const periode = String(req.query.periode || "ALL").toUpperCase();
    const size = positiveInt(req.query.size, 200, 500);

    const clientResult = await pool.query(
      `SELECT id_client, nom, prenom, telephone, date_creation
       FROM clients
       WHERE id_client = $1`,
      [idClient]
    );
    if (clientResult.rowCount === 0) return res.status(404).json({ error: "Client introuvable" });

    const commandesResult = await pool.query(
      `SELECT id_commande, date_creation, type_habit, statut, montant_total, montant_paye, mesures_habit_snapshot
       FROM commandes WHERE id_client = $1 ORDER BY date_creation DESC`,
      [idClient]
    );
    const retouchesResult = await pool.query(
      `SELECT id_retouche, date_depot, type_habit, type_retouche, statut, montant_total, montant_paye, mesures_habit_snapshot
       FROM retouches WHERE id_client = $1 ORDER BY date_depot DESC`,
      [idClient]
    );

    const client = clientResult.rows[0];
    const commandes = commandesResult.rows.map((row) => ({
      idCommande: row.id_commande,
      date: row.date_creation,
      typeHabit: row.type_habit || "",
      statut: row.statut,
      montant: Number(row.montant_total || 0)
    }));
    const retouches = retouchesResult.rows.map((row) => ({
      idRetouche: row.id_retouche,
      date: row.date_depot,
      typeHabit: row.type_habit || "",
      typeRetouche: row.type_retouche || "",
      statut: row.statut,
      montant: Number(row.montant_total || 0)
    }));
    const mesures = [
      ...commandesResult.rows
        .map((row) => ({
          datePrise: row.date_creation,
          typeHabit: row.type_habit || "",
          mesures: normalizeMesuresSnapshot(row.mesures_habit_snapshot, row.type_habit),
          source: "COMMANDE"
        }))
        .filter((row) => row.mesures),
      ...retouchesResult.rows
        .map((row) => ({
          datePrise: row.date_depot,
          typeHabit: row.type_habit || "",
          mesures: normalizeMesuresSnapshot(row.mesures_habit_snapshot, row.type_habit),
          source: "RETOUCHE"
        }))
        .filter((row) => row.mesures)
    ];

    const filtered = filterHistoriques({ commandes, retouches, mesures, source, typeHabit, periode });
    const pagedCommandes = paginateRows(filtered.commandes, 1, size);
    const pagedRetouches = paginateRows(filtered.retouches, 1, size);
    const pagedMesures = paginateRows(filtered.mesures, 1, size);
    const datesActivite = [...commandes.map((x) => x.date).filter(Boolean), ...retouches.map((x) => x.date).filter(Boolean)].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    const datePremierPassage = datesActivite[0] || client.date_creation || null;
    const dateDerniereActivite = datesActivite.length > 0 ? datesActivite[datesActivite.length - 1] : null;
    const totalInteractions = commandes.length + retouches.length;

    const payload = {
      client: {
        idClient: client.id_client,
        nomComplet: `${client.nom || ""} ${client.prenom || ""}`.trim(),
        telephone: client.telephone || "",
        datePremierPassage,
        dateDernierPassage: dateDerniereActivite,
        statutVisuel: statutFidelite(totalInteractions)
      },
      synthese: {
        totalCommandes: commandes.length,
        totalRetouches: retouches.length,
        dateDerniereActivite,
        montantTotalDepense:
          commandes.reduce((sum, row) => sum + Number(row.montant || 0), 0) + retouches.reduce((sum, row) => sum + Number(row.montant || 0), 0)
      },
      historique: {
        commandes: pagedCommandes.rows,
        retouches: pagedRetouches.rows,
        mesures: pagedMesures.rows
      }
    };

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(consultationPdfHtml(payload, req.query.autoprint === "1"));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create client
router.post("/clients", async (req, res) => {
  const r1 = requireFields(req.body, ["nom", "prenom", "telephone"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const client = creerClient({
      ...req.body,
      idClient: generateClientId()
    });
    await clientRepo.save(client);
    res.status(201).json({
      client,
      event: {
        type: "CLIENT_CREE",
        message: `Client ${client.idClient} cree avec succes`,
        entityId: client.idClient,
        occurredAt: new Date().toISOString()
      }
    });
  } catch (err) {
    if (err instanceof DomainError) {
      return res.status(422).json({
        error: err.message,
        errorType: err.name,
        source: "domain"
      });
    }
    res.status(400).json({ error: err.message });
  }
});

// Update client
router.put("/clients/:id", async (req, res) => {
  try {
    const client = await modifierClient({ idClient: req.params.id, input: req.body, clientRepo });
    res.json(client);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Deactivate client
router.post("/clients/:id/desactiver", async (req, res) => {
  try {
    const client = await desactiverClient({ idClient: req.params.id, clientRepo });
    res.json(client);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Enregistrer serie mesures
router.post("/clients/:id/mesures", async (req, res) => {
  const r1 = requireFields(req.body, ["typeVetement", "ensembleMesures"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const serie = enregistrerSerieMesures({
      idSerieMesures: generateSerieMesuresId(),
      idClient: req.params.id,
      typeVetement: req.body.typeVetement,
      ensembleMesures: req.body.ensembleMesures,
      prisePar: req.body.prisePar,
      observations: req.body.observations
    });
    await serieRepo.save(serie);
    res.status(201).json(serie);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Activer serie mesures
router.post("/clients/:id/mesures/:idSerie/activer", async (req, res) => {
  try {
    const serie = await activerSerieMesures({
      idClient: req.params.id,
      typeVetement: req.body.typeVetement,
      idSerieMesures: req.params.idSerie,
      serieRepo
    });
    res.json(serie);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Desactiver serie mesures
router.post("/clients/:id/mesures/:idSerie/desactiver", async (req, res) => {
  try {
    const serie = await desactiverSerieMesures({ idSerieMesures: req.params.idSerie, serieRepo });
    res.json(serie);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;


