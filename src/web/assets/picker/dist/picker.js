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
                this.scrollToSelected();
                this.searchInput.focus();
                return;
            }

            this.buildModal();

            loadIndex(this.config.indexUrl).then((icons) => {
                this.entries = this.buildEntries(icons);
                this.populateCategories(icons);
                if (this.randomGlyphEl) {
                    const shuffle = icons.find((icon) => icon.n === 'arrows-shuffle');
                    if (shuffle) {
                        this.randomGlyphEl.textContent = String.fromCodePoint(parseInt(shuffle.o, 16));
                    }
                }
                this.search('');
                this.scrollToSelected();
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
            if (!this.catSelect || this.allCategories) {
                return;
            }
            this.allCategories = [...new Set(icons.map((icon) => icon.c).filter(Boolean))].sort();
            this.filledCategories = [...new Set(icons.filter((icon) => icon.f).map((icon) => icon.c).filter(Boolean))].sort();
            this.refreshCategoryOptions();
        }

        // The Filled set only spans some categories; when the filled variant is
        // active (via the field setting or the Filled tab), hide the rest
        refreshCategoryOptions() {
            if (!this.catSelect || !this.allCategories) {
                return;
            }

            const filledOnly = this.config.style === 'filled' || this.variantFilter === 'filled';
            const cats = filledOnly ? this.filledCategories : this.allCategories;
            const current = this.catSelect.value;

            while (this.catSelect.options.length > 1) {
                this.catSelect.remove(1);
            }
            for (const cat of cats) {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                this.catSelect.appendChild(option);
            }

            // Keep the current category if it still exists; otherwise reset
            if (current && cats.includes(current)) {
                this.catSelect.value = current;
            } else {
                this.catSelect.value = '';
                this.categoryFilter = '';
            }
        }

        buildModal() {
            const $modal = $('<div class="modal tabler-icon-modal"/>').appendTo(Garnish.$bod);
            const $wrap = $('<div class="tabler-icon-modal__wrap"/>').appendTo($modal);

            // Header order: search, outline/filled tabs, categories, random
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

                this.$filters = $filters;
                $filters.on('click', 'button', (event) => {
                    $filters.find('button').removeClass('active');
                    $(event.currentTarget).addClass('active');
                    this.variantFilter = event.currentTarget.dataset.filter;
                    this.refreshCategoryOptions();
                    this.search(this.searchInput.value);
                });
            }

            if (this.config.categories !== false) {
                const $cats = $(
                    '<div class="select tabler-icon-modal__cats">' +
                        '<select aria-label="' + Craft.t('tabler', 'Category') + '">' +
                            '<option value="">' + Craft.t('tabler', 'All categories') + '</option>' +
                        '</select>' +
                    '</div>'
                ).appendTo(header);

                this.catSelect = $cats.find('select')[0];
                this.catSelect.addEventListener('change', () => {
                    this.categoryFilter = this.catSelect.value;
                    this.search(this.searchInput.value);
                });
            }

            if (this.config.random) {
                const $random = $(
                    '<button type="button" class="btn tabler-icon-modal__random" aria-label="' + Craft.t('tabler', 'Random icon') + '" title="' + Craft.t('tabler', 'Random icon') + '">' +
                        '<span class="tabler-glyph" aria-hidden="true"></span>' +
                    '</button>'
                ).appendTo(header);
                this.randomGlyphEl = $random.find('.tabler-glyph')[0];
                // event.detail is 0 for keyboard activation, >0 for real clicks:
                // mouse rolls focus the icon (Enter/Space commits immediately);
                // keyboard rolls keep focus here so Enter keeps re-rolling
                $random[0].addEventListener('click', (event) => this.rollRandomCell(event.detail === 0));

                // Down enters the grid at the rolled icon (or the anchor),
                // consistent with Down in the search field
                $random[0].addEventListener('keydown', (event) => {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        this.focusAnchorCell();
                    }
                });
            }

            const $body = $('<div class="tabler-icon-modal__body"><div class="tabler-icon-modal__grid" role="listbox"></div></div>').appendTo($wrap);
            const $footer = $('<div class="tabler-icon-modal__footer"><span class="light" data-count></span></div>').appendTo($wrap);

            this.searchInput = header.find('input')[0];
            this.gridEl = $body.find('.tabler-icon-modal__grid')[0];
            this.bodyEl = $body[0];
            this.countEl = $footer.find('[data-count]')[0];

            let debounce = null;
            let debouncePending = false;
            this.searchInput.addEventListener('input', () => {
                clearTimeout(debounce);
                debouncePending = true;
                debounce = setTimeout(() => {
                    debouncePending = false;
                    this.search(this.searchInput.value);
                }, 120);
            });

            // Down from the search field jumps into the grid — at the current
            // anchor (the selected icon on open, or the last position), or the
            // first fresh result when a search is pending
            this.searchInput.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    if (debouncePending) {
                        clearTimeout(debounce);
                        debouncePending = false;
                        this.search(this.searchInput.value);
                    }
                    this.focusAnchorCell();
                }
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

        // Bring the current selection into view (rendering out to it if it’s
        // beyond the rendered chunks) and make it the grid’s Tab entry point.
        // All of it is deferred: rendering thousands of cells before first
        // paint makes opening laggy, and Garnish’s fade means scrollIntoView
        // has no layout to work with yet anyway.
        scrollToSelected() {
            if (!this.nameInput.value) {
                return;
            }

            setTimeout(() => {
                const name = this.nameInput.value;
                if (!name || !this.results || !this.results.length) {
                    return;
                }

                const variant = this.variantInput.value || 'outline';

                // A filled selection isn’t in the default Outline tab — switch
                // the picker to the selection’s variant first
                if (this.$filters && this.variantFilter !== variant) {
                    this.variantFilter = variant;
                    this.$filters.find('button').removeClass('active');
                    this.$filters.find('[data-filter="' + variant + '"]').addClass('active');
                    this.refreshCategoryOptions();
                    this.search(this.searchInput.value);
                }

                const index = this.results.findIndex((entry) => entry.name === name && entry.variant === variant);
                if (index === -1) {
                    return;
                }

                while (index >= this.rendered && this.rendered < this.results.length) {
                    this.renderMore();
                }

                const cell = this.gridEl.children[index];
                if (!cell) {
                    return;
                }

                const previousAnchor = this.gridEl.querySelector('[tabindex="0"]');
                if (previousAnchor) {
                    previousAnchor.tabIndex = -1;
                }
                cell.tabIndex = 0;
                cell.scrollIntoView({block: 'center'});
            }, 150);
        }

        // Keep the selected highlight in sync on the already-rendered grid
        // (cells only pick it up at render time otherwise)
        markSelectedCell(name, variant) {
            if (!this.gridEl) {
                return;
            }
            const previous = this.gridEl.querySelector('.tabler-icon-cell--selected');
            if (previous) {
                previous.classList.remove('tabler-icon-cell--selected');
            }
            if (name) {
                const cell = this.gridEl.querySelector(`[data-name="${name}"][data-variant="${variant}"]`);
                if (cell) {
                    cell.classList.add('tabler-icon-cell--selected');
                }
            }
        }

        // Move the roving-tabindex focus to the result at the given index,
        // rendering more chunks if it isn’t in the DOM yet
        focusCellAt(index) {
            while (index >= this.rendered && this.rendered < this.results.length) {
                this.renderMore();
            }
            const target = this.gridEl.children[index];
            if (!target) {
                return;
            }
            const previous = this.gridEl.querySelector('[tabindex="0"]');
            if (previous) {
                previous.tabIndex = -1;
            }
            target.tabIndex = 0;
            target.focus();
            target.scrollIntoView({block: 'nearest'});
        }

        // Focus the grid’s current entry point: the selected icon on open,
        // a rolled icon after Random, or wherever navigation last was
        focusAnchorCell() {
            const anchor = this.gridEl.querySelector('[tabindex="0"]') || this.gridEl.children[0];
            if (anchor) {
                anchor.focus();
                anchor.scrollIntoView({block: 'nearest'});
            }
        }

        // Highlight a random icon from the current results. Mouse rolls focus
        // it (Enter/Space commits, clicking the button re-rolls); keyboard
        // rolls leave focus on the Random button so Enter re-rolls, and the
        // rolled cell becomes the grid’s Tab/Down entry point.
        rollRandomCell(keepFocusOnButton) {
            if (!this.results || !this.results.length) {
                return;
            }

            const index = Math.floor(Math.random() * this.results.length);
            while (index >= this.rendered && this.rendered < this.results.length) {
                this.renderMore();
            }

            const target = this.gridEl.children[index];
            if (!target) {
                return;
            }

            const previousRoll = this.gridEl.querySelector('.tabler-icon-cell--rolled');
            if (previousRoll) {
                previousRoll.classList.remove('tabler-icon-cell--rolled');
            }
            const previousAnchor = this.gridEl.querySelector('[tabindex="0"]');
            if (previousAnchor) {
                previousAnchor.tabIndex = -1;
            }

            target.classList.add('tabler-icon-cell--rolled');
            target.tabIndex = 0;
            target.scrollIntoView({block: 'nearest'});

            if (!keepFocusOnButton) {
                target.focus();
            }
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

            event.preventDefault();
            this.focusCellAt(index);
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

            this.markSelectedCell(name, variant);

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

            this.markSelectedCell(null, null);

            this.previewEl.innerHTML = '';
            this.previewEl.setAttribute('title', Craft.t('tabler', 'Choose icon'));
            this.previewEl.setAttribute('aria-label', Craft.t('tabler', 'Choose icon'));
            this.chooseBtn.classList.remove('hidden');
            this.removeBtn.classList.add('hidden');
        }
    }

    window.TablerIconPicker = TablerIconPicker;
})();
