<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  formatDateTime: {
    type: Function,
    required: true
  },
  formatAuditAction: {
    type: Function,
    required: true
  },
  formatRoleLabel: {
    type: Function,
    required: true
  },
  formatAuditEntity: {
    type: Function,
    required: true
  },
  formatAuditStatus: {
    type: Function,
    required: true
  },
  hasAuditMetadata: {
    type: Function,
    required: true
  },
  auditMetadataJson: {
    type: Function,
    required: true
  },
  auditUserDiffRows: {
    type: Function,
    required: true
  }
});

function toneFor(row) {
  return row?.success ? "success" : "warning";
}

function titleFor(row) {
  return props.formatAuditAction(row) || "Evenement utilisateur";
}

function subtitleFor(row) {
  const user = row?.userName || row?.userId || "Utilisateur inconnu";
  return `${props.formatDateTime(row?.createdAt)} · ${user}`;
}

function metaItemsFor(row) {
  return [
    {
      key: "email",
      label: "Email",
      value: row?.userEmail || "-"
    },
    {
      key: "role",
      label: "Role",
      value: props.formatRoleLabel(row?.role)
    },
    {
      key: "cible",
      label: "Cible",
      value: props.formatAuditEntity(row)
    },
    {
      key: "type-cible",
      label: "Type cible",
      value: row?.entityType || "-"
    },
    {
      key: "statut",
      label: "Statut",
      value: props.formatAuditStatus(row),
      emphasis: true,
      tone: row?.success ? "success" : "warning"
    },
    {
      key: "raison",
      label: "Raison",
      value: row?.success ? "-" : (row?.reason || "-")
    }
  ];
}

function diffRowsFor(row) {
  return props.auditUserDiffRows(row?.metadata);
}
</script>

<template>
  <div class="audit-utilisateur-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucun evenement utilisateur"
      description="Aucun evenement ne correspond aux filtres actuels."
    />
    <template v-else>
      <MobileEntityCard
        v-for="row in items"
        :key="row.idEvenement"
        eyebrow="Audit utilisateur"
        :title="titleFor(row)"
        :subtitle="subtitleFor(row)"
        :tone="toneFor(row)"
      >
        <template #badge>
          <span class="status-pill" :data-tone="row.success ? 'ok' : 'due'">
            {{ row.success ? "Succes" : "Echec" }}
          </span>
        </template>

        <template #meta>
          <MobileMetaList :items="metaItemsFor(row)" />
        </template>

        <template #footer>
          <details class="audit-utilisateur-mobile-list__details">
            <summary>Voir details</summary>
            <div class="audit-utilisateur-mobile-list__details-body">
              <template v-if="diffRowsFor(row).length > 0">
                <div
                  v-for="item in diffRowsFor(row)"
                  :key="`${row.idEvenement}-${item.key}`"
                  class="audit-utilisateur-mobile-list__diff-item"
                >
                  <strong>{{ item.label }}</strong>
                  <span>Avant : {{ item.before }}</span>
                  <span>Apres : {{ item.after }}</span>
                </div>
              </template>
              <template v-else-if="hasAuditMetadata(row)">
                <pre>{{ auditMetadataJson(row) }}</pre>
              </template>
              <template v-else>
                <p class="helper">Aucun detail technique pour cet evenement.</p>
              </template>
            </div>
          </details>
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.audit-utilisateur-mobile-list {
  display: grid;
  gap: 12px;
}

.audit-utilisateur-mobile-list__details {
  display: grid;
  gap: 10px;
}

.audit-utilisateur-mobile-list__details summary {
  cursor: pointer;
  color: #1f4f87;
  font-weight: 600;
}

.audit-utilisateur-mobile-list__details-body {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.audit-utilisateur-mobile-list__details-body pre {
  margin: 0;
  padding: 10px;
  border-radius: 12px;
  background: #f5f8fc;
  color: #17324d;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
}

.audit-utilisateur-mobile-list__diff-item {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid #e4ebf3;
  border-radius: 12px;
  background: #f9fbfe;
}

.audit-utilisateur-mobile-list__diff-item strong {
  color: #17324d;
  font-size: 13px;
}

.audit-utilisateur-mobile-list__diff-item span {
  color: #5a7391;
  font-size: 12px;
  line-height: 1.4;
}
</style>
