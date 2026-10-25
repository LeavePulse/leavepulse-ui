/*
 * The shape every option-taking control shares. LpSelect, LpAutocomplete,
 * LpRadioGroup and LpSegmented each grew their own option type, and the same
 * idea ended up spelled four ways: an icon on one, a picture on another, a
 * disabled flag on none. One base means a list built for one control can be
 * handed to another, and a field added here reaches all of them.
 *
 * `label` is optional on the base because two controls render without one (an
 * icon-only segment, a suggestion that is its own value); the controls that
 * always print a name narrow it back to required.
 */
export interface LpOptionBase<V = string> {
  value: V
  label?: string
  /** A second, muted line under the label. */
  description?: string
  /** Iconify name shown before the label. */
  icon?: string
  /** A picture before the label: an avatar, a server icon. Wins over `icon` where both fit. */
  image?: string
  /** Shown but not choosable. */
  disabled?: boolean
}

/** What a picked value stands for: a name for an id, with an optional muted hint and picture. */
export interface OptionSelection {
  label: string
  hint?: string
  image?: string
}
