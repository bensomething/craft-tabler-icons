<?php

namespace bensomething\tabler\fields;

use bensomething\tabler\models\Icon;
use bensomething\tabler\web\assets\picker\PickerAsset;
use Craft;
use craft\base\ElementInterface;
use craft\base\Field;
use craft\base\PreviewableFieldInterface;
use craft\helpers\Cp;
use craft\helpers\Html;
use craft\helpers\Json;
use yii\db\Schema;

class TablerIconField extends Field implements PreviewableFieldInterface
{
    public const STYLE_ALL = 'all';
    public const STYLE_OUTLINE = 'outline';
    public const STYLE_FILLED = 'filled';

    /**
     * @var string Which icon styles can be selected
     */
    public string $iconStyle = self::STYLE_ALL;

    public function __construct(array $config = [])
    {
        // Remove settings that no longer exist
        unset($config['buttonStyle']);
        parent::__construct($config);
    }

    public static function displayName(): string
    {
        return Craft::t('tabler', 'Tabler Icon');
    }

    public static function icon(): string
    {
        return 'icons';
    }

    public static function phpType(): string
    {
        return sprintf('\\%s|null', Icon::class);
    }

    public static function dbType(): array|string|null
    {
        return Schema::TYPE_JSON;
    }

    protected function defineRules(): array
    {
        $rules = parent::defineRules();
        $rules[] = [['iconStyle'], 'in', 'range' => [self::STYLE_ALL, self::STYLE_OUTLINE, self::STYLE_FILLED]];
        return $rules;
    }

    public function normalizeValue(mixed $value, ?ElementInterface $element = null): mixed
    {
        if ($value instanceof Icon) {
            return $value;
        }

        if (is_string($value) && $value !== '') {
            $decoded = Json::decodeIfJson($value);
            // Plain icon name string
            if (is_string($decoded)) {
                return new Icon($decoded);
            }
            $value = $decoded;
        }

        if (is_array($value) && !empty($value['name'])) {
            return new Icon(
                (string)$value['name'],
                (string)($value['variant'] ?? Icon::VARIANT_OUTLINE),
            );
        }

        return null;
    }

    public function serializeValue(mixed $value, ?ElementInterface $element = null): mixed
    {
        if ($value instanceof Icon) {
            return $value->jsonSerialize();
        }

        return null;
    }

    public function getElementValidationRules(): array
    {
        return ['validateIconValue'];
    }

    public function validateIconValue(ElementInterface $element): void
    {
        /** @var Icon|null $value */
        $value = $element->getFieldValue($this->handle);

        if ($value && $value->rawSvg() === null) {
            $element->addError(
                "field:$this->handle",
                Craft::t('tabler', 'Unknown icon “{name}”.', ['name' => $value->name])
            );
        }
    }

    public function getSearchKeywords(mixed $value, ElementInterface $element): string
    {
        return $value instanceof Icon ? $value->name : '';
    }

    protected function inputHtml(mixed $value, ?ElementInterface $element, bool $inline): string
    {
        /** @var Icon|null $value */
        $view = Craft::$app->getView();
        $bundle = $view->registerAssetBundle(PickerAsset::class);

        $id = Html::id($this->handle);
        $namespacedId = $view->namespaceInputId($id);

        $config = [
            'indexUrl' => $bundle->baseUrl . '/icons.json',
            'style' => $this->iconStyle,
        ];

        $view->registerJs(
            'new TablerIconPicker(' . Json::encode("#$namespacedId") . ', ' . Json::encode($config) . ');'
        );

        return $view->renderTemplate('tabler/_input.twig', [
            'id' => $id,
            'name' => $this->handle,
            'value' => $value,
        ]);
    }

    public function getPreviewHtml(mixed $value, ElementInterface $element): string
    {
        if (!$value instanceof Icon) {
            return '';
        }

        $svg = (string)$value->svg(['size' => 18]);

        if ($svg === '') {
            return Html::encode($value->name);
        }

        return Html::tag('span', $svg, [
            'title' => $value->getLabel(),
            'style' => ['display' => 'inline-flex', 'vertical-align' => 'middle'],
        ]);
    }

    public function getSettingsHtml(): ?string
    {
        return Cp::selectFieldHtml([
            'label' => Craft::t('tabler', 'Icon Style'),
            'instructions' => Craft::t('tabler', 'Which icon styles authors can choose from.'),
            'id' => 'iconStyle',
            'name' => 'iconStyle',
            'value' => $this->iconStyle,
            'options' => [
                ['label' => Craft::t('tabler', 'Outline and filled'), 'value' => self::STYLE_ALL],
                ['label' => Craft::t('tabler', 'Outline only'), 'value' => self::STYLE_OUTLINE],
                ['label' => Craft::t('tabler', 'Filled only'), 'value' => self::STYLE_FILLED],
            ],
        ]);
    }
}
