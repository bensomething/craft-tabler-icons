<?php

namespace bensomething\tabler\fields;

use bensomething\tabler\models\Icon;
use bensomething\tabler\web\assets\picker\PickerAsset;
use Craft;
use craft\base\ElementInterface;
use craft\base\Field;
use craft\base\InlineEditableFieldInterface;
use craft\base\ThumbableFieldInterface;
use craft\gql\GqlEntityRegistry;
use craft\helpers\Cp;
use craft\helpers\Html;
use craft\helpers\Json;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use yii\db\Schema;

class TablerIconField extends Field implements InlineEditableFieldInterface, ThumbableFieldInterface
{
    public const STYLE_ALL = 'all';
    public const STYLE_OUTLINE = 'outline';
    public const STYLE_FILLED = 'filled';

    /**
     * @var string Which icon styles can be selected
     */
    public string $iconStyle = self::STYLE_ALL;

    /**
     * @var bool Show the category dropdown in the picker
     */
    public bool $showCategories = true;

    /**
     * @var bool Show a Random button in the picker that highlights a random
     * icon from the current results
     */
    public bool $showRandomButton = false;

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
        $rules[] = [['showCategories', 'showRandomButton'], 'boolean'];
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
            'categories' => $this->showCategories,
            'random' => $this->showRandomButton,
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

    /**
     * Lets the field be an entry type’s Thumbnail Source. Returns the raw SVG
     * (not wrapped in .cp-icon, whose CSS force-fills shapes and would render
     * outline icons as solid squares).
     *
     * Craft requests thumbs at 30 (element chips/index rows) or 120 (cards),
     * but chip thumb slots are ~22px and get squeezed by surrounding layout,
     * and a 120px icon dominates cards (the native Icon field renders small
     * there too). Inline width/height/flex win over the CP’s `.thumb svg`
     * rules and flex shrinking, so the icon is always a fixed square.
     */
    public function getThumbHtml(mixed $value, ElementInterface $element, int $size): ?string
    {
        if (!$value instanceof Icon) {
            return null;
        }

        $dim = $size <= 30 ? 22 : 24;
        $svg = (string)$value->svg([
            'size' => $dim,
            'style' => "width:{$dim}px;height:{$dim}px;flex:none",
            'defaults' => false,
        ]);

        return $svg !== '' ? self::hardenSvgShapes($svg) : null;
    }

    /**
     * Adds per-shape inline styles so CP hover/selection rules (e.g. the
     * autocomplete menus’ `svg path { fill: var(--white); stroke-width: 0 }`,
     * built for Craft’s solid icons) can’t fill Tabler’s invisible bounding
     * path or erase its strokes. Each shape keeps its own fill, or inherits
     * the root’s; stroke-width inherits the root’s so it survives being
     * zeroed. The plugin stylesheet can’t help here — thumbs render on pages
     * where it isn’t loaded.
     */
    private static function hardenSvgShapes(string $svg): string
    {
        return preg_replace_callback(
            '/<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*?)\/?>/',
            function(array $match): string {
                $fill = preg_match('/\bfill="([^"]*)"/', $match[2], $f) ? $f[1] : 'inherit';
                $style = sprintf('fill:%s;stroke-width:inherit', $fill);
                return sprintf('<%s%s style="%s" />', $match[1], rtrim($match[2]), $style);
            },
            $svg,
        );
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

    public function getContentGqlType(): Type|array
    {
        $typeName = 'tabler_Icon';

        return GqlEntityRegistry::getOrCreate($typeName, fn() => new ObjectType([
            'name' => $typeName,
            'fields' => [
                'name' => [
                    'type' => Type::string(),
                    'description' => 'The icon name, e.g. `heart`.',
                ],
                'variant' => [
                    'type' => Type::string(),
                    'description' => '`outline` or `filled`.',
                ],
                'label' => [
                    'type' => Type::string(),
                    'description' => 'A human-friendly label, e.g. `Ad Off`.',
                    'resolve' => fn(Icon $icon) => $icon->getLabel(),
                ],
                'classes' => [
                    'type' => Type::string(),
                    'description' => 'Tabler webfont class names, e.g. `ti ti-heart-filled`.',
                    'resolve' => fn(Icon $icon) => $icon->classes(),
                ],
                'svg' => [
                    'type' => Type::string(),
                    'description' => 'The inline SVG markup. `svgDefaults` apply.',
                    'args' => [
                        'size' => [
                            'type' => Type::int(),
                            'description' => 'Sets the width and height attributes.',
                        ],
                    ],
                    'resolve' => function(Icon $icon, array $args) {
                        $svg = (string)$icon->svg(isset($args['size']) ? ['size' => $args['size']] : []);
                        return $svg !== '' ? $svg : null;
                    },
                ],
            ],
        ]));
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
        ]) . Cp::lightswitchFieldHtml([
            'label' => Craft::t('tabler', 'Show Categories Dropdown'),
            'instructions' => Craft::t('tabler', 'Show the category filter in the picker.'),
            'id' => 'showCategories',
            'name' => 'showCategories',
            'on' => $this->showCategories,
        ]) . Cp::lightswitchFieldHtml([
            'label' => Craft::t('tabler', 'Show Random Button'),
            'instructions' => Craft::t('tabler', 'Adds a button to the picker that highlights a random icon from the current results.'),
            'id' => 'showRandomButton',
            'name' => 'showRandomButton',
            'on' => $this->showRandomButton,
        ]);
    }
}
