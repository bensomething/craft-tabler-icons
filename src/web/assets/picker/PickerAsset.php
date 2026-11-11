<?php

namespace bensomething\tabler\web\assets\picker;

use craft\web\AssetBundle;
use craft\web\assets\cp\CpAsset;

class PickerAsset extends AssetBundle
{
    public $sourcePath = __DIR__ . '/dist';

    public $depends = [
        CpAsset::class,
    ];

    public $js = [
        'picker.js',
    ];

    public $css = [
        'picker.css',
    ];

    public function init(): void
    {
        parent::init();

        // Craft 6 dropped the legacy CP control styles (.btn, .select, .text…)
        // and the Craft 5 CSS variables picker.css leans on; restyle on top
        if (self::isCraft6()) {
            $this->css[] = 'picker-craft6.css';
        }
    }

    public static function isCraft6(): bool
    {
        return class_exists('CraftCms\\Cms\\Cms');
    }
}
