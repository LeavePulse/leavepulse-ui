/*
 * Ukrainian wording for every kit component, handed over once at the root:
 *
 *   app.use(lpConfig({ labels: uk }))   or   provideLpConfig({ labels: uk })
 *
 * Each scope is typed with the component's FULL labels type, so a key a
 * component adds and this pack lacks is a compile error rather than a stray
 * English word on a Ukrainian screen. `{placeholder}` tokens are kept as is:
 * the components replace them.
 *
 * Labels are plain strings, so a count cannot pick its own plural form here.
 * Where English writes "{n} selected", the pack words it so the number does
 * not have to agree ("Вибрано: {n}").
 */
import type { AddressLabels } from "../components/address"
import type { CalendarLabels } from "../components/calendar"
import type { PaletteLabels } from "../components/LpCommandPalette.vue"
import type { NOTIFICATION_LABELS } from "../components/notifications"
import type { StatusLabels } from "../components/status"
import type { TimeUnitLabels } from "../components/timeSpan"
import type { CloseGuardLabels } from "../composables/useCloseGuard"
import type { PaletteControlLabels } from "../composables/usePaletteCommands"
import type { HintExampleLabels } from "../components/HintSampleTag.vue"
import type { ActionBarLabels } from "../components/LpActionBar.vue"
import type { ActivityLineLabels } from "../components/LpActivityLine.vue"
import type { AppShellLabels } from "../components/LpAppShell.vue"
import type { AutocompleteLabels } from "../components/LpAutocomplete.vue"
import type { BadgeLabels } from "../components/LpBadge.vue"
import type { BottomNavLabels } from "../components/LpBottomNav.vue"
import type { BreadcrumbsLabels } from "../components/LpBreadcrumbs.vue"
import type { ButtonLabels } from "../components/LpButton.vue"
import type { ChartText } from "../components/LpChart.vue"
import type { CodeBlockLabels } from "../components/LpCodeBlock.vue"
import type { CodeDisplayLabels } from "../components/LpCodeDisplay.vue"
import type { ColorPickerLabels } from "../components/LpColorPicker.vue"
import type { ConfirmLabels } from "../components/LpConfirmDialog.vue"
import type { ContextSwitcherLabels } from "../components/LpContextSwitcher.vue"
import type { CopyButtonLabels } from "../components/LpCopyButton.vue"
import type { CountdownLabels } from "../components/LpCountdown.vue"
import type { DataListLabels } from "../components/LpDataList.vue"
import type { DatePickerLabels } from "../components/LpDatePicker.vue"
import type { DateRangePickerLabels } from "../components/LpDateRangePicker.vue"
import type { DrawerLabels } from "../components/LpDrawer.vue"
import type { DropzoneLabels } from "../components/LpDropzone.vue"
import type { EditableLabels } from "../components/LpEditable.vue"
import type { FileTreeLabels } from "../components/LpFileTree.vue"
import type { GaugeLabels } from "../components/LpGauge.vue"
import type { HintLayerLabels } from "../components/LpHintLayer.vue"
import type { HintsLabels } from "../components/LpHints.vue"
import type { ImageEditorLabels } from "../components/LpImageEditor.vue"
import type { InputLabels } from "../components/LpInput.vue"
import type { InspectorLabels } from "../components/LpInspector.vue"
import type { LightboxLabels } from "../components/LpLightbox.vue"
import type { LoaderLabels } from "../components/LpLoader.vue"
import type { LogInspectorLabels } from "../components/LpLogInspector.vue"
import type { LogViewerLabels } from "../components/LpLogViewer.vue"
import type { MapPickerLabels } from "../components/LpMapPicker.vue"
import type { MediaGalleryLabels } from "../components/LpMediaGallery.vue"
import type { ModalLabels } from "../components/LpModal.vue"
import type { ModalNavLabels } from "../components/LpModalNav.vue"
import type { NumberFieldLabels } from "../components/LpNumberField.vue"
import type { PaginationLabels } from "../components/LpPagination.vue"
import type { PaletteThemeLabels } from "../components/LpPaletteTheme.vue"
import type { PasswordInputLabels } from "../components/LpPasswordInput.vue"
import type { PhoneInputLabels } from "../components/LpPhoneInput.vue"
import type { PieText } from "../components/LpPie.vue"
import type { PipelineLabels } from "../components/LpPipeline.vue"
import type { QuotaLabels } from "../components/LpQuota.vue"
import type { RangeCalendarLabels } from "../components/LpRangeCalendar.vue"
import type { RepeaterLabels } from "../components/LpRepeater.vue"
import type { SecretFieldLabels } from "../components/LpSecretField.vue"
import type { SelectLabels } from "../components/LpSelect.vue"
import type { ShortcutsLabels } from "../components/LpShortcutsDialog.vue"
import type { SidebarLabels } from "../components/LpSidebar.vue"
import type { SparklineLabels } from "../components/LpSparkline.vue"
import type { TableLabels } from "../components/LpTable.vue"
import type { TableOfContentsLabels } from "../components/LpTableOfContents.vue"
import type { TagsInputLabels } from "../components/LpTagsInput.vue"
import type { ThemeStudioLabels } from "../components/LpThemeStudio.vue"
import type { ThemeSwitcherLabels } from "../components/LpThemeSwitcher.vue"
import type { ToasterLabels } from "../components/LpToaster.vue"
import type { TopologyLabels } from "../components/LpTopologyCanvas.vue"
import type { TourLabels } from "../components/LpTour.vue"
import type { UptimeBarLabels } from "../components/LpUptimeBar.vue"
import type { VideoCompressLabels } from "../components/LpVideoCompress.vue"
import type { VideoPlayerLabels } from "../components/LpVideoPlayer.vue"
import type { VideoTrimLabels } from "../components/LpVideoTrim.vue"
import type { WindowLabels } from "../components/LpWindow.vue"
import type { WorkspaceSwitcherLabels } from "../components/LpWorkspaceSwitcher.vue"

/**
 * Every declared key of a labels type, required, and nothing else: an index
 * signature (`[key: string]: string`) is dropped so a misspelt key is an
 * excess-property error instead of being silently accepted.
 */
export type FullLabels<T> = { [K in keyof T as string extends K ? never : K]-?: string }


/** One full label set per scope: the shape of a complete language pack. */
export interface KitLabels {
  actionBar: FullLabels<ActionBarLabels>
  activityLine: FullLabels<ActivityLineLabels>
  addressInput: FullLabels<AddressLabels>
  appShell: FullLabels<AppShellLabels>
  autocomplete: FullLabels<AutocompleteLabels>
  badge: FullLabels<BadgeLabels>
  bottomNav: FullLabels<BottomNavLabels>
  breadcrumbs: FullLabels<BreadcrumbsLabels>
  button: FullLabels<ButtonLabels>
  calendar: FullLabels<CalendarLabels>
  chart: FullLabels<ChartText>
  closeGuard: FullLabels<CloseGuardLabels>
  codeBlock: FullLabels<CodeBlockLabels>
  codeDisplay: FullLabels<CodeDisplayLabels>
  colorPicker: FullLabels<ColorPickerLabels>
  confirm: FullLabels<ConfirmLabels>
  contextSwitcher: FullLabels<ContextSwitcherLabels>
  copyButton: FullLabels<CopyButtonLabels>
  countdown: FullLabels<CountdownLabels>
  dataList: FullLabels<DataListLabels>
  datePicker: FullLabels<DatePickerLabels>
  dateRangePicker: FullLabels<DateRangePickerLabels>
  drawer: FullLabels<DrawerLabels>
  dropzone: FullLabels<DropzoneLabels>
  editable: FullLabels<EditableLabels & { required: string }>
  fileTree: FullLabels<FileTreeLabels>
  gauge: FullLabels<GaugeLabels>
  hintExample: FullLabels<HintExampleLabels>
  hintLayer: FullLabels<HintLayerLabels>
  hints: FullLabels<HintsLabels>
  imageEditor: FullLabels<ImageEditorLabels>
  input: FullLabels<InputLabels>
  inspector: FullLabels<InspectorLabels>
  lightbox: FullLabels<LightboxLabels>
  loader: FullLabels<LoaderLabels>
  logInspector: FullLabels<LogInspectorLabels>
  logViewer: FullLabels<LogViewerLabels>
  mapPicker: FullLabels<MapPickerLabels>
  mediaGallery: FullLabels<MediaGalleryLabels>
  modal: FullLabels<ModalLabels>
  modalNav: FullLabels<ModalNavLabels>
  /** The deprecated keys of `NotificationLabels` are no longer read, so not required. */
  notifications: FullLabels<typeof NOTIFICATION_LABELS>
  numberField: FullLabels<NumberFieldLabels>
  pagination: FullLabels<PaginationLabels>
  palette: FullLabels<PaletteLabels>
  paletteControl: FullLabels<PaletteControlLabels>
  paletteTheme: FullLabels<PaletteThemeLabels>
  passwordInput: FullLabels<PasswordInputLabels>
  phoneInput: FullLabels<PhoneInputLabels>
  pie: FullLabels<PieText>
  pipeline: FullLabels<PipelineLabels>
  quota: FullLabels<QuotaLabels>
  rangeCalendar: FullLabels<RangeCalendarLabels>
  repeater: FullLabels<RepeaterLabels>
  secretField: FullLabels<SecretFieldLabels>
  select: FullLabels<SelectLabels>
  shortcuts: FullLabels<ShortcutsLabels>
  sidebar: FullLabels<SidebarLabels>
  sparkline: FullLabels<SparklineLabels>
  status: FullLabels<StatusLabels>
  table: FullLabels<TableLabels>
  tagsInput: FullLabels<TagsInputLabels>
  themeStudio: FullLabels<ThemeStudioLabels>
  themeSwitcher: FullLabels<ThemeSwitcherLabels>
  time: FullLabels<TimeUnitLabels>
  toast: FullLabels<ToasterLabels>
  toc: FullLabels<TableOfContentsLabels>
  topology: FullLabels<TopologyLabels>
  tour: FullLabels<TourLabels>
  uptimeBar: FullLabels<UptimeBarLabels>
  videoCompress: FullLabels<VideoCompressLabels>
  videoPlayer: FullLabels<VideoPlayerLabels>
  videoTrim: FullLabels<VideoTrimLabels>
  window: FullLabels<WindowLabels>
  workspaces: FullLabels<WorkspaceSwitcherLabels>
}

export const uk: KitLabels = {
  actionBar: { dismiss: "Закрити" },
  activityLine: { busy: "Завантаження" },
  addressInput: {
    line: "Вулиця та номер будинку",
    linePlaceholder: "вул. Хрещатик, 22",
    secondLine: "Квартира, офіс (необов'язково)",
    secondLinePlaceholder: "кв. 4",
    city: "Місто",
    cityPlaceholder: "Київ",
    postalCode: "Поштовий індекс",
    postalCodePlaceholder: "01001",
    country: "Країна",
    countryPlaceholder: "Виберіть країну…",
    countrySearch: "Пошук країни…",
    pickOnMap: "Вибрати на мапі",
    mapTitle: "Виберіть місце",
    mapHint: "Клацніть на мапі, щоб поставити мітку; перетягуйте, щоб рухатися.",
    use: "Використати цю адресу",
    cancel: "Скасувати",
    searching: "Пошук…",
    noSuggestions: "Немає пропозицій",
    nothingHere: "Тут адресу не знайдено",
  },
  appShell: {
    openMenu: "Відкрити меню",
    skipToContent: "Перейти до вмісту",
    backToTop: "Догори",
    aside: "Подробиці",
    contextNav: "У цьому розділі",
  },
  autocomplete: { clear: "Очистити", placeholder: "Почніть вводити…", empty: "Немає пропозицій", loading: "Пошук…" },
  badge: { remove: "Прибрати" },
  bottomNav: { nav: "Головне", more: "Ще" },
  breadcrumbs: { nav: "Навігаційний ланцюжок" },
  button: { group: "Дії" },
  calendar: { previous: "Попередній місяць", next: "Наступний місяць" },
  chart: {
    empty: "Немає даних",
    loading: "Завантаження",
    rightAxis: "Вимірюється за правою віссю",
    point: "Точка",
    xColumn: "Позначка",
    rangeStart: "Початок діапазону",
    rangeEnd: "Кінець діапазону",
    resetZoom: "Показати все",
  },
  closeGuard: {
    title: "Скасувати зміни?",
    description: "Зміни тут не збережено, і їх буде втрачено.",
    discard: "Скасувати зміни",
    keep: "Редагувати далі",
  },
  codeBlock: {
    unlock: "Розблокувати для редагування",
    lock: "Заблокувати (лише читання)",
    copy: "Копіювати код",
    copied: "Скопійовано",
    imports: "імпорти",
    details: "подробиці",
    lines: "(рядків: {n})",
  },
  codeDisplay: {
    show: "Показати код",
    hide: "Сховати код",
    hidden: "Код приховано",
    expiresIn: "Дійсний ще",
    expired: "Термін минув",
    saved: "Я зберіг цей код",
  },
  colorPicker: {
    saturation: "Насиченість і яскравість",
    hue: "Відтінок",
    opacity: "Непрозорість",
    value: "Значення кольору",
    recent: "Недавні",
    copyHex: "Копіювати hex",
    copyRgb: "Копіювати rgb",
    copyHsl: "Копіювати hsl",
    paste: "Вставити колір",
    formatAs: "Формат",
    format_hex: "HEX",
    format_rgb: "RGB",
    format_hsl: "HSL",
    saturationValueText: "насиченість {s}%, яскравість {v}%",
    copyToast: "Скопійовано {value}",
  },
  confirm: { confirm: "Підтвердити", cancel: "Скасувати", loading: "Виконується…", failed: "Щось пішло не так." },
  contextSwitcher: { switch: "{label}, змінити", title: "Перейти до" },
  copyButton: { copy: "Копіювати", copied: "Скопійовано", failed: "Не вдалося скопіювати" },
  countdown: { left: "Залишилось {time}", done: "Час вийшов" },
  dataList: { empty: "—" },
  datePicker: {
    placeholder: "Виберіть дату",
    clear: "Очистити",
    done: "Готово",
    presets: "Швидкий вибір",
    today: "Сьогодні",
    tomorrow: "Завтра",
    inWeek: "Через тиждень",
  },
  dateRangePicker: {
    placeholder: "Виберіть період",
    clear: "Очистити",
    presets: "Швидкий вибір",
    today: "Сьогодні",
    last7: "Останні 7 днів",
    last30: "Останні 30 днів",
    thisMonth: "Цей місяць",
    lastMonth: "Минулий місяць",
  },
  drawer: { close: "Закрити" },
  dropzone: {
    orLink: "або посилання",
    placeholder: "https://…",
    done: "Додати",
    keys: "Enter, щоб додати · Esc, щоб повернутися",
    invalid: "Це не посилання: воно має починатися з http:// або https://",
  },
  editable: { edit: "Змінити", empty: "Порожньо", saving: "Збереження…", failed: "Не вдалося зберегти", required: "Не може бути порожнім" },
  fileTree: {
    empty: "Немає файлів",
    emptyDescription: "Ця папка порожня.",
    // Count words: the tree picks `file` for 1 and `files` for any other
    // number, so the plural is the genitive form ("5 файлів").
    file: "файл",
    files: "файлів",
    folder: "папка",
    folders: "папок",
    search: "Пошук файлів",
    noMatches: "Немає відповідних файлів",
    rename: "Перейменувати",
    path: "Шлях",
  },
  gauge: { warning: "попередження", danger: "критично" },
  hintExample: { badge: "Приклад" },
  hintLayer: { gotIt: "Зрозуміло", badge: "Нове" },
  hints: {
    tourTitle: "Уперше на сторінці «{page}»?",
    tourText: "Хвилинний огляд того, що тут можна зробити.",
    assignedTitle: "Вас попросили переглянути «{page}»",
    assignedText: "Короткий огляд сторінки, близько хвилини.",
    newsTitle: "Що змінилося: {page}",
    show: "Показати",
    notNow: "Не зараз",
    never: "Більше не пропонувати",
    gotIt: "Зрозуміло",
    noThanks: "Ні, дякую",
  },
  imageEditor: {
    rotateLeft: "Повернути ліворуч",
    rotateRight: "Повернути праворуч",
    zoomIn: "Збільшити",
    zoomOut: "Зменшити",
    reset: "Скинути",
    canvas: "Область кадрування: стрілки зсувають, +/− масштабують, R повертає, Alt+коліщатко обертає довільно",
    failed: "Не вдалося відкрити це зображення.",
    cors: "Сервер цього зображення не дозволяє редагувати його тут. Завантажте файл.",
  },
  input: { clear: "Очистити" },
  inspector: { close: "Закрити", empty: "Нічого не вибрано", resize: "Змінити розмір панелі", region: "Подробиці" },
  lightbox: {
    viewer: "Перегляд зображень",
    position: "Зображення {index} з {total}",
    previous: "Попереднє зображення",
    next: "Наступне зображення",
    zoomIn: "Збільшити (+)",
    zoomOut: "Зменшити (−)",
    rotate: "Повернути (R)",
    copy: "Копіювати зображення",
    download: "Завантажити",
    close: "Закрити (Esc)",
    failed: "Не вдалося завантажити це зображення.",
    spoiler: "Спойлер",
    reveal: "Показати зображення",
  },
  loader: { loading: "Завантаження…" },
  logInspector: {
    title: "Запис журналу",
    filterFields: "Фільтр полів",
    noFields: "Немає відповідних полів",
    expand: "Розгорнути {field}",
    collapse: "Згорнути {field}",
  },
  logViewer: {
    empty: "Журнал поки порожній",
    frozen: "Призупинено: відпустіть Ctrl, щоб продовжити",
    noMatch: "Немає відповідних рядків",
    loadingOlder: "завантаження старіших…",
    copyMessage: "Копіювати повідомлення",
    copyLine: "Копіювати рядок",
    copyTimestamp: "Копіювати час",
    copied: "Скопійовано в буфер обміну",
    filterSource: "Фільтр за [{source}]",
    filterLevel: "Фільтр за {level}",
    identical: "Однакових рядків: {n}",
    jump: "До останніх",
    search: "Пошук у журналі",
    clearSearch: "Очистити пошук",
    previousMatch: "Попередній збіг",
    nextMatch: "Наступний збіг",
    matchCount: "{current} / {total}",
    noMatches: "Немає збігів",
    levels: "Рівні",
    regex: "Регулярний вираз",
    invalidPattern: "Неправильний шаблон",
    sources: "Джерела",
    groupRepeats: "Групувати повтори",
    download: "Завантажити",
    copySelection: "Копіювати виділене",
  },
  mapPicker: {
    zoomIn: "Збільшити",
    zoomOut: "Зменшити",
    locate: "Моє місцезнаходження",
    recentre: "Назад до мітки",
    map: "Мапа: стрілки зсувають, +/− масштабують, Enter ставить мітку в центрі",
  },
  mediaGallery: {
    gallery: "Медіа",
    image: "Зображення {n} з {total}",
    spoiler: "Спойлер",
    showSpoiler: "Спойлер: показати зображення",
    showMore: "Показати ще {n}",
  },
  modal: { close: "Закрити" },
  modalNav: { nav: "Розділи" },
  notifications: {
    title: "Сповіщення",
    markAllRead: "Прочитати всі",
    clear: "Очистити",
    markAsRead: "Позначити прочитаним",
    markAsUnread: "Позначити непрочитаним",
    open: "Відкрити",
    dismiss: "Закрити",
    empty: "Немає сповіщень",
    emptyUnread: "Усе переглянуто",
    // Empty on purpose: the bell falls back to `title`.
    ariaLabel: "",
    unread: "Непрочитаних: {count}",
    unreadItem: "Непрочитане",
    all: "Усі",
    unreadTab: "Непрочитані",
    today: "Сьогодні",
    yesterday: "Учора",
    earlier: "Раніше",
    settings: "Налаштування сповіщень",
    viewAll: "Усі сповіщення",
    loadMore: "Завантажити ще",
    actions: "Дії",
  },
  numberField: { increase: "Збільшити", decrease: "Зменшити" },
  pagination: { nav: "Сторінки", previous: "Попередня сторінка", next: "Наступна сторінка" },
  palette: {
    people: "Люди",
    channels: "Канали",
    roles: "Ролі",
    commands: "Команди",
    help: "Довідка",
    search: "Пошук",
    pinned: "Закріплені",
    navigate: "перехід",
    pin: "Закріпити",
    unpin: "Відкріпити",
    undo: "Скасувати",
    backToResults: "Назад до результатів",
    actionFailed: "Не вдалося виконати дію.",
    submit: "Надіслати",
    running: "Виконується…",
    select: "вибрати",
    close: "закрити",
    dismiss: "Закрити",
    back: "назад",
    searching: "Пошук…",
    searchFailed: "Пошук зараз недоступний.",
    searchIncomplete: "Деякі результати не вдалося завантажити.",
    retry: "Повторити",
    showMore: "Показати ще {count}",
    actions: "дії",
    openInNewTab: "Відкрити в новій вкладці",
    copyLink: "Копіювати посилання",
    linkCopied: "Посилання скопійовано",
    noPreview: "Немає попереднього перегляду",
    title: "Палітра команд",
    description: "Знайдіть і виконайте команду.",
    esc: "esc",
    tab: "tab",
  },
  paletteControl: { focus: "Перейти до поля" },
  paletteTheme: {
    title: "Тема",
    apply: "Застосувати тему",
    revert: "Відкинути чернетку",
    sample: "Попередній перегляд",
    action: "Продовжити",
    placeholder: "Поле в цій темі",
  },
  passwordInput: { show: "Показати пароль", hide: "Сховати пароль" },
  phoneInput: {
    selectCountry: "Виберіть країну",
    placeholder: "Номер телефону",
    search: "Пошук країни…",
    searchLabel: "Пошук країн",
    empty: "Країну не знайдено",
    tooLong: "Номер телефону має щонайбільше {max} цифр",
    tooLongFor: "Номери в країні {country} мають щонайбільше {max} цифр після коду",
    tooShort: "Номер закороткий",
    tooShortFor: "Закороткий для країни {country}",
    invalidNumber: "Неправильний номер телефону",
    unknownCountry: "Невідомий код країни",
  },
  pie: { empty: "Немає даних", loading: "Завантаження", other: "Інше", total: "усього", selected: "Вибрано: {n}" },
  pipeline: {
    pending: "Очікує",
    running: "Виконується",
    success: "Успішно",
    failed: "Помилка",
    skipped: "Пропущено",
    cancelled: "Скасовано",
    showDetails: "Показати подробиці",
    hideDetails: "Сховати подробиці",
  },
  quota: {
    left: "Залишилось {amount}",
    over: "Перевищено на {amount}",
    unlimited: "Без обмежень",
    reading: "Використано {used} з {limit}",
  },
  rangeCalendar: { previous: "Попередній місяць", next: "Наступний місяць" },
  repeater: { add: "Додати", remove: "Видалити елемент {index}", empty: "Немає елементів" },
  secretField: {
    show: "Показати",
    hide: "Сховати",
    regenerate: "Створити новий",
    hidden: "Приховано",
    empty: "Не задано",
    hidesIn: "Сховається автоматично",
  },
  select: {
    clear: "Очистити",
    selected: "Вибрано: {count}",
    placeholder: "Виберіть…",
    search: "Пошук…",
    searchLabel: "Пошук варіантів",
    empty: "Нічого не знайдено",
    loading: "Пошук…",
  },
  shortcuts: {
    title: "Клавіатурні скорочення",
    conflict: "Також призначено деінде: спрацює лише одне",
    group: "Загальні",
    then: "потім",
  },
  sidebar: {
    nav: "Бічна панель",
    search: "Пошук",
    pinned: "Закріплені",
    pin: "Закріпити вгорі",
    unpin: "Відкріпити",
    expand: "Показати вкладені сторінки",
    compact: "Згорнути бічну панель",
    expandRail: "Розгорнути бічну панель",
    resize: "Перетягніть, щоб змінити розмір; подвійне клацання скидає",
  },
  sparkline: { empty: "Немає даних", up: "зростає", down: "спадає", flat: "без змін", latest: "останнє", loading: "Завантаження" },
  status: {
    online: "У мережі",
    offline: "Не в мережі",
    degraded: "Погіршено",
    down: "Не працює",
    maintenance: "Обслуговування",
    starting: "Запускається",
    unknown: "Невідомо",
  },
  table: {
    loading: "Завантаження…",
    error: "Не вдалося завантажити",
    empty: "Тут поки нічого немає",
    sortAsc: "За зростанням",
    sortDesc: "За спаданням",
    sortClear: "Скасувати сортування",
    filter: "Лише це",
    showAll: "Показати все",
    columns: "Стовпці",
    exportCsv: "Експорт CSV",
    selectAll: "Вибрати всі рядки",
    shortcutsGroup: "Таблиця",
    filterColumn: "Фільтр: {column}",
    filterSearch: "Пошук значень",
    filterAll: "Усі",
    filterNone: "Жодного",
    filterInvert: "Інвертувати",
    filterOnly: "Лише",
    filterOnlyShown: "Лише ці ({count})",
    filterAddShown: "Додати ці ({count})",
    filterNoValues: "Немає відповідних значень",
    filterNothingShown: "нічого",
    clearFilter: "Скинути фільтр «{column}»",
    clearFilters: "Скинути все",
    noMatches: "Жоден рядок не відповідає фільтрам",
    resetFilters: "Скинути фільтри",
    rowCount: "{shown} з {total}",
    rowsTotal: "Рядків: {total}",
    selectedCount: "Вибрано: {count}",
    clearSelection: "Зняти виділення",
    pageSelected: "Вибрано всі рядки на сторінці ({count}).",
    selectAllMatching: "Вибрати всі ({total})",
    allMatchingSelected: "Вибрано всі ({total}).",
    columnPresets: "Набори стовпців",
    resizeColumn: "Змінити ширину: {column}",
    expandRow: "Розгорнути рядок",
    collapseRow: "Згорнути рядок",
    groupCount: "{label} ({count})",
    expandGroup: "Розгорнути {label}",
    collapseGroup: "Згорнути {label}",
    layoutTable: "Таблиця",
    layoutCards: "Картки",
    layoutList: "Список",
    layoutSwitch: "Вигляд",
    sortBy: "Сортування",
  },
  tagsInput: {
    remove: "Прибрати {tag}",
    duplicate: "{tag} уже додано",
    max: "Не більше {max}",
    added: "{tag} додано",
    removed: "{tag} прибрано",
    loading: "Пошук…",
    suggestions: "Пропозиції",
  },
  themeStudio: {
    title: "Тема",
    reset: "Скинути",
    themes: "Тема",
    system: "Системна",
    brand: "Колір бренду",
    anyBrand: "Будь-який колір бренду",
    corners: "Кути",
    sharp: "Гострі",
    round: "Округлі",
    size: "Розмір елементів",
    compact: "Компактно",
    comfortable: "Просторо",
    motion: "Анімація",
    fast: "Швидко",
    normal: "Звичайно",
    slow: "Повільно",
    default: "Типово",
    export: "Використати цю тему",
  },
  themeSwitcher: {
    trigger: "Тема: {name}. Клацніть, щоб змінити; правою кнопкою, щоб вибрати.",
    system: "Системна",
    studio: "Редактор теми",
    openStudio: "Редактор теми…",
  },
  time: { d: "д", h: "год", m: "хв", s: "с" },
  toast: { dismiss: "Закрити", copy: "Копіювати повідомлення", copied: "Скопійовано" },
  toc: { title: "На цій сторінці" },
  topology: { search: "Знайти вузол", searchResults: "Знайдено: {n}", selected: "Вибрано: {n}", timeline: "Версія" },
  tour: {
    next: "Далі",
    back: "Назад",
    done: "Готово",
    close: "Закрити огляд",
    progress: "{n} з {total}",
    perform: "Зробити за мене",
    tryIt: "Спробуйте: натисніть виділений елемент.",
    example: "Це приклад: зараз таких немає.",
  },
  uptimeBar: {
    operational: "Працює",
    degraded: "Погіршено",
    down: "Не працює",
    maintenance: "Обслуговування",
    empty: "Немає даних",
    loading: "Завантаження",
    uptime: "доступність",
  },
  videoCompress: {
    original: "Оригінал",
    p1080: "1080p",
    p720: "720p",
    p480: "480p",
    fit: "До {size}",
    quality: "Якість",
    estimate: "До ~{size} замість {original}",
    probing: "Читання відео…",
    shrink: "Стиснути",
    skip: "Завантажити як є",
    encoding: "Кодування на цьому пристрої… {percent}%",
    cancel: "Скасувати",
    unsupported: "Цей браузер не вміє кодувати відео, тому буде завантажено оригінал.",
    failed: "Не вдалося закодувати: {error}",
    bigger: "Результат не був би меншим, тож краще оригінал.",
  },
  videoPlayer: {
    player: "Відеоплеєр: пробіл відтворює, стрілки перемотують, F на весь екран",
    play: "Відтворити",
    pause: "Пауза",
    replay: "Ще раз",
    mute: "Вимкнути звук",
    unmute: "Увімкнути звук",
    volume: "Гучність",
    speed: "Швидкість",
    normalSpeed: "Звичайна",
    fullscreen: "На весь екран",
    exitFullscreen: "Вийти з повноекранного режиму",
    pip: "Картинка в картинці",
    exitPip: "Вийти з режиму «картинка в картинці»",
    captions: "Субтитри",
    seek: "Перемотування",
    failed: "Не вдалося завантажити це відео.",
    unsupported: "Цей браузер не відтворює формат цього відео.",
    back: "−{n} с",
    forward: "+{n} с",
    rewind: "Назад на {n} с",
    fastForward: "Вперед на {n} с",
    menuAt: "На {time}",
    copyTime: "Копіювати час",
    copyFrame: "Копіювати кадр",
    copiedTime: "Час скопійовано",
    copiedFrame: "Кадр скопійовано",
    copyFailed: "Не вдалося скопіювати",
  },
  videoTrim: {
    play: "Відтворити",
    pause: "Пауза",
    stepBack: "Попередній кадр",
    stepForward: "Наступний кадр",
    mute: "Вимкнути звук",
    unmute: "Увімкнути звук",
    zoomIn: "Збільшити",
    zoomOut: "Зменшити",
    zoomFit: "Усе відео",
    start: "Початок",
    end: "Кінець",
    position: "Позиція",
    length: "Тривалість",
    left: "Залишилось {left} з {max}",
    overview: "Видима частина шкали",
    timeline: "Шкала часу: пробіл відтворює, стрілки крокують, I та O задають початок і кінець",
    region: "Виділена область: стрілки рухають, Shift+стрілки змінюють розмір, Delete видаляє",
    regionHint: "Протягніть по кадру, щоб виділити область",
    regionClear: "Прибрати область",
    failed: "Не вдалося завантажити це відео.",
    unsupported: "Цей браузер не відтворює формат цього відео.",
    invalidTime: "Введіть час у форматі 1:05.5",
    menuAt: "На {time}",
    setStart: "Почати тут",
    setEnd: "Закінчити тут",
    goStart: "До початку фрагмента",
    goEnd: "До кінця фрагмента",
    zoomHere: "Збільшити тут",
    volume: "Гучність",
    copyTime: "Копіювати час",
    copyFrame: "Копіювати кадр",
    copiedTime: "Час скопійовано",
    copiedFrame: "Кадр скопійовано",
    copyFailed: "Не вдалося скопіювати",
  },
  window: { close: "Закрити", move: "Перемістити вікно" },
  workspaces: {
    menu: "Робочі простори",
    create: "Новий простір",
    duplicate: "Дублювати",
    rename: "Перейменувати",
    remove: "Видалити",
    name: "Назва",
    save: "Зберегти",
    cancel: "Скасувати",
    required: "Введіть назву",
  },
}
