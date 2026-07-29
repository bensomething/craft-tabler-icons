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

    // "ad-off" -> "Ad Off"
    function label(name, variant) {
        const words = name.replace(/-/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());
        return words + (variant === 'filled' ? ' (Filled)' : '');
    }

    const CHUNK_SIZE = 210;

    // Recently used icons, shared by every field and scoped to the install by
    // Craft's storage helpers
    const RECENTS_KEY = 'tabler.recents';
    const RECENTS_LIMIT = 10;

    function loadRecents() {
        let stored;
        try {
            stored = Craft.getLocalStorage(RECENTS_KEY, []);
        } catch (e) {
            return [];
        }
        return Array.isArray(stored) ? stored : [];
    }

    function rememberRecent(name, variant) {
        const recents = loadRecents().filter((recent) => recent.name !== name || recent.variant !== variant);
        recents.unshift({name: name, variant: variant});
        Craft.setLocalStorage(RECENTS_KEY, recents.slice(0, RECENTS_LIMIT));
    }

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
            // redundant click target; the button stays the keyboard path
            this.previewEl.addEventListener('click', () => this.open());
        }

        open() {
            if (this.modal) {
                this.modal.show();
                this.renderRecents(); // another field may have added to the list
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
                this.renderRecents();
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

        // Filled icons only span some categories; hide the rest when filled
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

            // The search row never wraps internally, so its contents stay
            // beside the search at any width; the controls group wraps below as
            // a unit. Tabs live with the search when there's a dropdown (which
            // stretches), else in the group (where the tabs stretch instead).
            const header = $(
                '<div class="tabler-icon-modal__header">' +
                    '<div class="tabler-icon-modal__searchrow">' +
                        '<div class="texticon search icon clearable">' +
                            '<input class="text fullwidth" type="text" autocomplete="off" placeholder="' + Craft.t('tabler', 'Search icons') + '">' +
                        '</div>' +
                    '</div>' +
                '</div>'
            ).appendTo($wrap);

            const $searchRow = header.find('.tabler-icon-modal__searchrow');
            let $controls = null;
            const controls = () => ($controls ??= $('<div class="tabler-icon-modal__controls"/>').appendTo(header));
            const hasCategories = this.config.categories !== false;

            if (this.config.style === 'all') {
                this.variantFilter = 'outline';

                const $filters = $(
                    '<div class="btngroup btngroup--exclusive tabler-icon-modal__filters">' +
                        '<button type="button" class="btn active" data-filter="outline">' + Craft.t('tabler', 'Outline') + '</button>' +
                        '<button type="button" class="btn" data-filter="filled">' + Craft.t('tabler', 'Filled') + '</button>' +
                    '</div>'
                ).appendTo(hasCategories ? $searchRow : controls());

                this.$filters = $filters;
                $filters.on('click', 'button', (event) => {
                    $filters.find('button').removeClass('active');
                    $(event.currentTarget).addClass('active');
                    this.variantFilter = event.currentTarget.dataset.filter;
                    this.refreshCategoryOptions();
                    this.search(this.searchInput.value);
                });
            }

            if (hasCategories) {
                const $cats = $(
                    '<div class="select tabler-icon-modal__cats">' +
                        '<select aria-label="' + Craft.t('tabler', 'Category') + '">' +
                            '<option value="">' + Craft.t('tabler', 'All categories') + '</option>' +
                        '</select>' +
                    '</div>'
                ).appendTo(controls());

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
                ).appendTo($controls || (this.config.style === 'all' ? controls() : $searchRow));
                this.randomGlyphEl = $random.find('.tabler-glyph')[0];
                // event.detail 0 = keyboard: keep focus on the button so Enter
                // re-rolls. Mouse: focus the icon so Enter/Space commits it.
                $random[0].addEventListener('click', (event) => this.rollRandomCell(event.detail === 0));

                $random[0].addEventListener('keydown', (event) => {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        this.focusAnchorCell();
                    }
                });
            }

            const $body = $('<div class="tabler-icon-modal__body"/>').appendTo($wrap);

            // Recently used icons live in their own grid above the results: the
            // results grid indexes its cells against `this.results` positionally,
            // so extra cells can't share it
            if (this.config.recents !== false) {
                const $recents = $(
                    '<div class="tabler-icon-modal__recents hidden">' +
                        '<div class="tabler-icon-modal__recents-title">' + Craft.t('tabler', 'Recent') + '</div>' +
                        '<div class="tabler-icon-modal__grid" role="listbox" aria-label="' + Craft.t('tabler', 'Recently used icons') + '"></div>' +
                    '</div>'
                ).appendTo($body);

                this.recentsEl = $recents[0];
                this.recentsGridEl = $recents.find('.tabler-icon-modal__grid')[0];

                this.recentsGridEl.addEventListener('click', (event) => {
                    const cell = event.target.closest('.tabler-icon-cell');
                    if (cell) {
                        this.select(cell.dataset.name, cell.dataset.variant, cell.dataset.code);
                    }
                });

                this.recentsGridEl.addEventListener('keydown', (event) => this.handleRecentsKeydown(event));
            }

            const $grid = $('<div class="tabler-icon-modal__grid" role="listbox"></div>').appendTo($body);
            const $footer = $('<div class="tabler-icon-modal__footer"><span class="light" data-count></span></div>').appendTo($wrap);

            this.searchInput = header.find('input')[0];
            this.gridEl = $grid[0];
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

            // Down jumps into the grid; flush a pending search first so focus
            // lands on the fresh results rather than a stale anchor
            this.searchInput.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    if (debouncePending) {
                        clearTimeout(debounce);
                        debouncePending = false;
                        this.search(this.searchInput.value);
                    }
                    if (this.recentsVisible()) {
                        this.focusRecentCellAt(this.recentsAnchorIndex());
                    } else {
                        this.focusAnchorCell();
                    }
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

            this.modal = new Garnish.Modal($modal, {
                // Garnish resizes/repositions the modal after fading in, which
                // reflows the grid — re-center the selection once it settles
                onFadeIn: () => {
                    if (this.scrollTarget && this.scrollTarget.isConnected) {
                        this.scrollTarget.scrollIntoView({block: 'center'});
                    }
                },
            });
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

            this.updateRecentsVisibility();
        }

        // Recently used icons, resolved against the field's own entries so a
        // style-restricted field never offers one it can't store
        renderRecents() {
            if (!this.recentsGridEl || !this.entries) {
                return;
            }

            const byKey = new Map(this.entries.map((entry) => [entry.name + '|' + entry.variant, entry]));
            const entries = loadRecents()
                .map((recent) => byKey.get(recent.name + '|' + recent.variant))
                .filter(Boolean);

            this.recentsGridEl.innerHTML = '';
            for (const entry of entries) {
                this.recentsGridEl.appendChild(this.buildCell(entry));
            }
            if (entries.length) {
                this.recentsGridEl.children[0].tabIndex = 0;
            }

            this.updateRecentsVisibility();
        }

        // Suggestions only make sense against an unfiltered grid; once the
        // author narrows the results, they'd just be noise
        updateRecentsVisibility() {
            if (!this.recentsGridEl) {
                return;
            }
            const show = this.recentsGridEl.children.length &&
                !this.searchInput.value.trim() &&
                !this.categoryFilter;
            this.recentsEl.classList.toggle('hidden', !show);
        }

        recentsVisible() {
            return !!this.recentsEl && !this.recentsEl.classList.contains('hidden');
        }

        recentsAnchorIndex() {
            const anchor = this.recentsGridEl.querySelector('[tabindex="0"]');
            return anchor ? [].indexOf.call(this.recentsGridEl.children, anchor) : 0;
        }

        focusRecentCellAt(index) {
            const target = this.recentsGridEl.children[index];
            if (!target) {
                return;
            }
            const previous = this.recentsGridEl.querySelector('[tabindex="0"]');
            if (previous) {
                previous.tabIndex = -1;
            }
            target.tabIndex = 0;
            target.focus();
        }

        // Same roving tabindex as the results grid, but arrowing off either end
        // hands focus back to the search field or on to the results
        handleRecentsKeydown(event) {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                return;
            }

            const cells = this.recentsGridEl.children;
            if (!cells.length) {
                return;
            }

            const active = document.activeElement.closest('.tabler-icon-cell');
            let index = Math.max(0, [].indexOf.call(cells, active));
            const columns = getComputedStyle(this.recentsGridEl).gridTemplateColumns.split(' ').length;

            switch (event.key) {
                case 'ArrowRight': index += 1; break;
                case 'ArrowLeft': index -= 1; break;
                case 'ArrowDown': index += columns; break;
                case 'ArrowUp': index -= columns; break;
                case 'Home': index = 0; break;
                case 'End': index = cells.length - 1; break;
            }

            event.preventDefault();

            if (index < 0) {
                this.searchInput.focus();
            } else if (index >= cells.length) {
                this.focusAnchorCell();
            } else {
                this.focusRecentCellAt(index);
            }
        }

        // Scroll the selection into view and make it the Tab entry point.
        // Deferred: rendering out to a deep selection before first paint is
        // laggy, and Garnish's fade leaves scrollIntoView no layout yet anyway.
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

                // switch to the selection's tab so a filled pick is in results
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
                this.scrollTarget = cell;
                cell.scrollIntoView({block: 'center'});
            }, 150);
        }

        // Sync the highlight on already-rendered cells (they only get it at
        // render time otherwise)
        markSelectedCell(name, variant) {
            if (!this.bodyEl) {
                return;
            }
            for (const previous of this.bodyEl.querySelectorAll('.tabler-icon-cell--selected')) {
                previous.classList.remove('tabler-icon-cell--selected');
            }
            if (name) {
                for (const cell of this.bodyEl.querySelectorAll(`[data-name="${name}"][data-variant="${variant}"]`)) {
                    cell.classList.add('tabler-icon-cell--selected');
                }
            }
        }

        // Move roving-tabindex focus to the result at `index`, rendering chunks
        // out to it if needed
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

        // Focus the grid's current entry point (selection, last roll, or last
        // navigated cell)
        focusAnchorCell() {
            const anchor = this.gridEl.querySelector('[tabindex="0"]') || this.gridEl.children[0];
            if (anchor) {
                anchor.focus();
                anchor.scrollIntoView({block: 'nearest'});
            }
        }

        // Highlight a random result. keepFocusOnButton (keyboard) leaves focus
        // on the button so Enter re-rolls; otherwise focus the rolled cell.
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

            event.preventDefault();

            // Up and out of the top row lands in the recents, when it's showing
            if (index < 0 && this.recentsVisible()) {
                this.focusRecentCellAt(this.recentsAnchorIndex());
                return;
            }

            index = Math.max(0, Math.min(index, this.results.length - 1));

            this.focusCellAt(index);
        }

        buildCell(entry) {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'tabler-icon-cell';
            if (entry.name === this.nameInput.value && entry.variant === this.variantInput.value) {
                cell.classList.add('tabler-icon-cell--selected');
            }
            cell.title = label(entry.name, entry.variant);
            cell.tabIndex = -1;
            cell.dataset.name = entry.name;
            cell.dataset.variant = entry.variant;
            cell.dataset.code = entry.code;
            cell.appendChild(glyph(entry.code, entry.variant));
            return cell;
        }

        renderMore() {
            if (!this.results || this.rendered >= this.results.length) {
                return;
            }

            const fragment = document.createDocumentFragment();
            const end = Math.min(this.rendered + CHUNK_SIZE, this.results.length);

            for (let i = this.rendered; i < end; i++) {
                fragment.appendChild(this.buildCell(this.results[i]));
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

            rememberRecent(name, variant);
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
