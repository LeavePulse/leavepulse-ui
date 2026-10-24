import { createApp } from "vue"
import "./preview-tailwind.css" // Tailwind + kit CSS entry (preview = consumer)
import "./preview.css" // preview-only web fonts
import { lpConfig, vHint } from "../src"
import App from "./App.vue"
import { PreviewLink } from "./playground/demos"

// The preview's own router stands in for RouterLink/NuxtLink: internal `to` and
// "/..." hrefs on kit links navigate without a reload, as they would in an app.
// Apps register `v-hint` once, globally, like any directive.
createApp(App).use(lpConfig({ linkComponent: PreviewLink })).directive("hint", vHint).mount("#app")
