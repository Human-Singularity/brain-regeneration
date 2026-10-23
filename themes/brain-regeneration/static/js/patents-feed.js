/* patents-feed.js — Patent families feed for condition pages (/conditions/{slug}/patents/).
 * Fetches from the GregoryAi /patents/ endpoint (search via ?search= param).
 * Supports: category, modality and applicant/sponsor filters (server-side),
 * granted / trial-linked toggles, server-side ordering, URL state, pagination,
 * a filter-aware stats bar with a filings-by-priority-year chart (/patents/stats/),
 * and the mobile bottom-sheet filter UI.
 *
 * Licence (EPO OPS): every patent must keep its Espacenet link, and bulk export
 * is not allowed — so there is deliberately no CSV download here.
 */
(function () {
	'use strict';

	var mount = document.getElementById('patents-list');
	if (!mount) return;

	var apiBase   = (mount.dataset.apiBase || window.__API_BASE__ || 'https://api.brain-regeneration.com').replace(/\/$/, '');
	var endpoint  = mount.dataset.endpoint || (apiBase + '/patents/');
	var subjectId = mount.dataset.subjectId || '';

	var statsEndpoint    = endpoint.replace(/\/?$/, '/') + 'stats/';
	var sponsorsEndpoint = apiBase + '/sponsors/';

	// ── UI references ────────────────────────────────────────────────────────
	var filterForm      = document.getElementById('patents-filter-form');
	var searchInput     = document.getElementById('patents-search-input');
	var categorySelect  = document.getElementById('patents-category-select');
	var modalitySelect  = document.getElementById('patents-modality-select');
	var applicantInput  = document.getElementById('patents-applicant-input');
	var applicantList   = document.getElementById('patents-applicant-suggestions');
	var grantedCheck    = document.getElementById('patents-granted');
	var trialsCheck     = document.getElementById('patents-trial-linked');
	var sortSelect      = document.getElementById('patents-sort-select');
	var searchBtn       = document.getElementById('patents-search-btn');
	var searchContext   = searchBtn ? (searchBtn.dataset.searchContext || '') : '';
	var resetBtn        = document.getElementById('patents-reset-btn');
	var resultCount     = document.getElementById('patents-result-count');

	var statTotal   = document.getElementById('patents-stat-total');
	var statGranted = document.getElementById('patents-stat-granted');
	var statTrials  = document.getElementById('patents-stat-trials');
	var yearsChart  = document.getElementById('patents-years-chart');

	var firstBtn       = document.getElementById('patents-first-btn');
	var prevBtn        = document.getElementById('patents-prev-btn');
	var nextBtn        = document.getElementById('patents-next-btn');
	var lastBtn        = document.getElementById('patents-last-btn');
	var paginationNums = document.getElementById('patents-pagination-numbers');

	// ── State ─────────────────────────────────────────────────────────────
	var DEFAULT_SORT = 'discovery';
	var state = {
		page:        1,
		totalPages:  1,
		keyword:     '',
		category:    '',   // category id
		modality:    '',   // CategoryModality value
		sponsorId:   '',   // applicant_sponsor_id (picked from suggestions or a card)
		sponsorName: '',   // display label for sponsorId
		applicant:   '',   // free-text applicant substring (unlinked applicants)
		granted:     false,
		trialLinked: false,
		sort:        DEFAULT_SORT,
		categories:     [],
		categoryGroups: [],
	};

	var SORT_ORDERING = {
		discovery:     '-discovery_date',
		published:     '-earliest_publication_date',
		published_asc: 'earliest_publication_date',
		priority:      '-earliest_priority_date',
		priority_asc:  'earliest_priority_date',
	};

	// ── Cache ─────────────────────────────────────────────────────────────
	var cache      = BR.makeCache('brPatents:', 6 * 60 * 60 * 1000);      // 6 hours
	var statsCache = BR.makeCache('brPatentStats:', 6 * 60 * 60 * 1000); // 6 hours

	// ── Helpers (generic ones shared via window.BR; see js/br-utils.js) ─────
	var escHtml        = BR.escHtml;
	var decodeEntities = BR.decodeEntities;
	var stripHtml      = BR.stripHtml;
	var truncate       = BR.truncate;
	var safeLink       = BR.safeLink;
	var debounce       = BR.debounce;
	var formatDate     = BR.formatDate;

	// Acronyms that must survive sentence-casing an ALL-CAPS title. Words that
	// contain a digit (CD20, IL-17, S1P, A2A) are kept automatically.
	var ACRONYMS = {
		MS: 1, CNS: 1, PNS: 1, DNA: 1, RNA: 1, MRNA: 1, SIRNA: 1, MIRNA: 1, BTK: 1, BTKI: 1,
		OPC: 1, OPCS: 1, MOG: 1, MBP: 1, PLP: 1, MAG: 1, TNF: 1, ALS: 1, EAE: 1, NMOSD: 1,
		RRMS: 1, SPMS: 1, PPMS: 1, GPCR: 1, JAK: 1, PET: 1, MRI: 1, AAV: 1, CAR: 1, NK: 1,
		IGG: 1, IGM: 1, HLA: 1, BBB: 1, CSF: 1, ATP: 1, NAD: 1, NADH: 1, ROS: 1, LINGO: 1,
		HDAC: 1, PPAR: 1, AMPK: 1, MTOR: 1, NRF2: 1, GABA: 1, NMDA: 1, CB: 1, THC: 1, CBD: 1,
		TCR: 1, MHC: 1, APC: 1, MSC: 1, MSCS: 1, IPSC: 1, IPSCS: 1, HSC: 1, AHSCT: 1, EV: 1,
		EVS: 1, CRISPR: 1, PEG: 1, UV: 1, USA: 1, UK: 1, EU: 1,
		I: 1, II: 1, III: 1, IV: 1, VI: 1,
	};

	function caseWord(word) {
		// Keep surrounding punctuation, case only the letters.
		var m = /^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/.exec(word);
		var core = m[2];
		if (!core) return word;
		if (/\d/.test(core) || ACRONYMS[core.toUpperCase()]) return word;
		// Lone letters are names ("vitamin D", "protein C"), except the article "A".
		if (core.length === 1 && core !== 'A') return word;
		return m[1] + core.toLowerCase() + m[3];
	}

	// "SUSTAINED-RELEASE FAMPRIDINE FOR MS" → "Sustained-release fampridine for MS".
	// Only applied to titles that are entirely upper case.
	function sentenceCase(title) {
		if (!title || title !== title.toUpperCase() || !/[A-Z]/.test(title)) return title;
		var out = title.split(/(\s+)/).map(function (tok) {
			return /\s/.test(tok) ? tok : tok.split('-').map(caseWord).join('-');
		}).join('');
		var i = out.search(/[A-Za-z]/);
		return i === -1 ? out : out.slice(0, i) + out.charAt(i).toUpperCase() + out.slice(i + 1);
	}

	// Company suffixes that read wrong when title-cased.
	var NAME_FIXUPS = { Gmbh: 'GmbH', Llc: 'LLC', Plc: 'PLC', Ag: 'AG', Sa: 'SA', Sas: 'SAS', Spa: 'SpA', Bv: 'BV', Nv: 'NV', Ab: 'AB', Kgaa: 'KGaA', Usa: 'USA', Uk: 'UK' };

	// "ZHEJIANG CHINESE MEDICAL UNIVERSITY" → "Zhejiang Chinese Medical University".
	function displayApplicant(name) {
		name = decodeEntities(name || '').trim();
		if (!name || name !== name.toUpperCase() || !/[A-Z]/.test(name)) return name;
		return name.toLowerCase().replace(/[a-z][a-z']*/g, function (w) {
			var t = w.charAt(0).toUpperCase() + w.slice(1);
			return NAME_FIXUPS[t] || t;
		});
	}

	// Abstracts copied from EP descriptions carry paragraph numbers: "[0001] The present…"
	function cleanSummary(s) {
		return stripHtml(decodeEntities(s || '')).replace(/\[\d{4,5}\]\s*/g, '').trim();
	}

	function categoryLabel(id) {
		if (!id) return '';
		var cat = state.categories.find(function (c) { return String(c.id) === String(id); });
		return cat ? cat.name : id;
	}

	function optionLabel(select, value) {
		if (!select) return value;
		for (var i = 0; i < select.options.length; i++) {
			if (select.options[i].value === value) return select.options[i].text;
		}
		return value;
	}

	function applicantLabel() {
		return state.sponsorId ? (state.sponsorName || 'Applicant') : state.applicant;
	}

	// ── URL state ──────────────────────────────────────────────────────────

	function readURL() {
		var p = new URLSearchParams(window.location.search);
		state.keyword     = p.get('q')            || '';
		state.category    = p.get('category')     || '';
		state.modality    = p.get('modality')     || '';
		state.sponsorId   = p.get('sponsor')      || '';
		state.sponsorName = p.get('sponsor_name') || '';
		state.applicant   = state.sponsorId ? '' : (p.get('applicant') || '');
		state.granted     = p.get('granted') === 'true';
		state.trialLinked = p.get('trials')  === 'true';
		state.sort        = SORT_ORDERING[p.get('sort')] ? p.get('sort') : DEFAULT_SORT;
		state.page        = parseInt(p.get('page') || '1', 10) || 1;
	}

	function writeURL(push) {
		var p = new URLSearchParams();
		if (state.keyword)     p.set('q',        state.keyword);
		if (state.category)    p.set('category', state.category);
		if (state.modality)    p.set('modality', state.modality);
		if (state.sponsorId) {
			p.set('sponsor', state.sponsorId);
			if (state.sponsorName) p.set('sponsor_name', state.sponsorName);
		} else if (state.applicant) {
			p.set('applicant', state.applicant);
		}
		if (state.granted)     p.set('granted', 'true');
		if (state.trialLinked) p.set('trials',  'true');
		if (state.sort !== DEFAULT_SORT) p.set('sort', state.sort);
		if (state.page > 1)    p.set('page', String(state.page));
		var url = window.location.pathname + (p.toString() ? '?' + p.toString() : '');
		if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
	}

	window.addEventListener('popstate', function () {
		readURL();
		syncUIFromState();
		fetchPage(state.page, false);
	});

	function syncUIFromState() {
		if (searchInput)    searchInput.value    = state.keyword;
		if (categorySelect) categorySelect.value = state.category;
		if (modalitySelect) modalitySelect.value = state.modality;
		if (applicantInput) applicantInput.value = applicantLabel();
		if (grantedCheck)   grantedCheck.checked = state.granted;
		if (trialsCheck)    trialsCheck.checked  = state.trialLinked;
		if (sortSelect)     sortSelect.value     = state.sort;
		if (typeof syncMobileFromState === 'function') syncMobileFromState();
	}

	// ── API URL builders ──────────────────────────────────────────────────

	// Filters shared by the list and the stats endpoint.
	function filterParams() {
		var p = new URLSearchParams();
		p.set('format', 'json');
		if (subjectId)         p.set('subject_id',           subjectId);
		if (state.keyword)     p.set('search',               state.keyword);
		if (state.category)    p.set('category_id',          state.category);
		if (state.modality)    p.set('category_modality',    state.modality);
		if (state.sponsorId)   p.set('applicant_sponsor_id', state.sponsorId);
		else if (state.applicant) p.set('applicant',         state.applicant);
		if (state.granted)     p.set('has_grant',            'true');
		if (state.trialLinked) p.set('has_trial_link',       'true');
		return p;
	}

	function buildURL(page) {
		var p = filterParams();
		p.set('ordering', SORT_ORDERING[state.sort] || SORT_ORDERING[DEFAULT_SORT]);
		if (page > 1) p.set('page', String(page));
		return endpoint + '?' + p.toString();
	}

	function buildStatsURL() {
		return statsEndpoint + '?' + filterParams().toString();
	}

	// ── Render ─────────────────────────────────────────────────────────────

	function renderSkeleton() {
		var html = '';
		for (var i = 0; i < 3; i++) {
			html += '<div class="paper-skeleton"><div class="paper-skeleton-title"></div><div class="paper-skeleton-meta"></div><div class="paper-skeleton-body"></div></div>';
		}
		mount.innerHTML = html;
	}

	function renderEmpty() {
		mount.innerHTML = '<div class="paper-empty"><p>No patents match these filters. Try removing one.</p></div>';
	}

	function renderError() {
		mount.innerHTML = '<div class="paper-empty"><p>We could not load the patents. <button class="btn-outline-teal" id="patents-retry-btn" style="margin-left:8px;padding:4px 12px;font-size:14px;">Try again</button></p></div>';
		var retryBtn = document.getElementById('patents-retry-btn');
		if (retryBtn) retryBtn.addEventListener('click', function () { fetchPage(state.page, false); });
	}

	var MAX_APPLICANTS = 3;

	function buildApplicants(applicants) {
		if (!applicants || !applicants.length) return '';
		var shown = applicants.slice(0, MAX_APPLICANTS).map(function (a) {
			var name = displayApplicant(a.raw_name || a.sponsor_name);
			if (!name) return '';
			var attrs = a.sponsor_id
				? ' data-sponsor-id="' + escHtml(String(a.sponsor_id)) + '"'
				: ' data-applicant="' + escHtml(a.raw_name || '') + '"';
			return '<button type="button" class="patent-applicant"' + attrs + ' data-label="' + escHtml(name) + '" title="Show all patents from ' + escHtml(name) + '">' + escHtml(name) + '</button>';
		}).filter(Boolean);
		var more = applicants.length - MAX_APPLICANTS;
		return '<div class="patent-card-applicants">' + shown.join('<span class="patent-applicant-sep">; </span>') +
			(more > 0 ? ' <span class="patent-applicant-more">+' + more + ' more</span>' : '') +
		'</div>';
	}

	function buildCard(p) {
		var link     = safeLink(p.link);
		var title    = sentenceCase(decodeEntities(p.title || 'Untitled patent'));
		var summary  = truncate(cleanSummary(p.summary), 260);
		var priority = formatDate(p.earliest_priority_date);
		var published = formatDate(p.earliest_publication_date);
		var family   = (p.publications_count || 0) - 1;
		var trials   = p.trial_links_count || 0;

		var statusBadge = p.has_grant
			? '<span class="access-badge open" title="At least one publication in this family has a grant kind code">Granted</span>'
			: '<span class="access-badge restricted" title="No granted publication in this family yet">Application</span>';
		var trialBadge = trials
			? '<span class="patent-trial-badge">Linked to ' + trials + ' trial' + (trials !== 1 ? 's' : '') + '</span>'
			: '';

		var categories = '';
		var cats = p.categories || p.team_categories || [];
		if (cats.length) {
			categories = '<div class="paper-card-categories">' +
				cats.map(function (c) {
					return '<span class="condition-tag" style="font-size:12px;padding:2px 8px;">' + escHtml(decodeEntities(c.category_name || c.category_slug || '')) + '</span>';
				}).join('') +
			'</div>';
		}

		return '<article class="paper-card patent-card">' +
			'<div class="paper-card-title">' +
				'<a href="' + escHtml(link) + '" target="_blank" rel="noopener noreferrer">' + escHtml(title) +
				'<span class="visually-hidden"> (opens Espacenet in a new tab)</span></a>' +
			'</div>' +
			buildApplicants(p.applicants) +
			(summary ? '<div class="paper-card-abstract">' + escHtml(summary) + '</div>' : '') +
			'<div class="paper-card-meta">' +
				(p.representative_publication
					? '<span class="patent-card-number">' + escHtml(p.representative_publication) +
						(family > 0 ? ' <span class="patent-card-family">+' + family + ' in family</span>' : '') + '</span>'
					: '') +
				(priority  ? '<span class="paper-card-date" title="Earliest priority date — when the invention was first filed">Filed ' + escHtml(priority) + '</span>' : '') +
				(published ? '<span class="paper-card-date" title="Earliest publication date">Published ' + escHtml(published) + '</span>' : '') +
				statusBadge +
				trialBadge +
				'<a class="paper-card-doi" href="' + escHtml(link) + '" target="_blank" rel="noopener noreferrer">Espacenet ↗</a>' +
			'</div>' +
			categories +
		'</article>';
	}

	function renderCards(patents) {
		if (!patents.length) { renderEmpty(); return; }
		mount.innerHTML = patents.map(buildCard).join('');
	}

	// ── Result counter ─────────────────────────────────────────────────────

	function updateCounter(count) {
		var text = count.toLocaleString('en') + ' patent famil' + (count !== 1 ? 'ies' : 'y');
		if (resultCount) resultCount.textContent = text;
		if (mobileResultCount) mobileResultCount.textContent = text;
	}

	// ── Pagination ─────────────────────────────────────────────────────────

	function updatePagination(current, total) {
		state.page       = current;
		state.totalPages = total;

		if (firstBtn) firstBtn.disabled = current <= 1;
		if (prevBtn)  prevBtn.disabled  = current <= 1;
		if (nextBtn)  nextBtn.disabled  = current >= total;
		if (lastBtn)  lastBtn.disabled  = current >= total;

		if (!paginationNums) return;

		var start = Math.max(1, current - 2);
		var end   = Math.min(total, current + 2);
		var html  = '';

		if (start > 1) {
			html += '<button class="pagination-btn page-num" data-page="1">1</button>';
			if (start > 2) html += '<span class="pagination-ellipsis">&hellip;</span>';
		}
		for (var p = start; p <= end; p++) {
			html += '<button class="pagination-btn page-num' + (p === current ? ' active' : '') + '" data-page="' + p + '"' + (p === current ? ' disabled aria-current="page"' : '') + '>' + p + '</button>';
		}
		if (end < total) {
			if (end < total - 1) html += '<span class="pagination-ellipsis">&hellip;</span>';
			html += '<button class="pagination-btn page-num" data-page="' + total + '">' + total + '</button>';
		}
		paginationNums.innerHTML = html;
	}

	// ── Stats bar + filings-by-year chart ──────────────────────────────────

	var CHART_W = 260, CHART_H = 48, BAR_GAP = 2;

	function renderYearsChart(byYear) {
		if (!yearsChart) return;
		var rows = (byYear || []).filter(function (d) { return d.year != null; });
		if (!rows.length) {
			yearsChart.innerHTML = '<div class="patents-years-empty">—</div>';
			yearsChart.setAttribute('aria-label', 'No filings by priority year for these filters');
			return;
		}
		// Zero-fill gaps so each bar is one calendar year.
		var counts = {};
		rows.forEach(function (d) { counts[d.year] = d.count; });
		var first = rows[0].year, last = rows[rows.length - 1].year;
		var years = [];
		for (var y = first; y <= last; y++) years.push({ year: y, count: counts[y] || 0 });

		var max  = Math.max.apply(null, years.map(function (d) { return d.count; })) || 1;
		var step = CHART_W / years.length;
		var barW = Math.max(1, step - BAR_GAP);
		var r    = Math.min(2, barW / 2);
		// Patents publish ~18 months after filing, so the latest years are incomplete.
		var incompleteFrom = new Date().getFullYear() - 1;

		var bars = years.map(function (d, i) {
			var h = d.count ? Math.max(2, (d.count / max) * CHART_H) : 0;
			var x = (i * step + BAR_GAP / 2).toFixed(2);
			var label = d.year + ': ' + d.count.toLocaleString('en') + ' famil' + (d.count !== 1 ? 'ies' : 'y') +
				(d.year >= incompleteFrom ? ' (still being published)' : '');
			// Rounded data-end on top, square on the baseline.
			var bar = h
				? '<path class="patents-years-bar' + (d.year >= incompleteFrom ? ' is-partial' : '') + '" d="' +
					'M' + x + ',' + CHART_H +
					'v' + (-(h - r)).toFixed(2) +
					'q0,' + (-r) + ' ' + r + ',' + (-r) +
					'h' + (barW - 2 * r).toFixed(2) +
					'q' + r + ',0 ' + r + ',' + r +
					'v' + (h - r).toFixed(2) + 'z"/>'
				: '';
			return '<g class="patents-years-col" data-label="' + escHtml(label) + '">' +
				'<rect class="patents-years-hit" x="' + (i * step).toFixed(2) + '" y="0" width="' + step.toFixed(2) + '" height="' + CHART_H + '"/>' +
				bar +
			'</g>';
		}).join('');

		var peak = years.reduce(function (a, b) { return b.count > a.count ? b : a; });
		yearsChart.setAttribute('aria-label', 'Patent families by priority year, ' + first + ' to ' + last + '. Peak: ' + peak.count + ' in ' + peak.year + '.');
		yearsChart.innerHTML =
			'<svg viewBox="0 0 ' + CHART_W + ' ' + CHART_H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' + bars + '</svg>' +
			'<div class="patents-years-axis" aria-hidden="true"><span>' + first + '</span><span>' + last + '</span></div>' +
			'<div class="patents-years-tip" hidden></div>';
	}

	if (yearsChart) {
		yearsChart.addEventListener('mouseover', function (e) {
			var col = e.target.closest && e.target.closest('.patents-years-col');
			var tip = yearsChart.querySelector('.patents-years-tip');
			if (!col || !tip) return;
			yearsChart.querySelectorAll('.patents-years-col.is-hover').forEach(function (c) { c.classList.remove('is-hover'); });
			col.classList.add('is-hover');
			tip.textContent = col.dataset.label;
			tip.hidden = false;
			var box = yearsChart.getBoundingClientRect();
			var colBox = col.getBoundingClientRect();
			var center = colBox.left + colBox.width / 2 - box.left;
			tip.style.left = Math.max(0, Math.min(box.width, center)) + 'px';
		});
		yearsChart.addEventListener('mouseleave', function () {
			var tip = yearsChart.querySelector('.patents-years-tip');
			if (tip) tip.hidden = true;
			yearsChart.querySelectorAll('.patents-years-col.is-hover').forEach(function (c) { c.classList.remove('is-hover'); });
		});
	}

	function applyStats(data) {
		if (statTotal)   statTotal.textContent   = (data.total || 0).toLocaleString('en');
		if (statGranted) statGranted.textContent = (data.with_grant || 0).toLocaleString('en');
		if (statTrials)  statTrials.textContent  = (data.with_trial_link || 0).toLocaleString('en');
		renderYearsChart(data.by_priority_year);
	}

	var lastStatsURL = '';
	function fetchStats() {
		var url = buildStatsURL();
		if (url === lastStatsURL) return; // paging doesn't change the totals
		lastStatsURL = url;
		var cached = statsCache.get(url);
		if (cached) { applyStats(cached); return; }
		fetch(url)
			.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
			.then(function (data) {
				statsCache.set(url, data);
				if (url === lastStatsURL) applyStats(data);
			})
			.catch(function () { lastStatsURL = ''; });
	}

	// ── Fetch ──────────────────────────────────────────────────────────────

	var lastListURL = '';
	function showPage(data, page, push) {
		var results = data.results || [];
		var totalPages = data.total_pages || (data.count && results.length ? Math.ceil(data.count / results.length) : 1);
		renderCards(results);
		updatePagination(data.current_page || page, totalPages);
		updateCounter(data.count || 0);
		writeURL(push === true);
		renderTokens();
	}

	function fetchPage(page, push) {
		var url = buildURL(page);
		lastListURL = url;
		fetchStats();

		var cached = cache.get(url);
		if (cached && cached.count > 0) { showPage(cached, page, push); return; }

		renderSkeleton();
		if (push === true) {
			var scrollTarget = document.getElementById('patents-filters') || mount;
			scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}

		fetch(url)
			.then(function (r) {
				if (!r.ok) throw new Error('HTTP ' + r.status);
				return r.json();
			})
			.then(function (data) {
				if (data && data.count > 0) cache.set(url, data);
				if (url !== lastListURL) return; // a newer request superseded this one
				showPage(data, page, push);
			})
			.catch(function () { if (url === lastListURL) renderError(); });
	}

	function refetch() {
		state.page = 1;
		fetchPage(1, false);
	}

	// ── Categories ─────────────────────────────────────────────────────────

	function populateCategorySelect() {
		if (!categorySelect) return;
		while (categorySelect.options.length > 1) categorySelect.remove(1);
		var byName = function (a, b) { return (a.name || '').localeCompare(b.name || ''); };

		state.categoryGroups.forEach(function (g) {
			var group = document.createElement('optgroup');
			group.label = g.label;
			(g.categories || []).slice().sort(byName).forEach(function (c) {
				if (!c.id) return;
				var opt = document.createElement('option');
				opt.value       = String(c.id);
				opt.textContent = c.name;
				group.appendChild(opt);
			});
			categorySelect.appendChild(group);
		});
		categorySelect.value = state.category;
	}

	// ── Applicant typeahead (desktop) ──────────────────────────────────────

	var applicantTimer;
	var activeSuggestion = -1;

	function hideApplicantSuggestions() {
		if (!applicantList) return;
		applicantList.hidden = true;
		applicantList.innerHTML = '';
		activeSuggestion = -1;
		if (applicantInput) applicantInput.setAttribute('aria-expanded', 'false');
	}

	function highlightMatch(name, query) {
		var i = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
		if (i === -1) return escHtml(name);
		return escHtml(name.slice(0, i)) +
			'<mark class="author-suggestion-match">' + escHtml(name.slice(i, i + query.length)) + '</mark>' +
			escHtml(name.slice(i + query.length));
	}

	function showApplicantSuggestions(sponsors, query) {
		if (!applicantList) return;
		if (!sponsors.length) { hideApplicantSuggestions(); return; }
		applicantList.innerHTML = sponsors.map(function (s, i) {
			var name = displayApplicant(s.name);
			return '<button type="button" class="author-suggestion-item" role="option" id="patents-applicant-opt-' + i + '" data-id="' + escHtml(String(s.id)) + '" data-label="' + escHtml(name) + '" title="' + escHtml(name) + '">' +
				highlightMatch(name, query) +
				' <span class="patent-suggestion-count">' + s.patents_count.toLocaleString('en') + '</span>' +
			'</button>';
		}).join('');
		applicantList.hidden = false;
		activeSuggestion = -1;
		applicantInput.setAttribute('aria-expanded', 'true');
	}

	function setActiveSuggestion(i) {
		var items = applicantList ? applicantList.querySelectorAll('.author-suggestion-item') : [];
		if (!items.length) return;
		activeSuggestion = (i + items.length) % items.length;
		items.forEach(function (el, idx) { el.classList.toggle('is-active', idx === activeSuggestion); });
		applicantInput.setAttribute('aria-activedescendant', items[activeSuggestion].id);
	}

	function pickSponsor(id, label) {
		state.sponsorId   = id;
		state.sponsorName = label;
		state.applicant   = '';
		if (applicantInput) applicantInput.value = label;
		hideApplicantSuggestions();
		refetch();
	}

	if (applicantInput) {
		applicantInput.addEventListener('input', function () {
			var q = applicantInput.value.trim();
			clearTimeout(applicantTimer);
			if (q.length < 2) { hideApplicantSuggestions(); return; }
			applicantTimer = setTimeout(function () {
				var url = new URL(sponsorsEndpoint);
				url.searchParams.set('format', 'json');
				url.searchParams.set('search', q);
				url.searchParams.set('include_patent_applicants', 'true');
				url.searchParams.set('page_size', '30');
				fetch(url.toString())
					.then(function (r) { return r.json(); })
					.then(function (data) {
						if (applicantInput.value.trim() !== q) return; // stale
						var withPatents = (data.results || [])
							.filter(function (s) { return s.patents_count > 0; })
							.sort(function (a, b) { return b.patents_count - a.patents_count; })
							.slice(0, 8);
						showApplicantSuggestions(withPatents, q);
					})
					.catch(hideApplicantSuggestions);
			}, 300);
		});

		applicantInput.addEventListener('keydown', function (e) {
			var open = applicantList && !applicantList.hidden;
			if (e.key === 'ArrowDown' && open)      { e.preventDefault(); setActiveSuggestion(activeSuggestion + 1); }
			else if (e.key === 'ArrowUp' && open)   { e.preventDefault(); setActiveSuggestion(activeSuggestion - 1); }
			else if (e.key === 'Escape')            { hideApplicantSuggestions(); }
			else if (e.key === 'Enter' && open && activeSuggestion >= 0) {
				e.preventDefault();
				var item = applicantList.querySelectorAll('.author-suggestion-item')[activeSuggestion];
				pickSponsor(item.dataset.id, item.dataset.label);
			}
		});
	}

	if (applicantList) {
		applicantList.addEventListener('click', function (e) {
			var item = e.target.closest('.author-suggestion-item');
			if (item) pickSponsor(item.dataset.id, item.dataset.label);
		});
		document.addEventListener('click', function (e) {
			if (!applicantList.contains(e.target) && e.target !== applicantInput) hideApplicantSuggestions();
		});
	}

	// Typed text without picking a suggestion → free-text applicant filter.
	function readApplicantInput() {
		if (!applicantInput) return;
		var v = applicantInput.value.trim();
		if (state.sponsorId && v === state.sponsorName) return; // unchanged pick
		state.sponsorId = '';
		state.sponsorName = '';
		state.applicant = v;
	}

	// ── Desktop events ─────────────────────────────────────────────────────

	function doSearch() {
		state.keyword = searchInput ? searchInput.value.trim() : '';
		readApplicantInput();
		hideApplicantSuggestions();
		BR.trackSearch('Patents: Search', state.keyword, searchContext);
		refetch();
	}

	if (filterForm) filterForm.addEventListener('submit', function (e) { e.preventDefault(); doSearch(); });

	if (categorySelect) categorySelect.addEventListener('change', function () { state.category = categorySelect.value; refetch(); });
	if (modalitySelect) modalitySelect.addEventListener('change', function () { state.modality = modalitySelect.value; refetch(); });
	if (grantedCheck)   grantedCheck.addEventListener('change',   function () { state.granted = grantedCheck.checked; refetch(); });
	if (trialsCheck)    trialsCheck.addEventListener('change',    function () { state.trialLinked = trialsCheck.checked; refetch(); });
	if (sortSelect)     sortSelect.addEventListener('change',     function () { state.sort = sortSelect.value; refetch(); });

	function resetState() {
		state.keyword = '';
		state.category = '';
		state.modality = '';
		state.sponsorId = '';
		state.sponsorName = '';
		state.applicant = '';
		state.granted = false;
		state.trialLinked = false;
		state.sort = DEFAULT_SORT;
	}

	if (resetBtn) {
		resetBtn.addEventListener('click', function () {
			resetState();
			hideApplicantSuggestions();
			syncUIFromState();
			refetch();
		});
	}

	if (firstBtn) firstBtn.addEventListener('click', function () { if (state.page > 1) fetchPage(1, true); });
	if (prevBtn)  prevBtn.addEventListener('click',  function () { if (state.page > 1) fetchPage(state.page - 1, true); });
	if (nextBtn)  nextBtn.addEventListener('click',  function () { if (state.page < state.totalPages) fetchPage(state.page + 1, true); });
	if (lastBtn)  lastBtn.addEventListener('click',  function () { if (state.page < state.totalPages) fetchPage(state.totalPages, true); });

	document.addEventListener('click', function (e) {
		var pageBtn = e.target.closest('#patents-pagination-numbers .page-num');
		if (pageBtn && !pageBtn.disabled) {
			fetchPage(parseInt(pageBtn.dataset.page, 10), true);
			return;
		}
		// Applicant names on cards filter the feed to that applicant.
		var applicantBtn = e.target.closest('#patents-list .patent-applicant');
		if (applicantBtn) {
			if (applicantBtn.dataset.sponsorId) {
				state.sponsorId   = applicantBtn.dataset.sponsorId;
				state.sponsorName = applicantBtn.dataset.label;
				state.applicant   = '';
			} else {
				state.sponsorId   = '';
				state.sponsorName = '';
				state.applicant   = applicantBtn.dataset.applicant || applicantBtn.dataset.label;
			}
			syncUIFromState();
			state.page = 1;
			fetchPage(1, true);
		}
	});

	// ── Mobile UI ──────────────────────────────────────────────────────────
	// Search bar, removable filter tokens, FAB count and the bottom sheet.
	// The sheet edits a draft that is applied on "Show results".

	var mobileSearchInput = document.getElementById('patents-mobile-search');
	var mobileClearBtn    = document.getElementById('patents-mobile-clear');
	var tokenStrip        = document.getElementById('patents-filter-tokens');
	var fabCount          = document.getElementById('patents-fab-count');
	var sheetEl           = document.getElementById('patents-filter-sheet');
	var sheetApply        = document.getElementById('patents-sheet-apply');
	var sheetReset        = document.getElementById('patents-sheet-reset');
	var sheetApplicant    = document.getElementById('patents-sheet-applicant');
	var mobileResultCount = document.getElementById('patents-mobile-result-count');
	var setActiveChip     = BR.feedUI.setActiveChip;
	var buildToken        = BR.feedUI.buildToken;

	var draft = {};

	function resetDraft() {
		draft = {
			category:    state.category,
			modality:    state.modality,
			applicant:   applicantLabel(),
			granted:     state.granted,
			trialLinked: state.trialLinked,
			sort:        state.sort,
		};
	}

	function syncSheetToDraft() {
		setActiveChip('patents-sheet-category', draft.category);
		setActiveChip('patents-sheet-modality', draft.modality);
		setActiveChip('patents-sheet-granted',  String(draft.granted));
		setActiveChip('patents-sheet-trials',   String(draft.trialLinked));
		setActiveChip('patents-sheet-sort',     draft.sort);
		if (sheetApplicant) sheetApplicant.value = draft.applicant;
	}

	function wireChipGroup(groupId, onChange) {
		var group = document.getElementById(groupId);
		if (!group) return;
		group.addEventListener('click', function (e) {
			var chip = e.target.closest('.sheet-chip');
			if (!chip) return;
			setActiveChip(groupId, chip.dataset.value);
			onChange(chip.dataset.value);
		});
	}

	function populateMobileCategoryChips() {
		var group = document.getElementById('patents-sheet-category');
		if (!group) return;
		group.querySelectorAll('.sheet-chip:not([data-value=""])').forEach(function (c) { c.remove(); });
		state.categories.forEach(function (c) {
			if (!c.id) return;
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'sheet-chip';
			btn.dataset.value = String(c.id);
			btn.textContent = c.name;
			group.appendChild(btn);
		});
	}

	function removeToken(key) {
		if (key === 'category')       state.category = '';
		else if (key === 'modality')  state.modality = '';
		else if (key === 'applicant') { state.sponsorId = ''; state.sponsorName = ''; state.applicant = ''; }
		else if (key === 'granted')   state.granted = false;
		else if (key === 'trials')    state.trialLinked = false;
		else if (key === 'sort')      state.sort = DEFAULT_SORT;
		syncUIFromState();
		refetch();
	}

	function renderTokens() {
		var tokens = [];
		if (state.category)                tokens.push([categoryLabel(state.category), 'category']);
		if (state.modality)                tokens.push([optionLabel(modalitySelect, state.modality), 'modality']);
		if (applicantLabel())              tokens.push([applicantLabel(), 'applicant']);
		if (state.granted)                 tokens.push(['Granted only', 'granted']);
		if (state.trialLinked)             tokens.push(['Linked to a trial', 'trials']);
		if (state.sort !== DEFAULT_SORT)   tokens.push([optionLabel(sortSelect, state.sort), 'sort']);

		if (fabCount) {
			fabCount.textContent = String(tokens.length);
			fabCount.hidden = tokens.length === 0;
		}
		if (!tokenStrip) return;
		var addChip = tokenStrip.querySelector('.token-add-filters');
		while (tokenStrip.firstChild) tokenStrip.removeChild(tokenStrip.firstChild);
		tokens.forEach(function (t) { tokenStrip.appendChild(buildToken(t[0], t[1])); });
		if (addChip) tokenStrip.appendChild(addChip);
		tokenStrip.hidden = tokens.length === 0;
	}

	function syncMobileFromState() {
		if (mobileSearchInput) mobileSearchInput.value = state.keyword;
		if (mobileClearBtn)    mobileClearBtn.hidden   = !state.keyword;
	}

	if (mobileSearchInput) {
		mobileSearchInput.addEventListener('input', debounce(function () {
			state.keyword = mobileSearchInput.value.trim();
			if (searchInput) searchInput.value = state.keyword;
			if (mobileClearBtn) mobileClearBtn.hidden = !state.keyword;
			BR.trackSearch('Patents: Search', state.keyword, searchContext);
			refetch();
		}, 300));
	}

	if (mobileClearBtn) {
		mobileClearBtn.addEventListener('click', function () {
			state.keyword = '';
			syncUIFromState();
			refetch();
		});
	}

	if (tokenStrip) {
		tokenStrip.addEventListener('click', function (e) {
			var removeBtn = e.target.closest('.filter-token-remove');
			var token = removeBtn && removeBtn.closest('.filter-token');
			if (token) removeToken(token.dataset.filter);
		});
	}

	wireChipGroup('patents-sheet-category', function (v) { draft.category = v; });
	wireChipGroup('patents-sheet-modality', function (v) { draft.modality = v; });
	wireChipGroup('patents-sheet-granted',  function (v) { draft.granted = v === 'true'; });
	wireChipGroup('patents-sheet-trials',   function (v) { draft.trialLinked = v === 'true'; });
	wireChipGroup('patents-sheet-sort',     function (v) { draft.sort = v; });
	if (sheetApplicant) sheetApplicant.addEventListener('input', function () { draft.applicant = sheetApplicant.value.trim(); });

	if (sheetEl) {
		sheetEl.addEventListener('show.bs.offcanvas', function () {
			resetDraft();
			syncSheetToDraft();
		});
	}

	if (sheetApply) {
		sheetApply.addEventListener('click', function () {
			state.category    = draft.category;
			state.modality    = draft.modality;
			state.granted     = draft.granted;
			state.trialLinked = draft.trialLinked;
			state.sort        = draft.sort;
			// Keep a sponsor picked on a card unless the text was edited.
			if (draft.applicant !== applicantLabel()) {
				state.sponsorId   = '';
				state.sponsorName = '';
				state.applicant   = draft.applicant;
			}
			syncUIFromState();
			refetch();
			if (window.bootstrap && bootstrap.Offcanvas) {
				var instance = bootstrap.Offcanvas.getInstance(sheetEl);
				if (instance) instance.hide();
			}
		});
	}

	if (sheetReset) {
		sheetReset.addEventListener('click', function () {
			draft = { category: '', modality: '', applicant: '', granted: false, trialLinked: false, sort: DEFAULT_SORT };
			syncSheetToDraft();
		});
	}

	// ── Init ───────────────────────────────────────────────────────────────

	try {
		var rawGroups = mount.dataset.categoryGroups;
		if (rawGroups) {
			var parsed = JSON.parse(rawGroups);
			if (Array.isArray(parsed)) {
				state.categoryGroups = parsed;
				state.categories = parsed.reduce(function (acc, g) {
					return acc.concat(Array.isArray(g.categories) ? g.categories : []);
				}, []);
			}
		}
	} catch (e) { /* non-fatal: category filter will just have no options */ }

	readURL();
	populateCategorySelect();
	populateMobileCategoryChips();
	syncUIFromState();
	fetchPage(state.page, false);
})();
