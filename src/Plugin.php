<?php

namespace bensomething\tabler;

use bensomething\tabler\fields\TablerIconField;
use bensomething\tabler\iconsets\TablerIconSet;
use bensomething\tabler\models\Icon;
use bensomething\tabler\web\twig\Extension;
use Craft;
use craft\events\RegisterComponentTypesEvent;
use craft\events\RegisterIconSetsEvent;
use craft\services\Fields;
use craft\services\Icons;
use yii\base\Event;

class Plugin extends \craft\base\Plugin
{
    public string $schemaVersion = '1.0.0';

    public function init(): void
    {
        parent::init();

        Event::on(
            Fields::class,
            Fields::EVENT_REGISTER_FIELD_TYPES,
            function(RegisterComponentTypesEvent $event) {
                $event->types[] = TablerIconField::class;
            }
        );

        // Custom icon sets arrived in Craft 5.12
        if (class_exists(Icons::class)) {
            Event::on(
                Icons::class,
                Icons::EVENT_REGISTER_ICON_SETS,
                function(RegisterIconSetsEvent $event) {
                    $event->iconSets[] = new TablerIconSet([
                        'handle' => TablerIconSet::HANDLE_OUTLINE,
                        'name' => Craft::t('tabler', 'Tabler'),
                    ]);
                    $event->iconSets[] = new TablerIconSet([
                        'handle' => TablerIconSet::HANDLE_FILLED,
                        'name' => Craft::t('tabler', 'Tabler (Filled)'),
                        'variant' => Icon::VARIANT_FILLED,
                    ]);
                }
            );
        }

        Craft::$app->getView()->registerTwigExtension(new Extension());
    }
}
