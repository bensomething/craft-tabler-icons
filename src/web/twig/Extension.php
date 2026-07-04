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

    public function icon(string $name, string $variant = Icon::VARIANT_OUTLINE): Icon
    {
        return new Icon($name, $variant);
    }
}
