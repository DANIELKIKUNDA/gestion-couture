<script setup>
const props = defineProps({
  menuItems: {
    type: Array,
    default: () => []
  },
  currentRoute: {
    type: String,
    default: ""
  },
  iconPaths: {
    type: Object,
    default: () => ({})
  },
  workspaceName: {
    type: String,
    default: ""
  },
  workspaceSubtitle: {
    type: String,
    default: ""
  },
  workspaceLogoText: {
    type: String,
    default: ""
  },
  atelierLogoUrl: {
    type: String,
    default: ""
  },
  isSystemManager: {
    type: Boolean,
    default: false
  },
  authUser: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(["navigate", "account", "logout"]);

function isActiveMenuItem(itemId) {
  return props.currentRoute === itemId || (props.currentRoute === "systemAtelierDetail" && itemId === "systemAteliers");
}
</script>

<template>
  <aside class="sidebar classic-sidebar">
    <div class="brand classic-brand">
      <div class="brand-mark">
        <img v-if="atelierLogoUrl && !isSystemManager" :src="atelierLogoUrl" alt="Logo atelier" />
        <span v-else>{{ workspaceLogoText }}</span>
      </div>
      <div>
        <h1>{{ workspaceName }}</h1>
        <p>{{ workspaceSubtitle }}</p>
      </div>
    </div>

    <nav class="menu">
      <a
        v-for="item in menuItems"
        :key="item.id"
        href="#"
        class="menu-item"
        :class="{ active: isActiveMenuItem(item.id) }"
        @click.prevent="emit('navigate', item.id)"
      >
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path v-for="(path, i) in iconPaths[item.icon]" :key="`${item.id}-${i}`" :d="path" />
        </svg>
        <span>{{ item.label }}</span>
      </a>
    </nav>

    <div class="sidebar-user">
      <button class="sidebar-user-account" type="button" title="Ouvrir mon compte" @click="emit('account')">
        <span class="sidebar-user-avatar" aria-hidden="true">{{ (authUser?.nom || "U").trim().slice(0, 1).toUpperCase() }}</span>
        <span class="sidebar-user-meta">
          <strong>{{ authUser?.nom || "Utilisateur" }}</strong>
          <span>{{ authUser?.roleId || "-" }}</span>
          <small>Mon compte</small>
        </span>
      </button>
      <button class="mini-btn" @click="emit('logout')">Deconnexion</button>
    </div>
  </aside>
</template>
