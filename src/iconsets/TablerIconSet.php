<?php

namespace bensomething\tabler\iconsets;

use bensomething\tabler\models\Icon;
use craft\helpers\Json;
use craft\icons\IconSet;

/**
 * Exposes the bundled Tabler icons to Craft's native icon pickers (Craft 5.12+).
 *
 * Registered twice, once per variant, because outline and filled icons share
 * names: values are stored as `tabler:heart` / `tabler-filled:heart`.
 */
class TablerIconSet extends IconSet
{
    public const HANDLE_OUTLINE = 'tabler';
    public const HANDLE_FILLED = 'tabler-filled';

    /**
     * @var string Which variant this set serves
     */
    public string $variant = Icon::VARIANT_OUTLINE;

    /**
     * @var array<string,array<string,string>>|null Search keywords per icon name, per variant
     */
    private static ?array $index = null;

    public function getIcons(): array
    {
        return array_map('strval', array_keys(self::index()[$this->variant]));
    }

    public function getKeywords(string $icon): array
    {
        $terms = self::index()[$this->variant][$icon] ?? '';
        return array_values(array_filter(explode(' ', $terms), fn(string $term) => $term !== ''));
    }

    public function getSvg(string $icon): ?string
    {
        if (!isset(self::index()[$this->variant][$icon])) {
            return null;
        }

        // svgDefaults are for the front end, not the CP
        $svg = (string)(new Icon($icon, $this->variant))->svg(['defaults' => false]);

        return $svg !== '' ? Icon::hardenSvgShapes($svg) : null;
    }

    /**
     * Reuses the picker's search index, so keywords match the plugin's own
     * picker. Decoded once per request and shared by both sets.
     *
     * @return array{outline: array<string,string>, filled: array<string,string>}
     */
    private static function index(): array
    {
        if (self::$index === null) {
            self::$index = [Icon::VARIANT_OUTLINE => [], Icon::VARIANT_FILLED => []];
            $path = dirname(__DIR__) . '/web/assets/picker/dist/icons.json';
            $entries = is_file($path) ? Json::decode(file_get_contents($path)) : [];

            foreach ($entries as $entry) {
                // `t` already includes the lowercased category
                $terms = (string)($entry['t'] ?? '');
                if (isset($entry['o'])) {
                    self::$index[Icon::VARIANT_OUTLINE][$entry['n']] = $terms;
                }
                if (isset($entry['f'])) {
                    self::$index[Icon::VARIANT_FILLED][$entry['n']] = $terms;
                }
            }
        }

        return self::$index;
    }
}
