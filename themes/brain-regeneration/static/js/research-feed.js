/* research-feed.js — Article feed for research area pages
 * Fetches from api.gregory-ms.com/articles/ and renders paper cards.
 * Supports keyword search (server-side), client-side date filtering,
 * client-side sort, pagination, and CSV download.
 */
(function () {
	'use strict';

	var container = document.getElementById('paper-list');
	if (!container) return;

	var endpoint  = container.dataset.endpoint || (window.__API_BASE__ || 'https://api.gregory-ms.com') + '/articles/';
	var teamId    = container.dataset.teamId    || '';
	var subjectId = container.dataset.subjectId || '';

	// ── UI control references ────────────────────────────────────────────────
	var sortSelect   = document.getElementById('sort-select');
	var dateFrom     = document.getElementById('date-from');
	var dateTo       = document.getElementById('date-to');
	var keywordInput = document.getElementById('keyword-search');
	var prevBtn      = document.getElementById('prev-btn');
	var nextBtn      = document.getElementById('next-btn');
	var currentPageEl = document.getElementById('current-page');
	var downloadToggle = document.getElementById('download-toggle');

	// ── Mutable state ────────────────────────────────────────────────────────
	var state = {
		page:       1,
		totalPages: 1,
		sort:       'date',
		keyword:    '',
		dateFrom:   '',
		dateTo:     '',
		results:    [],  // current page from API (for CSV + client-side ops)
	};

	// ── Cache ───────────────────────────────────────────────────────────────

	var FEED_CACHE_TTL = 60 * 60 * 1000; // 1 hour

	function getCached(url) {
		try {
			var raw = localStorage.getItem('brFeed:' + url);
			if (!raw) return null;
			var entry = JSON.parse(raw);
			if (Date.now() - entry.ts > FEED_CACHE_TTL) return null;
			return entry.data;
		} catch (e) { return null; }
	}

	function setCached(url, data) {
		try {
			localStorage.setItem('brFeed:' + url, JSON.stringify({ ts: Date.now(), data: data }));
		} catch (e) { /* quota exceeded or private mode — ignore */ }
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

	function formatDate(iso) {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString('en-GB', {
			year: 'numeric', month: 'short', day: 'numeric'
		});
	}

	function formatAuthors(authors) {
		if (!authors || !authors.length) return '';
		var names = authors.map(function (a) { return a.full_name; });
		return names.length > 3 ? names.slice(0, 3).join(', ') + ' et al.' : names.join(', ');
	}

	function withinDateRange(isoDate) {
		if (!state.dateFrom && !state.dateTo) return true;
		var d = new Date(isoDate);
		if (state.dateFrom && d < new Date(state.dateFrom)) return false;
		if (state.dateTo   && d > new Date(state.dateTo + 'T23:59:59Z')) return false;
		return true;
	}

	// ── API URL builder ──────────────────────────────────────────────────────

	function buildURL(page) {
		var url = new URL(endpoint);
		url.searchParams.set('format', 'json');
		if (teamId)       url.searchParams.set('team_id',    teamId);
		if (subjectId)    url.searchParams.set('subject_id', subjectId);
		if (state.keyword) url.searchParams.set('search',    state.keyword);
		url.searchParams.set('page', String(page));
		return url.toString();
	}

	// ── Render helpers ───────────────────────────────────────────────────────

	function renderLoading() {
		container.innerHTML =
			'<div class="paper-loading">' +
				'<div class="paper-loading-spinner"></div>' +
				'<p>Loading articles\u2026</p>' +
			'</div>';
	}

	function renderEmpty() {
		container.innerHTML =
			'<div class="paper-empty">' +
				'<p>No articles found for the current filters.</p>' +
			'</div>';
	}

	function renderError() {
		container.innerHTML =
			'<div class="paper-empty">' +
				'<p>Could not load articles. Please try again later.</p>' +
			'</div>';
	}

	function truncate(str, limit) {
		if (!str || str.length <= limit) return str;
		return str.slice(0, str.lastIndexOf(' ', limit) || limit) + '\u2026';
	}

	function buildCard(a) {
		var authors  = formatAuthors(a.authors);
		var date     = formatDate(a.published_date);
		var journal  = a.container_title || '';
		var takeaway = a.takeaways
			? '<p class="paper-card-takeaway">' + escHtml(truncate(a.takeaways, 200)) + '</p>'
			: '';
		var accessBadge = a.access === 'open'
			? '<span class="access-badge open">Open Access</span>'
			: '<span class="access-badge restricted">Subscription</span>';
		var doiLink = a.doi
			? '<a class="paper-card-doi" href="https://doi.org/' + escHtml(a.doi) + '" target="_blank" rel="noopener noreferrer">DOI</a>'
			: '';

		return '<article class="paper-card">' +
			'<div class="paper-card-title">' +
				'<a href="' + escHtml(a.link) + '" target="_blank" rel="noopener noreferrer">' +
					escHtml(a.title) +
				'</a>' +
			'</div>' +
			(authors ? '<div class="paper-card-authors">' + escHtml(authors) + '</div>' : '') +
			takeaway +
			'<div class="paper-card-meta">' +
				(date    ? '<span class="paper-card-date">' + escHtml(date) + '</span>' : '') +
				(journal ? '<span class="paper-card-journal">' + escHtml(journal) + '</span>' : '') +
				accessBadge +
				doiLink +
			'</div>' +
		'</article>';
	}

	function applyClientFilters(articles) {
		var filtered = articles.filter(function (a) {
			return withinDateRange(a.published_date);
		});

		if (state.sort === 'relevance') {
			filtered.sort(function (a, b) {
				var sa = (a.article_subject_relevances && a.article_subject_relevances[0])
					? (a.article_subject_relevances[0].score || 0) : 0;
				var sb = (b.article_subject_relevances && b.article_subject_relevances[0])
					? (b.article_subject_relevances[0].score || 0) : 0;
				return sb - sa;
			});
		}

		return filtered;
	}

	function renderCards(articles) {
		var filtered = applyClientFilters(articles);
		if (!filtered.length) { renderEmpty(); return; }
		container.innerHTML = filtered.map(buildCard).join('');
	}

	// ── Pagination UI ────────────────────────────────────────────────────────

	function updatePagination(currentPage, totalPages) {
		state.page       = currentPage;
		state.totalPages = totalPages;

		if (currentPageEl) currentPageEl.textContent = currentPage;
		if (prevBtn) prevBtn.disabled = currentPage <= 1;
		if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

		var paginationEl = document.getElementById('pagination');
		if (!paginationEl) return;

		// Remove previously rendered numbered buttons
		paginationEl.querySelectorAll('.pagination-btn.page-num').forEach(function (el) {
			el.remove();
		});

		var start = Math.max(1, currentPage - 2);
		var end   = Math.min(totalPages, currentPage + 2);

		// Build buttons in order, then insert them all before nextBtn
		var fragment = document.createDocumentFragment();
		for (var p = start; p <= end; p++) {
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'pagination-btn page-num' + (p === currentPage ? ' active' : '');
			btn.textContent = String(p);
			btn.dataset.page = String(p);
			if (p === currentPage) btn.disabled = true;
			fragment.appendChild(btn);
		}
		paginationEl.insertBefore(fragment, nextBtn || null);
	}

	// ── Fetch & render ───────────────────────────────────────────────────────

	function fetchPage(page) {
		var url = buildURL(page);
		var cached = getCached(url);
		if (cached) {
			state.results = cached.results || [];
			renderCards(state.results);
			updatePagination(
				cached.current_page || page,
				cached.total_pages  || 1
			);
			return;
		}
		renderLoading();
		var target = document.querySelector('.feed-header') || container;
		target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		fetch(url)
			.then(function (r) {
				if (!r.ok) throw new Error('HTTP ' + r.status);
				return r.json();
			})
			.then(function (data) {
				setCached(url, data);
				state.results = data.results || [];
				renderCards(state.results);
				updatePagination(
					data.current_page || page,
					data.total_pages  || 1
				);
			})
			.catch(renderError);
	}

	// ── CSV download ─────────────────────────────────────────────────────────

	function buildCSVURL(allResults) {
		var url = new URL(endpoint);
		url.searchParams.set('format', 'csv');
		if (teamId)        url.searchParams.set('team_id',    teamId);
		if (subjectId)     url.searchParams.set('subject_id', subjectId);
		if (state.keyword) url.searchParams.set('search',     state.keyword);
		if (allResults) {
			url.searchParams.set('all_results', 'true');
		} else {
			url.searchParams.set('page', String(state.page));
		}
		return url.toString();
	}

	function triggerDownload(allResults) {
		var a = document.createElement('a');
		a.href     = buildCSVURL(allResults);
		a.download = 'research-articles.csv';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	// ── Event listeners ──────────────────────────────────────────────────────

	if (sortSelect) {
		sortSelect.addEventListener('change', function () {
			state.sort = this.value;
			renderCards(state.results);
		});
	}

	if (dateFrom) {
		dateFrom.addEventListener('change', function () {
			state.dateFrom = this.value;
			renderCards(state.results);
		});
	}

	if (dateTo) {
		dateTo.addEventListener('change', function () {
			state.dateTo = this.value;
			renderCards(state.results);
		});
	}

	if (keywordInput) {
		keywordInput.addEventListener('input', debounce(function () {
			state.keyword = keywordInput.value.trim();
			fetchPage(1);
		}, 400));
	}

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

	// ── Download dropdown ─────────────────────────────────────────────────────
	if (downloadToggle) {
		var downloadMenu = downloadToggle.parentElement.querySelector('.download-menu');

		downloadToggle.addEventListener('click', function (e) {
			e.stopPropagation();
			var open = downloadToggle.getAttribute('aria-expanded') === 'true';
			downloadToggle.setAttribute('aria-expanded', String(!open));
			downloadMenu.classList.toggle('is-open', !open);
		});

		downloadMenu.addEventListener('click', function (e) {
			var btn = e.target.closest('.download-option');
			if (!btn) return;
			triggerDownload(btn.dataset.scope === 'all');
			downloadToggle.setAttribute('aria-expanded', 'false');
			downloadMenu.classList.remove('is-open');
		});

		document.addEventListener('click', function () {
			downloadToggle.setAttribute('aria-expanded', 'false');
			downloadMenu.classList.remove('is-open');
		});
	}

	// ── Init ─────────────────────────────────────────────────────────────────
	fetchPage(1);

})();
