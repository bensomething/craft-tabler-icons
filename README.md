# Tabler Icons for Craft CMS

A field type for selecting a [Tabler icon](https://tabler.io/icons) from a searchable picker, and rendering any icon as inline SVG in your templates.

- 5,000+ outline icons and 1,000+ filled icons (Tabler Icons v3.44), bundled with the plugin
- Searchable by name, tags, and category, with outline/filled tabs
- Inline SVG rendering with custom attributes, plays nicely with Tailwind
- `tabler()` Twig function for hardcoding icons without a field
- Field setting to limit picker to outline-only or filled-only icons

## Requirements

- Craft CMS 5.0+
- PHP 8.2+

## Installation

```bash
composer require bensomething/craft-tabler-icons
php craft plugin/install tabler
```

Or install from the control panel: **Settings → Plugins**.

> **Installing straight from GitHub** (if not using Packagist): add
> `{ "type": "vcs", "url": "https://github.com/bensomething/craft-tabler-icons" }`
> to the `repositories` array in your project's `composer.json` first.

### Package Size

The full Tabler icon set is bundled with the plugin, which makes it around 25MB on disk (roughly 3MB compressed for the actual download). In return, everything works offline. The picker, search, and SVG rendering make no CDN or API calls, icons can never change or disappear underneath your content, and front-end rendering is a local file read rather than an HTTP request.

## The Field

Create a field of type **Tabler Icon** and add it to a field layout. Authors get a **Choose icon** button that opens a searchable icon grid.

**Field settings** — *Icon Style* controls whether authors can pick from both styles, outline only, or filled only. Selecting **Outline and filled** will display **Outline** and **Filled** tabs in the icon picker.

## Templating

The field value is `null` or an Icon object:

```twig
{# Inline SVG at its native 24×24 #}
{{ entry.myIcon }}

{# With attributes — `size` sets width and height,
   `strokeWidth` is an alias for stroke-width (outline icons only) #}
{{ entry.myIcon.svg({ size: 32, class: 'text-red-500', strokeWidth: 1.5 }) }}

{# Guard against empty values #}
{% if entry.myIcon %}
    {{ entry.myIcon.svg({ size: 20 }) }}
{% endif %}

{# Properties #}
{{ entry.myIcon.name }}        {# "ad-off" #}
{{ entry.myIcon.label }}       {# "Ad Off" #}
{{ entry.myIcon.variant }}     {# "outline" or "filled" #}
```

Icons inherit `currentColor`, so they take the CSS text colour of their parent. SVGs render with `aria-hidden="true"` by default. Pass an `aria-label` for icons that carry meaning.

### Manual Icons (No Field)

The `tabler()` Twig function returns the same Icon object for any icon name:

```twig
{{ tabler('map-pin') }}
{{ tabler('map-pin').svg({ size: 20, class: 'list-icon' }) }}
{{ tabler('heart', 'filled').svg({ size: 20 }) }}
```

Unknown icon names render as an empty string.

### With Tailwind

Skip `size` and use utility classes, CSS wins over the SVG's intrinsic `width`/`height` attributes:

```twig
{{ tabler('calendar').svg({ class: 'size-4 sm:size-6 shrink-0 text-emerald-600' }) }}
```

### Webfont Classes

If you load the Tabler webfont on the front end yourself, `classes()` gives you the class names:

```twig
<i class="{{ entry.myIcon.classes() }}"></i>   {# "ti ti-ad-off" / "ti ti-heart-filled" #}
```

## License

This plugin is MIT-licensed. Tabler Icons are © [Paweł Kuna](https://github.com/tabler/tabler-icons), also MIT-licensed (see `LICENSE-tabler`).
