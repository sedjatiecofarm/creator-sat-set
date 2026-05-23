<template>
  <main class="pin-login-page">
    <section class="pin-login-card">
      <div class="pin-brand">
        <span class="brand-mark">◆</span>
        <strong>CreatorSpine</strong>
      </div>
      <p class="eyebrow">Private Workspace</p>
      <h1>Masukkan PIN</h1>
      <p class="muted">Akses aplikasi ini dikunci dari server. Ubah PIN lewat environment variable di VPS.</p>

      <form class="pin-form" @submit.prevent="submitPin">
        <input
          v-model="pin"
          inputmode="numeric"
          autocomplete="one-time-code"
          type="password"
          placeholder="PIN akses"
          autofocus
        />
        <button class="primary-btn" type="submit" :disabled="loading || !pin.trim()">
          {{ loading ? "Memeriksa..." : "Masuk" }}
        </button>
      </form>
      <p v-if="error" class="pin-error">{{ error }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { loginWithPin } from "../services/api";
import { setSessionToken } from "../services/session";

const emit = defineEmits<{ authenticated: [] }>();

const pin = ref("");
const loading = ref(false);
const error = ref("");

async function submitPin() {
  error.value = "";
  loading.value = true;
  try {
    const response = await loginWithPin(pin.value.trim());
    setSessionToken(response.token);
    emit("authenticated");
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "PIN salah.";
  } finally {
    loading.value = false;
  }
}
</script>
