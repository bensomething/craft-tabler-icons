/* global Craft, Garnish, $ */
(function() {
    'use strict';

    // Shared icon index, fetched once per page no matter how many fields exist
    let indexPromise = null;

    function loadIndex(url) {
        if (!indexPromise) {
            indexPromise = fetch(url).then(function(response) {
                if (!response.ok) {
                    throw new Error('Failed to load the Tabler icon index.');
                }
                return response.json();
            });
        }
        return indexPromise;
    }

    function glyph(codepoint, variant) {
        const span = document.createElement('span');
        span.className = 'tabler-glyph' + (variant === 'filled' ? ' tabler-glyph--filled' : '');
        span.textContent = String.fromCodePoint(parseInt(codepoint, 16));
        return span;
    }

    // "ad-off" -> "Ad Off", with a variant suffix for filled icons
    function label(name, variant) {
        const words = name.replace(/-/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());
        return words + (variant === 'filled' ? ' (Filled)' : '');
    }

    const CHUNK_SIZE = 210;

    class TablerIconPicker {
        constructor(selector, config) {
            this.container = document.querySelector(selector);
            if (!this.container || this.container.dataset.tablerInitialized) {
                return;
            }
            this.container.dataset.tablerInitialized = '1';

            this.config = config;
            this.nameInput = this.container.querySelector('[data-name]');
            this.variantInput = this.container.querySelector('[data-variant]');
            this.selectionEl = this.container.querySelector('[data-selection]');
            this.previewEl = this.container.querySelector('[data-preview]');
            this.labelEl = this.container.querySelector('[data-label]');
            this.chooseBtn = this.container.querySelector('[data-choose]');
            this.removeBtn = this.container.querySelector('[data-remove]');

            this.modal = null;
            this.entries = null;
            this.results = [];
            this.rendered = 0;
            this.variantFilter = 'all';

            this.chooseBtn.addEventListener('click', () => this.open());
            this.removeBtn.addEventListener('click', () => this.clear());
        }

        open() {
            if (this.modal) {
                this.modal.show();
                this.searchInput.focus();
                return;
            }

            this.buildModal();

            loadIndex(this.config.indexUrl).then((icons) => {
                this.entries = this.buildEntries(icons);
                this.search('');
                this.searchInput.focus();
            }).catch(() => {
                this.gridEl.innerHTML = '<p class="error">' + Craft.t('tabler', 'Couldn’t load the icon index.') + '</p>';
            });
        }

        buildEntries(icons) {
            const style = this.config.style;
            const entries = [];

            for (const icon of icons) {
                const haystack = (icon.n + ' ' + icon.t).toLowerCase();
                if (style !== 'filled') {
                    entries.push({name: icon.n, variant: 'outline', code: icon.o, haystack: haystack});
                }
                if (style !== 'outline' && icon.f) {
                    entries.push({name: icon.n, variant: 'filled', code: icon.f, haystack: haystack});
                }
            }

            return entries;
        }

        buildModal() {
            const $modal = $('<div class="modal tabler-icon-modal"/>').appendTo(Garnish.$bod);
            const $wrap = $('<div class="tabler-icon-modal__wrap"/>').appendTo($modal);

            const header = $(
                '<div class="tabler-icon-modal__header">' +
                    '<div class="texticon search icon clearable fullwidth">' +
                        '<input class="text fullwidth" type="text" autocomplete="off" placeholder="' + Craft.t('tabler', 'Search icons') + '">' +
                    '</div>' +
                '</div>'
            ).appendTo($wrap);

            if (this.config.style === 'all') {
                this.variantFilter = 'outline';

                const $filters = $(
                    '<div class="btngroup btngroup--exclusive tabler-icon-modal__filters">' +
                        '<button type="button" class="btn active" data-filter="outline">' + Craft.t('tabler', 'Outline') + '</button>' +
                        '<button type="button" class="btn" data-filter="filled">' + Craft.t('tabler', 'Filled') + '</button>' +
                    '</div>'
                ).appendTo(header);

                $filters.on('click', 'button', (event) => {
                    $filters.find('button').removeClass('active');
                    $(event.currentTarget).addClass('active');
                    this.variantFilter = event.currentTarget.dataset.filter;
                    this.search(this.searchInput.value);
                });
            }

            const $body = $('<div class="tabler-icon-modal__body"><div class="tabler-icon-modal__grid" role="listbox"></div></div>').appendTo($wrap);
            const $footer = $('<div class="tabler-icon-modal__footer"><span class="light" data-count></span></div>').appendTo($wrap);

            this.searchInput = header.find('input')[0];
            this.gridEl = $body.find('.tabler-icon-modal__grid')[0];
            this.bodyEl = $body[0];
            this.countEl = $footer.find('[data-count]')[0];

            let debounce = null;
            this.searchInput.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => this.search(this.searchInput.value), 120);
            });

            this.bodyEl.addEventListener('scroll', () => {
                if (this.bodyEl.scrollTop + this.bodyEl.clientHeight > this.bodyEl.scrollHeight - 400) {
                    this.renderMore();
                }
            });

            this.gridEl.addEventListener('click', (event) => {
                const cell = event.target.closest('.tabler-icon-cell');
                if (cell) {
                    this.select(cell.dataset.name, cell.dataset.variant, cell.dataset.code);
                }
            });

            this.modal = new Garnish.Modal($modal);
        }

        search(query) {
            if (!this.entries) {
                return;
            }

            const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

            this.results = this.entries.filter((entry) => {
                if (this.variantFilter !== 'all' && entry.variant !== this.variantFilter) {
                    return false;
                }
                return words.every((word) => entry.haystack.includes(word));
            });

            if (words.length) {
                const q = words[0];
                const score = (entry) =>
                    entry.name === q ? 0 : entry.name.startsWith(q) ? 1 : entry.name.includes(q) ? 2 : 3;
                this.results.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
            }

            this.gridEl.innerHTML = '';
            this.rendered = 0;
            this.bodyEl.scrollTop = 0;
            this.renderMore();

            this.countEl.textContent = Craft.t('tabler', '{count} icons', {
                count: this.results.length.toLocaleString(),
            });
        }

        renderMore() {
            if (!this.results || this.rendered >= this.results.length) {
                return;
            }

            const fragment = document.createDocumentFragment();
            const end = Math.min(this.rendered + CHUNK_SIZE, this.results.length);
            const selectedName = this.nameInput.value;
            const selectedVariant = this.variantInput.value;

            for (let i = this.rendered; i < end; i++) {
                const entry = this.results[i];
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'tabler-icon-cell';
                if (entry.name === selectedName && entry.variant === selectedVariant) {
                    cell.classList.add('tabler-icon-cell--selected');
                }
                cell.title = label(entry.name, entry.variant);
                cell.dataset.name = entry.name;
                cell.dataset.variant = entry.variant;
                cell.dataset.code = entry.code;
                cell.appendChild(glyph(entry.code, entry.variant));
                fragment.appendChild(cell);
            }

            this.rendered = end;
            this.gridEl.appendChild(fragment);
        }

        select(name, variant, code) {
            this.nameInput.value = name;
            this.variantInput.value = variant;
            this.nameInput.dispatchEvent(new Event('change', {bubbles: true}));

            this.previewEl.innerHTML = '';
            this.previewEl.appendChild(glyph(code, variant));
            this.labelEl.textContent = label(name, variant);
            this.selectionEl.classList.remove('hidden');
            this.removeBtn.classList.remove('hidden');
            this.chooseBtn.textContent = Craft.t('tabler', 'Change icon');

            this.modal.hide();
        }

        clear() {
            this.nameInput.value = '';
            this.variantInput.value = '';
            this.nameInput.dispatchEvent(new Event('change', {bubbles: true}));

            this.previewEl.innerHTML = '';
            this.labelEl.textContent = '';
            this.selectionEl.classList.add('hidden');
            this.removeBtn.classList.add('hidden');
            this.chooseBtn.textContent = Craft.t('tabler', 'Choose icon');
        }
    }

    window.TablerIconPicker = TablerIconPicker;
})();
