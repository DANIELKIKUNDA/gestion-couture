<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  formatDateTime: {
    type: Function,
    required: true
  }
});

function subtitleFor(event) {
  const user = event?.utilisateurNom || "Utilisateur inconnu";
  const role = event?.role || "Role non renseigne";
  return `${user} - ${role}`;
}

function metaItemsFor(event) {
  return [
    {
      key: "date",
      label: "Date",
      value: props.formatDateTime(event?.dateEvent)
    },
    {
      key: "precedent",
      label: "Etat precedent",
      value: event?.ancienStatutLabel || "-"
    },
    {
      key: "nouveau",
      label: "Nouvel etat",
      value: event?.nouveauStatutLabel || "-",
      emphasis: true,
      tone: "info"
    },
    {
      key: "utilisateur",
      label: "Utilisateur",
      value: event?.utilisateurNom || "-"
    },
    {
      key: "role",
      label: "Role",
      value: event?.role || "-"
    }
  ];
}
</script>

<template>
  <div class="retouche-detail-event-mobile-list">
    <p v-if="loading" class="helper">Chargement...</p>
    <MobileStateEmpty
      v-else-if="items.length === 0"
      title="Aucun evenement enregistre"
      description="Les changements d'etat apparaitront ici."
    />
    <template v-else>
      <MobileEntityCard
        v-for="event in items"
        :key="event.idEvent"
        eyebrow="Evenement"
        :title="event.typeEventLabel || 'Evenement'"
        :subtitle="subtitleFor(event)"
        tone="info"
      >
        <template #badge>
          <span class="status-pill" :data-status="event.nouveauStatut || ''">
            {{ event.nouveauStatutLabel || "-" }}
          </span>
        </template>

        <template #meta>
          <MobileMetaList :items="metaItemsFor(event)" />
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.retouche-detail-event-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
