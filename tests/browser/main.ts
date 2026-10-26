import { createApp } from "vue"
import "../../preview/preview-tailwind.css"
import Contracts from "./Contracts.vue"
import ShellScroll from "./ShellScroll.vue"

const scenario = new URLSearchParams(location.search).get("scenario")
createApp(scenario === "shell-scroll" ? ShellScroll : Contracts).mount("#app")
