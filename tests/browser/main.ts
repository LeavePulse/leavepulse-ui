import { createApp } from "vue"
import "../../preview/preview-tailwind.css"
import Contracts from "./Contracts.vue"
import ShellScroll from "./ShellScroll.vue"
import ShiftWrap from "./ShiftWrap.vue"
import StatFit from "./StatFit.vue"

const scenario = new URLSearchParams(location.search).get("scenario")
const SCENARIOS = { "shell-scroll": ShellScroll, "shift-wrap": ShiftWrap, "stat-fit": StatFit }
createApp(SCENARIOS[scenario as keyof typeof SCENARIOS] ?? Contracts).mount("#app")
