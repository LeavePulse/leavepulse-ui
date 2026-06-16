import { createApp } from "vue"
import "./preview-tailwind.css" // Tailwind + kit CSS entry (preview = consumer)
import "./preview.css" // preview-only web fonts
import App from "./App.vue"

createApp(App).mount("#app")
