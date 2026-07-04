# Release Notes for Tabler Icons

## 1.4.0 - 2026-07-04

- Added a category dropdown to the icon picker, combinable with search and the outline/filled tabs
- The field’s Remove button is a text button again; changing the icon is done via the preview box

## 1.3.0 - 2026-07-04

- Compact field input: the preview box itself opens the picker (click or keyboard), the Choose button only shows while the field is empty, and Remove is a square x icon button
- Fixed the field preview rendering as a solid square (Craft’s CP force-fills SVG shapes inside the icon box)
- Fixed the icon preview box shrinking in narrow layouts

## 1.2.0 - 2026-07-04

- Restyled the field input to match Craft’s native Icon field (icon box + Choose/Change/Remove buttons)
- `tabler()` now resolves a `-filled` suffix to the filled variant (e.g. `tabler('heart-filled')`)
- `tabler()` now accepts an existing Icon (e.g. a field value) and passes it through unchanged, so one code path can render names and field values

## 1.1.0 - 2026-07-04

- Added site-wide SVG attribute defaults via `svgDefaults` in `config/tabler.php` — per-call attributes override defaults, `class` values are combined, and `defaults: false` skips them for a single call

## 1.0.0 - 2026-07-04

- Initial release
- Tabler Icon field type with searchable outline/filled picker (Tabler Icons v3.44.0)
- Inline SVG templating with `size`, `strokeWidth`, and arbitrary attributes
- `tabler()` Twig function for manual icons
