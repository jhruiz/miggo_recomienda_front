<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { OwnerPortfolio } from '@/services/portfolios'

const NAME_MAX = 100
const DESCRIPTION_MAX = 1000

const props = withDefaults(defineProps<{
  modelValue: boolean
  /** Portafolio a editar; null/undefined para crear uno nuevo. */
  portfolio?: Pick<OwnerPortfolio, 'name' | 'description'> | null
  loading?: boolean
  /** Errores por campo devueltos por la API (Req. 6.5). */
  fieldErrors?: Record<string, string>
}>(), {
  portfolio: null,
  loading: false,
  fieldErrors: () => ({}),
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', payload: { name: string, description: string | null }): void
}>()

const name = ref('')
const description = ref('')

const isEdit = computed(() => !!props.portfolio)
const title = computed(() => (isEdit.value ? 'Editar portafolio' : 'Nuevo portafolio'))

// Reinicia el formulario cada vez que se abre el diálogo.
watch(
  () => props.modelValue,
  open => {
    if (open) {
      name.value = props.portfolio?.name ?? ''
      description.value = props.portfolio?.description ?? ''
    }
  },
  { immediate: true },
)

const nameErrors = computed(() => {
  const errors: string[] = []

  if (props.fieldErrors.name)
    errors.push(props.fieldErrors.name)

  return errors
})

const descriptionErrors = computed(() => {
  const errors: string[] = []

  if (props.fieldErrors.description)
    errors.push(props.fieldErrors.description)

  return errors
})

const canSubmit = computed(() => name.value.trim() !== '' && !props.loading)

function close () {
  if (!props.loading)
    emit('update:modelValue', false)
}

function onSubmit () {
  if (!canSubmit.value)
    return

  const trimmedDescription = description.value.trim()

  emit('submit', {
    name: name.value.trim(),
    description: trimmedDescription === '' ? null : trimmedDescription,
  })
}
</script>

<template>
  <VDialog
    :model-value="modelValue"
    max-width="560"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
    @keydown.esc="close"
  >
    <VCard
      role="dialog"
      aria-labelledby="portfolio-form-title"
    >
      <VForm @submit.prevent="onSubmit">
        <VCardTitle id="portfolio-form-title">
          {{ title }}
        </VCardTitle>

        <VCardText class="d-flex flex-column gap-4">
          <VTextField
            v-model="name"
            label="Nombre"
            placeholder="Ej. Trabajos de pintura"
            :maxlength="NAME_MAX"
            counter
            autofocus
            required
            :error-messages="nameErrors"
            :disabled="loading"
            :rules="[v => !!String(v ?? '').trim() || 'El nombre es obligatorio.']"
            aria-required="true"
          />

          <VTextarea
            v-model="description"
            label="Descripción (opcional)"
            :maxlength="DESCRIPTION_MAX"
            counter
            rows="3"
            auto-grow
            :error-messages="descriptionErrors"
            :disabled="loading"
          />
        </VCardText>

        <VCardActions class="justify-end px-6 pb-4">
          <VBtn
            variant="text"
            :disabled="loading"
            @click="close"
          >
            Cancelar
          </VBtn>
          <VBtn
            type="submit"
            color="primary"
            variant="elevated"
            :loading="loading"
            :disabled="!canSubmit"
          >
            {{ isEdit ? 'Guardar cambios' : 'Crear portafolio' }}
          </VBtn>
        </VCardActions>
      </VForm>
    </VCard>
  </VDialog>
</template>
