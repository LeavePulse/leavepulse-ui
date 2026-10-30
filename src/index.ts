export { default as LayoutCanvas } from "./components/LayoutCanvas.vue"
export { default as LpAddressInput } from "./components/LpAddressInput.vue"
export { default as LpMapPicker } from "./components/LpMapPicker.vue"
export {
  OSM_TILES,
  createNominatimProvider,
  emptyAddress,
  formatAddress,
  project,
  tileUrl,
  unproject,
} from "./components/address"
export type {
  AddressField,
  AddressLabels,
  AddressSuggestion,
  AddressValue,
  GeocodeProvider,
  GeocodeQuery,
  LatLon,
  NominatimOptions,
  TileSource,
} from "./components/address"
export { default as LpActionBar } from "./components/LpActionBar.vue"
export type { ActionBarAction } from "./components/LpActionBar.vue"
export { default as LpAlert } from "./components/LpAlert.vue"
export { default as LpAppShell } from "./components/LpAppShell.vue"
export { default as LpAutocomplete } from "./components/LpAutocomplete.vue"
export type { AutocompleteLabels, AutocompleteOption, AutocompleteSelection } from "./components/LpAutocomplete.vue"
export type { LpOptionBase, OptionSelection } from "./components/options"
export { default as LpAvatar } from "./components/LpAvatar.vue"
export { default as LpBadge } from "./components/LpBadge.vue"
export { default as LpBreadcrumbs } from "./components/LpBreadcrumbs.vue"
export type { Crumb } from "./components/LpBreadcrumbs.vue"
export { default as LpButton } from "./components/LpButton.vue"
export { default as LpCalendar } from "./components/LpCalendar.vue"
export type { CalendarLabels } from "./components/calendar"
export { default as LpCard } from "./components/LpCard.vue"
export { default as LpChart } from "./components/LpChart.vue"
export type { ChartPointEvent } from "./components/LpChart.vue"
export type { ChartText } from "./components/LpChart.vue"
export type { ChartExportOptions } from "./components/LpChart.vue"
export { backgroundOf, csvField, downloadFile, fileStem, inlineSvg, resolveCssColor, svgToPng, toCsv } from "./components/exportData"
export type { CsvColumn, CsvOptions, RasterOptions } from "./components/exportData"
export {
  CHART_PALETTE,
  axisTicks,
  formatTick,
  niceScale,
} from "./components/chart"
export type { ChartAxis, ChartPoint, ChartSeries } from "./components/chart"
export { chartSummary, markerIndex } from "./components/chart"
export type { ChartMarker, ChartThreshold } from "./components/chart"
export { default as LpCheckbox } from "./components/LpCheckbox.vue"
export { default as LpCodeBlock } from "./components/LpCodeBlock.vue"
export type { CodeLang } from "./components/codeHighlight"
export { tokenizeLines } from "./components/codeHighlight"
export { default as LpColorPicker } from "./components/LpColorPicker.vue"
export type { ColorPickerLabels } from "./components/LpColorPicker.vue"
export {
  clampHsv,
  DEFAULT_SWATCHES,
  formatColor,
  hsvToHsl,
  hsvToRgb,
  isLight,
  normalizeHue,
  opaqueCss,
  parseColor,
  parseHex,
  rgbToHex,
  rgbToHsv,
} from "./components/color"
export type { ColorFormat, Hsv, Rgb } from "./components/color"
export { default as LpCommandPalette } from "./components/LpCommandPalette.vue"
export type { Command, CommandFetcher, CommandImage, PaletteLabels } from "./components/LpCommandPalette.vue"
export { applyQueryFilters, highlightParts, parseCommandQuery, parsePaletteQuery, rankCommandItems } from "./components/commandSearch"
export { commandHasPreview, pushRecent, readRecent, toRecentItem } from "./components/commandPalette"
export type { PaletteFact, PaletteStat, PreviewableCommand, RecentEntry, RecentItem } from "./components/commandPalette"
export { default as LpPalettePreview } from "./components/LpPalettePreview.vue"
export { default as LpPaletteHeader } from "./components/LpPaletteHeader.vue"
export { default as LpPaletteFacts } from "./components/LpPaletteFacts.vue"
export { default as LpPaletteStats } from "./components/LpPaletteStats.vue"
export { default as LpPaletteSwatches } from "./components/LpPaletteSwatches.vue"
export { default as LpKeys } from "./components/LpKeys.vue"
export { comboKeys, comboSteps } from "./components/keys"
export type { CommandSearchTerms, HighlightPart, PaletteQuery, SearchableCommand } from "./components/commandSearch"
export { default as LpConfirmDialog } from "./components/LpConfirmDialog.vue"
export type { ConfirmLabels } from "./components/LpConfirmDialog.vue"
export { default as LpConfirmHost } from "./components/LpConfirmHost.vue"
export { confirm, useConfirm } from "./components/confirm"
export type { ConfirmOptions } from "./components/confirm"
export { default as LpContextMenu } from "./components/LpContextMenu.vue"
export type { ContextMenuItemDef } from "./components/LpContextMenu.vue"
export { default as LpDatePicker } from "./components/LpDatePicker.vue"
export type { DatePickerLabels } from "./components/LpDatePicker.vue"
export { default as LpDateRangePicker } from "./components/LpDateRangePicker.vue"
export type { DateRangePickerLabels } from "./components/LpDateRangePicker.vue"
export { default as LpRangeCalendar } from "./components/LpRangeCalendar.vue"
export type { RangeCalendarLabels } from "./components/LpRangeCalendar.vue"
export {
  clampRange,
  dayAllowed,
  defaultDatePresets,
  defaultRangePresets,
  formatRange,
  normalizeRange,
  sameRange,
} from "./components/dateRange"
export type {
  DatePreset,
  DatePresetLabels,
  DateRange,
  DateRangePreset,
  DateRangePresetLabels,
  DayRules,
} from "./components/dateRange"
export { default as LpDisclosure } from "./components/LpDisclosure.vue"
export { default as LpDivider } from "./components/LpDivider.vue"
export { default as LpDrawer } from "./components/LpDrawer.vue"
export { default as LpDropdownMenu } from "./components/LpDropdownMenu.vue"
export type { MenuItem } from "./components/LpDropdownMenu.vue"
export { default as LpDropzone } from "./components/LpDropzone.vue"
export { default as LpEmptyState } from "./components/LpEmptyState.vue"
export { default as LpFileTree } from "./components/LpFileTree.vue"
export type { FileTreeSummary } from "./components/LpFileTree.vue"
export type { FileTreeLabels } from "./components/LpFileTree.vue"
export type { CheckState, FileNode, NodeStats } from "./components/fileTree"
export {
  ancestorIds,
  checkedCount,
  checkStateOf,
  computeStats,
  fileIcon,
  formatModified,
  formatSize,
  sortNodes,
  subtreeIds,
  subtreeSize,
} from "./components/fileTree"
export { default as LpFieldNotice } from "./components/LpFieldNotice.vue"
export { default as LpFormField } from "./components/LpFormField.vue"
export { default as LpIcon } from "./components/LpIcon.vue"
export { iconsVersion, registerAllIcons, registerIconCollection, registerIcons } from "./icons"
export { default as LpImageEditor } from "./components/LpImageEditor.vue"
export type { ImageEditorError, ImageEditorErrorCause } from "./components/imageCrop"
export { default as LpInfraNode } from "./components/LpInfraNode.vue"
export type { InfraNodeData } from "./components/LpInfraNode.vue"
export { default as LpInput } from "./components/LpInput.vue"
export { default as LpLightbox } from "./components/LpLightbox.vue"
export type { LightboxLabels } from "./components/LpLightbox.vue"
export type { LightboxItem } from "./components/lightbox"
export { fileNameOf } from "./components/lightbox"
export { default as LpLink } from "./components/LpLink.vue"
export { default as LpLogViewer } from "./components/LpLogViewer.vue"
export type { LogLevel, LogLine } from "./components/LpLogViewer.vue"
export type { LogViewerLabels } from "./components/LpLogViewer.vue"
export { countLevels, matchPositions, matchesTerm, ringWindow, stepMatch } from "./components/logSearch"
export { default as LpMediaGallery } from "./components/LpMediaGallery.vue"
export { default as LpModal } from "./components/LpModal.vue"
export { default as LpModalNav } from "./components/LpModalNav.vue"
export { default as LpNotificationBell } from "./components/LpNotificationBell.vue"
export type {
  NotificationItem,
  NotificationLabels,
} from "./components/LpNotificationBell.vue"
export { default as LpNumberField } from "./components/LpNumberField.vue"
export type { NumberFieldLabels } from "./components/LpNumberField.vue"
export { default as LpTimeField } from "./components/LpTimeField.vue"
export { default as LpNumberFlow } from "./components/LpNumberFlow.vue"
export { default as LpOtpInput } from "./components/LpOtpInput.vue"
export { default as LpPagination } from "./components/LpPagination.vue"
export { default as LpPasswordInput } from "./components/LpPasswordInput.vue"
export type { PasswordInputLabels } from "./components/LpPasswordInput.vue"
export { default as LpPie } from "./components/LpPie.vue"
export type { SliceEvent } from "./components/LpPie.vue"
export type { PieText } from "./components/LpPie.vue"
export { resolveSlices } from "./components/chart"
export type { PieSlice, ResolvedSlice } from "./components/chart"
export { default as LpPhoneInput } from "./components/LpPhoneInput.vue"
export type { PhoneDetail, PhoneInputLabels } from "./components/LpPhoneInput.vue"
export { filterCountries, flagEmoji, loadCountries, matchCountryByValue } from "./components/countries"
export type { Country } from "./components/countries"
export { default as LpPopover } from "./components/LpPopover.vue"
export { default as LpProgress } from "./components/LpProgress.vue"
export { default as LpRadio } from "./components/LpRadio.vue"
export { default as LpRadioGroup } from "./components/LpRadioGroup.vue"
export type { RadioOption } from "./components/LpRadioGroup.vue"
export { default as LpRollingText } from "./components/LpRollingText.vue"
export { default as LpScrollArea } from "./components/LpScrollArea.vue"
export { default as LpSegmented } from "./components/LpSegmented.vue"
export type { SegmentedOption } from "./components/LpSegmented.vue"
export { default as LpSection } from "./components/LpSection.vue"
export { default as LpSelect } from "./components/LpSelect.vue"
export type { SelectLabels, SelectOption, SelectSelection, SelectValue } from "./components/LpSelect.vue"
export { fitChips, toggledValues } from "./components/select"
export { default as LpServiceNode } from "./components/LpServiceNode.vue"
export type { ServiceNodeData } from "./components/LpServiceNode.vue"
export { default as LpShift } from "./components/LpShift.vue"
export { default as LpSwap } from "./components/LpSwap.vue"
export { default as LpHintExample } from "./components/LpHintExample.vue"
export { default as LpShortcutsDialog } from "./components/LpShortcutsDialog.vue"
export { default as LpSidebar } from "./components/LpSidebar.vue"
export type { SidebarItem, SidebarSection } from "./components/LpSidebar.vue"
export type { AppContext } from "./components/sidebar"
export { default as LpContextSwitcher } from "./components/LpContextSwitcher.vue"
export { default as LpSkeleton } from "./components/LpSkeleton.vue"
export { default as LpSlider } from "./components/LpSlider.vue"
export { default as LpRangeSlider } from "./components/LpRangeSlider.vue"
export { default as LpVideoBackdrop } from "./components/LpVideoBackdrop.vue"
export { formatClipTime, isNativeLoop, planLoop, seamProgress, seamReached } from "./components/videoBackdrop"
export type { LoopPlan } from "./components/videoBackdrop"
export { default as LpSparkline } from "./components/LpSparkline.vue"
export { default as LpStat } from "./components/LpStat.vue"
export { default as LpStepper } from "./components/LpStepper.vue"
export type { Step } from "./components/LpStepper.vue"
export { default as LpSwitch } from "./components/LpSwitch.vue"
export { default as LpTable } from "./components/LpTable.vue"
export type { SortState, TableColumn, TablePage, TableQuery } from "./components/LpTable.vue"
export type { TableLabels } from "./components/LpTable.vue"
export type { TableExportOptions } from "./components/LpTable.vue"
export { compareValues } from "./components/tableSort"
export { filterRows, showOnly, shownValues } from "./components/tableFilter"
export type { TableFilters } from "./components/tableFilter"
export { useTableFilterChoice } from "./composables/useTableFilterChoice"
export { resolveRowMenu } from "./components/tableRowMenu"
export type { TableRowMenu, TableRowMenuResult } from "./components/tableRowMenu"
export { default as LpTableOfContents } from "./components/LpTableOfContents.vue"
export type { TocLink } from "./components/LpTableOfContents.vue"
export { default as LpTabs } from "./components/LpTabs.vue"
export { default as LpBottomNav } from "./components/LpBottomNav.vue"
export type { TabItem } from "./components/LpTabs.vue"
export { default as LpTagsInput } from "./components/LpTagsInput.vue"
export type { TagsInputLabels } from "./components/LpTagsInput.vue"
export { addTags, splitTags } from "./components/tags"
export type { AddTagsOptions, TagDuplicates, TagRejection, TagValidator } from "./components/tags"
export { default as LpTextarea } from "./components/LpTextarea.vue"
export { default as LpThemeSwitcher } from "./components/LpThemeSwitcher.vue"
export { default as LpTilt } from "./components/LpTilt.vue"
export { default as LpToaster } from "./components/LpToaster.vue"
export { default as LpTooltip } from "./components/LpTooltip.vue"
export { default as LpTour } from "./components/LpTour.vue"
export type { TourContext, TourStep } from "./components/LpTour.vue"
export { holeOf, openContextMenu, panelsAround } from "./components/tour"
export { default as LpHintLayer } from "./components/LpHintLayer.vue"
export { default as LpHints } from "./components/LpHints.vue"
export { HINT_SIGNALS, contextMenuTip, createHintSystem, dropzoneTip, hotkeyTip, noteDropzone, noteHotkeyTarget, hintKey, hintSummary, localHintStorage, paletteTip, provideHintSystem, runningHintSystem, useHintSystem } from "./composables/useHintSystem"
export type {
  HintDelta,
  HintFeature,
  HintLevel,
  HintNews,
  HintNudge,
  HintOffer,
  HintPage,
  HintRecord,
  HintStorage,
  HintSummary,
  HintSystem,
  HintTip,
  HintSystemOptions,
  HintTiming,
} from "./composables/useHintSystem"
export type { HintNote } from "./components/LpHintLayer.vue"
export { default as LpTooltipProvider } from "./components/LpTooltipProvider.vue"
export { default as LpTopologyCanvas } from "./components/LpTopologyCanvas.vue"
export type {
  CanvasViewport,
  EdgeCategory,
  EdgeObserved,
  TopologyEdge,
  TopologyLane,
  TopologyNode,
} from "./components/LpTopologyCanvas.vue"
export { default as LpUptimeBar } from "./components/LpUptimeBar.vue"
export type { UptimeSegment, UptimeStatus } from "./components/LpUptimeBar.vue"

export {
  addLeaf,
  addTab,
  countBlocks,
  countLeaves,
  deserializeLayout,
  makeLayout,
  moveLeaf,
  removeBlock,
  removeLeaf,
  reorderTab,
  resizeAt,
  setActiveTab,
  serializeLayout,
} from "./layout/tree"
export type { Dir, LayoutNode, Leaf, Side, Split } from "./layout/tree"
export { blockTitle, defineBlocks } from "./layout/registry"
export type { BlockDef, BlockRegistry } from "./layout/registry"
export { useLayout } from "./layout/useLayout"
export type { UseLayout, UseLayoutOptions } from "./layout/useLayout"

// theme engine — themes are JSON (TokenSet), applied at runtime
export {
  applyTheme,
  applyThemeWithTransition,
  revealTransition,
  bootstrapTheme,
  parseTheme,
  serializeTheme,
  THEME_COOKIE,
  themeFromCookie,
  themeToCssRule,
  themeToCssVars,
  useTheme,
} from "./theme/useTheme"
export type { RevealOrigin } from "./theme/useTheme"
export { detectBackdropFilter, GLASS_BACKDROP_ATTR, isBrokenBackdropEngine, NO_BACKDROP_ATTR, setGlassBackdrop } from "./theme/backdrop"
export { DEFAULT_SURFACE } from "./theme/tokens"
export { defineTheme, withBrand } from "./theme/define"
export { STUDIO_BRANDS, STUDIO_CORNERS, STUDIO_MOTION, STUDIO_SIZES, STUDIO_SYSTEM, useThemeStudio } from "./theme/studio"
export type { StudioState, ThemeStudio, ThemeStudioOptions } from "./theme/studio"
export type { ThemeOverrides } from "./theme/define"
export type {
  ColorTokens,
  DensityTokens,
  FontTokens,
  ShapeTokens,
  SurfaceTokens,
  TokenSet,
} from "./theme/tokens"
export { amber, dark, light, lime, nord, presets, rose, violet } from "./theme/presets"
export type { PresetName } from "./theme/presets"
export { parseConfig, serializeConfig, UI_CONFIG_VERSION } from "./theme/config"
export type { UiConfig } from "./theme/config"

export { useClipboard } from "./composables/useClipboard"
export type { CopyOptions, UseClipboard } from "./composables/useClipboard"
export {
  useHotkeys,
  isAppleKeyboard,
  appleModifierLabel,
  activeShortcuts,
  mergeShortcutGroups,
} from "./composables/useHotkeys"
export type { HotkeyBinding, HotkeyHelp, ShortcutEntry, ShortcutGroup } from "./composables/useHotkeys"
export {
  findHotkeyConflicts,
  hotkeyConflicts,
  hotkeySteps,
  matchesHotkey,
  parseCombo,
  pendingHotkey,
  sequenceProgress,
  useAppleKeyboard,
} from "./composables/useHotkeys"
export type { HotkeyConflict, HotkeyStep } from "./composables/useHotkeys"
export { anyModalOpen, topModalElement, useModalLayer } from "./components/modalDepth"
export type { ModalLayer, ModalLayerOptions } from "./components/modalDepth"
export { useGamepadNav } from "./composables/useGamepadNav"
export type { UseGamepadNavOptions } from "./composables/useGamepadNav"
export { focusableIn, nextInDirection } from "./composables/spatialNav"
export type { Box, Direction } from "./composables/spatialNav"
export { provideGlass, useGlass } from "./composables/useGlass"
export { provideOverlayHistory, useOverlayHistory, useStepHistory } from "./composables/useOverlayHistory"
export type { OverlayHistoryMode, OverlayHistoryOptions, ProvideOverlayHistoryOptions, StepHistoryOptions } from "./composables/useOverlayHistory"
export type { HistoryRouter } from "./composables/overlayHistory"
export { LP_CONFIG, lpConfig, mergeConfig, provideLpConfig, useLabels, useLinkComponent, useLpConfig } from "./composables/useLpConfig"
export type { KitStorage, LabelScope, LpConfig } from "./composables/useLpConfig"
export { browserStorage, useKitStorage, usePersisted } from "./composables/usePersisted"
export { useCloseGuard } from "./composables/useCloseGuard"
export { useOptimisticToggle } from "./composables/useOptimisticToggle"
export type { CloseGuard, CloseGuardLabels } from "./composables/useCloseGuard"
export type { PersistedOptions } from "./composables/usePersisted"
export { useMergedClass, useMergedAttrs, mergeClass } from "./composables/useMergedClass"
export { anchorPattern, stripDisallowed, useInputFilter } from "./composables/useInputFilter"
export { usePaintSelect } from "./composables/usePaintSelect"
export type { UsePaintSelectOptions } from "./composables/usePaintSelect"
export { LP_FIELD, fieldMessageId, provideField, useField, useFieldControl } from "./composables/useField"
export { FIELD_NOTICE_MS, useFieldNotice } from "./composables/useFieldNotice"
export type { FieldNotice, FieldNoticeOptions, FieldNoticeTone } from "./composables/useFieldNotice"
export type { FieldContext, FieldControlState } from "./composables/useField"
export type { UseInputFilterOptions } from "./composables/useInputFilter"
export { easeOut, easeTravel, easingToken, prefersReducedMotion } from "./composables/easing"
export { useReveal } from "./composables/useReveal"
export { useRevealedValue } from "./composables/useRevealedValue"
export { hints, vHint } from "./composables/useHints"
export type { HintEvent } from "./composables/useHints"
export { scrollParent, scrollToElement } from "./composables/scroll"
export type { ScrollParentOptions, ScrollToElementOptions } from "./composables/scroll"
export { useMediaQuery } from "./composables/useMediaQuery"
export { usePrefersReducedMotion } from "./composables/useReducedMotion"
export { useResizeObserver } from "./composables/useResizeObserver"
export type { UseResizeObserverOptions } from "./composables/useResizeObserver"
export { usePointerFrame } from "./composables/usePointerFrame"
export type { PointerFrame, PointerFrameOptions } from "./composables/usePointerFrame"
export { usePortalTarget, useView, viewDocument, viewWindow, type LpView } from "./composables/useView"
export type { UseReveal, UseRevealOptions } from "./composables/useReveal"
export type { UseRevealedValue, UseRevealedValueOptions } from "./composables/useRevealedValue"
export { useAsyncTask } from "./composables/useAsyncTask"
export { useRovingFocus } from "./composables/useRovingFocus"
export type { RovingItem, UseRovingFocusOptions } from "./composables/useRovingFocus"
export { useFormDraft } from "./composables/useFormDraft"
export type { UseFormDraft, UseFormDraftOptions } from "./composables/useFormDraft"
export { DEFAULT_MASK_TOKENS, applyMask, maskDelete, parseMask, useInputMask } from "./composables/useInputMask"
export type { MaskOptions, MaskResult, MaskSpec, MaskToken, MaskTokens, UseInputMaskOptions } from "./composables/useInputMask"
export { deepEqual, useForm } from "./composables/useForm"
export type { FieldBinding, FieldRule, FormErrorMessage, FormErrors, FormRules, UseForm, UseFormOptions } from "./composables/useForm"

export { useSettled } from "./composables/useSettled"
export type { UseSettledOptions } from "./composables/useSettled"
export { useShift } from "./composables/useShift"
export type { ShiftAxis, UseShift, UseShiftOptions } from "./composables/useShift"
export { useTilt } from "./composables/useTilt"
export type { UseTilt, UseTiltOptions } from "./composables/useTilt"
export { useZoomPan } from "./composables/useZoomPan"
export type { UseZoomPan, UseZoomPanOptions } from "./composables/useZoomPan"
export { useToast } from "./composables/useToast"
export type {
  ToastAction,
  ToastItem,
  ToastMessage,
  ToastOptions,
  ToastVariant,
} from "./composables/useToast"
export type { ToastPromiseMessages } from "./composables/useToast"
export {
  cacheSystemThemes,
  normalizeTheme,
  prefersDarkScheme,
  themeEntries,
} from "./theme/useTheme"
export type { SystemThemes, UseTheme } from "./theme/useTheme"
export { layoutController } from "./layout/useLayout"
export type { LayoutController } from "./layout/useLayout"
export { default as LpThemeProvider } from "./components/LpThemeProvider.vue"
export { default as LpFrame } from "./components/LpFrame.vue"
export { default as LpThemeStudio } from "./components/LpThemeStudio.vue"
export type { ThemeStudioLabels, ThemeStudioPart } from "./components/LpThemeStudio.vue"
export { default as LpThemeStudioSection } from "./components/LpThemeStudioSection.vue"
export { isInternalHref, resolveLink } from "./components/link"
export type { LinkTarget, ResolvedLink } from "./components/link"

export { default as LpRepeater } from "./components/LpRepeater.vue"
export type { RepeaterItemKey } from "./composables/useRepeater"

// ── Status and data (group: status) ──
export { default as LpGauge } from "./components/LpGauge.vue"
export type { GaugeLabels } from "./components/LpGauge.vue"
export { default as LpQuota } from "./components/LpQuota.vue"
export type { QuotaLabels } from "./components/LpQuota.vue"
export { default as LpStatus } from "./components/LpStatus.vue"
export { default as LpRelativeTime } from "./components/LpRelativeTime.vue"
export { default as LpActivityLine } from "./components/LpActivityLine.vue"
export {
  arcPath,
  capacityThresholds,
  meterFraction,
  toneAt,
  TONE_COLOR,
  TONE_SOFT,
} from "./components/meter"
export type { MeterThreshold, MeterTone } from "./components/meter"
export { TONE_ALIASES, TONES, toneLook, toneOf } from "./components/tone"
export type { Tone, ToneLook, ToneName } from "./components/tone"
export { formatAmount, quotaSegments, quotaState } from "./components/quota"
export type { QuotaPart, QuotaSegment, QuotaState, QuotaUnit } from "./components/quota"
export { compactNumber, decimalMark, formatBytes } from "./components/format"
export type { CompactNumberOptions, FormatBytesOptions } from "./components/format"
export { STATUS_LABELS, STATUS_LOOK } from "./components/status"
export type { StatusKind, StatusLook } from "./components/status"
export { formatRelativeTime } from "./components/relativeTime"
export type { RelativeTime, RelativeTimeOptions, RelativeUnit } from "./components/relativeTime"

// ── Processes (group: process) ──
export { default as LpPipeline } from "./components/LpPipeline.vue"
export type { PipelineLabels } from "./components/LpPipeline.vue"
export { default as LpStepMark } from "./components/LpStepMark.vue"
export type { StepMarkStatus } from "./components/LpStepMark.vue"
export {
  childProgress,
  connectorFilled,
  currentStepIndex,
  isSettled,
  overallStatus,
  stepElapsed,
} from "./components/pipeline"
export type { PipelineStep, StepStatus } from "./components/pipeline"
export { default as LpLoader } from "./components/LpLoader.vue"
export type { LoaderLabels, LoaderSize, LoaderTone, LoaderVariant } from "./components/LpLoader.vue"
export { useLoadingGate } from "./composables/useLoadingGate"
export type { LoadingGateOptions } from "./composables/useLoadingGate"
export { useNow } from "./composables/useNow"
export type { UseNowOptions } from "./composables/useNow"
export { default as LpCountdown } from "./components/LpCountdown.vue"
export type { CountdownLabels } from "./components/LpCountdown.vue"
export {
  ceilToSecond,
  crossedMilestone,
  DEFAULT_MILESTONES,
  DEFAULT_UNIT_LABELS,
  formatElapsed,
  formatTime,
  msToNextSecond,
  splitTime,
  timeParts,
} from "./components/timeSpan"
export type { TimeFormat, TimePart, TimeSplit, TimeUnit, TimeUnitLabels } from "./components/timeSpan"

// ── Fields and text (group: fields) ──
export { default as LpCopyButton } from "./components/LpCopyButton.vue"
export type { CopyButtonLabels, CopyValue } from "./components/LpCopyButton.vue"
export { default as LpSecretField } from "./components/LpSecretField.vue"
export type { SecretFieldLabels } from "./components/LpSecretField.vue"
export { default as LpDataList } from "./components/LpDataList.vue"
export type { DataListItem, DataListLabels } from "./components/LpDataList.vue"
export { default as LpEditable } from "./components/LpEditable.vue"
export type { EditableLabels } from "./components/LpEditable.vue"
export { default as LpTruncate } from "./components/LpTruncate.vue"
export { default as LpCodeDisplay } from "./components/LpCodeDisplay.vue"
export type { CodeDisplayLabels } from "./components/LpCodeDisplay.vue"
export { formatRemaining, groupCode, middleTruncate, normalizeCode } from "./components/fieldText"

// ── Overlays and look (group: looks) ──
export { default as LpHoverCard } from "./components/LpHoverCard.vue"
export { default as LpIdenticon } from "./components/LpIdenticon.vue"
export { hashString, identicon, identiconRects, identiconSvg } from "./components/identicon"
export type { Identicon, IdenticonOptions, IdenticonSvgOptions } from "./components/identicon"
export { default as LpShaderBackdrop } from "./components/LpShaderBackdrop.vue"
export { PRESET_NAMES as SHADER_PRESETS } from "./components/shaderBackdrop"
export type { ShaderPreset } from "./components/shaderBackdrop"
export { default as LpCollapse } from "./components/LpCollapse.vue"
export { pseudoLocalize } from "./composables/pseudoLocale"
export type { PseudoOptions } from "./composables/pseudoLocale"

// ── Text effects (group: text) ──
export { default as LpTextReveal } from "./components/LpTextReveal.vue"
export { default as LpShinyText } from "./components/LpShinyText.vue"
export { default as LpTypewriter } from "./components/LpTypewriter.vue"
export { default as LpScramble } from "./components/LpScramble.vue"
export { useScramble } from "./composables/useScramble"
export type { UseScramble, UseScrambleOptions } from "./composables/useScramble"
export { useInView } from "./composables/useInView"
export type { UseInView } from "./composables/useInView"
export {
  graphemes,
  planScramble,
  randomGlyph,
  scrambleFrame,
  seededRandom,
  settledCells,
  SCRAMBLE_GLYPHS,
} from "./components/scramble"
export type { ScrambleCell, ScrambleFrameCell, ScrambleOptions } from "./components/scramble"

// ── Layout and card effects (group: layout) ──
export { default as LpDock } from "./components/LpDock.vue"
export type { DockItem } from "./components/LpDock.vue"
export { dockSize, magneticOffset } from "./components/dock"
export { default as LpMasonry } from "./components/LpMasonry.vue"
export { masonryColumnCount, placeMasonry } from "./components/masonry"
export type { MasonryColumns, MasonryPlacement } from "./components/masonry"
export { default as LpRevealOnScroll } from "./components/LpRevealOnScroll.vue"
export { revealFrom, revealTo, staggerDelay } from "./components/reveal"
export type { RevealDirection, RevealPreset } from "./components/reveal"
export { default as LpSpotlight } from "./components/LpSpotlight.vue"
export { default as LpGlowBorder } from "./components/LpGlowBorder.vue"
export { default as LpMagnetic } from "./components/LpMagnetic.vue"
export { spotlightPoint, useSpotlight } from "./composables/useSpotlight"
export type { UseSpotlight, UseSpotlightOptions } from "./composables/useSpotlight"

export { default as LpCommandScope } from "./components/LpCommandScope.vue"
export { createPaletteRegistry, usePaletteCommands, mergePaletteCommands } from "./composables/usePaletteCommands"
export type { PaletteRegistry, PaletteControlOptions } from "./composables/usePaletteCommands"
export { PALETTE_MODES } from "./components/commandPalette"
export type { PaletteMode } from "./components/commandPalette"
export { searchCommandItems, swapCommandLayout } from "./components/commandSearch"
export type { CommandPrompt } from "./components/LpCommandPalette.vue"

export { usePaletteTheme } from "./theme/palette"
export { default as LpPaletteTheme } from "./components/LpPaletteTheme.vue"

export { vPalette } from "./composables/usePaletteCommands"
export type { PaletteTargetOptions } from "./composables/usePaletteCommands"
export { menuPaletteCommands } from "./components/commandPalette"

export type { PreviewableThemeStudio } from "./theme/studio"
