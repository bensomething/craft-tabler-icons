<?php

namespace bensomething\tabler\web\twig;

use bensomething\tabler\models\Icon;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;
use Twig\TwigFunction;

class Extension extends AbstractExtension
{
    public function getFunctions(): array
    {
        return [
            new TwigFunction('tabler', [$this, 'icon'], ['is_safe' => ['html']]),
        ];
    }

    public function getFilters(): array
    {
        return [
            new TwigFilter('tabler', [$this, 'replaceIcons'], ['is_safe' => ['html']]),
        ];
    }

    /**
     * Replaces `{icon:heart-filled}` tokens in text with inline SVG.
     *
     * Icons are sized at 1em and nudged down slightly so they sit naturally
     * in running text at any font size, wrapped in a span for styling hooks.
     */
    public function replaceIcons(mixed $html): string
    {
        return preg_replace_callback(
            '/\{icon:\s*([a-z0-9-]+)\s*\}/',
            function(array $match): string {
                // display is explicit because CSS resets (e.g. Tailwind
                // Preflight) commonly set svg { display: block }
                $svg = (string)$this->icon($match[1])->svg([
                    'style' => 'display:inline-block;width:1em;height:1em;vertical-align:-0.125em',
                ]);

                return $svg !== '' ? '<span class="tabler-icon">' . $svg . '</span>' : '';
            },
            (string)$html,
        );
    }

    public function icon(string|Icon $name, ?string $variant = null): Icon
    {
        // Pass an existing Icon (e.g. a field value) straight through, so
        // templates can hand tabler() either a name or a field value.
        if ($name instanceof Icon) {
            return $name;
        }

        // A '-filled' suffix selects the filled variant: tabler('heart-filled').
        // No outline icon name ends in '-filled', so this is unambiguous — but
        // only resolve it when the base icon actually has a filled variant.
        if ($variant === null && str_ends_with($name, '-filled')) {
            $filled = new Icon(substr($name, 0, -7), Icon::VARIANT_FILLED);
            $path = $filled->path();
            if ($path !== null && is_file($path)) {
                return $filled;
            }
        }

        return new Icon($name, $variant ?? Icon::VARIANT_OUTLINE);
    }
}
