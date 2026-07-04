<?php

namespace bensomething\tabler\models;

use Craft;
use craft\helpers\Html;
use craft\web\twig\SafeHtml;
use Twig\Markup;

/**
 * Represents a selected Tabler icon.
 */
class Icon implements \JsonSerializable, \Stringable, SafeHtml
{
    public const VARIANT_OUTLINE = 'outline';
    public const VARIANT_FILLED = 'filled';

    private static ?array $svgDefaults = null;

    public function __construct(
        public string $name,
        public string $variant = self::VARIANT_OUTLINE,
    ) {
    }

    /**
     * Returns the inline SVG markup for the icon.
     *
     * Supported attributes: `size` (sets width + height), plus any HTML
     * attribute (`class`, `width`, `height`, `stroke-width`, `aria-label`, …).
     *
     * Site-wide defaults can be set via `svgDefaults` in `config/tabler.php`.
     * Per-call attributes override defaults, except `class`, which is combined.
     * Pass `defaults: false` to skip the configured defaults for one call.
     */
    public function svg(array $attributes = []): Markup
    {
        $contents = $this->rawSvg();

        if ($contents === null) {
            return new Markup('', 'UTF-8');
        }

        $attributes = self::normalizeStrokeWidth($attributes);
        $attributes = self::mergeSvgDefaults($attributes);

        if (isset($attributes['size'])) {
            $size = $attributes['size'];
            unset($attributes['size']);
            $attributes['width'] = $attributes['width'] ?? $size;
            $attributes['height'] = $attributes['height'] ?? $size;
        }

        // Default to a hidden decorative icon unless a label is provided
        if (!isset($attributes['aria-label']) && !isset($attributes['aria-hidden'])) {
            $attributes['aria-hidden'] = 'true';
        }

        if ($attributes) {
            $contents = Html::modifyTagAttributes($contents, $attributes);
        }

        return new Markup($contents, 'UTF-8');
    }

    /**
     * Converts the unquoted-friendly `strokeWidth` alias to 'stroke-width'.
     */
    private static function normalizeStrokeWidth(array $attributes): array
    {
        if (isset($attributes['strokeWidth'])) {
            $attributes['stroke-width'] = $attributes['stroke-width'] ?? $attributes['strokeWidth'];
            unset($attributes['strokeWidth']);
        }

        return $attributes;
    }

    /**
     * Merges the configured `svgDefaults` under the given attributes.
     * Call-time attributes win per key; `class` values are combined.
     */
    private static function mergeSvgDefaults(array $attributes): array
    {
        $skipDefaults = ($attributes['defaults'] ?? true) === false;
        unset($attributes['defaults']);

        if ($skipDefaults) {
            return $attributes;
        }

        if (self::$svgDefaults === null) {
            self::$svgDefaults = self::normalizeStrokeWidth(
                Craft::$app->getConfig()->getConfigFromFile('tabler')['svgDefaults'] ?? []
            );
        }

        if (!self::$svgDefaults) {
            return $attributes;
        }

        $defaults = self::$svgDefaults;

        if (isset($defaults['class'], $attributes['class'])) {
            $attributes['class'] = trim(
                implode(' ', (array)$defaults['class']) . ' ' . implode(' ', (array)$attributes['class'])
            );
        }

        return $attributes + $defaults;
    }

    /**
     * Returns the raw SVG file contents, or null if the icon doesn’t exist.
     */
    public function rawSvg(): ?string
    {
        $path = $this->path();

        if ($path === null || !is_file($path)) {
            return null;
        }

        return trim(file_get_contents($path));
    }

    /**
     * Returns a human-friendly label, e.g. "ad-off" -> "Ad Off".
     */
    public function getLabel(): string
    {
        $label = ucwords(str_replace('-', ' ', $this->name));

        if ($this->variant === self::VARIANT_FILLED) {
            $label .= ' (Filled)';
        }

        return $label;
    }

    /**
     * Returns the CSS classes for use with the Tabler webfont
     * (e.g. `ti ti-home` / `ti ti-heart-filled`).
     */
    public function classes(): string
    {
        $suffix = $this->variant === self::VARIANT_FILLED ? '-filled' : '';
        return "ti ti-{$this->name}{$suffix}";
    }

    public function path(): ?string
    {
        // Guard against path traversal
        if (!preg_match('/^[a-z0-9-]+$/', $this->name)) {
            return null;
        }

        $variant = $this->variant === self::VARIANT_FILLED ? self::VARIANT_FILLED : self::VARIANT_OUTLINE;

        return dirname(__DIR__) . "/icons/$variant/{$this->name}.svg";
    }

    public function jsonSerialize(): array
    {
        return [
            'name' => $this->name,
            'variant' => $this->variant,
        ];
    }

    public function __toString(): string
    {
        return (string)$this->svg();
    }
}
