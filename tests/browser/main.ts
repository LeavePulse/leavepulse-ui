import { createApp } from "vue"
import { lpPropCheck } from "../../src"
import TableFeatures from "./TableFeatures.vue"
import "../../preview/preview-tailwind.css"
import AutocompleteBlur from "./AutocompleteBlur.vue"
import Contracts from "./Contracts.vue"
import ChartToolkit from "./ChartToolkit.vue"
import DataContracts from "./DataContracts.vue"
import FileTreeFeatures from "./FileTreeFeatures.vue"
import FieldErrors from "./FieldErrors.vue"
import Fields from "./Fields.vue"
import HotkeyFrame from "./HotkeyFrame.vue"
import LinkedView from "./LinkedView.vue"
import LogTools from "./LogTools.vue"
import Notifications from "./Notifications.vue"
import OverlayHistory from "./OverlayHistory.vue"
import Overlays from "./Overlays.vue"
import RealmSweep from "./RealmSweep.vue"
import ShellFeatures from "./ShellFeatures.vue"
import ShellFrame from "./ShellFrame.vue"
import ShellScroll from "./ShellScroll.vue"
import ShiftTick from "./ShiftTick.vue"
import StatFit from "./StatFit.vue"
import TopologyContracts from "./TopologyContracts.vue"
import TriggerNesting from "./TriggerNesting.vue"
import Workspace from "./Workspace.vue"
import VideoTrim from "./VideoTrim.vue"
import VideoPlayer from "./VideoPlayer.vue"
import MediaVideo from "./MediaVideo.vue"

const scenario = new URLSearchParams(location.search).get("scenario")
const SCENARIOS = { notifications: Notifications, "field-errors": FieldErrors, "trigger-nesting": TriggerNesting, "hotkey-frame": HotkeyFrame, "realm-sweep": RealmSweep, "linked-view": LinkedView, topology: TopologyContracts, "file-tree": FileTreeFeatures, table: TableFeatures, workspace: Workspace, "chart-toolkit": ChartToolkit, "log-tools": LogTools, data: DataContracts, fields: Fields, "shell-features": ShellFeatures, "shell-frame": ShellFrame, "shell-scroll": ShellScroll, "stat-fit": StatFit, "overlay-history": OverlayHistory, overlays: Overlays, "shift-tick": ShiftTick, "autocomplete-blur": AutocompleteBlur, "video-trim": VideoTrim, "video-player": VideoPlayer, "media-video": MediaVideo }
// A kit component handed an attribute nothing under it takes fails the test
// (the fixture fails on a console error), so a misspelt prop in a fixture and a
// false report from the check itself both surface here.
createApp(SCENARIOS[scenario as keyof typeof SCENARIOS] ?? Contracts)
  .use(lpPropCheck, { warn: (message) => console.error(message) })
  .mount("#app")
