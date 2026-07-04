# Release Notes for Tabler Icons

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
