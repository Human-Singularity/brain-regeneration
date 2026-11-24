/* labs-table.js — "Research Groups" tab of a condition (/conditions/{slug}/research-groups/).
 * The /labs/ directory for one condition, as a table: GregoryAi /labs/?subject_id={page subject}
 * (10 per page) with the directory's other filters — search, research topic, country, sort.
 *
 * URL state uses the feeds' parameter names, not the directory's: q, category, country,
 * sort, page. ?category= is the one the condition tabs share (condition-tabs.html copies it
 * into the other tabs' links), so a topic picked here stays picked on Research Papers,
 * Clinical Trials, Patents and Medicines, and theirs arrives here.
 *
 * Sorting follows labs-directory.js: with subject_id always set, all four orderings work.
 * "Papers" and "Since {year}" count the selected topic's papers when one is picked,
 * otherwise this condition's.
 */
(function () {
	'use strict';

	var mount = document.getElementById('labs-table');
	if (!mount || !window.BR || !BR.labs) return;

	var L = BR.labs, t = L.t, escHtml = BR.escHtml, debounce = BR.debounce;
	var cfg = L.readConfig(mount);
	var subjectId = mount.getAttribute('data-subject-id') || '';
	var condition = mount.getAttribute('data-condition') || 'this condition';
	if (!/^\d+$/.test(subjectId)) return;

	var PAGE_SIZE = 10;
	var DEFAULT_SORT = '-articles';
	var SORTS = { '-articles': 1, '-recent_articles': 1, '-member_count': 1, 'name': 1 };
	var trackContext = condition + ': Research Groups';

	var $ = function (id) { return document.getElementById(id); };
	var searchInput = $('groups-search-input'), categorySel = $('groups-category-select');
	var countrySel = $('groups-country-select'), sortSel = $('groups-sort-select');
	var resultCount = $('groups-result-count'), mobileResultCount = $('groups-mobile-result-count');
	var listEl = $('groups-list'), pagerEl = $('groups-pagination'), pageNums = $('groups-pagination-numbers');
	var firstBtn = $('groups-first-btn'), prevBtn = $('groups-prev-btn');
	var nextBtn = $('groups-next-btn'), lastBtn = $('groups-last-btn');

	// ── Topic options ───────────────────────────────────────────────────────
	// The papers tab's curated groups when the condition has them, else the
	// directory's flat list. Either way [{label|null, categories:[{id,name}]}].
	var groups = [];
	try { groups = JSON.parse(mount.getAttribute('data-category-groups') || '[]') || []; } catch (e) { groups = []; }
	if (!groups.length && cfg.categories.length) groups = [{ label: null, categories: cfg.categories.slice() }];
	var topicNames = {};
	groups.forEach(function (g) {
		(g.categories || []).forEach(function (c) { if (c.id) topicNames[String(c.id)] = c.name; });
	});

	function categoryLabel(id) {
		return topicNames[id] || cfg.categoryNames[id] || ('Topic ' + id);
	}

	// ── State ───────────────────────────────────────────────────────────────
	var state = { q: '', category: '', country: '', sort: DEFAULT_SORT, page: 1 };
	var data = null, reqId = 0;

	function readURL() {
		var p = new URLSearchParams(window.location.search);
		state.q = (p.get('q') || '').trim();
		state.category = /^\d+$/.test(p.get('category') || '') ? p.get('category') : '';
		state.country = /^[A-Za-z]{2}$/.test(p.get('country') || '') ? p.get('country').toUpperCase() : '';
		state.sort = SORTS[p.get('sort')] ? p.get('sort') : DEFAULT_SORT;
		var pg = parseInt(p.get('page'), 10);
		state.page = pg > 0 ? pg : 1;
	}

	function writeURL(replace) {
		var p = new URLSearchParams();
		if (state.q) p.set('q', state.q);
		if (state.category) p.set('category', state.category);
		if (state.country) p.set('country', state.country);
		if (state.sort !== DEFAULT_SORT) p.set('sort', state.sort);
		if (state.page > 1) p.set('page', String(state.page));
		var qs = p.toString();
		var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
		try { history[replace ? 'replaceState' : 'pushState'](null, '', url); } catch (e) { /* ignore */ }
	}

	function apiUrl() {
		var p = new URLSearchParams();
		p.set('subject_id', subjectId);
		if (state.category) p.set('category_id', state.category);
		if (state.q) p.set('search', state.q);
		if (state.country) p.set('country', state.country);
		p.set('ordering', state.sort);
		if (state.page > 1) p.set('page', String(state.page));
		p.set('format', 'json');
		return cfg.apiBase + '/labs/?' + p.toString();
	}

	// ── Filter controls ─────────────────────────────────────────────────────
	function topicOptionsHtml() {
		return '<option value="">All topics</option>' + groups.map(function (g) {
			var opts = (g.categories || []).filter(function (c) { return c.id; }).slice().sort(function (a, b) {
				return String(a.name || '').localeCompare(String(b.name || ''), 'en');
			}).map(function (c) {
				return '<option value="' + escHtml(String(c.id)) + '">' + escHtml(c.name) + '</option>';
			}).join('');
			return g.label ? '<optgroup label="' + escHtml(g.label) + '">' + opts + '</optgroup>' : opts;
		}).join('');
	}

	function countryOptionsHtml() {
		return '<option value="">Any country</option>' + L.countryOptions().map(function (c) {
			return '<option value="' + c.code + '">' + escHtml(c.name) + '</option>';
		}).join('');
	}

	var recentLabel = 'Most active since ' + L.recentSince;

	function fillControls() {
		var topics = topicOptionsHtml(), countries = countryOptionsHtml();
		[categorySel, $('groups-sheet-category')].forEach(function (s) { if (s) s.innerHTML = topics; });
		[countrySel, $('groups-sheet-country')].forEach(function (s) { if (s) s.innerHTML = countries; });
		// "Most active recently" → "Most active since {year}" (the year moves every January)
		document.querySelectorAll('#groups-sort-select option[value="-recent_articles"], #groups-sheet-sort [data-value="-recent_articles"]')
			.forEach(function (el) { el.textContent = recentLabel; });
	}

	// A ?category= from another tab (or an article / trial page) can name a topic this
	// list doesn't offer. The API filter applies regardless; add it so the select shows it.
	function ensureUrlCategory() {
		var id = state.category;
		if (!id || topicNames[id]) return;
		var add = function (name) {
			if (topicNames[id]) return;
			topicNames[id] = name;
			groups.push({ label: groups.length && groups[0].label ? 'Other' : null, categories: [{ id: id, name: name }] });
			fillControls();
			syncControls();
			if (data) render();
		};
		if (cfg.categoryNames[id]) { add(cfg.categoryNames[id]); return; }
		if (!BR.feedUI || !BR.feedUI.categoryInfo) return;
		BR.feedUI.categoryInfo(cfg.apiBase, id).then(function (cat) {
			if (cat && state.category === id) add(cat.name);
		});
	}

	function syncControls() {
		if (searchInput && searchInput.value !== state.q) searchInput.value = state.q;
		if (mobileSearch && mobileSearch.value !== state.q) mobileSearch.value = state.q;
		if (mobileClear) mobileClear.hidden = !state.q;
		if (categorySel) categorySel.value = state.category;
		if (countrySel) countrySel.value = state.country;
		if (sortSel) sortSel.value = state.sort;
		renderTokens();
	}

	function changed(replace) {
		state.page = 1;
		syncControls();
		writeURL(replace);
		ensureUrlCategory();
		load();
	}

	// ── Data ────────────────────────────────────────────────────────────────
	function load() {
		var id = ++reqId;
		listEl.setAttribute('aria-busy', 'true');
		if (!data) {
			listEl.innerHTML = '<div class="paper-loading"><div class="paper-loading-spinner"></div><p>Loading research groups…</p></div>';
		} else {
			listEl.classList.add('is-loading');
		}
		L.getJson(apiUrl()).then(function (res) {
			if (id !== reqId) return;
			data = res;
			render();
		}).catch(function (err) {
			if (id !== reqId) return;
			// A page past the end (e.g. a stale ?page=) is a 404: go back to page 1.
			if (err && err.status === 404 && state.page > 1) { state.page = 1; writeURL(true); load(); return; }
			data = null;
			listEl.classList.remove('is-loading');
			listEl.setAttribute('aria-busy', 'false');
			listEl.innerHTML = '<div class="paper-empty"><p>We could not load the research groups. <button type="button" class="btn-outline-teal groups-retry" style="margin-left:8px;padding:4px 12px;font-size:14px;">Try again</button></p></div>';
			pagerEl.hidden = true;
			setCount('');
		});
	}

	// ── Rendering ───────────────────────────────────────────────────────────
	function setCount(html) {
		if (resultCount) resultCount.innerHTML = html;
		if (mobileResultCount) mobileResultCount.innerHTML = html;
	}

	function sortPhrase() {
		switch (state.sort) {
			case '-recent_articles': return ', most active since ' + L.recentSince + ' first';
			case '-member_count': return ', largest groups first';
			case 'name': return ', A to Z';
			default: return ', most papers first';
		}
	}

	function countHtml(count) {
		var parts = ['working on ' + condition + (state.category ? ' and ' + categoryLabel(state.category) : '')];
		if (state.country) parts.push('in ' + L.countryName(state.country));
		if (state.q) parts.push('matching “' + state.q + '”');
		return '<strong>' + L.num(count) + ' research ' + L.plural(count, 'group', 'groups') + '</strong> ' +
			escHtml(parts.join(', ') + sortPhrase());
	}

	// The lab's papers on the selected topic, else on this condition.
	function paperStats(lab) {
		var pick;
		if (state.category) {
			pick = (lab.categories || []).filter(function (c) { return String(c.id) === state.category; })[0];
		} else {
			pick = (lab.subjects || []).filter(function (s) { return String(s.id) === subjectId; })[0];
		}
		return pick ? { articles: L.num(pick.articles), recent: L.num(pick.recent_articles) } : { articles: '—', recent: '—' };
	}

	function papersHeading() { return 'Papers on ' + (state.category ? categoryLabel(state.category) : condition); }
	function recentHeading() { return 'Since ' + L.recentSince; }

	function th(label, sortKey, cls) {
		var sorted = state.sort === sortKey;
		var aria = sorted ? ' aria-sort="' + (sortKey === 'name' ? 'ascending' : 'descending') + '"' : '';
		var inner = sortKey
			? '<button type="button" class="groups-sort' + (sorted ? ' is-active' : '') + '" data-sort="' + sortKey + '">' +
				escHtml(label) + '<span class="groups-sort__arrow" aria-hidden="true">' + (sortKey === 'name' ? '↑' : '↓') + '</span></button>'
			: escHtml(label);
		return '<th scope="col"' + (cls ? ' class="' + cls + '"' : '') + aria + '>' + inner + '</th>';
	}

	function rowHtml(lab) {
		var st = paperStats(lab);
		var head = lab.head;
		var place = L.placeText(lab);
		var cats = L.allowedCategories(lab, cfg).slice(0, 3);
		var note = lab.curated ? ''
			: '<span class="groups-auto" title="Grouped automatically from publication data">' + L.infoIcon(13) + 'Grouped from publication data</span>';
		var catsHtml = cats.length ? '<ul class="groups-topics">' + cats.map(function (c) {
			var id = String(c.id), on = id === state.category;
			return '<li><button type="button" class="badge-phase groups-topic' + (on ? ' is-active' : '') + '" data-category="' + escHtml(id) + '"' +
				(on ? ' aria-pressed="true"' : ' aria-pressed="false"') + ' title="Show groups working on ' + escHtml(c.name) + '">' + escHtml(c.name) + '</button></li>';
		}).join('') + '</ul>' : '<span class="groups-none">—</span>';

		return '<tr>' +
			'<th scope="row" class="groups-name">' +
				L.curatorBadge(cfg, lab) +
				'<a class="groups-name__link" href="' + escHtml(L.labHref(cfg, lab)) + '">' + t(lab.name) + '</a>' +
				(head && head.full_name ? '<span class="groups-led">Led by ' + L.personHtml(cfg, head) + '</span>' : '') +
				note +
			'</th>' +
			'<td class="groups-place" data-label="Institution">' + (place ? t(place) : '<span class="groups-none">—</span>') + '</td>' +
			'<td class="num" data-label="Members">' + L.num(lab.member_count) + '</td>' +
			'<td class="num" data-label="' + escHtml(papersHeading()) + '">' + st.articles + '</td>' +
			'<td class="num" data-label="' + escHtml(recentHeading()) + '">' + st.recent + '</td>' +
			'<td class="groups-works" data-label="Works on">' + catsHtml + '</td>' +
		'</tr>';
	}

	function render() {
		var count = data.count || 0, results = data.results || [];
		listEl.classList.remove('is-loading');
		listEl.setAttribute('aria-busy', 'false');
		setCount(countHtml(count));

		if (!count) {
			listEl.innerHTML = (state.q || state.category || state.country)
				? '<div class="paper-empty"><p>No research groups match these filters. ' +
					'<button type="button" class="btn-outline-teal groups-clear" style="margin-left:8px;padding:4px 12px;font-size:14px;">Clear filters</button></p></div>'
				: '<div class="paper-empty"><p>We have not identified research groups working on ' + escHtml(condition) + ' yet. ' +
					'<a href="' + escHtml(cfg.labBase) + '">Browse all research groups</a>.</p></div>';
			pagerEl.hidden = true;
			return;
		}

		listEl.innerHTML = '<table class="groups-table">' +
			'<caption class="visually-hidden">Research groups working on ' + escHtml(condition) + '</caption>' +
			'<thead><tr>' +
				th('Research group', 'name') +
				th('Institution', null) +
				th('Members', '-member_count', 'num') +
				th(papersHeading(), '-articles', 'num') +
				th(recentHeading(), '-recent_articles', 'num') +
				th('Works on', null) +
			'</tr></thead>' +
			'<tbody>' + results.map(rowHtml).join('') + '</tbody>' +
		'</table>';

		var total = Math.max(1, Math.ceil(count / PAGE_SIZE));
		renderPager(state.page, total);
	}

	function renderPager(current, total) {
		pagerEl.hidden = total <= 1;
		firstBtn.disabled = prevBtn.disabled = current <= 1;
		nextBtn.disabled = lastBtn.disabled = current >= total;
		lastBtn.setAttribute('data-page', String(total));
		var start = Math.max(1, current - 2), end = Math.min(total, current + 2), html = '';
		if (start > 1) {
			html += '<button class="pagination-btn page-num" data-page="1">1</button>';
			if (start > 2) html += '<span class="pagination-ellipsis">&hellip;</span>';
		}
		for (var p = start; p <= end; p++) {
			html += '<button class="pagination-btn page-num' + (p === current ? ' active' : '') + '" data-page="' + p + '"' +
				(p === current ? ' disabled aria-current="page"' : '') + '>' + p + '</button>';
		}
		if (end < total) {
			if (end < total - 1) html += '<span class="pagination-ellipsis">&hellip;</span>';
			html += '<button class="pagination-btn page-num" data-page="' + total + '">' + total + '</button>';
		}
		pageNums.innerHTML = html;
	}

	function goTo(page) {
		if (!page || page === state.page) return;
		state.page = page;
		writeURL(false);
		load();
		var top = (resultCount && resultCount.offsetParent ? resultCount : listEl);
		top.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// ── Desktop events ──────────────────────────────────────────────────────
	if (searchInput) {
		searchInput.addEventListener('input', debounce(function () {
			var v = searchInput.value.trim();
			if (v === state.q) return;
			state.q = v;
			if (BR.trackSearch) BR.trackSearch('Research Groups: Search', v, trackContext);
			changed(true);
		}, 300));
	}
	$('groups-filter-form').addEventListener('submit', function (e) { e.preventDefault(); });
	categorySel.addEventListener('change', function () { state.category = categorySel.value; changed(false); });
	countrySel.addEventListener('change', function () { state.country = countrySel.value; changed(false); });
	sortSel.addEventListener('change', function () { state.sort = sortSel.value; changed(false); });
	$('groups-reset-btn').addEventListener('click', resetAll);

	function resetAll() {
		state.q = ''; state.category = ''; state.country = ''; state.sort = DEFAULT_SORT;
		changed(false);
	}

	// Table: sortable headers, topic chips (filter by that topic), retry / clear buttons.
	listEl.addEventListener('click', function (e) {
		var b = e.target.closest('button');
		if (!b) return;
		if (b.hasAttribute('data-sort')) {
			if (state.sort === b.getAttribute('data-sort')) return;
			state.sort = b.getAttribute('data-sort');
			changed(false);
		} else if (b.hasAttribute('data-category')) {
			var id = b.getAttribute('data-category');
			state.category = state.category === id ? '' : id;
			changed(false);
		} else if (b.classList.contains('groups-retry')) {
			load();
		} else if (b.classList.contains('groups-clear')) {
			resetAll();
		}
	});

	pagerEl.addEventListener('click', function (e) {
		var b = e.target.closest('button');
		if (!b || b.disabled || !data) return;
		var total = Math.max(1, Math.ceil((data.count || 0) / PAGE_SIZE));
		if (b === firstBtn) goTo(1);
		else if (b === prevBtn) goTo(state.page - 1);
		else if (b === nextBtn) goTo(state.page + 1);
		else if (b === lastBtn) goTo(total);
		else if (b.hasAttribute('data-page')) goTo(parseInt(b.getAttribute('data-page'), 10));
	});

	// ── Mobile: search, removable tokens, FAB count, bottom sheet ──────────
	var mobileSearch = $('groups-mobile-search'), mobileClear = $('groups-mobile-clear');
	var tokenStrip = $('groups-filter-tokens'), fabCount = $('groups-fab-count');
	var sheetEl = $('groups-filter-sheet'), sheetCategory = $('groups-sheet-category'), sheetCountry = $('groups-sheet-country');
	var feedUI = BR.feedUI || {};
	var draft = {};

	function sortLabel(v) {
		var o = sortSel && sortSel.querySelector('option[value="' + v + '"]');
		return o ? o.textContent : v;
	}

	function renderTokens() {
		var tokens = [];
		if (state.category) tokens.push([categoryLabel(state.category), 'category']);
		if (state.country) tokens.push([L.countryName(state.country), 'country']);
		if (state.sort !== DEFAULT_SORT) tokens.push([sortLabel(state.sort), 'sort']);
		if (fabCount) { fabCount.textContent = String(tokens.length); fabCount.hidden = !tokens.length; }
		if (!tokenStrip || !feedUI.buildToken) return;
		var addChip = tokenStrip.querySelector('.token-add-filters');
		while (tokenStrip.firstChild) tokenStrip.removeChild(tokenStrip.firstChild);
		tokens.forEach(function (x) { tokenStrip.appendChild(feedUI.buildToken(x[0], x[1])); });
		if (addChip) tokenStrip.appendChild(addChip);
		tokenStrip.hidden = !tokens.length;
	}

	if (tokenStrip) {
		tokenStrip.addEventListener('click', function (e) {
			var rm = e.target.closest('.filter-token-remove');
			var tok = rm && rm.closest('.filter-token');
			if (!tok) return;
			var k = tok.dataset.filter;
			if (k === 'category') state.category = '';
			else if (k === 'country') state.country = '';
			else if (k === 'sort') state.sort = DEFAULT_SORT;
			changed(false);
		});
	}

	if (mobileSearch) {
		mobileSearch.addEventListener('input', debounce(function () {
			var v = mobileSearch.value.trim();
			if (mobileClear) mobileClear.hidden = !v;
			if (v === state.q) return;
			state.q = v;
			if (BR.trackSearch) BR.trackSearch('Research Groups: Search', v, trackContext);
			changed(true);
		}, 300));
	}
	if (mobileClear) mobileClear.addEventListener('click', function () { state.q = ''; changed(false); });

	function syncSheet() {
		if (sheetCategory) sheetCategory.value = draft.category;
		if (sheetCountry) sheetCountry.value = draft.country;
		if (feedUI.setActiveChip) feedUI.setActiveChip('groups-sheet-sort', draft.sort);
	}

	if (sheetEl) {
		sheetEl.addEventListener('show.bs.offcanvas', function () {
			draft = { category: state.category, country: state.country, sort: state.sort };
			syncSheet();
		});
	}
	if (sheetCategory) sheetCategory.addEventListener('change', function () { draft.category = sheetCategory.value; });
	if (sheetCountry) sheetCountry.addEventListener('change', function () { draft.country = sheetCountry.value; });
	var sheetSort = $('groups-sheet-sort');
	if (sheetSort) {
		sheetSort.addEventListener('click', function (e) {
			var chip = e.target.closest('.sheet-chip');
			if (!chip) return;
			draft.sort = chip.dataset.value;
			syncSheet();
		});
	}
	var sheetReset = $('groups-sheet-reset');
	if (sheetReset) sheetReset.addEventListener('click', function () { draft = { category: '', country: '', sort: DEFAULT_SORT }; syncSheet(); });
	var sheetApply = $('groups-sheet-apply');
	if (sheetApply) {
		sheetApply.addEventListener('click', function () {
			state.category = draft.category; state.country = draft.country; state.sort = draft.sort;
			changed(false);
			if (window.bootstrap && bootstrap.Offcanvas) {
				var inst = bootstrap.Offcanvas.getInstance(sheetEl);
				if (inst) inst.hide();
			}
		});
	}

	window.addEventListener('popstate', function () { readURL(); syncControls(); ensureUrlCategory(); load(); });

	fillControls();
	readURL();
	syncControls();
	ensureUrlCategory();
	load();
})();
