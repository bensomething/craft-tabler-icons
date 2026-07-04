<?php

namespace bensomething\tabler\models;

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
     */
    public function svg(array $attributes = []): Markup
    {
        $contents = $this->rawSvg();

        if ($contents === null) {
            return new Markup('', 'UTF-8');
        }

        if (isset($attributes['size'])) {
            $size = $attributes['size'];
            unset($attributes['size']);
            $attributes['width'] = $attributes['width'] ?? $size;
            $attributes['height'] = $attributes['height'] ?? $size;
        }

        // Unquoted-friendly alias for 'stroke-width'
        if (isset($attributes['strokeWidth'])) {
            $attributes['stroke-width'] = $attributes['stroke-width'] ?? $attributes['strokeWidth'];
            unset($attributes['strokeWidth']);
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
