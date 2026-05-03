<script setup>
import { computed } from "vue";

const props = defineProps({
  modelValue: { type: String, required: true }
});

const emit = defineEmits(["update:modelValue"]);

function toDate(isoDate) {
  const value = String(isoDate || "").trim();
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate, days) {
  const date = toDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

function todayIso() {
  return toIso(new Date());
}

const relativeLabel = computed(() => {
  const selected = toDate(props.modelValue);
  const today = toDate(todayIso());
  const diff = Math.round((selected.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === -1) return "Hier";
  if (diff === -2) return "Avant-hier";
  if (diff === 1) return "Demain";
  if (diff === 2) return "Apres-demain";
  return "";
});

const dateLabel = computed(() =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(toDate(props.modelValue))
);

const isToday = computed(() => props.modelValue === todayIso());

function move(days) {
  emit("update:modelValue", addDays(props.modelValue, days));
}

function goToday() {
  emit("update:modelValue", todayIso());
}
</script>

<template>
  <div class="date-navigator" aria-label="Navigation par jour">
    <button type="button" class="date-navigator__button" aria-label="Jour precedent" @click="move(-1)">
      <span aria-hidden="true" class="date-navigator__chevron">&lt;</span>
    </button>
    <div class="date-navigator__label">
      <strong>{{ relativeLabel || dateLabel }}</strong>
      <span>{{ dateLabel }}</span>
      <button v-if="!isToday" type="button" class="date-navigator__today" @click="goToday">
        Aujourd'hui
      </button>
    </div>
    <button type="button" class="date-navigator__button" aria-label="Jour suivant" @click="move(1)">
      <span aria-hidden="true" class="date-navigator__chevron">&gt;</span>
    </button>
  </div>
</template>

<style scoped>
.date-navigator {
  display: inline-grid;
  grid-template-columns: 38px minmax(168px, 1fr) 38px;
  align-items: center;
  gap: 6px;
  min-width: min(100%, 292px);
  padding: 4px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.07);
}

.date-navigator__button {
  width: 38px;
  height: 38px;
  display: inline-grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  color: var(--text-color, #1f2937);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
}

.date-navigator__button:hover {
  border-color: rgba(59, 130, 246, 0.42);
  background: #ffffff;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.11);
  transform: translateY(-1px);
}

.date-navigator__button:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.date-navigator__chevron {
  display: inline-block;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  transform: translateY(-1px);
}

.date-navigator__label {
  min-width: 0;
  text-align: center;
  display: grid;
  gap: 2px;
  justify-items: center;
}

.date-navigator__label strong,
.date-navigator__label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-navigator__label strong {
  font-size: 0.98rem;
}

.date-navigator__label span {
  color: var(--muted-color, #667085);
  font-size: 0.82rem;
  text-transform: capitalize;
}

.date-navigator__today {
  border: 0;
  background: transparent;
  color: #255a97;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  padding: 2px 4px 0;
}

@media (max-width: 520px) {
  .date-navigator {
    width: 100%;
    grid-template-columns: 36px minmax(0, 1fr) 36px;
    min-width: 0;
    gap: 5px;
    padding: 3px;
  }

  .date-navigator__button {
    width: 36px;
    height: 36px;
    border-radius: 9px;
  }

  .date-navigator__label strong {
    font-size: 0.92rem;
  }

  .date-navigator__label span {
    font-size: 0.76rem;
  }

  .date-navigator__today {
    font-size: 0.68rem;
  }
}
</style>
