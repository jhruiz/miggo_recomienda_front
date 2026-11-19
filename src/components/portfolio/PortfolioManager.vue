<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PortfolioCard from './PortfolioCard.vue'
import PortfolioFormDialog from './PortfolioFormDialog.vue'
import { usePortfoliosStore } from '@/stores/portfolios'
import { MAX_PORTFOLIOS, formatCounter, isPortfolioCreationDisabled } from '@/utils/portfolio'
import type { ApiError } from '@/utils/portfolio'

/**
 * Según design.md, la página (`provider-profile.vue`) monta el único VSnackbar.
 * `useNotifier` crea estado por llamada, por lo que el manager no notifica solo:
 * reenvía `success` y `error` hacia la página.
 */
const emit = defineEmits<{
  (e: 'success', message: string): void
  (e: 'error', message: string): void
}>()

const store = usePortfoliosStore()

const createOpen = ref(false)
const createFieldErrors = ref<Record<string, string>>({})

const count = computed(() => store.portfolios.length)
const counter = computed(() => formatCounter(count.value, MAX_PORTFOLIOS))
const creationDisabled = computed(() => isPortfolioCreationDisabled(count.value))
const creating = computed(() => store.savingPortfolioId === 0)

onMounted(async () => {
  try {
    await store.load()
  }
  catch (err) {
    emit('error', (err as ApiError).message)
  }
})

function openCreate () {
  if (creationDisabled.value)
    return

  createFieldErrors.value = {}
  createOpen.value = true
}

// Asignación de categoría a Portafolios sin categoría (Req. 2.12).
const assignOpen = ref(false)
const assignFieldErrors = ref<Record<string, string>>({})
const uncategorizedCount = computed(() => store.uncategorizedCount)
const firstPending = computed(() => store.portfolios.find(p => !p.category) ?? null)
const assigning = computed(() => firstPending.value !== null && store.savingPortfolioId === firstPending.value.id)

function openAssign () {
  if (!firstPending.value)
    return

  assignFieldErrors.value = {}
  assignOpen.value = true
}

async function onAssignSubmit (payload: { name: string, description: string | null, service_category_id: number }) {
  const target = firstPending.value

  if (!target)
    return

  assignFieldErrors.value = {}
  try {
    await store.update(target.id, payload)
    // Si quedan pendientes se cierra igual; el aviso muestra el conteo vigente.
    assignOpen.value = false
    emit('success', 'Portafolio actualizado.')
  }
  catch (err) {
    const apiError = err as ApiError

    assignFieldErrors.value = apiError.fieldErrors ?? {}
    emit('error', apiError.message)
  }
}

async function onCreateSubmit (payload: { name: string, description: string | null, service_category_id: number }) {
  createFieldErrors.value = {}
  try {
    await store.create(payload)
    createOpen.value = false
    emit('success', 'Portafolio creado.')
  }
  catch (err) {
    const apiError = err as ApiError

    createFieldErrors.value = apiError.fieldErrors ?? {}
    emit('error', apiError.message)
  }
}
</script>

<template>
  <section aria-labelledby="portfolio-manager-title">
    <div class="d-flex align-center flex-wrap gap-2 mb-4">
      <h3
        id="portfolio-manager-title"
        class="text-h6 me-2"
      >
        Portafolios
      </h3>
      <VChip
        size="small"
        data-testid="portfolios-counter"
      >
        {{ counter }}
      </VChip>
      <VSpacer />
      <VBtn
        color="primary"
        prepend-icon="ri-add-line"
        data-testid="new-portfolio-btn"
        :disabled="creationDisabled"
        @click="openCreate"
      >
        Nuevo portafolio
      </VBtn>
    </div>

    <p
      v-if="creationDisabled"
      class="text-body-2 text-medium-emphasis mb-4"
    >
      Alcanzaste el máximo de {{ MAX_PORTFOLIOS }} portafolios.
    </p>

    <VAlert
      v-if="uncategorizedCount > 0"
      type="warning"
      variant="tonal"
      class="mb-4"
      data-testid="uncategorized-notice"
    >
      Tienes {{ uncategorizedCount }} {{ uncategorizedCount === 1 ? 'portafolio sin categoría' : 'portafolios sin categoría' }}.
      Asígnales una para que aparezcan en el Muro.
      <template #append>
        <VBtn
          size="small"
          variant="outlined"
          data-testid="assign-category-btn"
          @click="openAssign"
        >
          Asignar categoría
        </VBtn>
      </template>
    </VAlert>

    <div
      v-if="store.loading && count === 0"
      class="d-flex justify-center py-6"
      data-testid="portfolios-loading"
    >
      <VProgressCircular
        indeterminate
        color="primary"
        aria-label="Cargando portafolios"
      />
    </div>

    <p
      v-else-if="count === 0"
      class="text-body-1 text-medium-emphasis"
      data-testid="portfolios-empty"
    >
      Crea tu primer portafolio para subir fotos
    </p>

    <div
      v-else
      class="d-flex flex-column gap-4"
    >
      <PortfolioCard
        v-for="portfolio in store.portfolios"
        :key="portfolio.id"
        :portfolio="portfolio"
        @success="emit('success', $event)"
        @error="emit('error', $event)"
      />
    </div>

    <PortfolioFormDialog
      v-model="createOpen"
      :loading="creating"
      :field-errors="createFieldErrors"
      @submit="onCreateSubmit"
    />

    <PortfolioFormDialog
      v-model="assignOpen"
      :portfolio="firstPending"
      :loading="assigning"
      :field-errors="assignFieldErrors"
      @submit="onAssignSubmit"
    />
  </section>
</template>
