<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  formatDate: {
    type: Function,
    required: true
  },
  formatMesuresLines: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(["view"]);

function cardTone(row) {
  return String(row?.source || "").trim() === "RETOUCHE" ? "warning" : "info";
}

function titleFor(row) {
  return String(row?.typeHabit || "").trim() || "Mesures";
}

function previewLines(row) {
  return props.formatMesuresLines(row?.mesures).slice(0, 3);
}

function hiddenLinesCount(row) {
  return Math.max(0, props.formatMesuresLines(row?.mesures).length - 3);
}

function metaItemsFor(row) {
  return [
    {
      key: "date",
      label: "Date de prise",
      value: props.formatDate(row?.datePrise)
    },
    {
      key: "source",
      label: "Source",
      value: row?.source || "-"
    }
  ];
}
</script>

<template>
  <div class="client-history-mobile-list">
    <MobileEntityCard
      v-for="(row, index) in items"
      :key="`mesure-history-${row.source}-${row.idOrigine}-${index}`"
      eyebrow="Mesures"
      :title="titleFor(row)"
      :subtitle="row.datePrise ? `Prises le ${formatDate(row.datePrise)}` : 'Snapshot de mesures'"
      :tone="cardTone(row)"
    >
      <template #meta>
        <MobileMetaList :items="metaItemsFor(row)" />
      </template>

      <div class="client-history-mobile-list__preview">
        <strong>Apercu</strong>
        <ul v-if="previewLines(row).length > 0">
          <li v-for="(line, lineIndex) in previewLines(row)" :key="`preview-${index}-${lineIndex}`">{{ line }}</li>
        </ul>
        <p v-else>Aucune mesure</p>
        <p v-if="hiddenLinesCount(row) > 0" class="client-history-mobile-list__more">
          + {{ hiddenLinesCount(row) }} autre(s) mesure(s)
        </p>
      </div>

      <template #footer>
        <button type="button" class="action-btn blue client-history-mobile-list__action" @click="emit('view', row)">
          Voir l'origine
        </button>
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.client-history-mobile-list {
  display: grid;
  gap: 12px;
}

.client-history-mobile-list__preview {
  display: grid;
  gap: 6px;
  color: #17324d;
}

.client-history-mobile-list__preview strong {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6d86a0;
}

.client-history-mobile-list__preview ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 4px;
}

.client-history-mobile-list__preview p {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
}

.client-history-mobile-list__more {
  color: #5a7391;
  font-size: 12px;
}

.client-history-mobile-list__action {
  width: 100%;
}
</style>
