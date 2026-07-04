<?php

namespace bensomething\tabler\web\twig;

use bensomething\tabler\models\Icon;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class Extension extends AbstractExtension
{
    public function getFunctions(): array
    {
        return [
            new TwigFunction('tabler', [$this, 'icon'], ['is_safe' => ['html']]),
        ];
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
