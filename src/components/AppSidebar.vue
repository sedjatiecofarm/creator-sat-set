<template>
  <aside class="sidebar">
    <button class="brand home-link" type="button" @click="$emit('home')">
      <span class="brand-mark">◆</span>
      <div>
        <strong>CreatorSpine</strong>
      </div>
    </button>

    <nav class="nav" aria-label="Menu utama">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-item"
        :class="{ active: activeView === item.id }"
        type="button"
        @click="$emit('navigate', item.id)"
      >
        <b class="menu-icon">{{ item.icon }}</b>{{ item.label }}
      </button>
    </nav>

    <div class="account">
      <div class="avatar">YN</div>
      <div>
        <strong>{{ accountName }}</strong>
        <span>{{ accountEmail }}</span>
      </div>
    </div>

    <div class="auth-actions" v-if="!hasUser">
      <button class="auth-btn" type="button" :disabled="!authReady" @click="$emit('login')">
        {{ authReady ? "Mode SQL" : "Database belum siap" }}
      </button>
    </div>

    <button v-else class="sidebar-logout" type="button" @click="$emit('logout')">
      <span>↪</span>
      Log Out
    </button>
  </aside>
</template>

<script setup>
defineProps({
  accountEmail: { type: String, required: true },
  accountName: { type: String, required: true },
  activeView: { type: String, required: true },
  authReady: { type: Boolean, required: true },
  hasUser: { type: Boolean, required: true },
  navItems: { type: Array, required: true },
});

defineEmits(["home", "login", "logout", "navigate"]);
</script>
