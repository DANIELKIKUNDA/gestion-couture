<script setup>
import { computed } from "vue";

const props = defineProps({
  page: {
    type: Number,
    required: true
  },
  pages: {
    type: Number,
    required: true
  },
  pageSize: {
    type: Number,
    default: null
  },
  pageSizeOptions: {
    type: Array,
    default: () => []
  },
  showPageSize: {
    type: Boolean,
    default: true
  },
  prevDisabled: {
    type: Boolean,
    default: false
  },
  nextDisabled: {
    type: Boolean,
    default: false
  },
  desktopSummary: {
    type: String,
    default: ""
  },
  mobileSummary: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["prev", "next", "update:pageSize"]);

const desktopSummaryText = computed(() => props.desktopSummary || `Page ${props.page} / ${props.pages}`);
const mobileSummaryText = computed(() => props.mobileSummary || `${props.page} / ${props.pages}`);

function updatePageSize(event) {
  emit("update:pageSize", Number(event.target.value));
}
</script>

<template>
  <div class="panel-footer responsive-pagination">
    <div class="responsive-pagination__desktop">
      <select
        v-if="showPageSize && pageSize !== null && pageSizeOptions.length > 0"
        :value="pageSize"
        @change="updatePageSize"
      >
        <option v-for="option in pageSizeOptions" :key="`page-size-${option}`" :value="option">
          {{ option }} / page
        </option>
      </select>
      <button type="button" class="mini-btn" :disabled="prevDisabled" @click="emit('prev')">Precedent</button>
      <span>{{ desktopSummaryText }}</span>
      <button type="button" class="mini-btn" :disabled="nextDisabled" @click="emit('next')">Suivant</button>
    </div>

    <div class="responsive-pagination__mobile">
      <button
        type="button"
        class="mini-btn responsive-pagination__mobile-btn"
        :disabled="prevDisabled"
        aria-label="Page precedente"
        @click="emit('prev')"
      >
        &lt;
      </button>
      <span class="responsive-pagination__mobile-status">{{ mobileSummaryText }}</span>
      <button
        type="button"
        class="mini-btn responsive-pagination__mobile-btn"
        :disabled="nextDisabled"
        aria-label="Page suivante"
        @click="emit('next')"
      >
        &gt;
      </button>
    </div>
  </div>
</template>

<style scoped>
.responsive-pagination {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.responsive-pagination__desktop,
.responsive-pagination__mobile {
  width: 100%;
  align-items: center;
  gap: 8px;
}

.responsive-pagination__desktop {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
}

.responsive-pagination__mobile {
  display: none;
}

.responsive-pagination__mobile-status {
  min-width: 0;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: #17324d;
}

.responsive-pagination__mobile-btn {
  width: 44px;
  min-width: 44px;
  min-height: 42px;
  padding: 0;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
}

@media (max-width: 767px) {
  .responsive-pagination__desktop {
    display: none;
  }

  .responsive-pagination__mobile {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
  }
}
</style>
