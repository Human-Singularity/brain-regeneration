/* trials-feed.js — Clinical trial listing for condition pages
 * Fetches from api.gregory-ms.com/trials/, renders trial cards,
 * populates stats bar, handles search/phase/status filters,
 * pagination, and 1-hour client-side caching.
 */
(function () {
	'use strict';

	var listEl = document.getElementById('trials-list');
	if (!listEl) return;

	var endpoint  = listEl.dataset.endpoint  || 'https://api.gregory-ms.com/trials/';
	var teamId    = listEl.dataset.teamId    || '';
	var subjectId = listEl.dataset.subjectId || '';

	// ── UI references ────────────────────────────────────────────────────────
	var searchInput     = document.getElementById('search-input');
	var filterPhase     = document.getElementById('filter-phase');
	var filterStatus    = document.getElementById('filter-status');
	var resetBtn        = document.getElementById('reset-filters');
	var clearBtn        = document.getElementById('clear-filters');
	var resultsCountEl  = document.getElementById('results-count');
	var paginationEl    = document.getElementById('pagination');
	var prevBtn         = document.getElementById('prev-btn');
	var nextBtn         = document.getElementById('next-btn');
	var noResults       = document.getElementById('no-results');

	// ── State ────────────────────────────────────────────────────────────────
	// Normalise the default status value to uppercase to match what the API expects.
	var rawDefaultStatus = listEl.dataset.defaultStatus || '';
	var normaliseStatus  = function (s) { return s ? s.toUpperCase().replace(/ /g, '_') : ''; };

	var state = {
		page:       1,
		totalPages: 1,
		total:      0,
		keyword:    '',
		phase:      listEl.dataset.defaultPhase  || '',
		status:     normaliseStatus(rawDefaultStatus),
	};

	// ── Cache ────────────────────────────────────────────────────────────────
	var CACHE_TTL = 60 * 60 * 1000; // 1 hour

	function getCached(key) {
		try {
			var raw = localStorage.getItem(key);
			if (!raw) return null;
			var entry = JSON.parse(raw);
			if (Date.now() - entry.ts > CACHE_TTL) return null;
			return entry.data;
		} catch (e) { return null; }
	}

	function setCached(key, data) {
		try {
			localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
		} catch (e) { /* quota / private mode — ignore */ }
	}

	// ── Helpers ──────────────────────────────────────────────────────────────
	function debounce(fn, ms) {
		var t;
		return function () { clearTimeout(t); t = setTimeout(fn, ms); };
	}

	function escHtml(str) {
		if (str == null) return '';
		return String(str)
			.replace(/&/g,  '&amp;')
			.replace(/</g,  '&lt;')
			.replace(/>/g,  '&gt;')
			.replace(/"/g,  '&quot;')
			.replace(/'/g,  '&#39;');
	}

	function stripHtml(str) {
		if (!str) return '';
		return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
	}

	function truncate(str, limit) {
		var plain = stripHtml(str);
		if (!plain || plain.length <= limit) return plain;
		return plain.slice(0, plain.lastIndexOf(' ', limit) || limit) + '\u2026';
	}

	// ── API URL builder ──────────────────────────────────────────────────────
	function buildURL(page) {
		var url = new URL(endpoint);
		url.searchParams.set('format', 'json');
		if (teamId)       url.searchParams.set('team_id',    teamId);
		if (subjectId)    url.searchParams.set('subject_id', subjectId);
		if (state.keyword) url.searchParams.set('search',   state.keyword);
		if (state.phase)   url.searchParams.set('phase',    state.phase);
		if (state.status)  url.searchParams.set('recruitment_status', state.status);
		url.searchParams.set('page', String(page));
		return url.toString();
	}

	// ── Status badge ─────────────────────────────────────────────────────────
	var STATUS_MAP = {
		'RECRUITING':            { cls: 'badge-recruiting', label: 'Recruiting' },
		'ACTIVE_NOT_RECRUITING': { cls: 'badge-active',     label: 'Active' },
		'NOT_YET_RECRUITING':    { cls: 'badge-phase',      label: 'Not yet recruiting' },
		'ENROLLING_BY_INVITATION':{ cls: 'badge-phase',     label: 'By invitation' },
		'COMPLETED':             { cls: 'badge-completed',  label: 'Completed' },
		'TERMINATED':            { cls: 'badge-completed',  label: 'Terminated' },
		'SUSPENDED':             { cls: 'badge-completed',  label: 'Suspended' },
		'WITHDRAWN':             { cls: 'badge-completed',  label: 'Withdrawn' },
		'AUTHORISED':            { cls: 'badge-phase',      label: 'Authorised' },
	};

	function statusBadge(s) {
		if (!s) return '';
		var d = STATUS_MAP[s] || { cls: 'badge-phase', label: s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, function (c) { return c.toUpperCase(); }) };
		return '<span class="' + d.cls + '">' + escHtml(d.label) + '</span>';
	}

	function formatPhase(p) {
		if (!p || p === 'NA') return '';
		return p.replace(/^PHASE(\d)$/, 'Phase $1').replace(/^PHASE$/, 'Phase');
	}

	// ── View link label ───────────────────────────────────────────────────────
	function viewLabel(link) {
		if (!link) return 'View trial &rarr;';
		if (link.indexOf('clinicaltrials.gov') !== -1) return 'View on ClinicalTrials.gov &rarr;';
		if (link.indexOf('euclinicaltrials.eu') !== -1) return 'View on EU Clinical Trials &rarr;';
		if (link.indexOf('who.int') !== -1)             return 'View on WHO ICTRP &rarr;';
		return 'View trial &rarr;';
	}

	function formatShortDate(iso) {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
	}

	// ── Card builder ─────────────────────────────────────────────────────────
	function buildCard(t) {
		var ids = t.identifiers || {};
		var displayId = ids.nct || ids.euct || ids.eudract || '';
		var summary   = truncate(t.summary, 300);
		var phase     = formatPhase(t.phase);

		// ── Top badge row ─────────────────────────────────────────────────
		var badges = '';
		if (t.recruitment_status) badges += statusBadge(t.recruitment_status);
		if (phase)                 badges += '<span class="badge-phase">' + escHtml(phase) + '</span>';

		// ── Meta row ──────────────────────────────────────────────────────
		var metaItems = [];
		if (t.primary_sponsor) metaItems.push({ label: 'Sponsor',    value: escHtml(t.primary_sponsor) });
		if (t.target_size)     metaItems.push({ label: 'Enrollment', value: escHtml(t.target_size) + ' participants' });
		if (t.countries)       metaItems.push({ label: 'Countries',  value: escHtml(t.countries) });
		var updDate = t.date_registration || t.published_date;
		if (updDate)           metaItems.push({ label: 'Updated',    value: escHtml(formatShortDate(updDate)) });

		var metaHtml = metaItems.map(function (m) {
			return '<div class="trial-meta-item">' +
				'<span class="meta-label">' + escHtml(m.label) + '</span>' +
				'<span class="meta-value">' + m.value + '</span>' +
			'</div>';
		}).join('');

		return '<article class="trial-card">' +
			(badges ? '<div class="d-flex flex-wrap gap-2 mb-3">' + badges + '</div>' : '') +
			'<div class="trial-title">' +
				'<a href="' + escHtml(t.link) + '" target="_blank" rel="noopener noreferrer">' + escHtml(t.title) + '</a>' +
			'</div>' +
			(displayId ? '<div class="trial-nct">' + escHtml(displayId) + '</div>' : '') +
			(summary   ? '<p class="trial-description">' + escHtml(summary) + '</p>' : '') +
			(metaItems.length ? '<div class="trial-meta-row">' + metaHtml + '</div>' : '') +
			(t.link ? '<a href="' + escHtml(t.link) + '" target="_blank" rel="noopener noreferrer" class="btn-outline-teal">' + viewLabel(t.link) + '</a>' : '') +
		'</article>';
	}

	// ── Render states ─────────────────────────────────────────────────────────
	function renderLoading() {
		listEl.innerHTML =
			'<div class="paper-loading">' +
				'<div class="paper-loading-spinner"></div>' +
				'<p>Loading trials\u2026</p>' +
			'</div>';
		if (noResults) noResults.style.display = 'none';
	}

	function renderEmpty() {
		listEl.innerHTML = '';
		if (noResults) noResults.style.display = 'block';
		if (paginationEl) paginationEl.style.display = 'none';
		if (resultsCountEl) resultsCountEl.innerHTML = '<strong>0</strong> trials found';
		return; // pagination already hidden above
	}

	function renderError() {
		listEl.innerHTML =
			'<div class="paper-empty">' +
				'<p>Could not load trials. Please try again later.</p>' +
			'</div>';
	}

	function renderCards(results) {
		if (!results.length) { renderEmpty(); return; }
		listEl.innerHTML = results.map(buildCard).join('');
		if (noResults) noResults.style.display = 'none';
	}

	// ── Stats bar ─────────────────────────────────────────────────────────────
	function updateStats(stats) {
		function setEl(id, val) {
			var el = document.getElementById(id);
			if (el) el.textContent = (val != null) ? Number(val).toLocaleString() : '\u2014';
		}
		setEl('stat-recruiting', stats.recruiting);
		setEl('stat-active',     stats.active_not_recruiting);
		setEl('stat-completed',  stats.completed);
		setEl('stat-total',      stats.total);
	}

	// Fetches aggregate stats with NO filters (just team + subject) so the stats
	// bar always reflects the full counts regardless of what filters are active.
	function fetchStats() {
		var statsCacheKey = 'brTrialsStats:' + teamId + ':' + subjectId;
		var cached = getCached(statsCacheKey);
		if (cached) { updateStats(cached); return; }

		var url = new URL(endpoint);
		url.searchParams.set('format',     'json');
		url.searchParams.set('team_id',    teamId);
		url.searchParams.set('subject_id', subjectId);
		url.searchParams.set('page_size',  '1');

		fetch(url.toString())
			.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
			.then(function (data) {
				if (!data.stats) return;
				setCached(statsCacheKey, data.stats);
				updateStats(data.stats);
			})
			.catch(function () { /* silently skip */ });
	}

	// ── Pagination ────────────────────────────────────────────────────────────
	function updatePagination(currentPage, totalPages, total) {
		state.page       = currentPage;
		state.totalPages = totalPages;
		state.total      = total;

		if (resultsCountEl) {
			resultsCountEl.innerHTML =
				'<strong>' + total.toLocaleString() + '</strong> trial' + (total !== 1 ? 's' : '') + ' found';
		}

		if (!paginationEl) return;

		if (prevBtn) prevBtn.disabled = currentPage <= 1;
		if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

		// Remove old numbered buttons
		paginationEl.querySelectorAll('.page-num').forEach(function(el) { el.remove(); });

		if (totalPages > 1) {
			var start = Math.max(1, currentPage - 2);
			var end   = Math.min(totalPages, currentPage + 2);
			var fragment = document.createDocumentFragment();
			for (var p = start; p <= end; p++) {
				var btn = document.createElement('button');
				btn.className = 'pagination-btn page-num' + (p === currentPage ? ' active' : '');
				btn.textContent = String(p);
				btn.dataset.page = String(p);
				if (p === currentPage) btn.disabled = true;
				fragment.appendChild(btn);
			}
			paginationEl.insertBefore(fragment, nextBtn || null);
			paginationEl.style.display = 'flex';
		} else {
			paginationEl.style.display = 'none';
		}
	}

	// ── Fetch ─────────────────────────────────────────────────────────────────
	function fetchPage(page) {
		var url = buildURL(page);
		var cacheKey = 'brTrialsFeed:' + url;
		var cached = getCached(cacheKey);
		if (cached) {
			renderCards(cached.results || []);
			updatePagination(cached.current_page || page, cached.total_pages || 1, cached.count || 0);
			return;
		}

		renderLoading();
		fetch(url)
			.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
			.then(function (data) {
				setCached(cacheKey, data);
				renderCards(data.results || []);
				updatePagination(data.current_page || page, data.total_pages || 1, data.count || 0);
			})
			.catch(renderError);
	}

	// ── Event listeners ───────────────────────────────────────────────────────
	if (searchInput) {
		searchInput.addEventListener('input', debounce(function () {
			state.keyword = searchInput.value.trim();
			fetchPage(1);
		}, 400));
	}

	if (filterPhase) {
		filterPhase.addEventListener('change', function () {
			state.phase = this.value;
			fetchPage(1);
		});
	}

	if (filterStatus) {
		filterStatus.addEventListener('change', function () {
			state.status = this.value;
			fetchPage(1);
		});
	}

	function resetAll() {
		state.keyword = '';
		state.phase   = '';
		state.status  = '';
		if (searchInput)  searchInput.value  = '';
		if (filterPhase)  filterPhase.value  = '';
		if (filterStatus) filterStatus.value = '';
		fetchPage(1);
	}

	if (resetBtn) resetBtn.addEventListener('click', resetAll);
	if (clearBtn) clearBtn.addEventListener('click', resetAll);

	if (prevBtn) {
		prevBtn.addEventListener('click', function () {
			if (state.page > 1) fetchPage(state.page - 1);
		});
	}

	if (nextBtn) {
		nextBtn.addEventListener('click', function () {
			if (state.page < state.totalPages) fetchPage(state.page + 1);
		});
	}

	document.addEventListener('click', function (e) {
		var btn = e.target.closest && e.target.closest('.pagination-btn.page-num');
		if (btn && !btn.disabled) fetchPage(parseInt(btn.dataset.page, 10));
	});

	// ── Init ──────────────────────────────────────────────────────────────────
	if (filterStatus && state.status) filterStatus.value = state.status;
	if (filterPhase  && state.phase)  filterPhase.value  = state.phase;
	fetchStats(); // always fetches unfiltered aggregate stats
	fetchPage(1);

})();
