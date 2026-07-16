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
     * Replaces `{icon:heart-filled}` tokens with inline SVG, sized at 1em and
     * baseline-nudged to sit in running text, wrapped in a span styling hook.
     */
    public function replaceIcons(mixed $html): string
    {
        return preg_replace_callback(
            '/\{icon:\s*([a-z0-9-]+)\s*\}/',
            function(array $match): string {
                // explicit display beats CSS resets (e.g. Tailwind Preflight's
                // svg { display: block })
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
        // pass a field value straight through
        if ($name instanceof Icon) {
            return $name;
        }

        // '-filled' suffix selects the filled variant (unambiguous — no outline
        // name ends in '-filled'), but only if that filled icon exists
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
