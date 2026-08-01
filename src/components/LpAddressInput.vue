<script setup lang="ts">
/*
 * Postal address form — street, optional second line, city, postcode and
 * country — with live suggestions on the text fields and a button that opens a
 * map to drop a pin instead of typing.
 *
 * Everything external is swappable. `provider` is any GeocodeProvider (default:
 * public Nominatim), `tiles` any {z}/{x}/{y} server (default: OSM), and the
 * `map` slot replaces the built-in picker outright for apps that already ship
 * Leaflet or MapLibre. Nothing map-related is imported until the dialog opens:
 * the picker is an async component, so the tile maths stays out of the bundle
 * of every form that never shows a map.
 */
import { computed, defineAsyncComponent, onMounted, ref, watch } from "vue"
import {
  type AddressField,
  type AddressLabels,
  type AddressSuggestion,
  type AddressValue,
  type GeocodeProvider,
  type LatLon,
  OSM_TILES,
  type TileSource,
  createNominatimProvider,
  emptyAddress,
  formatAddress,
} from "./address"
import { type Country, flagEmoji, loadCountries } from "./countries"
import LpAutocomplete from "./LpAutocomplete.vue"
import LpButton from "./LpButton.vue"
import LpFormField from "./LpFormField.vue"
import LpIcon from "./LpIcon.vue"
import LpInput from "./LpInput.vue"
import LpModal from "./LpModal.vue"
import LpSelect from "./LpSelect.vue"

const LpMapPicker = defineAsyncComponent(() => import("./LpMapPicker.vue"))

const props = withDefaults(
  defineProps<{
    /** The address. Bind with v-model. */
    modelValue?: AddressValue
    /** Geocoder for suggestions and for the map's reverse lookup. */
    provider?: GeocodeProvider
    /** Tile server handed to the built-in picker. */
    tiles?: TileSource
    /** Restrict the country list (ISO2). Omit for every country. */
    only?: string[]
    /** Show the "apartment, suite" line. */
    secondLine?: boolean
    /** Suggestions start after this many characters. */
    minChars?: number
    /** Debounce before a suggestion request goes out. */
    debounce?: number
    /** Accept-Language for the geocoder. */
    language?: string
    disabled?: boolean
    size?: "sm" | "md" | "lg"
    /** Hide the map button when picking a point makes no sense. */
    hideMap?: boolean
    labels?: Partial<AddressLabels>
  }>(),
  {
    tiles: () => OSM_TILES,
    minChars: 3,
    debounce: 350,
    size: "md",
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: AddressValue): void
  /** A point was confirmed on the map, after the address was filled in. */
  (e: "pick", value: LatLon): void
}>()

const DEFAULT_LABELS: AddressLabels = {
  line: "Street and number",
  linePlaceholder: "Baker Street 221B",
  secondLine: "Apartment, suite (optional)",
  secondLinePlaceholder: "Flat 4",
  city: "City",
  cityPlaceholder: "London",
  postalCode: "Postcode",
  postalCodePlaceholder: "NW1 6XE",
  country: "Country",
  countryPlaceholder: "Select country…",
  countrySearch: "Search country…",
  pickOnMap: "Pick on map",
  mapTitle: "Pick a location",
  mapHint: "Click the map to drop a pin, drag to move around.",
  use: "Use this address",
  cancel: "Cancel",
  searching: "Searching…",
  noSuggestions: "No suggestions",
  nothingHere: "No address found here",
}

const text = computed<AddressLabels>(() => ({ ...DEFAULT_LABELS, ...props.labels }))

// One provider instance for the component's lifetime, so a parent that passes
// none doesn't get a new Nominatim client on every render.
const fallbackProvider = createNominatimProvider()
const geocoder = computed(() => props.provider ?? fallbackProvider)

const value = computed<AddressValue>(() => props.modelValue ?? emptyAddress())

function patch(changes: Partial<AddressValue>) {
  emit("update:modelValue", { ...value.value, ...changes })
}

const countries = ref<Country[]>([])
const countryOptions = computed(() =>
  countries.value.map((country) => ({
    value: country.iso2,
    label: `${flagEmoji(country.iso2)} ${country.name}`,
  })),
)

onMounted(async () => {
  const list = await loadCountries()
  const only = props.only?.map((code) => code.toUpperCase())
  countries.value = only?.length ? list.filter((c) => only.includes(c.iso2)) : list
})

/*
 * Suggestions for one text field. Each field keeps its own list and in-flight
 * request; a newer keystroke aborts the previous fetch so a slow response can
 * never overwrite a fresher one.
 */
function useSuggestions(field: AddressField) {
  const options = ref<AddressSuggestion[]>([])
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  function query(term: string) {
    if (timer) clearTimeout(timer)
    controller?.abort()
    if (term.trim().length < props.minChars) {
      options.value = []
      loading.value = false
      return
    }
    loading.value = true
    timer = setTimeout(async () => {
      controller = new AbortController()
      try {
        options.value = await geocoder.value.search(term.trim(), field, {
          country: value.value.country || undefined,
          language: props.language,
          signal: controller.signal,
        })
      } catch {
        // Abort or network failure: leave the field usable as free text.
        options.value = []
      } finally {
        loading.value = false
      }
    }, props.debounce)
  }

  return { options, loading, query }
}

const lineSuggestions = useSuggestions("line")
const citySuggestions = useSuggestions("city")

/** Take whatever parts a chosen suggestion resolved, keeping typed-in values. */
function applySuggestion(suggestion: AddressSuggestion, keep: keyof AddressValue) {
  const parsed = suggestion.address
  const changes: Partial<AddressValue> = { lat: suggestion.lat, lon: suggestion.lon }
  if (parsed.line && keep !== "line") changes.line = parsed.line
  if (parsed.city) changes.city = parsed.city
  if (parsed.postalCode) changes.postalCode = parsed.postalCode
  if (parsed.country) changes.country = parsed.country
  patch(changes)
}

function onLineSelect(chosen: string) {
  const suggestion = lineSuggestions.options.value.find((option) => option.value === chosen)
  if (suggestion) applySuggestion(suggestion, "line")
}

function onCitySelect(chosen: string) {
  const suggestion = citySuggestions.options.value.find((option) => option.value === chosen)
  if (suggestion) applySuggestion(suggestion, "city")
}

const mapOpen = ref(false)
const point = ref<LatLon | undefined>()
const resolved = ref<AddressSuggestion | undefined>()
const resolving = ref(false)

const countryName = computed(
  () => countries.value.find((c) => c.iso2 === value.value.country)?.name,
)

const preview = computed(() => {
  if (resolving.value) return text.value.searching
  if (!point.value) return text.value.mapHint
  if (!resolved.value) return text.value.nothingHere
  const parsed = resolved.value.address
  return formatAddress(
    {
      line: parsed.line ?? "",
      city: parsed.city ?? "",
      postalCode: parsed.postalCode ?? "",
      country: parsed.country ?? "",
    },
    countries.value.find((c) => c.iso2 === parsed.country)?.name,
  )
})

watch(mapOpen, (open) => {
  if (!open) return
  // Reopening starts from the address already on the form, so the map lands
  // where the user left off rather than in the middle of Europe.
  point.value = value.value.lat != null && value.value.lon != null
    ? { lat: value.value.lat, lon: value.value.lon }
    : undefined
  resolved.value = undefined
})

async function onPick(next: LatLon) {
  point.value = next
  resolving.value = true
  resolved.value = undefined
  try {
    resolved.value = await geocoder.value.reverse(next.lat, next.lon, {
      language: props.language,
    })
  } catch {
    resolved.value = undefined
  } finally {
    resolving.value = false
  }
}

/** Confirm the pin: fill in whatever came back and always keep the point. */
function confirmPoint() {
  if (!point.value) return
  const parsed = resolved.value?.address ?? {}
  patch({
    line: parsed.line ?? value.value.line,
    city: parsed.city ?? value.value.city,
    postalCode: parsed.postalCode ?? value.value.postalCode,
    country: parsed.country ?? value.value.country,
    lat: point.value.lat,
    lon: point.value.lon,
  })
  emit("pick", point.value)
  mapOpen.value = false
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <LpFormField :label="text.line">
      <!-- Typing is the fast path and stands on its own; the map is one button
           away for when an address is easier pointed at than spelled. -->
      <div class="flex items-stretch gap-2">
        <LpAutocomplete
          class="min-w-0 flex-1"
          :model-value="value.line"
          :options="lineSuggestions.options.value"
          :loading="lineSuggestions.loading.value"
          :filter="false"
          :min-chars="minChars"
          :disabled="disabled"
          :size="size"
          :placeholder="text.linePlaceholder"
          :empty-text="text.noSuggestions"
          :loading-text="text.searching"
          icon="lucide:map-pin"
          @update:model-value="(next: string) => { patch({ line: next }); lineSuggestions.query(next) }"
          @select="onLineSelect"
        />
        <LpButton
          v-if="!hideMap"
          variant="soft"
          :size="size"
          square
          :disabled="disabled"
          :title="text.pickOnMap"
          :aria-label="text.pickOnMap"
          @click="mapOpen = true"
        >
          <LpIcon name="lucide:map" :size="16" />
        </LpButton>
      </div>
    </LpFormField>

    <LpInput
      v-if="secondLine"
      :model-value="value.line2 ?? ''"
      :label="text.secondLine"
      :placeholder="text.secondLinePlaceholder"
      :disabled="disabled"
      :size="size"
      autocomplete="address-line2"
      @update:model-value="(next: string) => patch({ line2: next })"
    />

    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
      <LpFormField :label="text.city">
        <LpAutocomplete
          :model-value="value.city"
          :options="citySuggestions.options.value"
          :loading="citySuggestions.loading.value"
          :filter="false"
          :min-chars="minChars"
          :disabled="disabled"
          :size="size"
          :placeholder="text.cityPlaceholder"
          :empty-text="text.noSuggestions"
          :loading-text="text.searching"
          @update:model-value="(next: string) => { patch({ city: next }); citySuggestions.query(next) }"
          @select="onCitySelect"
        />
      </LpFormField>

      <LpInput
        :model-value="value.postalCode"
        :label="text.postalCode"
        :placeholder="text.postalCodePlaceholder"
        :disabled="disabled"
        :size="size"
        autocomplete="postal-code"
        @update:model-value="(next: string) => patch({ postalCode: next })"
      />
    </div>

    <LpFormField :label="text.country">
      <LpSelect
        :model-value="value.country"
        :options="countryOptions"
        :placeholder="text.countryPlaceholder"
        :search-placeholder="text.countrySearch"
        :disabled="disabled"
        :size="size"
        searchable
        @update:model-value="(next) => patch({ country: String(next ?? '') })"
      />
    </LpFormField>

    <div v-if="!hideMap" class="flex items-center gap-2">
      <LpButton variant="soft" :size="size === 'lg' ? 'md' : 'sm'" :disabled="disabled" @click="mapOpen = true">
        <LpIcon name="lucide:map" :size="15" />
        {{ text.pickOnMap }}
      </LpButton>
      <span v-if="value.lat != null && value.lon != null" class="text-xs text-muted">
        {{ value.lat.toFixed(5) }}, {{ value.lon.toFixed(5) }}
      </span>
    </div>

    <LpModal v-model:open="mapOpen" :title="text.mapTitle" size="2xl">
      <!--
        Replace the whole picker with your own map. The slot gets the current
        point and a setter that runs the same reverse lookup the built-in map
        does, so a Leaflet or MapLibre implementation only has to report clicks.
      -->
      <slot name="map" :point="point" :set-point="onPick" :tiles="tiles">
        <LpMapPicker :model-value="point" :tiles="tiles" @update:model-value="onPick" />
      </slot>

      <p class="mt-3 min-h-5 text-sm" :class="resolved || resolving ? 'text-ink' : 'text-muted'">
        {{ preview }}
      </p>

      <template #footer>
        <LpButton variant="ghost" @click="mapOpen = false">{{ text.cancel }}</LpButton>
        <LpButton :disabled="!point" @click="confirmPoint">{{ text.use }}</LpButton>
      </template>
    </LpModal>
  </div>
</template>
