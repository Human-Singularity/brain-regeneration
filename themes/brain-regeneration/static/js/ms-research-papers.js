/* ms-research-papers.js — Research papers listing for conditions pages.
 * Fetches from api.gregory-ms.com/articles/ and /articles/search/.
 * Supports: category filter (server-side), text search (server-side),
 * client-side sort, URL state, ML/expert badges, CSV download, pagination.
 */
(function () {
	'use strict';

	var mount = document.getElementById('papers-list');
	if (!mount) return;

	var apiBase   = mount.dataset.apiBase   || 'https://api.gregory-ms.com';
	var teamId    = mount.dataset.teamId    || '';
	var subjectId = mount.dataset.subjectId || '';

	var articlesEndpoint = apiBase.replace(/\/$/, '') + '/articles/';
	var searchEndpoint   = apiBase.replace(/\/$/, '') + '/articles/search/';

	// ── UI references ────────────────────────────────────────────────────────
	var searchInput      = document.getElementById('papers-search-input');
	var categorySelect   = document.getElementById('papers-category-select');
	var sortSelect       = document.getElementById('papers-sort-select');
	var searchBtn        = document.getElementById('papers-search-btn');
	var resetBtn         = document.getElementById('papers-reset-btn');
	var resultCount      = document.getElementById('papers-result-count');
	var downloadToggle   = document.getElementById('papers-download-toggle');
	var categoryPanel    = document.getElementById('category-panel');
	var categoryPanelName = document.getElementById('category-panel-name');
	var categoryPanelDesc = document.getElementById('category-panel-description');

	var firstBtn         = document.getElementById('papers-first-btn');
	var prevBtn          = document.getElementById('papers-prev-btn');
	var nextBtn          = document.getElementById('papers-next-btn');
	var lastBtn          = document.getElementById('papers-last-btn');
	var paginationNums   = document.getElementById('papers-pagination-numbers');

	// ── State ─────────────────────────────────────────────────────────────
	var state = {
		page:        1,
		totalPages:  1,
		totalCount:  0,
		pageSize:    10,
		keyword:     '',
		category:    '',   // slug
		sort:        'date',
		results:     [],   // current page articles
		categories:  [],   // fetched once
	};

	// ── Cache ─────────────────────────────────────────────────────────────
	var CACHE_TTL = 60 * 60 * 1000; // 1 hour

	function getCached(url) {
		try {
			var raw = sessionStorage.getItem('brPapers:' + url);
			if (!raw) return null;
			var entry = JSON.parse(raw);
			if (Date.now() - entry.ts > CACHE_TTL) return null;
			return entry.data;
		} catch (e) { return null; }
	}

	function setCached(url, data) {
		try {
			sessionStorage.setItem('brPapers:' + url, JSON.stringify({ ts: Date.now(), data: data }));
		} catch (e) { /* quota exceeded — ignore */ }
	}

	// ── Helpers ───────────────────────────────────────────────────────────

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
		return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
	}

	function truncate(str, limit) {
		if (!str || str.length <= limit) return str;
		var cut = str.lastIndexOf(' ', limit);
		return str.slice(0, cut > 0 ? cut : limit) + '\u2026';
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

	function slugify(str) {
		return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
	}

	function todayISO() {
		return new Date().toISOString().slice(0, 10);
	}

	// ── URL state ──────────────────────────────────────────────────────────

	function readURL() {
		var params = new URLSearchParams(window.location.search);
		state.keyword  = params.get('q')        || '';
		state.category = params.get('category') || '';
		state.page     = parseInt(params.get('page') || '1', 10) || 1;
	}

	function writeURL(push) {
		var params = new URLSearchParams();
		if (state.keyword)  params.set('q',        state.keyword);
		if (state.category) params.set('category', state.category);
		if (state.page > 1) params.set('page',     String(state.page));
		var search = params.toString() ? '?' + params.toString() : window.location.pathname;
		var url = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
		if (push) {
			history.pushState(null, '', url);
		} else {
			history.replaceState(null, '', url);
		}
	}

	window.addEventListener('popstate', function () {
		readURL();
		syncUIFromState();
		fetchPage(state.page, false);
	});

	function syncUIFromState() {
		if (searchInput)    searchInput.value    = state.keyword;
		if (categorySelect) categorySelect.value = state.category;
		if (sortSelect)     sortSelect.value     = state.sort;
		renderCategoryPanel();
	}

	// ── API URL builders ──────────────────────────────────────────────────

	function sortToOrdering(sort) {
		// 'relevance' is client-side re-sort; server always returns by date first
		return '-published_date';
	}

	function buildURL(page) {
		var base = state.keyword ? searchEndpoint : articlesEndpoint;
		var url  = new URL(base);
		url.searchParams.set('format',     'json');
		if (teamId)         url.searchParams.set('team_id',       teamId);
		if (subjectId)      url.searchParams.set('subject_id',    subjectId);
		if (state.keyword)  url.searchParams.set('search',        state.keyword);
		if (state.category) url.searchParams.set('category_slug', state.category);
		// Relevance filter only applies when browsing without a category
		if (!state.category) url.searchParams.set('relevant', 'true');
		url.searchParams.set('ordering', sortToOrdering(state.sort));
		url.searchParams.set('page', String(page));
		return url.toString();
	}

	function buildCSVAllURL() {
		var base = state.keyword ? searchEndpoint : articlesEndpoint;
		var url  = new URL(base);
		url.searchParams.set('format',      'csv');
		url.searchParams.set('all_results', 'true');
		if (teamId)         url.searchParams.set('team_id',       teamId);
		if (subjectId)      url.searchParams.set('subject_id',    subjectId);
		if (state.keyword)  url.searchParams.set('search',        state.keyword);
		if (state.category) url.searchParams.set('category_slug', state.category);
		if (!state.category) url.searchParams.set('relevant', 'true');
		url.searchParams.set('ordering', sortToOrdering(state.sort));
		return url.toString();
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
		mount.innerHTML = '<div class="paper-empty"><p>No papers match these filters. Try removing one.</p></div>';
	}

	function renderError() {
		mount.innerHTML = '<div class="paper-empty"><p>We could not load the papers. <button class="btn-outline-teal" id="papers-retry-btn" style="margin-left:8px;padding:4px 12px;font-size:14px;">Try again</button></p></div>';
		var retryBtn = document.getElementById('papers-retry-btn');
		if (retryBtn) retryBtn.addEventListener('click', function () { fetchPage(state.page, false); });
	}

	function buildMLBadge(pred) {
		var score = pred.probability_score || 0;
		var relevant = pred.predicted_relevant;
		var pct = Math.round(score * 100);
		var cls = 'muted';
		if (relevant && score >= 0.8) cls = 'success';
		else if (relevant && score >= 0.5) cls = 'warning';
		var algo = escHtml(pred.algorithm || 'ML');
		var tooltip = algo + ' predicted ' + (relevant ? 'relevant' : 'not relevant') + ' with ' + pct + '% confidence';
		return '<span class="ml-badge ' + cls + '" title="' + tooltip + '">' + algo + ' ' + pct + '%</span>';
	}

	function buildExpertBadge(relevances) {
		if (!relevances || !relevances.length) return '';
		var sid = parseInt(subjectId, 10);
		var found = relevances.some(function (r) {
			return r.subject && r.subject.id === sid && r.is_relevant === true;
		});
		if (!found) return '';
		return '<span class="expert-badge" title="Marked relevant by a curator">Curator-selected</span>';
	}

	function buildCard(a) {
		var authors  = formatAuthors(a.authors);
		var date     = formatDate(a.published_date);
		var journal  = a.container_title || '';
		var abstract = truncate(stripHtml(a.summary || ''), 200);
		var accessBadge = a.access === 'open'
			? '<span class="access-badge open">Open Access</span>'
			: '<span class="access-badge restricted">Subscription</span>';
		var doiLink = a.doi
			? '<a class="paper-card-doi" href="https://doi.org/' + escHtml(a.doi) + '" target="_blank" rel="noopener noreferrer">DOI</a>'
			: '';

		var mlBadges = '';
		if (a.ml_predictions && a.ml_predictions.length) {
			// Keep only the most recent prediction per algorithm.
			// The API returns entries with an `id` field; higher id = more recent run.
			var latestByAlgo = {};
			a.ml_predictions.forEach(function (pred) {
				var algo = pred.algorithm || 'ML';
				var existing = latestByAlgo[algo];
				if (!existing || (pred.id || 0) > (existing.id || 0)) {
					latestByAlgo[algo] = pred;
				}
			});
			mlBadges = Object.keys(latestByAlgo).map(function (algo) {
				return buildMLBadge(latestByAlgo[algo]);
			}).join(' ');
		}
		var expertBadge = buildExpertBadge(a.article_subject_relevances);

		var categories = '';
		if (a.team_categories && a.team_categories.length) {
			categories = '<div class="paper-card-categories">' +
				a.team_categories.map(function (c) {
					return '<span class="condition-tag" style="font-size:12px;padding:2px 8px;">' + escHtml(c.category_name || c.slug || c) + '</span>';
				}).join('') +
			'</div>';
		}

		return '<article class="paper-card">' +
			'<div class="paper-card-title">' +
				'<a href="' + escHtml(a.link) + '" target="_blank" rel="noopener noreferrer">' + escHtml(a.title) + '</a>' +
				(expertBadge ? ' ' + expertBadge : '') +
				(mlBadges    ? ' ' + mlBadges    : '') +
			'</div>' +
			(authors  ? '<div class="paper-card-authors">'  + escHtml(authors)  + '</div>' : '') +
			(abstract ? '<div class="paper-card-abstract">' + escHtml(abstract) + '</div>' : '') +
			'<div class="paper-card-meta">' +
				(date    ? '<span class="paper-card-date">'    + escHtml(date)    + '</span>' : '') +
				(journal ? '<span class="paper-card-journal">' + escHtml(journal) + '</span>' : '') +
				accessBadge +
				doiLink +
			'</div>' +
			categories +
		'</article>';
	}

	function applySort(articles) {
		if (state.sort !== 'relevance') return articles;
		return articles.slice().sort(function (a, b) {
			var sa = (a.article_subject_relevances && a.article_subject_relevances[0])
				? (a.article_subject_relevances[0].score || 0) : 0;
			var sb = (b.article_subject_relevances && b.article_subject_relevances[0])
				? (b.article_subject_relevances[0].score || 0) : 0;
			return sb - sa;
		});
	}

	function renderCards(articles) {
		var sorted = applySort(articles);
		if (!sorted.length) { renderEmpty(); return; }
		mount.innerHTML = sorted.map(buildCard).join('');
	}

	function renderCategoryPanel() {
		if (!state.category || !categoryPanel) return;
		var cat = state.categories.find(function (c) { return c.slug === state.category; });
		if (!cat) { categoryPanel.hidden = true; return; }
		if (categoryPanelName) categoryPanelName.textContent = cat.name;
		
		// Fetch category description from API
		if (categoryPanelDesc) {
			categoryPanelDesc.textContent = 'Loading...';
			var url = new URL(apiBase.replace(/\/$/, '') + '/categories/');
			url.searchParams.set('team_id', teamId);
			url.searchParams.set('slug', state.category);
			url.searchParams.set('include_authors', 'false');
			
			fetch(url.toString())
				.then(function (r) { return r.json(); })
				.then(function (data) {
					var results = Array.isArray(data) ? data : (data.results || []);
					var category = results[0];
					if (category && category.category_description) {
						categoryPanelDesc.textContent = category.category_description;
					} else {
						categoryPanelDesc.textContent = '';
					}
				})
				.catch(function () {
					categoryPanelDesc.textContent = '';
				});
		}
		
		categoryPanel.hidden = false;
	}

	function hideCategoryPanel() {
		if (categoryPanel) categoryPanel.hidden = true;
	}

	// ── Result counter ─────────────────────────────────────────────────────

	function updateCounter(count) {
		if (!resultCount) return;
		resultCount.textContent = count.toLocaleString('en') + ' paper' + (count !== 1 ? 's' : '');
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

	// ── Fetch ──────────────────────────────────────────────────────────────

	function fetchPage(page, push) {
		var url = buildURL(page);
		var cached = getCached(url);
		if (cached) {
			state.results = cached.results || [];
			state.pageSize = state.results.length || state.pageSize;
			renderCards(state.results);
			updatePagination(cached.current_page || page, cached.total_pages || 1);
			updateCounter(cached.count || 0);
			return;
		}

		renderSkeleton();
		var scrollTarget = document.getElementById('papers-filters') || mount;
		scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });

		fetch(url)
			.then(function (r) {
				if (!r.ok) throw new Error('HTTP ' + r.status);
				return r.json();
			})
			.then(function (data) {
				setCached(url, data);
				state.results  = data.results || [];
				state.pageSize = state.results.length || state.pageSize;
				state.totalCount = data.count || 0;

				var totalPages = data.total_pages
					|| (data.count && state.results.length
						? Math.ceil(data.count / state.results.length)
						: 1);

				renderCards(state.results);
				updatePagination(data.current_page || page, totalPages);
				updateCounter(data.count || 0);
				writeURL(push === true);
			})
			.catch(renderError);
	}

	// ── Categories ─────────────────────────────────────────────────────────
	// Categories are defined in the page frontmatter and passed via data-categories.

	function populateCategorySelect() {
		if (!categorySelect) return;
		// Remove any previously added options (re-init guard)
		while (categorySelect.options.length > 1) categorySelect.remove(1);

		state.categories.forEach(function (c) {
			var opt = document.createElement('option');
			opt.value       = c.slug;
			opt.textContent = c.name;
			categorySelect.appendChild(opt);
		});

		// Restore URL state value
		if (state.category) {
			categorySelect.value = state.category;
			renderCategoryPanel();
		}
	}

	// ── CSV ────────────────────────────────────────────────────────────────

	function csvField(val) {
		var s = String(val == null ? '' : val);
		if (s.search(/[",\r\n]/) >= 0) {
			return '"' + s.replace(/"/g, '""') + '"';
		}
		return s;
	}

	function buildCSVFilename() {
		var parts = ['brain-regeneration', 'papers', todayISO()];
		if (state.page > 1 && !arguments[0]) parts.push('page-' + state.page);
		if (state.keyword)  parts.push('q-' + slugify(state.keyword));
		if (state.category) parts.push('cat-' + state.category);
		return parts.join('-') + '.csv';
	}

	function articleToCSVRow(a) {
		var authors    = (a.authors || []).map(function (x) { return x.full_name; }).join('; ');
		var date       = (a.published_date || '').slice(0, 10);
		var abstract   = stripHtml(a.summary || '');
		var categories = (a.team_categories || []).map(function (c) { return c.category_slug || c.slug || c; }).join('; ');
		return [
			a.article_id,
			a.title,
			authors,
			date,
			a.container_title || '',
			a.link || '',
			abstract,
			categories,
		].map(csvField).join(',');
	}

	var CSV_HEADER = 'article_id,title,authors,published_date,journal,link,abstract,categories';

	function downloadPageCSV() {
		var rows = [CSV_HEADER].concat(state.results.map(articleToCSVRow));
		var bom  = '\uFEFF';
		var csv  = bom + rows.join('\r\n');
		var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		var a    = document.createElement('a');
		a.href     = URL.createObjectURL(blob);
		a.download = buildCSVFilename();
		document.body.appendChild(a);
		a.click();
		setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 200);
	}

	function downloadAllCSV() {
		var a    = document.createElement('a');
		a.href     = buildCSVAllURL();
		a.download = buildCSVFilename(true);
		document.body.appendChild(a);
		a.click();
		setTimeout(function () { document.body.removeChild(a); }, 200);
	}

	// ── Event listeners ────────────────────────────────────────────────────

	function doSearch() {
		state.keyword  = searchInput ? searchInput.value.trim() : '';
		state.category = categorySelect ? categorySelect.value : '';
		state.page     = 1;
		renderCategoryPanel();
		if (!state.category) hideCategoryPanel();
		fetchPage(1, false);
	}

	if (searchBtn) {
		searchBtn.addEventListener('click', doSearch);
	}

	var filterForm = document.getElementById('papers-filter-form');
	if (filterForm) {
		filterForm.addEventListener('submit', function (e) {
			e.preventDefault();
			doSearch();
		});
	}

	if (categorySelect) {
		categorySelect.addEventListener('change', function () {
			state.category = this.value;
			state.page     = 1;
			if (state.category) {
				renderCategoryPanel();
			} else {
				hideCategoryPanel();
			}
			fetchPage(1, false);
		});
	}

	if (sortSelect) {
		sortSelect.addEventListener('change', function () {
			state.sort = this.value;
			state.page = 1;
			// 'date' sort is server-side; 'relevance' re-sorts current page client-side
			if (state.sort === 'relevance') {
				renderCards(state.results);
			} else {
				fetchPage(1, false);
			}
		});
	}

	if (resetBtn) {
		resetBtn.addEventListener('click', function () {
			state.keyword  = '';
			state.category = '';
			state.page     = 1;
			state.sort     = 'date';
			if (searchInput)    searchInput.value    = '';
			if (categorySelect) categorySelect.value = '';
			if (sortSelect)     sortSelect.value     = 'date';
			hideCategoryPanel();
			fetchPage(1, false);
		});
	}

	if (firstBtn) firstBtn.addEventListener('click', function () { if (state.page > 1) fetchPage(1, true); });
	if (prevBtn)  prevBtn.addEventListener('click',  function () { if (state.page > 1) fetchPage(state.page - 1, true); });
	if (nextBtn)  nextBtn.addEventListener('click',  function () { if (state.page < state.totalPages) fetchPage(state.page + 1, true); });
	if (lastBtn)  lastBtn.addEventListener('click',  function () { if (state.page < state.totalPages) fetchPage(state.totalPages, true); });

	document.addEventListener('click', function (e) {
		var btn = e.target.closest && e.target.closest('.pagination-btn.page-num');
		if (btn && !btn.disabled) fetchPage(parseInt(btn.dataset.page, 10), true);
	});

	// Download dropdown
	if (downloadToggle) {
		var downloadMenu = downloadToggle.parentElement.querySelector('.download-menu');

		downloadToggle.addEventListener('click', function (e) {
			e.stopPropagation();
			var open = downloadToggle.getAttribute('aria-expanded') === 'true';
			downloadToggle.setAttribute('aria-expanded', String(!open));
			if (downloadMenu) downloadMenu.classList.toggle('is-open', !open);
		});

		if (downloadMenu) {
			downloadMenu.addEventListener('click', function (e) {
				var btn = e.target.closest('.download-option');
				if (!btn) return;
				if (btn.dataset.scope === 'all') {
					downloadAllCSV();
				} else {
					downloadPageCSV();
				}
				downloadToggle.setAttribute('aria-expanded', 'false');
				downloadMenu.classList.remove('is-open');
			});
		}

		document.addEventListener('click', function () {
			downloadToggle.setAttribute('aria-expanded', 'false');
			if (downloadMenu) downloadMenu.classList.remove('is-open');
		});
	}

	// ── Init ───────────────────────────────────────────────────────────────
	readURL();
	syncUIFromState();

	// Load categories from frontmatter (passed as JSON in data-categories)
	try {
		var rawCats = mount.dataset.categories;
		if (rawCats) {
			var parsedCats = JSON.parse(rawCats);
			state.categories = Array.isArray(parsedCats) ? parsedCats : [];
		}
	} catch (e) { /* non-fatal: select will just have no options */ }
	populateCategorySelect();

	fetchPage(state.page, false);

})();
