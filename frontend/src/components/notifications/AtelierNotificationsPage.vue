<script setup>
const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  notifications: { type: Array, default: () => [] },
  unreadCount: { type: Number, default: 0 },
  activeNotificationId: { type: String, default: "" },
  formatDateTime: { type: Function, required: true }
});

const emit = defineEmits(["refresh", "open-notification"]);

function handleOpen(notification) {
  if (!notification?.idNotification) return;
  emit("open-notification", notification);
}
</script>

<template>
  <section class="dashboard system-admin-page atelier-notifications-page">
    <article class="panel panel-header">
      <div>
        <h3>Notifications</h3>
        <p class="helper">Les messages de la plateforme apparaissent ici pour votre atelier.</p>
      </div>
      <div class="row-actions">
        <span class="status-pill" :data-tone="unreadCount > 0 ? 'due' : 'ok'">
          {{ unreadCount > 0 ? `${unreadCount} non lue(s)` : "A jour" }}
        </span>
        <button class="mini-btn" :disabled="loading" @click="emit('refresh')">
          {{ loading ? "Actualisation..." : "Actualiser" }}
        </button>
      </div>
    </article>

    <article class="panel atelier-notifications-panel">
      <div v-if="error" class="auth-error">{{ error }}</div>

      <div v-else-if="loading && notifications.length === 0" class="helper">
        Chargement des notifications...
      </div>

      <div v-else-if="notifications.length === 0" class="helper">
        Aucune notification. Les messages de la plateforme apparaitront ici.
      </div>

      <div v-else class="atelier-notification-list">
        <article
          v-for="item in notifications"
          :key="item.idNotification"
          class="atelier-notification-item"
          :class="{ unread: !item.estLue }"
        >
          <div class="atelier-notification-item-head">
            <div>
              <div class="atelier-notification-title-row">
                <strong>{{ item.titre }}</strong>
                <span v-if="!item.estLue" class="status-pill" data-tone="due">Non lue</span>
              </div>
              <p class="helper">
                {{ item.portee === "GLOBAL" ? "Message plateforme" : "Message cible pour votre atelier" }}
              </p>
            </div>
            <span class="helper">{{ formatDateTime(item.dateEnvoi || item.dateCreation) }}</span>
          </div>

          <p class="atelier-notification-message">{{ item.message }}</p>

          <div class="atelier-notification-item-footer">
            <span class="helper">
              {{ item.estLue ? `Lue le ${formatDateTime(item.luAt || item.dateCreation)}` : "A lire" }}
            </span>
            <button
              class="mini-btn"
              type="button"
              :disabled="item.estLue || activeNotificationId === item.idNotification"
              @click="handleOpen(item)"
            >
              {{
                item.estLue
                  ? "Lue"
                  : activeNotificationId === item.idNotification
                    ? "Ouverture..."
                    : "Ouvrir"
              }}
            </button>
          </div>
        </article>
      </div>
    </article>
  </section>
</template>
