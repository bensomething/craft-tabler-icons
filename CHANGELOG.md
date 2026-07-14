# Changelog

## 1.9.0 - 2026-07-14

- Tabler Icon fields are now inline-editable in element indexes.
- Added a **Show Categories Dropdown** field setting to hide the picker’s category filter.

## 1.8.2 - 2026-07-14

- Fixed Thumbnail Source icons rendering as solid squares on hovered rows in relation-field search results and other CP menus.

## 1.8.1 - 2026-07-14

- Card thumbnails from a Tabler Icon Thumbnail Source now render small (24px), matching the native Icon field, instead of filling the card’s image slot.

## 1.8.0 - 2026-07-14

- Added a `tabler` Twig filter that replaces `{icon:name}` tokens in plain and rich text with inline SVG — ideal for CKEditor fields.

## 1.7.0 - 2026-07-14

- Added a **Show Random Button** field setting: a shuffle button in the picker selects a random icon from the current results. Clicking focuses the icon (`Enter`/`Space` selects it), activating the button from the keyboard keeps focus on it so `Enter`/`Space` re-rolls, with `Tab` or `Down` moving to the selected icon.
- The category dropdown is now filled-aware. When the filled style is active it only lists categories containing filled icons, and the dropdown now sits after the Outline/Filled tabs it depends on.
- Pressing `Down` in the picker’s search field now jumps focus into the grid, to the currently-selected icon when there is one, or the first result.
- The currently-selected icon in the picker now uses the hover styling, and stays highlighted when the picker is reopened.
- Opening the picker with an icon selected now scrolls to it (switching to its outline/filled tab if needed) and makes it the keyboard entry point.

## 1.6.0 - 2026-07-09

- The field can now be used as an entry type’s Thumbnail Source, showing the selected icon as the entry’s thumbnail in element indexes and cards.

## 1.5.0 - 2026-07-07

- Added keyboard navigation in the picker grid: arrow keys move between icons, Home/End jump to the first/last result, `Enter` or `Space` selects.
- This release also consolidates the changelog. Versions 1.0.0–1.4.1 covered the initial build-out.