<script setup lang="ts">
import { ref } from 'vue'
import { useWallPrivacyStore } from '@/stores/wallPrivacy'
import { useWallBoardStore } from '@/stores/wallBoard'

/**
 * Aviso de privacidad del Muro (Req. 10.18). Se muestra mientras
 * `wallBoard.privacy.answered` sea `false`; el Muro sigue visible sin responder.
 * "Permitir registro" activa el registro; "No permitir" lo deja desactivado y marca el aviso como respondido.
 */
const wall = useWallBoardStore()
const privacy = useWallPrivacyStore()

const emit = defineEmits<{
  (e: 'answered', enabled: boolean): void
}>()

const error = ref<string | null>(null)

async function answer(enabled: boolean) {
  error.value = null
  try {
    await privacy.setEnabled(enabled)
    wall.privacy = { answered: true, enabled }
    emit('answered', enabled)
  }
  catch {
    error.value = 'No se pudo guardar tu respuesta. Inténtalo de nuevo.'
  }
}
</script>

<template>
  <VAlert
    v-if="!wall.privacy.answered"
    class="mb-4"
    data-testid="privacy-notice"
    icon="ri-shield-user-line"
    type="info"
    variant="tonal"
  >
    <div class="text-body-2" data-testid="privacy-notice-text">
      Registramos las tarjetas de trabajos y portafolios que ves, tus me gusta, tus guardados y las veces que abres un detalle o el perfil de un prestador, con su fecha.
      Lo usamos para mejorar el Muro en el futuro. No se comparte con otros usuarios ni con prestadores.
      Los eventos se conservan 12 meses y luego se eliminan.
    </div>
    <p
      v-if="error"
      class="text-error text-body-2 mt-2 mb-0"
      data-testid="privacy-notice-error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="d-flex flex-wrap ga-2 mt-3">
      <VBtn
        color="primary"
        data-testid="privacy-allow"
        :loading="privacy.saving"
        size="small"
        @click="answer(true)"
      >
        Permitir registro
      </VBtn>
      <VBtn
        data-testid="privacy-deny"
        :disabled="privacy.saving"
        size="small"
        variant="outlined"
        @click="answer(false)"
      >
        No permitir
      </VBtn>
    </div>
  </VAlert>
</template>
