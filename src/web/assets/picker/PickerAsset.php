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
}
