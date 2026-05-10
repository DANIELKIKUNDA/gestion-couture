<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  modelValue: { type: String, required: true }
});

const emit = defineEmits(["update:modelValue"]);
const calendarOpen = ref(false);
const visibleMonth = ref(monthStart(toDate(props.modelValue)));
const pickerRef = ref(null);

const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(isoDate, days) {
  const date = toDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

function todayIso() {
  return toIso(new Date());
}

function sameDay(first, second) {
  return toIso(first) === toIso(second);
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

const monthLabel = computed(() =>
  new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric"
  }).format(visibleMonth.value)
);

const calendarDays = computed(() => {
  const firstOfMonth = monthStart(visibleMonth.value);
  const firstGridDay = new Date(firstOfMonth);
  const mondayOffset = (firstGridDay.getDay() + 6) % 7;
  firstGridDay.setDate(firstGridDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDay);
    date.setDate(firstGridDay.getDate() + index);
    return {
      iso: toIso(date),
      label: date.getDate(),
      inMonth: date.getMonth() === visibleMonth.value.getMonth(),
      isSelected: date.toDateString() === toDate(props.modelValue).toDateString(),
      isToday: sameDay(date, new Date())
    };
  });
});

watch(
  () => props.modelValue,
  (value) => {
    visibleMonth.value = monthStart(toDate(value));
  }
);

function move(days) {
  emit("update:modelValue", addDays(props.modelValue, days));
}

function goToday() {
  emit("update:modelValue", todayIso());
  calendarOpen.value = false;
}

function toggleCalendar() {
  calendarOpen.value = !calendarOpen.value;
}

function moveMonth(delta) {
  const next = monthStart(visibleMonth.value);
  next.setMonth(next.getMonth() + delta);
  visibleMonth.value = next;
}

function selectDate(isoDate) {
  emit("update:modelValue", isoDate);
  calendarOpen.value = false;
}

function handleDocumentClick(event) {
  if (!calendarOpen.value) return;
  if (pickerRef.value?.contains(event.target)) return;
  calendarOpen.value = false;
}

function handleEscape(event) {
  if (event.key === "Escape") calendarOpen.value = false;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleEscape);
}

onBeforeUnmount(() => {
  if (typeof document === "undefined") return;
  document.removeEventListener("click", handleDocumentClick);
  document.removeEventListener("keydown", handleEscape);
});
</script>

<template>
  <div ref="pickerRef" class="date-navigator-wrap">
    <div class="date-navigator" aria-label="Navigation par jour">
      <button type="button" class="date-navigator__button" aria-label="Jour precedent" @click="move(-1)">
        <span aria-hidden="true" class="date-navigator__chevron">&lt;</span>
      </button>
      <button
        type="button"
        class="date-navigator__label"
        :aria-expanded="calendarOpen"
        aria-haspopup="dialog"
        @click="toggleCalendar"
      >
        <strong>{{ relativeLabel || dateLabel }}</strong>
        <span>{{ dateLabel }}</span>
      </button>
      <button type="button" class="date-navigator__button" aria-label="Jour suivant" @click="move(1)">
        <span aria-hidden="true" class="date-navigator__chevron">&gt;</span>
      </button>
    </div>

    <div v-if="calendarOpen" class="date-navigator__calendar" role="dialog" aria-label="Choisir une date">
      <div class="date-navigator__calendar-head">
        <button type="button" class="date-navigator__month-btn" aria-label="Mois precedent" @click="moveMonth(-1)">&lt;</button>
        <strong>{{ monthLabel }}</strong>
        <button type="button" class="date-navigator__month-btn" aria-label="Mois suivant" @click="moveMonth(1)">&gt;</button>
      </div>

      <div class="date-navigator__weekdays" aria-hidden="true">
        <span v-for="day in weekDays" :key="day">{{ day }}</span>
      </div>

      <div class="date-navigator__days">
        <button
          v-for="day in calendarDays"
          :key="day.iso"
          type="button"
          class="date-navigator__day"
          :class="{
            'date-navigator__day--muted': !day.inMonth,
            'date-navigator__day--today': day.isToday,
            'date-navigator__day--selected': day.isSelected
          }"
          @click="selectDate(day.iso)"
        >
          {{ day.label }}
        </button>
      </div>
    </div>

    <button v-if="!isToday" type="button" class="date-navigator__floating-today" @click="goToday">
      Aujourd'hui
    </button>
  </div>
</template>

<style scoped>
.date-navigator-wrap {
  position: relative;
  display: inline-grid;
  max-width: 100%;
}

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
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  min-width: 0;
  text-align: center;
  display: grid;
  gap: 2px;
  justify-items: center;
  cursor: pointer;
  border-radius: 10px;
  padding: 2px 6px;
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

.date-navigator__calendar {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 50;
  width: min(320px, calc(100vw - 28px));
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.18);
}

.date-navigator__calendar-head {
  display: grid;
  grid-template-columns: 34px 1fr 34px;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.date-navigator__calendar-head strong {
  text-align: center;
  color: #183957;
  text-transform: capitalize;
}

.date-navigator__month-btn,
.date-navigator__day {
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: #ffffff;
  color: #24364d;
  cursor: pointer;
  font: inherit;
}

.date-navigator__month-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  font-weight: 900;
}

.date-navigator__weekdays,
.date-navigator__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
}

.date-navigator__weekdays {
  margin-bottom: 6px;
}

.date-navigator__weekdays span {
  color: #71839a;
  font-size: 0.7rem;
  font-weight: 900;
  text-align: center;
}

.date-navigator__day {
  aspect-ratio: 1;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 800;
}

.date-navigator__day--muted {
  color: #a3afbd;
  background: #f8fafc;
}

.date-navigator__day--today {
  border-color: rgba(37, 90, 151, 0.45);
  color: #255a97;
}

.date-navigator__day--selected {
  border-color: #255a97;
  background: #255a97;
  color: #ffffff;
}

.date-navigator__floating-today {
  position: fixed;
  left: 50%;
  bottom: calc(var(--mobile-bottom-offset, 64px) + 12px);
  z-index: 60;
  transform: translateX(-50%);
  display: none;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid rgba(37, 90, 151, 0.28);
  border-radius: 999px;
  background: #255a97;
  color: #ffffff;
  box-shadow: 0 14px 30px rgba(37, 90, 151, 0.28);
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 900;
}

@media (max-width: 520px) {
  .date-navigator-wrap {
    width: 100%;
  }

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

  .date-navigator__calendar {
    position: fixed;
    left: 14px;
    right: 14px;
    top: auto;
    bottom: calc(var(--mobile-bottom-offset, 64px) + 62px);
    width: auto;
  }

  .date-navigator__floating-today {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
