<template>
  <PinLogin v-if="!pinAuthenticated" @authenticated="handlePinAuthenticated" />

  <div v-else class="app-shell">
    <AppSidebar
      :account-email="accountEmail"
      :account-name="accountName"
      :active-view="activeView"
      :auth-ready="auth.ready"
      :has-user="pinAuthenticated"
      :nav-items="navItems"
      @home="goHome"
      @login="loginWithGoogle"
      @logout="handlePinLogout"
      @navigate="activeView = $event"
    />
    <CreatorWorkspace />
  </div>

  <div class="toast" :class="{ show: toast }">{{ toast }}</div>
</template>

<script setup lang="ts">
import { onMounted, provide, ref } from "vue";
import AppSidebar from "./components/AppSidebar.vue";
import PinLogin from "./components/PinLogin.vue";
import CreatorWorkspace from "./components/CreatorWorkspace.vue";
import { creatorAppKey } from "./composables/creatorAppContext";
import { useCreatorApp } from "./composables/useCreatorApp";
import { verifyPinSession } from "./services/api";
import { clearSessionToken, getSessionToken } from "./services/session";

const app = useCreatorApp();
provide(creatorAppKey, app);
const pinAuthenticated = ref(false);

onMounted(async () => {
  if (!getSessionToken()) return;
  try {
    const session = await verifyPinSession();
    pinAuthenticated.value = session.ok;
    if (!session.ok) clearSessionToken();
  } catch {
    clearSessionToken();
  }
});

async function handlePinAuthenticated() {
  pinAuthenticated.value = true;
  await app.loadWorkspaceState();
}

function handlePinLogout() {
  clearSessionToken();
  pinAuthenticated.value = false;
}

const {
  accountEmail,
  accountName,
  activeView,
  auth,
  goHome,
  loginWithGoogle,
  navItems,
  toast,
} = app;
</script>
