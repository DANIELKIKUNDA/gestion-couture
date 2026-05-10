<script setup>
defineProps({
  title: {
    type: String,
    default: "Filtres"
  },
  summary: {
    type: String,
    default: ""
  },
  open: {
    type: Boolean,
    default: false
  },
  collapsible: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(["toggle"]);
</script>

<template>
  <article class="mobile-filter-block" :class="{ 'mobile-filter-block--open': open }">
    <button
      v-if="collapsible"
      type="button"
      class="mobile-filter-block__trigger"
      :aria-expanded="open ? 'true' : 'false'"
      @click="emit('toggle')"
    >
      <div class="mobile-filter-block__copy">
        <strong>{{ title }}</strong>
        <span v-if="summary">{{ summary }}</span>
      </div>
      <span class="mobile-filter-block__chevron" aria-hidden="true">{{ open ? "-" : "+" }}</span>
    </button>

    <div v-else class="mobile-filter-block__static-head">
      <strong>{{ title }}</strong>
      <span v-if="summary">{{ summary }}</span>
    </div>

    <div v-show="!collapsible || open" class="mobile-filter-block__body">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.mobile-filter-block {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(31, 90, 162, 0.12);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 251, 255, 0.98) 100%);
  box-shadow: 0 12px 26px rgba(31, 90, 162, 0.07);
}

.mobile-filter-block__trigger,
.mobile-filter-block__static-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.mobile-filter-block__trigger {
  border: none;
  padding: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.mobile-filter-block__copy {
  display: grid;
  gap: 3px;
}

.mobile-filter-block__copy strong,
.mobile-filter-block__static-head strong {
  color: #17324d;
  font-size: 13px;
  letter-spacing: 0;
}

.mobile-filter-block__copy span,
.mobile-filter-block__static-head span {
  color: #5a7391;
  font-size: 12px;
  line-height: 1.4;
}

.mobile-filter-block__chevron {
  flex-shrink: 0;
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #eaf3ff;
  color: #1f5aa2;
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}

.mobile-filter-block__body {
  display: grid;
  gap: 10px;
}

.mobile-filter-block__body :deep(.filters.compact) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.mobile-filter-block__body :deep(.filters.compact > input),
.mobile-filter-block__body :deep(.commande-client-picker),
.mobile-filter-block__body :deep(.retouche-client-picker) {
  grid-column: 1 / -1;
}

.mobile-filter-block__body :deep(.filters.compact input),
.mobile-filter-block__body :deep(.filters.compact select) {
  min-height: 44px;
  border-color: rgba(31, 90, 162, 0.13);
  border-radius: 12px;
  background: #ffffff;
}

.mobile-filter-block__body :deep(.filters.compact input) {
  background:
    linear-gradient(90deg, rgba(31, 90, 162, 0.05), transparent 34%),
    #ffffff;
}

.mobile-filter-block__body :deep(.filters.compact input[type="search"]) {
  padding-left: 38px;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%231f5aa2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.3-4.3'/%3E%3C/svg%3E"),
    linear-gradient(90deg, rgba(31, 90, 162, 0.05), transparent 34%);
  background-repeat: no-repeat, no-repeat;
  background-position: 12px center, left center;
  background-size: 18px 18px, auto;
}

.mobile-filter-block__body :deep(.panel-footer) {
  margin-top: 0;
}

.mobile-filter-block__body :deep(.panel-footer .mini-btn) {
  width: 100%;
  justify-content: center;
  border-color: rgba(71, 84, 103, 0.16);
  background: #f8fafc;
  color: #475467;
}
</style>
