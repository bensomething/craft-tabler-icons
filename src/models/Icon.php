<?php

namespace bensomething\tabler\models;

use Craft;
use craft\helpers\Html;
use craft\web\twig\SafeHtml;
use Twig\Markup;

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
     * Accepts `size` (sets width + height) and any HTML attribute. Merges
     * `svgDefaults` from config/tabler.php (per-call wins, `class` combines);
     * pass `defaults: false` to skip them.
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

    /** `strokeWidth` alias avoids quoting the hyphenated key in Twig. */
    private static function normalizeStrokeWidth(array $attributes): array
    {
        if (isset($attributes['strokeWidth'])) {
            $attributes['stroke-width'] = $attributes['stroke-width'] ?? $attributes['strokeWidth'];
            unset($attributes['strokeWidth']);
        }

        return $attributes;
    }

    /** Call-time attributes win per key; `class` values are combined. */
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

    public function rawSvg(): ?string
    {
        $path = $this->path();

        if ($path === null || !is_file($path)) {
            return null;
        }

        return trim(file_get_contents($path));
    }

    /** "ad-off" -> "Ad Off". */
    public function getLabel(): string
    {
        $label = ucwords(str_replace('-', ' ', $this->name));

        if ($this->variant === self::VARIANT_FILLED) {
            $label .= ' (Filled)';
        }

        return $label;
    }

    /** Tabler webfont classes, e.g. `ti ti-home` / `ti ti-heart-filled`. */
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
