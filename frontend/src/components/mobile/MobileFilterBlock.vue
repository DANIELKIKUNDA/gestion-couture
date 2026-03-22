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
  gap: 10px;
  padding: 12px;
  border: 1px solid #dde6ef;
  border-radius: 18px;
  background: #f9fbfe;
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
  font-size: 14px;
}

.mobile-filter-block__copy span,
.mobile-filter-block__static-head span {
  color: #5a7391;
  font-size: 12px;
  line-height: 1.4;
}

.mobile-filter-block__chevron {
  flex-shrink: 0;
  color: #2c5685;
  font-size: 18px;
  line-height: 1;
}

.mobile-filter-block__body {
  display: grid;
  gap: 10px;
}
</style>
