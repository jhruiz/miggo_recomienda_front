<script setup lang="ts">
/**
 * Creación de una cotización por el Prestador (Requisito 5.1).
 *
 * Formulario con ítems de línea dinámicos (agregar/eliminar filas, con
 * subtotal por fila y total acumulado calculado en cliente para feedback
 * inmediato) y carga de adjuntos (hasta 5 imágenes JPG/PNG/WEBP de ≤10 MB,
 * validadas en cliente). El total definitivo lo calcula el backend.
 *
 * Esta misma vista cubre dos flujos de respuesta del Prestador:
 *
 *  - Cotización para una Solicitud pública (Requisito 5.1): la solicitud destino
 *    (`quote_request_id`) se recibe por query string (`?quote_request_id=123`)
 *    desde el detalle de la solicitud; al enviar con éxito se redirige a la
 *    vista comparativa de la solicitud.
 *  - Respuesta a una Cotización directa (Requisito 10.2/10.4): se activa con
 *    `?direct_quote_id=123`. Aplica las MISMAS reglas de formato, pero envía a
 *    `POST /quotes/direct/{id}/respond` (sin `quote_request_id`); al enviar con
 *    éxito se redirige al detalle de la cotización resultante.
 *
 * La escritura va a través del store Pinia `quotes` (multipart/form-data). Los
 * errores de validación 422 y de negocio 409 del backend se muestran en la UI.
 *
 * `useRoute`, `useRouter`, `storeToRefs`, `ref`, `computed` están disponibles
 * por auto-import.
 */
import { useQuotesStore } from '@/stores/quotes'

interface ItemRow {
  description: string
  unit_price: number | null
  quantity: number | null
}

const MAX_ITEMS = 50
const MAX_ATTACHMENTS = 5
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const route = useRoute()
const router = useRouter()
const store = useQuotesStore()

const { saving, saveError } = storeToRefs(store)

function readIdQuery(key: string): number | null {
  const raw = route.query[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = value ? Number(value) : null

  return parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Solicitud destino tomada de la query string (flujo de solicitud pública). */
const quoteRequestId = computed(() => readIdQuery('quote_request_id'))

/** Cotización directa a responder (flujo de respuesta directa, Requisito 10.2). */
const directQuoteId = computed(() => readIdQuery('direct_quote_id'))

/** Modo "respuesta a cotización directa": cambia destino, textos y navegación. */
const isDirectMode = computed(() => directQuoteId.value != null)

const serviceDescription = ref('')
const deliveryDays = ref<number | null>(null)
const expirationDays = ref<number | null>(null)

const items = ref<ItemRow[]>([
  { description: '', unit_price: null, quantity: 1 },
])

const attachments = ref<File[]>([])
const attachmentError = ref<string | null>(null)

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
})

function money(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

/** Subtotal de una fila (precio × cantidad), 0 si falta algún dato. */
function rowSubtotal(row: ItemRow): number {
  const price = row.unit_price ?? 0
  const qty = row.quantity ?? 0

  return price > 0 && qty > 0 ? price * qty : 0
}

/** Total acumulado de todas las filas (feedback cliente; el backend recalcula). */
const runningTotal = computed(() =>
  items.value.reduce((sum, row) => sum + rowSubtotal(row), 0),
)

function addItem() {
  if (items.value.length >= MAX_ITEMS)
    return

  items.value.push({ description: '', unit_price: null, quantity: 1 })
}

function removeItem(index: number) {
  if (items.value.length <= 1)
    return

  items.value.splice(index, 1)
}

/** Valida tipo/tamaño/cantidad de los adjuntos seleccionados (≤5). */
function onAttachmentsChange(selected: File[] | File | null) {
  attachmentError.value = null

  const files = Array.isArray(selected) ? selected : selected ? [selected] : []

  if (files.length > MAX_ATTACHMENTS) {
    attachmentError.value = `No puedes adjuntar más de ${MAX_ATTACHMENTS} imágenes.`
    attachments.value = []

    return
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      attachmentError.value = 'Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.'
      attachments.value = []

      return
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      attachmentError.value = 'El tamaño de cada imagen no puede exceder los 10 MB.'
      attachments.value = []

      return
    }
  }

  attachments.value = files
}

const itemsValid = computed(() =>
  items.value.length >= 1
  && items.value.length <= MAX_ITEMS
  && items.value.every(row =>
    row.description.trim().length > 0
    && row.description.length <= 1000
    && row.unit_price != null
    && row.unit_price >= 0.01
    && row.unit_price <= 999999999.99
    && row.quantity != null
    && Number.isInteger(row.quantity)
    && row.quantity >= 1
    && row.quantity <= 9999,
  ),
)

/** Hay un destino válido: una solicitud pública o una cotización directa. */
const hasTarget = computed(
  () => quoteRequestId.value != null || directQuoteId.value != null,
)

const isValid = computed(() =>
  hasTarget.value
  && serviceDescription.value.trim().length > 0
  && serviceDescription.value.length <= 1000
  && deliveryDays.value != null
  && Number.isInteger(deliveryDays.value)
  && deliveryDays.value >= 1
  && deliveryDays.value <= 365
  && expirationDays.value != null
  && Number.isInteger(expirationDays.value)
  && expirationDays.value >= 1
  && expirationDays.value <= 30
  && itemsValid.value
  && attachmentError.value == null,
)

async function submit() {
  if (!isValid.value)
    return

  const body = {
    service_description: serviceDescription.value.trim(),
    delivery_days: deliveryDays.value as number,
    expiration_days: expirationDays.value as number,
    items: items.value.map(row => ({
      description: row.description.trim(),
      unit_price: row.unit_price as number,
      quantity: row.quantity as number,
    })),
    attachments: attachments.value,
  }

  try {
    if (isDirectMode.value && directQuoteId.value != null) {
      const quote = await store.respondDirect(directQuoteId.value, body)

      router.push({ path: `/quotes/${quote.id}`, query: { sent: '1' } })
    }
    else if (quoteRequestId.value != null) {
      const created = await store.create({ quote_request_id: quoteRequestId.value, ...body })

      router.push({ path: `/quotes/${created.id}`, query: { sent: '1' } })
    }
  }
  catch {
    // El mensaje queda disponible en `saveError`.
  }
}

function cancel() {
  if (isDirectMode.value && directQuoteId.value != null)
    router.push(`/quotes/${directQuoteId.value}`)
  else if (quoteRequestId.value)
    router.push(`/quote-requests/${quoteRequestId.value}`)
  else
    router.push('/quote-requests')
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h4 class="text-h4 mb-1">
        {{ isDirectMode ? 'Responder solicitud directa' : 'Nueva cotización' }}
      </h4>
      <span class="text-body-1 text-medium-emphasis">
        {{
          isDirectMode
            ? 'El cliente te solicitó una cotización directa. Detalla tu propuesta para responderle.'
            : 'Detalla los ítems y el alcance de tu propuesta para la solicitud.'
        }}
      </span>
    </div>

    <!-- Falta un destino (ni solicitud pública ni cotización directa) -->
    <VAlert
      v-if="!hasTarget"
      type="warning"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      No se indicó qué cotizar. Vuelve a la solicitud y usa el botón
      "Enviar cotización".
    </VAlert>

    <VRow>
      <VCol
        cols="12"
        md="8"
      >
        <VCard>
          <VCardText>
            <VAlert
              v-if="saveError"
              type="error"
              variant="tonal"
              border="start"
              class="mb-6"
            >
              {{ saveError }}
            </VAlert>

            <VForm @submit.prevent="submit">
              <VRow>
                <VCol cols="12">
                  <VTextarea
                    v-model="serviceDescription"
                    label="Descripción del servicio"
                    placeholder="Explica el alcance de tu propuesta"
                    rows="4"
                    counter="1000"
                    maxlength="1000"
                  />
                </VCol>

                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model.number="deliveryDays"
                    label="Tiempo estimado de entrega (días)"
                    type="number"
                    min="1"
                    max="365"
                    placeholder="1 - 365"
                  />
                </VCol>

                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model.number="expirationDays"
                    label="Expira en (días)"
                    type="number"
                    min="1"
                    max="30"
                    placeholder="1 - 30"
                  />
                </VCol>
              </VRow>

              <VDivider class="my-6" />

              <!-- Ítems dinámicos -->
              <div class="d-flex align-center justify-space-between mb-4">
                <h6 class="text-h6 mb-0">
                  Ítems de la cotización
                </h6>
                <VBtn
                  size="small"
                  variant="tonal"
                  color="primary"
                  prepend-icon="ri-add-line"
                  :disabled="items.length >= MAX_ITEMS"
                  @click="addItem"
                >
                  Agregar ítem
                </VBtn>
              </div>

              <div
                v-for="(row, index) in items"
                :key="index"
                class="mb-4"
              >
                <VRow class="align-start">
                  <VCol
                    cols="12"
                    md="5"
                  >
                    <VTextField
                      v-model="row.description"
                      label="Descripción"
                      density="comfortable"
                      counter="1000"
                      maxlength="1000"
                    />
                  </VCol>
                  <VCol
                    cols="6"
                    md="3"
                  >
                    <VTextField
                      v-model.number="row.unit_price"
                      label="Precio unitario"
                      type="number"
                      min="0.01"
                      step="0.01"
                      prefix="$"
                      density="comfortable"
                    />
                  </VCol>
                  <VCol
                    cols="6"
                    md="2"
                  >
                    <VTextField
                      v-model.number="row.quantity"
                      label="Cantidad"
                      type="number"
                      min="1"
                      max="9999"
                      density="comfortable"
                    />
                  </VCol>
                  <VCol
                    cols="12"
                    md="2"
                  >
                    <div
                      class="d-flex align-center justify-space-between"
                      style="min-block-size: 48px;"
                    >
                      <span class="text-body-2 font-weight-medium">
                        {{ money(rowSubtotal(row)) }}
                      </span>
                      <VBtn
                        icon
                        variant="text"
                        color="error"
                        size="small"
                        :disabled="items.length <= 1"
                        @click="removeItem(index)"
                      >
                        <VIcon icon="ri-delete-bin-line" />
                      </VBtn>
                    </div>
                  </VCol>
                </VRow>
                <VDivider v-if="index < items.length - 1" class="mt-2" />
              </div>

              <div class="d-flex justify-end align-center gap-2 mt-2 mb-6">
                <span class="text-body-1 text-medium-emphasis">Total estimado:</span>
                <span class="text-h5 mb-0">{{ money(runningTotal) }}</span>
              </div>

              <VDivider class="my-6" />

              <!-- Adjuntos -->
              <VFileInput
                label="Adjuntos (hasta 5 imágenes JPG/PNG/WEBP, ≤10 MB)"
                accept="image/jpeg,image/png,image/webp"
                prepend-icon="ri-image-line"
                multiple
                chips
                :error-messages="attachmentError ? [attachmentError] : []"
                @update:model-value="onAttachmentsChange"
              />

              <VDivider class="my-6" />

              <div class="d-flex flex-wrap gap-3">
                <VBtn
                  type="submit"
                  color="primary"
                  prepend-icon="ri-send-plane-line"
                  :loading="saving"
                  :disabled="!isValid"
                >
                  Enviar cotización
                </VBtn>
                <VBtn
                  variant="tonal"
                  color="secondary"
                  @click="cancel"
                >
                  Cancelar
                </VBtn>
              </div>
            </VForm>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Resumen lateral -->
      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardItem>
            <VCardTitle>Resumen</VCardTitle>
          </VCardItem>
          <VCardText>
            <div class="d-flex justify-space-between mb-2">
              <span class="text-medium-emphasis">Ítems</span>
              <span class="font-weight-medium">{{ items.length }} / {{ MAX_ITEMS }}</span>
            </div>
            <div class="d-flex justify-space-between mb-2">
              <span class="text-medium-emphasis">Adjuntos</span>
              <span class="font-weight-medium">{{ attachments.length }} / {{ MAX_ATTACHMENTS }}</span>
            </div>
            <VDivider class="my-3" />
            <div class="d-flex justify-space-between">
              <span class="text-medium-emphasis">Total</span>
              <span class="text-h6 mb-0">{{ money(runningTotal) }}</span>
            </div>
            <p class="text-caption text-medium-emphasis mt-3 mb-0">
              El total definitivo lo calcula el sistema al recibir la cotización.
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
