<script setup>
import { computed } from "vue";
import DashboardActivityMobileList from "./DashboardActivityMobileList.vue";
import DashboardRecentWorkMobileList from "./DashboardRecentWorkMobileList.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";

const props = defineProps({
  isMobileViewport: { type: Boolean, default: false },
  tailorDashboardCards: { type: Array, default: () => [] },
  tailorCollections: { type: Object, default: () => ({ dueToday: [], overdue: [], ready: [] }) },
  dashboardProductionRecentRows: { type: Array, default: () => [] },
  formatCurrency: { type: Function, required: true },
  openRoute: { type: Function, required: true }
});

function card(label) {
  return props.tailorDashboardCards.find((item) => item?.label === label) || { label, value: 0, tone: "neutral" };
}

const productionCards = computed(() => [
  { ...card("A faire aujourd'hui"), description: "Travaux prevus pour la journee affichee." },
  { ...card("En retard"), description: "Travaux dont la date prevue est deja passee." },
  { ...card("Commandes en cours"), description: "Commandes encore en production." },
  { ...card("Retouches en cours"), description: "Retouches encore en production." },
  { ...card("Termines"), description: "Travaux termines et prets a remettre." }
]);

const mainStatus = computed(() => {
  const overdue = Number(card("En retard").value || 0);
  const dueToday = Number(card("A faire aujourd'hui").value || 0);
  if (overdue > 0) {
    return {
      title: `${overdue} travail(aux) en retard`,
      description: "Commencez par ces pieces avant le reste.",
      tone: "danger"
    };
  }
  if (dueToday > 0) {
    return {
      title: `${dueToday} travail(aux) a faire aujourd'hui`,
      description: "La journee est claire: terminez d'abord ces pieces.",
      tone: "warning"
    };
  }
  return {
    title: "Aucun retard visible",
    description: "La production est calme pour la date affichee.",
    tone: "success"
  };
});
</script>

<template>
  <div class="tailor-cockpit" :class="{ 'tailor-cockpit--mobile': isMobileViewport }">
    <section class="tailor-section tailor-section--state" aria-labelledby="tailor-state-title">
      <div class="tailor-section-head">
        <div>
          <p class="tailor-overline">Atelier couture</p>
          <h3 id="tailor-state-title">Travail a faire</h3>
        </div>
        <div class="tailor-actions">
          <button class="action-btn blue" type="button" @click="openRoute('commandes')">Commandes</button>
          <button class="action-btn green" type="button" @click="openRoute('retouches')">Retouches</button>
        </div>
      </div>

      <article class="tailor-status-card" :data-tone="mainStatus.tone">
        <strong>{{ mainStatus.title }}</strong>
        <p>{{ mainStatus.description }}</p>
      </article>

      <div class="tailor-metric-grid">
        <article v-for="item in productionCards" :key="item.label" class="tailor-metric-card" :data-tone="item.tone">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section class="tailor-section tailor-section--today" aria-labelledby="tailor-today-title">
      <div class="tailor-section-head">
        <div>
          <p class="tailor-overline">Aujourd'hui</p>
          <h3 id="tailor-today-title">A faire aujourd'hui</h3>
        </div>
        <span class="tailor-pill">{{ tailorCollections.dueToday.length }} travail(aux)</span>
      </div>
      <DashboardActivityMobileList
        :items="tailorCollections.dueToday"
        title="Travail du jour"
        empty-label="Aucun travail prevu aujourd'hui"
        tone="info"
      />
    </section>

    <section class="tailor-section tailor-section--late" aria-labelledby="tailor-late-title">
      <div class="tailor-section-head">
        <div>
          <p class="tailor-overline">Urgent</p>
          <h3 id="tailor-late-title">En retard</h3>
        </div>
      </div>
      <DashboardActivityMobileList
        :items="tailorCollections.overdue"
        title="Travail en retard"
        empty-label="Aucun travail en retard"
        tone="warning"
        badge-label="Urgent"
      />
    </section>

    <section class="tailor-section" aria-labelledby="tailor-ready-title">
      <div class="tailor-section-head">
        <div>
          <p class="tailor-overline">Termine</p>
          <h3 id="tailor-ready-title">Prets a remettre</h3>
        </div>
      </div>
      <DashboardActivityMobileList
        :items="tailorCollections.ready"
        title="Travail termine"
        empty-label="Aucun travail termine"
        tone="info"
        badge-label="Pret"
      />
    </section>

    <section class="tailor-section" aria-labelledby="tailor-recent-title">
      <div class="tailor-section-head">
        <div>
          <p class="tailor-overline">Activite</p>
          <h3 id="tailor-recent-title">Ce qui a bouge recemment</h3>
        </div>
      </div>
      <DashboardRecentWorkMobileList
        v-if="dashboardProductionRecentRows.length > 0"
        :items="dashboardProductionRecentRows"
        :format-currency="formatCurrency"
      />
      <MobileStateEmpty
        v-else
        title="Aucune activite recente"
        description="Aucune commande ou retouche recente pour la date affichee."
      />
    </section>
  </div>
</template>

<style scoped>
.tailor-cockpit {
  display: grid;
  gap: 14px;
}

.tailor-section {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid #d9e4ef;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 16px 36px rgba(22, 47, 78, 0.08);
  min-width: 0;
}

.tailor-section--state {
  background:
    radial-gradient(circle at top right, rgba(37, 90, 151, 0.09), transparent 30%),
    linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%);
}

.tailor-section--today {
  border-color: #d6e4f2;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
}

.tailor-section--late {
  border-color: #ead1b9;
  background:
    radial-gradient(circle at top right, rgba(159, 92, 31, 0.08), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #fffaf5 100%);
}

.tailor-section-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.tailor-section-head h3 {
  margin: 0;
  color: #153553;
  font-size: clamp(21px, 2.2vw, 28px);
  line-height: 1.1;
}

.tailor-overline {
  margin: 0 0 4px;
  color: #607b98;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.tailor-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.tailor-status-card,
.tailor-metric-card {
  border: 1px solid #dce7f2;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 28px rgba(22, 47, 78, 0.07);
}

.tailor-status-card {
  display: grid;
  gap: 5px;
  padding: 15px;
}

.tailor-status-card strong {
  color: #237246;
  font-size: 20px;
}

.tailor-status-card[data-tone="warning"] strong {
  color: #9f5c1f;
}

.tailor-status-card[data-tone="danger"] strong {
  color: #b74235;
}

.tailor-status-card p,
.tailor-metric-card p {
  margin: 0;
  color: #5b728d;
  line-height: 1.45;
}

.tailor-metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.tailor-metric-card {
  display: grid;
  gap: 8px;
  padding: 15px;
}

.tailor-metric-card span {
  color: #607b98;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.tailor-metric-card strong {
  color: #1c4f82;
  font-size: clamp(24px, 2.5vw, 34px);
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.tailor-metric-card[data-tone="green"] strong {
  color: #237246;
}

.tailor-metric-card[data-tone="amber"] strong {
  color: #9f5c1f;
}

.tailor-metric-card[data-tone="teal"] strong {
  color: #177878;
}

.tailor-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid #d6e4f2;
  border-radius: 999px;
  background: #f7fbff;
  color: #255a97;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

@media (max-width: 1260px) {
  .tailor-metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .tailor-section {
    padding: 14px;
    border-radius: 16px;
  }

  .tailor-section-head,
  .tailor-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .tailor-metric-grid {
    grid-template-columns: 1fr;
  }

  .tailor-actions .action-btn {
    width: 100%;
  }
}
</style>
