import { createApp } from "vue"
import "../../preview/preview-tailwind.css"
import Contracts from "./Contracts.vue"
import OverlayHistory from "./OverlayHistory.vue"
import ShellScroll from "./ShellScroll.vue"
import StatFit from "./StatFit.vue"

const scenario = new URLSearchParams(location.search).get("scenario")
const SCENARIOS = { "shell-scroll": ShellScroll, "stat-fit": StatFit, "overlay-history": OverlayHistory }
createApp(SCENARIOS[scenario as keyof typeof SCENARIOS] ?? Contracts).mount("#app")
