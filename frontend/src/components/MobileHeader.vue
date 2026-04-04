<script setup>
defineProps({
  title: {
    type: String,
    default: ""
  },
  showNotifications: {
    type: Boolean,
    default: false
  },
  unreadCount: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(["toggle-menu", "open-notifications"]);
</script>

<template>
  <header class="mobile-header">
    <button class="mobile-header-menu" type="button" aria-label="Ouvrir le menu" @click="emit('toggle-menu')">
      <span aria-hidden="true">☰</span>
    </button>
    <div class="mobile-header-copy">
      <p class="mobile-header-kicker">AtelierPro</p>
      <h2>{{ title }}</h2>
    </div>
    <button
      v-if="showNotifications"
      class="mobile-header-notification"
      type="button"
      aria-label="Ouvrir les notifications"
      @click="emit('open-notifications')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
        <path d="M10 17a2 2 0 0 0 4 0" />
      </svg>
      <span v-if="unreadCount > 0" class="mobile-header-notification-badge">
        {{ unreadCount > 99 ? "99+" : unreadCount }}
      </span>
    </button>
  </header>
</template>
