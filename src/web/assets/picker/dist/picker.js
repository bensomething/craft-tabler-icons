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
            this.previewEl = this.container.querySelector('[data-preview]');
            this.chooseBtn = this.container.querySelector('[data-choose]');
            this.removeBtn = this.container.querySelector('[data-remove]');

            this.modal = null;
            this.entries = null;
            this.results = [];
            this.rendered = 0;
            this.variantFilter = 'all';
            this.categoryFilter = '';

            this.chooseBtn.addEventListener('click', () => this.open());
            this.removeBtn.addEventListener('click', () => this.clear());
            // The preview box is a redundant click target; the Choose/Change
            // button remains the keyboard-accessible path.
            this.previewEl.addEventListener('click', () => this.open());
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
                this.populateCategories(icons);
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
                    entries.push({name: icon.n, variant: 'outline', code: icon.o, cat: icon.c, haystack: haystack});
                }
                if (style !== 'outline' && icon.f) {
                    entries.push({name: icon.n, variant: 'filled', code: icon.f, cat: icon.c, haystack: haystack});
                }
            }

            return entries;
        }

        populateCategories(icons) {
            if (this.catSelect.options.length > 1) {
                return;
            }
            const cats = [...new Set(icons.map((icon) => icon.c).filter(Boolean))].sort();
            for (const cat of cats) {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                this.catSelect.appendChild(option);
            }
        }

        buildModal() {
            const $modal = $('<div class="modal tabler-icon-modal"/>').appendTo(Garnish.$bod);
            const $wrap = $('<div class="tabler-icon-modal__wrap"/>').appendTo($modal);

            const header = $(
                '<div class="tabler-icon-modal__header">' +
                    '<div class="texticon search icon clearable fullwidth">' +
                        '<input class="text fullwidth" type="text" autocomplete="off" placeholder="' + Craft.t('tabler', 'Search icons') + '">' +
                    '</div>' +
                    '<div class="select tabler-icon-modal__cats">' +
                        '<select aria-label="' + Craft.t('tabler', 'Category') + '">' +
                            '<option value="">' + Craft.t('tabler', 'All categories') + '</option>' +
                        '</select>' +
                    '</div>' +
                '</div>'
            ).appendTo($wrap);

            this.catSelect = header.find('select')[0];
            this.catSelect.addEventListener('change', () => {
                this.categoryFilter = this.catSelect.value;
                this.search(this.searchInput.value);
            });

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

            this.gridEl.addEventListener('keydown', (event) => this.handleGridKeydown(event));

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
                if (this.categoryFilter && entry.cat !== this.categoryFilter) {
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

        // Roving tabindex: arrows move focus around the grid, Tab moves past it.
        // Cells are real buttons, so Enter/Space select natively.
        handleGridKeydown(event) {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                return;
            }

            const cells = this.gridEl.children;
            if (!cells.length) {
                return;
            }

            const active = document.activeElement.closest('.tabler-icon-cell');
            let index = Math.max(0, [].indexOf.call(cells, active));
            const columns = getComputedStyle(this.gridEl).gridTemplateColumns.split(' ').length;

            switch (event.key) {
                case 'ArrowRight': index += 1; break;
                case 'ArrowLeft': index -= 1; break;
                case 'ArrowDown': index += columns; break;
                case 'ArrowUp': index -= columns; break;
                case 'Home': index = 0; break;
                case 'End': index = this.results.length - 1; break;
            }

            index = Math.max(0, Math.min(index, this.results.length - 1));

            // The grid renders in chunks; make sure the target cell exists
            while (index >= this.rendered && this.rendered < this.results.length) {
                this.renderMore();
            }

            const target = this.gridEl.children[index];
            if (!target) {
                return;
            }

            event.preventDefault();
            const previous = this.gridEl.querySelector('[tabindex="0"]');
            if (previous) {
                previous.tabIndex = -1;
            }
            target.tabIndex = 0;
            target.focus();
            target.scrollIntoView({block: 'nearest'});
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
                cell.tabIndex = -1;
                cell.dataset.name = entry.name;
                cell.dataset.variant = entry.variant;
                cell.dataset.code = entry.code;
                cell.appendChild(glyph(entry.code, entry.variant));
                fragment.appendChild(cell);
            }

            this.rendered = end;
            this.gridEl.appendChild(fragment);

            // Keep one tabbable cell as the grid's Tab entry point
            if (!this.gridEl.querySelector('[tabindex="0"]')) {
                this.gridEl.children[0].tabIndex = 0;
            }
        }

        select(name, variant, code) {
            this.nameInput.value = name;
            this.variantInput.value = variant;
            this.nameInput.dispatchEvent(new Event('change', {bubbles: true}));

            this.previewEl.innerHTML = '';
            this.previewEl.appendChild(glyph(code, variant));
            this.previewEl.setAttribute('title', label(name, variant));
            this.previewEl.setAttribute('aria-label', Craft.t('tabler', 'Change icon: {label}', {label: label(name, variant)}));
            this.chooseBtn.classList.add('hidden');
            this.removeBtn.classList.remove('hidden');

            this.modal.hide();
        }

        clear() {
            this.nameInput.value = '';
            this.variantInput.value = '';
            this.nameInput.dispatchEvent(new Event('change', {bubbles: true}));

            this.previewEl.innerHTML = '';
            this.previewEl.setAttribute('title', Craft.t('tabler', 'Choose icon'));
            this.previewEl.setAttribute('aria-label', Craft.t('tabler', 'Choose icon'));
            this.chooseBtn.classList.remove('hidden');
            this.removeBtn.classList.add('hidden');
        }
    }

    window.TablerIconPicker = TablerIconPicker;
})();
