/* labs-directory.js — /labs/ research groups directory.
 * Fetches GregoryAi's /labs/ (10 per page) with the filters below, renders cards and
 * pagination, and keeps the filters in the URL query string using the API's own
 * parameter names (search, subject_id, category_id, country, ordering, page), so a
 * filtered link such as /labs/?subject_id=13 works.
 *
 * Sorting: name and -member_count always work. -articles and -recent_articles rank by
 * a lab's papers in ONE topic, so the API answers 400 without subject_id or category_id;
 * they are only offered while one is selected, and fall back to name when it is cleared.
 * relevant_articles ordering is deliberately never used (relevance marks are sparse).
 */
(function () {
	'use strict';

	var mount = document.getElementById('labs-directory');
	if (!mount || !window.BR || !BR.labs) return;

	var L = BR.labs, t = L.t, escHtml = BR.escHtml, debounce = BR.debounce;
	var cfg = L.readConfig(mount);

	var $ = function (id) { return document.getElementById(id); };
	var form = $('labs-form'), searchInput = $('labs-search'), subjectSel = $('labs-subject');
	var categorySel = $('labs-category'), countrySel = $('labs-country'), sortSel = $('labs-sort');
	var activeEl = $('labs-active'), resultLine = $('labs-result-line'), listEl = $('labs-list');
	var emptyEl = $('labs-empty'), errorEl = $('labs-error'), pagerEl = $('labs-pager');
	var pagerInfo = $('labs-pager-info'), prevBtn = $('labs-prev'), nextBtn = $('labs-next');

	var TOPIC_SORTS = { '-articles': 1, '-recent_articles': 1 };
	var SORT_LABELS = {
		'name': 'Name, A to Z',
		'-member_count': 'Most members',
		'-articles': 'Most papers on this {topic}',
		'-recent_articles': 'Most active since ' + L.recentSince
	};
	var PAGE_SIZE = 10;

	// sort is null until the visitor (or the URL) picks one: the effective sort is then
	// "most papers" once a condition or topic is chosen, otherwise name.
	var state = { q: '', subject: '', category: '', country: '', sort: null, page: 1 };
	var data = null;           // last API response
	var reqId = 0;

	function hasTopic() { return !!(state.subject || state.category); }
	function effectiveSort() { return state.sort || (hasTopic() ? '-articles' : 'name'); }

	// ── URL state ───────────────────────────────────────────────────────────
	function readURL() {
		var p = new URLSearchParams(window.location.search);
		state.q = (p.get('search') || '').trim();
		state.subject = /^\d+$/.test(p.get('subject_id') || '') ? p.get('subject_id') : '';
		state.category = /^\d+$/.test(p.get('category_id') || '') ? p.get('category_id') : '';
		state.country = /^[A-Za-z]{2}$/.test(p.get('country') || '') ? p.get('country').toUpperCase() : '';
		var o = p.get('ordering');
		state.sort = SORT_LABELS[o] ? o : null;
		if (state.sort && TOPIC_SORTS[state.sort] && !hasTopic()) state.sort = null;
		var pg = parseInt(p.get('page'), 10);
		state.page = pg > 0 ? pg : 1;
	}

	function params(forApi) {
		var p = new URLSearchParams();
		if (state.q) p.set('search', state.q);
		if (state.subject) p.set('subject_id', state.subject);
		if (state.category) p.set('category_id', state.category);
		if (state.country) p.set('country', state.country);
		var sort = forApi ? effectiveSort() : state.sort;
		if (sort && (forApi || sort !== 'name' || hasTopic())) p.set('ordering', sort);
		if (state.page > 1) p.set('page', String(state.page));
		return p;
	}

	function writeURL(replace) {
		var qs = params(false).toString();
		var url = window.location.pathname + (qs ? '?' + qs : '');
		try { history[replace ? 'replaceState' : 'pushState'](null, '', url); } catch (e) { /* ignore */ }
	}

	// ── Filter controls ─────────────────────────────────────────────────────
	function fillSelects() {
		subjectSel.innerHTML = '<option value="">Any condition</option>' + cfg.subjects.map(function (s) {
			return '<option value="' + s.id + '">' + t(s.name) + '</option>';
		}).join('');
		categorySel.innerHTML = '<option value="">Any topic</option>' + cfg.categories.map(function (c) {
			return '<option value="' + c.id + '">' + t(c.name) + '</option>';
		}).join('');
		countrySel.innerHTML = '<option value="">Any country</option>' + L.countryOptions().map(function (c) {
			return '<option value="' + c.code + '">' + t(c.name) + '</option>';
		}).join('');
	}

	function topicWord() { return state.category && !state.subject ? 'topic' : 'condition'; }

	function renderSort() {
		var opts = ['name', '-member_count'];
		if (hasTopic()) opts.push('-articles', '-recent_articles');
		var cur = effectiveSort();
		sortSel.innerHTML = opts.map(function (v) {
			var label = SORT_LABELS[v].replace('{topic}', topicWord());
			return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + escHtml(label) + '</option>';
		}).join('');
	}

	function syncControls() {
		if (searchInput.value !== state.q) searchInput.value = state.q;
		subjectSel.value = state.subject;
		categorySel.value = state.category;
		countrySel.value = state.country;
		renderSort();
		renderActive();
	}

	function subjectLabel() { return cfg.subjectNames[state.subject] || ('Condition ' + state.subject); }
	function categoryLabel() { return cfg.categoryNames[state.category] || ('Topic ' + state.category); }

	function activeFilters() {
		var f = [];
		if (state.subject) f.push({ key: 'subject', label: subjectLabel() });
		if (state.category) f.push({ key: 'category', label: categoryLabel() });
		if (state.country) f.push({ key: 'country', label: L.countryName(state.country) });
		if (state.q) f.push({ key: 'q', label: '“' + state.q + '”' });
		return f;
	}

	function renderActive() {
		var f = activeFilters();
		if (!f.length) { activeEl.hidden = true; activeEl.innerHTML = ''; return; }
		activeEl.hidden = false;
		activeEl.innerHTML = '<span class="labs-active__label">Filtering by</span>' + f.map(function (x) {
			return '<button type="button" class="labs-chip labs-chip--active" data-remove="' + x.key + '" aria-label="Remove filter: ' + escHtml(x.label) + '">' +
				escHtml(x.label) + ' <span aria-hidden="true">×</span></button>';
		}).join('');
	}

	// A topic-only sort cannot outlive the condition/topic it ranks by.
	function normaliseSort() {
		if (state.sort && TOPIC_SORTS[state.sort] && !hasTopic()) state.sort = 'name';
	}

	function changed(replace) {
		normaliseSort();
		state.page = 1;
		syncControls();
		writeURL(replace);
		load();
	}

	// ── Data ────────────────────────────────────────────────────────────────
	function apiUrl() {
		var p = params(true);
		if (!p.has('ordering')) p.set('ordering', effectiveSort());
		p.set('format', 'json');
		return cfg.apiBase + '/labs/?' + p.toString();
	}

	function load() {
		var id = ++reqId;
		listEl.setAttribute('aria-busy', 'true');
		errorEl.hidden = true;
		emptyEl.hidden = true;
		if (!data) { listEl.innerHTML = skeletons(); resultLine.textContent = 'Loading research groups…'; }
		L.getJson(apiUrl()).then(function (res) {
			if (id !== reqId) return;
			data = res;
			render();
		}).catch(function () {
			if (id !== reqId) return;
			listEl.innerHTML = '';
			listEl.setAttribute('aria-busy', 'false');
			pagerEl.hidden = true;
			resultLine.textContent = '';
			errorEl.hidden = false;
		});
	}

	function skeletons() {
		var s = '';
		for (var i = 0; i < 4; i++) s += '<div class="lab-card lab-card--skeleton" aria-hidden="true"><div class="labs-sk labs-sk--title"></div><div class="labs-sk labs-sk--line"></div><div class="labs-sk labs-sk--stats"></div></div>';
		return s;
	}

	// ── Rendering ───────────────────────────────────────────────────────────
	function sortPhrase() {
		switch (effectiveSort()) {
			case '-articles': return ', most papers first';
			case '-recent_articles': return ', most active since ' + L.recentSince + ' first';
			case '-member_count': return ', largest groups first';
			default: return ', A to Z';
		}
	}

	function resultText(count) {
		var parts = [];
		var topics = [];
		if (state.subject) topics.push(subjectLabel());
		if (state.category) topics.push(categoryLabel());
		if (topics.length) parts.push('working on ' + topics.join(' and '));
		if (state.country) parts.push('in ' + L.countryName(state.country));
		if (state.q) parts.push('matching “' + state.q + '”');
		return '<strong>' + L.num(count) + ' research ' + L.plural(count, 'group', 'groups') + '</strong>' +
			(parts.length ? ' ' + escHtml(parts.join(', ')) : '') + escHtml(sortPhrase());
	}

	// The two paper counts on a card: for the filtered category, else the filtered
	// condition, else the lab's top condition. Returns { label, articles, recent }.
	function paperStats(lab) {
		var pick = null, name = '';
		if (state.category) {
			pick = (lab.categories || []).filter(function (c) { return String(c.id) === state.category; })[0];
			name = categoryLabel();
		} else if (state.subject) {
			pick = (lab.subjects || []).filter(function (s) { return String(s.id) === state.subject; })[0];
			name = subjectLabel();
		} else {
			pick = L.topSubject(lab);
			name = pick ? pick.name : '';
		}
		if (!pick) return { label: 'Papers', articles: '—', recent: '—' };
		return { label: 'Papers on ' + name, articles: L.num(pick.articles), recent: L.num(pick.recent_articles) };
	}

	function cardHtml(lab) {
		var st = paperStats(lab);
		var head = lab.head;
		var ledBy = head && head.full_name
			? '<p class="lab-card__led">Led by ' + L.personHtml(cfg, head) + '</p>' : '';
		var place = L.placeText(lab);
		var cats = L.allowedCategories(lab, cfg).slice(0, 3);
		var catsHtml = cats.length
			? '<div class="lab-card__chips"><span class="lab-card__chips-label">Works on</span>' +
				cats.map(function (c) { return '<span class="badge-phase">' + t(c.name) + '</span>'; }).join('') + '</div>'
			: '';
		var note = lab.curated ? ''
			: '<p class="lab-card__note" title="Grouped automatically from publication data">' + L.infoIcon(14) + 'Grouped from publication data</p>';
		return '<article class="lab-card">' +
			'<div class="lab-card__head">' +
				L.curatorBadge(cfg, lab) +
				'<h3><a href="' + escHtml(L.labHref(cfg, lab)) + '">' + t(lab.name) + '</a></h3>' + ledBy +
			'</div>' +
			(place ? '<p class="lab-card__place">' + L.pinIcon(16) + '<span>' + t(place) + '</span></p>' : '') +
			'<dl class="lab-card__stats">' +
				'<div><dt>Members</dt><dd>' + L.num(lab.member_count) + '</dd></div>' +
				'<div><dt>' + escHtml(st.label) + '</dt><dd>' + st.articles + '</dd></div>' +
				'<div><dt>Since ' + L.recentSince + '</dt><dd>' + st.recent + '</dd></div>' +
			'</dl>' + catsHtml + note +
		'</article>';
	}

	function render() {
		var count = data.count || 0, results = data.results || [];
		resultLine.innerHTML = resultText(count);
		listEl.innerHTML = results.map(cardHtml).join('');
		listEl.setAttribute('aria-busy', 'false');
		emptyEl.hidden = count > 0;
		pagerEl.hidden = count === 0;
		var totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
		var from = count ? (state.page - 1) * PAGE_SIZE + 1 : 0;
		var to = count ? from + results.length - 1 : 0;
		pagerInfo.textContent = 'Showing ' + L.num(from) + ' to ' + L.num(to) + ' of ' + L.num(count) +
			' · page ' + L.num(state.page) + ' of ' + L.num(totalPages);
		prevBtn.disabled = !data.previous;
		nextBtn.disabled = !data.next;
		nextBtn.innerHTML = 'Next ' + (data.next ? Math.min(PAGE_SIZE, count - state.page * PAGE_SIZE) : PAGE_SIZE) + ' &rarr;';
	}

	// ── Events ──────────────────────────────────────────────────────────────
	form.addEventListener('submit', function (e) { e.preventDefault(); });

	searchInput.addEventListener('input', debounce(function () {
		var v = searchInput.value.trim();
		if (v === state.q) return;
		state.q = v;
		changed(true);
	}, 300));

	subjectSel.addEventListener('change', function () { state.subject = subjectSel.value; changed(false); });
	categorySel.addEventListener('change', function () { state.category = categorySel.value; changed(false); });
	countrySel.addEventListener('change', function () { state.country = countrySel.value; changed(false); });
	sortSel.addEventListener('change', function () { state.sort = sortSel.value; changed(false); });

	activeEl.addEventListener('click', function (e) {
		var btn = e.target.closest('button[data-remove]');
		if (!btn) return;
		var k = btn.getAttribute('data-remove');
		if (k === 'subject') state.subject = '';
		else if (k === 'category') state.category = '';
		else if (k === 'country') state.country = '';
		else if (k === 'q') state.q = '';
		changed(false);
	});

	$('labs-clear').addEventListener('click', function () {
		state.q = ''; state.subject = ''; state.category = ''; state.country = ''; state.sort = null;
		changed(false);
	});
	$('labs-retry').addEventListener('click', load);

	function go(delta) {
		state.page = Math.max(1, state.page + delta);
		writeURL(false);
		load();
		resultLine.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
	prevBtn.addEventListener('click', function () { if (data && data.previous) go(-1); });
	nextBtn.addEventListener('click', function () { if (data && data.next) go(1); });

	window.addEventListener('popstate', function () { readURL(); syncControls(); load(); });

	fillSelects();
	readURL();
	syncControls();
	load();
})();
