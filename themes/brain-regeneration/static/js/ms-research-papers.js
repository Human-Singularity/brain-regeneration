/* ms-research-papers.js — Research papers listing for conditions pages.
 * Fetches from api.gregory-ms.com/articles/ and /articles/search/.
 * Supports: category filter (server-side), text search (server-side),
 * client-side sort, URL state, ML/expert scores, CSV download, pagination.
 */
(function () {
	'use strict';

	var mount = document.getElementById('papers-list');
	if (!mount) return;

	var apiBase          = mount.dataset.apiBase          || 'https://api.gregory-ms.com';
	var teamId           = mount.dataset.teamId           || '';
	var subjectId        = mount.dataset.subjectId        || '';
	var requireRelevant  = mount.dataset.requireRelevant  !== 'false';

	var articlesEndpoint = apiBase.replace(/\/$/, '') + '/articles/';
	var searchEndpoint   = apiBase.replace(/\/$/, '') + '/articles/search/';

	// ── UI references ────────────────────────────────────────────────────────
	var searchInput      = document.getElementById('papers-search-input');
	var categorySelect   = document.getElementById('papers-category-select');
	var subjectsSelect   = document.getElementById('papers-subject-select');
	var sortSelect       = document.getElementById('papers-sort-select');
	var relevantSelect   = document.getElementById('papers-relevant-select');
	var searchBtn        = document.getElementById('papers-search-btn');
	var resetBtn         = document.getElementById('papers-reset-btn');
	var resultCount      = document.getElementById('papers-result-count');
	var downloadToggle   = document.getElementById('papers-download-toggle');
	var categoryPanel    = document.getElementById('category-panel');
	var categoryPanelName = document.getElementById('category-panel-name');
	var categoryPanelDesc = document.getElementById('category-panel-description');
	var categoryPanelSparkline = document.getElementById('category-panel-sparkline');

	var firstBtn         = document.getElementById('papers-first-btn');
	var prevBtn          = document.getElementById('papers-prev-btn');
	var nextBtn          = document.getElementById('papers-next-btn');
	var lastBtn          = document.getElementById('papers-last-btn');
	var paginationNums   = document.getElementById('papers-pagination-numbers');

	// ── State ─────────────────────────────────────────────────────────────
	var state = {
		page:               1,
		totalPages:         1,
		totalCount:         0,
		pageSize:           10,
		keyword:            '',
		category:           '',   // slug
		subjects:           '',   // comma-separated subject IDs (AND match)
		sort:               'date',
		relevant:           requireRelevant,  // true = curated feed, false = full feed
		hasClinicalTrials:  null, // null = no filter, true/false = has_clinical_trials param
		results:            [],   // current page articles
		categories:         [],   // flat list (populated from category_groups or data-categories)
		categoryGroups:     [],   // grouped list (populated from data-category-groups)
	};

	// ── Cache ─────────────────────────────────────────────────────────────
	var CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

	function getCached(url) {
		try {
			var raw = localStorage.getItem('brPapers:' + url);
			if (!raw) return null;
			var entry = JSON.parse(raw);
			if (Date.now() - entry.ts > CACHE_TTL) {
				localStorage.removeItem('brPapers:' + url);
				return null;
			}
			return entry.data;
		} catch (e) { return null; }
	}

	function setCached(url, data) {
		try {
			localStorage.setItem('brPapers:' + url, JSON.stringify({ ts: Date.now(), data: data }));
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

	function safeLink(url) {
		if (!url) return '#';
		try {
			var parsed = new URL(String(url));
			if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '#';
			return parsed.href;
		} catch (e) { return '#'; }
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
		state.keyword            = params.get('q')        || '';
		state.category           = params.get('category') || '';
		state.subjects           = params.get('subjects') || '';
		state.sort               = params.get('sort')     || 'date';
		state.relevant           = params.has('relevant') ? params.get('relevant') !== 'false' : requireRelevant;
		state.hasClinicalTrials  = params.has('has_clinical_trials') ? params.get('has_clinical_trials') !== 'false' : null;
		state.page               = parseInt(params.get('page') || '1', 10) || 1;
	}

	function writeURL(push) {
		var params = new URLSearchParams();
		if (state.keyword)                    params.set('q',                    state.keyword);
		if (state.category)                   params.set('category',             state.category);
		if (state.subjects)                   params.set('subjects',             state.subjects);
		params.set('sort',                    state.sort);
		params.set('relevant',                String(state.relevant));
		if (state.hasClinicalTrials !== null) params.set('has_clinical_trials',  String(state.hasClinicalTrials));
		if (state.page > 1)                   params.set('page',                 String(state.page));
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
		if (subjectsSelect) subjectsSelect.value = state.subjects;
		if (sortSelect)     sortSelect.value     = state.sort;
		if (relevantSelect) {
			if (state.hasClinicalTrials !== null) {
				relevantSelect.value = 'has_clinical_trials_' + (state.hasClinicalTrials ? 'true' : 'false');
			} else {
				relevantSelect.value = String(state.relevant);
			}
		}
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
		if (state.category) url.searchParams.set('category_id',   state.category);
		if (state.subjects) url.searchParams.set('subjects',      state.subjects);
		// Apply relevance filter based on current state (user-controlled)
		if (state.hasClinicalTrials !== null) {
			url.searchParams.set('has_clinical_trials', String(state.hasClinicalTrials));
		} else if (!state.category && state.relevant) {
			url.searchParams.set('relevant', 'true');
		}
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
		if (state.category) url.searchParams.set('category_id',   state.category);
		if (state.subjects) url.searchParams.set('subjects',      state.subjects);
		if (state.hasClinicalTrials !== null) {
			url.searchParams.set('has_clinical_trials', String(state.hasClinicalTrials));
		} else if (!state.category && state.relevant) {
			url.searchParams.set('relevant', 'true');
		}
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

		var mlScores = '';
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
			mlScores = Object.keys(latestByAlgo).map(function (algo) {
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

		var rawUrl = a.article_id ? '/articles/' + encodeURIComponent(a.article_id) + '/' : safeLink(a.link);
		return '<article class="paper-card">' +
			'<div class="paper-card-title">' +
				'<a href="' + escHtml(rawUrl) + '">' + escHtml(a.title) + '</a>' +
				(expertBadge ? ' ' + expertBadge : '') +
				(mlScores    ? ' ' + mlScores    : '') +
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

	// ── Sparklines ───────────────────────────────────────────────────────

	// Converts a sorted array of {month, count} into cumulative values mapped to SVG coords.
	function toCumulativePoints(counts, W, H, globalMax) {
		if (!counts || !counts.length) return [];
		var cum = 0;
		var values = counts.map(function (d) {
			cum += (d.count || 0);
			return cum;
		});
		var step = W / Math.max(values.length - 1, 1);
		return values.map(function (v, i) {
			return {
				x: Math.round(i * step),
				y: Math.round(H - (v / globalMax) * (H - 4)),
				v: v,
			};
		});
	}

	// Renders one SVG containing multiple series, each as a polyline.
	// series: [{counts, color, label}, ...]
	function makeSVGMultiSparkline(seriesList) {
		var W = 120, H = 40;
		// Compute global max across all series for a shared y-scale
		var globalMax = 1;
		seriesList.forEach(function (s) {
			if (!s.counts || !s.counts.length) return;
			var cum = 0;
			s.counts.forEach(function (d) {
				cum += (d.count || 0);
				if (cum > globalMax) globalMax = cum;
			});
		});

		var lines = seriesList.map(function (s) {
			var pts = toCumulativePoints(s.counts, W, H, globalMax);
			if (!pts.length) return '';
			var ptsStr = pts.map(function (p) { return p.x + ',' + p.y; }).join(' ');
			var last = pts[pts.length - 1];
			return '<polyline points="' + ptsStr + '" fill="none" stroke="' + s.color + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>' +
				'<circle cx="' + last.x + '" cy="' + last.y + '" r="2.5" fill="' + s.color + '"/>';
		}).join('');

		if (!lines) {
			return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><line x1="0" y1="' + H + '" x2="' + W + '" y2="' + H + '" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="2"/></svg>';
		}

		return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" overflow="visible">' + lines + '</svg>';
	}

	function last12Months(counts) {
		if (!counts || !counts.length) return counts;
		var sorted = counts.slice().sort(function (a, b) { return a.month < b.month ? -1 : a.month > b.month ? 1 : 0; });
		return sorted.slice(-12);
	}

	function buildSparklines(monthly) {
		var articleCounts = last12Months(monthly.monthly_article_counts || []);
		var trialCounts   = last12Months(monthly.monthly_trial_counts   || []);

		// Aggregate ML counts across all models by month
		var mlByMonth = {};
		var mlByModel = monthly.monthly_ml_article_counts_by_model || {};
		Object.keys(mlByModel).forEach(function (model) {
			(mlByModel[model] || []).forEach(function (d) {
				mlByMonth[d.month] = (mlByMonth[d.month] || 0) + (d.count || 0);
			});
		});
		var mlCounts = last12Months(Object.keys(mlByMonth).sort().map(function (m) {
			return { month: m, count: mlByMonth[m] };
		}));

		// Chart 1: Articles (teal) + ML predictions (muted) on shared y-scale
		var articlesChart = '<div class="sparkline-group">' +
			'<span class="sparkline-label">Papers &amp; Relevancy</span>' +
			makeSVGMultiSparkline([
				{ counts: articleCounts, color: 'var(--color-muted)'   },
				{ counts: mlCounts,      color: 'var(--color-accent)' },
			]) +
			'<div class="sparkline-legend">' +
				'<span class="sparkline-legend-dot" style="background:var(--color-muted);"></span>Papers ' +
				'<span class="sparkline-legend-dot" style="background:var(--color-accent);"></span>Relevancy' +
			'</div>' +
		'</div>';

		// Chart 2: Clinical trials
		var trialsChart = '<div class="sparkline-group">' +
			'<span class="sparkline-label">Trials</span>' +
			makeSVGMultiSparkline([
				{ counts: trialCounts, color: 'var(--color-primary)' },
			]) +
		'</div>';

		return articlesChart + trialsChart;
	}

	function renderCategoryPanel() {
		if (!state.category || !categoryPanel) return;
		var catId = state.category;
		var cat = state.categories.find(function (c) { return String(c.id) === catId; });
		if (!cat) { categoryPanel.hidden = true; return; }
		if (categoryPanelName) categoryPanelName.textContent = cat.name;
		
		// Fetch category description and monthly counts from API
		var url = new URL(apiBase.replace(/\/$/, '') + '/categories/');
		url.searchParams.set('team_id', teamId);
		url.searchParams.set('category_id', catId);
		url.searchParams.set('include_authors', 'false');
		url.searchParams.set('monthly_counts', 'true');
		
		var catCacheKey = url.toString();
		var catCached = getCached(catCacheKey);

		if (categoryPanelDesc) categoryPanelDesc.textContent = '';
		categoryPanel.hidden = false;

		function applyCategoryData(data) {
			var results = Array.isArray(data) ? data : (data.results || []);
			var match = results.find(function (c) {
				return String(c.id) === catId || String(c.category_id) === catId;
			});
			if (!match) {
				if (categoryPanelSparkline) categoryPanelSparkline.innerHTML = '';
				return;
			}
			if (categoryPanelDesc && match.category_description) {
				categoryPanelDesc.textContent = match.category_description;
			}
			if (categoryPanelSparkline) {
				categoryPanelSparkline.innerHTML = match.monthly_counts ? buildSparklines(match.monthly_counts) : '';
			}
		}

		if (catCached) {
			if (categoryPanelSparkline) categoryPanelSparkline.innerHTML = '';
			applyCategoryData(catCached);
		} else {
			if (categoryPanelSparkline) categoryPanelSparkline.innerHTML = '<div class="sparkline-loading"><span></span><span></span><span></span></div>';
			fetch(url.toString())
				.then(function (r) { return r.json(); })
				.then(function (data) {
					setCached(catCacheKey, data);
					applyCategoryData(data);
				})
				.catch(function () {
					if (categoryPanelDesc) categoryPanelDesc.textContent = '';
					if (categoryPanelSparkline) categoryPanelSparkline.innerHTML = '';
				});
		}
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
			writeURL(push === true);
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

		if (state.categoryGroups.length) {
			state.categoryGroups.forEach(function (g) {
				var group = document.createElement('optgroup');
				group.label = g.label;
				(g.categories || []).forEach(function (c) {
					if (!c.id) return;
					var opt = document.createElement('option');
					opt.value       = String(c.id);
					opt.textContent = c.name;
					group.appendChild(opt);
				});
				categorySelect.appendChild(group);
			});
		} else {
			state.categories.forEach(function (c) {
				if (!c.id) return; // skip entries without an id
				var opt = document.createElement('option');
				opt.value       = String(c.id);
				opt.textContent = c.name;
				categorySelect.appendChild(opt);
			});
		}

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
		state.keyword  = searchInput  ? searchInput.value.trim() : '';
		state.category = categorySelect ? categorySelect.value  : '';
		state.subjects = subjectsSelect ? subjectsSelect.value  : '';
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
				var panel = document.getElementById('category-panel');
				if (panel) {
					panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
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

	if (subjectsSelect) {
		subjectsSelect.addEventListener('change', function () {
			state.subjects = this.value;
			state.page     = 1;
			fetchPage(1, false);
		});
	}

	if (relevantSelect) {
		relevantSelect.addEventListener('change', function () {
			var val = this.value;
			if (val === 'has_clinical_trials_true') {
				state.hasClinicalTrials = true;
				state.relevant         = requireRelevant;
			} else if (val === 'has_clinical_trials_false') {
				state.hasClinicalTrials = false;
				state.relevant         = requireRelevant;
			} else {
				state.hasClinicalTrials = null;
				state.relevant         = val !== 'false';
			}
			state.page = 1;
			fetchPage(1, false);
		});
	}

	if (resetBtn) {
		resetBtn.addEventListener('click', function () {
			state.keyword           = '';
			state.category          = '';
			state.subjects          = '';
			state.page              = 1;
			state.sort              = 'date';
			state.relevant          = requireRelevant;
			state.hasClinicalTrials = null;
			if (searchInput)     searchInput.value     = '';
			if (categorySelect)  categorySelect.value  = '';
			if (subjectsSelect)  subjectsSelect.value  = '';
			if (sortSelect)      sortSelect.value      = 'date';
			if (relevantSelect)  relevantSelect.value  = String(requireRelevant);
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

	// Load categories from frontmatter (passed as JSON in data-categories / data-category-groups)
	try {
		var rawGroups = mount.dataset.categoryGroups;
		if (rawGroups) {
			var parsedGroups = JSON.parse(rawGroups);
			if (Array.isArray(parsedGroups) && parsedGroups.length) {
				state.categoryGroups = parsedGroups;
				// Derive flat list from groups so renderCategoryPanel() lookup by ID keeps working
				state.categories = parsedGroups.reduce(function (acc, g) {
					return acc.concat(Array.isArray(g.categories) ? g.categories : []);
				}, []);
			}
		}
		if (!state.categories.length) {
			var rawCats = mount.dataset.categories;
			if (rawCats) {
				var parsedCats = JSON.parse(rawCats);
				state.categories = Array.isArray(parsedCats) ? parsedCats : [];
			}
		}
	} catch (e) { /* non-fatal: select will just have no options */ }
	populateCategorySelect();

	fetchPage(state.page, false);

	// ── Mobile UI module ──────────────────────────────────────────────────
	// Wires the mobile search bar, filter token strip, and bottom sheet.
	// All state changes ultimately call the same fetchPage() used by the
	// desktop controls — no business logic is duplicated.

	var mobileBar        = document.getElementById('papers-mobile-bar');
	if (!mobileBar) return; // mobile elements not present — skip

	var mobileSearchInput = document.getElementById('papers-mobile-search');
	var mobileClearBtn    = document.getElementById('papers-mobile-clear');
	var tokenStrip        = document.getElementById('papers-filter-tokens');
	var fabBtn            = document.getElementById('papers-filter-fab');
	var fabCount          = document.getElementById('papers-fab-count');
	var sheetEl           = document.getElementById('papers-filter-sheet');
	var sheetApply        = document.getElementById('papers-sheet-apply');
	var sheetReset        = document.getElementById('papers-sheet-reset');
	var mobileResultCount = document.getElementById('papers-mobile-result-count');

	// Draft state — edited inside the sheet, committed on "Show results"
	var draft = {};

	function resetDraft() {
		draft = {
			category:           state.category,
			subjects:           state.subjects,
			sort:               state.sort,
			relevant:           state.relevant,
			hasClinicalTrials:  state.hasClinicalTrials,
		};
	}

	// ── Sheet chip helpers ────────────────────────────────────────────────

	function setActiveChip(groupId, value) {
		var group = document.getElementById(groupId);
		if (!group) return;
		var chips = group.querySelectorAll('.sheet-chip');
		chips.forEach(function (chip) {
			chip.classList.toggle('active', chip.dataset.value === value);
		});
	}

	function syncSheetToDraft() {
		setActiveChip('papers-sheet-category', draft.category);
		setActiveChip('papers-sheet-subjects',  draft.subjects);
		setActiveChip('papers-sheet-sort',       draft.sort);
		// "show" chips: derive active value string from draft fields
		var showVal;
		if (draft.hasClinicalTrials === true)  showVal = 'has_clinical_trials_true';
		else if (draft.hasClinicalTrials === false) showVal = 'has_clinical_trials_false';
		else showVal = String(draft.relevant);
		setActiveChip('papers-sheet-show', showVal);
	}

	function wireChipGroup(groupId, onChange) {
		var group = document.getElementById(groupId);
		if (!group) return;
		group.addEventListener('click', function (e) {
			var chip = e.target.closest('.sheet-chip');
			if (!chip) return;
			var chips = group.querySelectorAll('.sheet-chip');
			chips.forEach(function (c) { c.classList.remove('active'); });
			chip.classList.add('active');
			onChange(chip.dataset.value);
		});
	}

	// ── Category chips in sheet (populated from state.categories) ─────────

	function populateMobileCategoryChips() {
		var group = document.getElementById('papers-sheet-category');
		if (!group) return;
		// Remove anything beyond the first "All categories" chip
		var existing = group.querySelectorAll('.sheet-chip[data-value]:not([data-value=""])');
		existing.forEach(function (c) { c.parentNode.removeChild(c); });

		var items = [];
		if (state.categoryGroups.length) {
			state.categoryGroups.forEach(function (g) {
				(g.categories || []).forEach(function (c) { if (c.id) items.push(c); });
			});
		} else {
			items = state.categories.filter(function (c) { return c.id; });
		}

		items.forEach(function (c) {
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'sheet-chip';
			btn.dataset.value = String(c.id);
			btn.textContent = c.name;
			group.appendChild(btn);
		});
	}

	// ── Token strip ───────────────────────────────────────────────────────

	function categoryLabel(id) {
		if (!id) return '';
		var cat = state.categories.find(function (c) { return String(c.id) === id; });
		return cat ? cat.name : id;
	}

	function subjectLabel(id) {
		if (!id) return '';
		var group = document.getElementById('papers-sheet-subjects');
		if (!group) return id;
		var chip = group.querySelector('.sheet-chip[data-value="' + id + '"]');
		return chip ? chip.textContent.trim() : id;
	}

	function buildToken(label, filterKey) {
		var token = document.createElement('span');
		token.className = 'filter-token';
		token.dataset.filter = filterKey;
		var text = document.createTextNode(label + ' ');
		var removeBtn = document.createElement('button');
		removeBtn.type = 'button';
		removeBtn.className = 'filter-token-remove';
		removeBtn.setAttribute('aria-label', 'Remove ' + label + ' filter');
		removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
		token.appendChild(text);
		token.appendChild(removeBtn);
		return token;
	}

	function removeToken(filterKey) {
		if (filterKey === 'category') {
			state.category = '';
			hideCategoryPanel();
		} else if (filterKey === 'subjects') {
			state.subjects = '';
		} else if (filterKey === 'sort') {
			state.sort = 'date';
		} else if (filterKey === 'show') {
			state.relevant = requireRelevant;
			state.hasClinicalTrials = null;
		}
		state.page = 1;
		fetchPage(1, false);
		renderTokens();
		updateMobileResultCount();
	}

	function renderTokens() {
		if (!tokenStrip) return;
		// Remove existing tokens (keep the "+ Filters" chip at the end)
		var addChip = tokenStrip.querySelector('.token-add-filters');
		// Clear all children then re-add the add chip
		while (tokenStrip.firstChild) tokenStrip.removeChild(tokenStrip.firstChild);

		var hasTokens = false;

		if (state.category) {
			tokenStrip.appendChild(buildToken(categoryLabel(state.category), 'category'));
			hasTokens = true;
		}
		if (state.subjects) {
			tokenStrip.appendChild(buildToken(subjectLabel(state.subjects), 'subjects'));
			hasTokens = true;
		}
		if (state.sort && state.sort !== 'date') {
			var sortLabel = state.sort === 'relevance' ? 'AI relevance' : state.sort;
			tokenStrip.appendChild(buildToken(sortLabel, 'sort'));
			hasTokens = true;
		}
		if (state.hasClinicalTrials !== null) {
			var showLabel = state.hasClinicalTrials ? 'With clinical trials' : 'Without clinical trials';
			tokenStrip.appendChild(buildToken(showLabel, 'show'));
			hasTokens = true;
		} else if (state.relevant !== requireRelevant) {
			tokenStrip.appendChild(buildToken('Full feed', 'show'));
			hasTokens = true;
		}

		if (addChip) tokenStrip.appendChild(addChip);
		tokenStrip.hidden = !hasTokens;

		updateFabCount();
	}

	function updateFabCount() {
		var count = 0;
		if (state.category) count++;
		if (state.subjects)  count++;
		if (state.sort && state.sort !== 'date') count++;
		if (state.hasClinicalTrials !== null) count++;
		else if (state.relevant !== requireRelevant) count++;

		if (!fabCount) return;
		fabCount.textContent = String(count);
		fabCount.hidden = count === 0;
	}

	function updateMobileResultCount() {
		if (!mobileResultCount) return;
		var text = mobileResultCount.getAttribute('data-count') || '';
		// The desktop counter already has the count; mirror it
		var desktopCount = document.getElementById('papers-result-count');
		if (desktopCount && desktopCount.textContent) {
			mobileResultCount.innerHTML = desktopCount.innerHTML;
		}
	}

	// Patch fetchPage to also update the mobile result count after each fetch
	var origFetchPage = fetchPage;
	fetchPage = function (page, push) {
		origFetchPage(page, push);
		// result count updates async; observe via a short MutationObserver
		if (mobileResultCount) {
			var desktopCount = document.getElementById('papers-result-count');
			if (desktopCount) {
				var obs = new MutationObserver(function () {
					mobileResultCount.innerHTML = desktopCount.innerHTML;
				});
				obs.observe(desktopCount, { childList: true, characterData: true, subtree: true });
				setTimeout(function () { obs.disconnect(); }, 5000);
			}
		}
	};

	// ── Mobile search wiring ──────────────────────────────────────────────

	function debounce(fn, ms) {
		var t;
		return function () { clearTimeout(t); t = setTimeout(fn, ms); };
	}

	if (mobileSearchInput) {
		mobileSearchInput.addEventListener('input', debounce(function () {
			state.keyword = mobileSearchInput.value.trim();
			state.page = 1;
			if (mobileClearBtn) mobileClearBtn.hidden = !state.keyword;
			fetchPage(1, false);
			renderTokens();
		}, 200));

		// Keep desktop search input in sync (so URL state and reset work uniformly)
		mobileSearchInput.addEventListener('input', function () {
			if (searchInput) searchInput.value = mobileSearchInput.value;
		});
	}

	if (mobileClearBtn) {
		mobileClearBtn.addEventListener('click', function () {
			state.keyword = '';
			if (mobileSearchInput) mobileSearchInput.value = '';
			if (searchInput) searchInput.value = '';
			mobileClearBtn.hidden = true;
			state.page = 1;
			fetchPage(1, false);
			renderTokens();
		});
	}

	// ── Token strip: remove via delegation ───────────────────────────────

	if (tokenStrip) {
		tokenStrip.addEventListener('click', function (e) {
			var removeBtn = e.target.closest('.filter-token-remove');
			if (!removeBtn) return;
			var token = removeBtn.closest('.filter-token');
			if (!token) return;
			removeToken(token.dataset.filter);
		});
	}

	// ── Bottom sheet wiring ───────────────────────────────────────────────

	wireChipGroup('papers-sheet-category', function (val) { draft.category = val; });
	wireChipGroup('papers-sheet-subjects',  function (val) { draft.subjects = val; });
	wireChipGroup('papers-sheet-sort',       function (val) { draft.sort = val; });
	wireChipGroup('papers-sheet-show', function (val) {
		if (val === 'has_clinical_trials_true')  { draft.hasClinicalTrials = true;  draft.relevant = requireRelevant; }
		else if (val === 'has_clinical_trials_false') { draft.hasClinicalTrials = false; draft.relevant = requireRelevant; }
		else { draft.hasClinicalTrials = null; draft.relevant = val !== 'false'; }
	});

	// Sync draft from live state each time the sheet opens
	if (sheetEl) {
		sheetEl.addEventListener('show.bs.offcanvas', function () {
			resetDraft();
			populateMobileCategoryChips();
			syncSheetToDraft();
		});
		// Discard draft on close without apply (already handled by not committing)
	}

	if (sheetApply) {
		sheetApply.addEventListener('click', function () {
			// Commit draft to state
			state.category          = draft.category          !== undefined ? draft.category          : state.category;
			state.subjects          = draft.subjects           !== undefined ? draft.subjects           : state.subjects;
			state.sort              = draft.sort               !== undefined ? draft.sort               : state.sort;
			state.relevant          = draft.relevant           !== undefined ? draft.relevant           : state.relevant;
			state.hasClinicalTrials = draft.hasClinicalTrials  !== undefined ? draft.hasClinicalTrials  : state.hasClinicalTrials;
			state.page = 1;

			// Category panel
			if (state.category) { renderCategoryPanel(); } else { hideCategoryPanel(); }

			fetchPage(1, false);
			renderTokens();

			// Close the offcanvas
			if (window.bootstrap && bootstrap.Offcanvas) {
				var offcanvasInstance = bootstrap.Offcanvas.getInstance(sheetEl);
				if (offcanvasInstance) offcanvasInstance.hide();
			}
		});
	}

	if (sheetReset) {
		sheetReset.addEventListener('click', function () {
			draft = {
				category:          '',
				subjects:          '',
				sort:              'date',
				relevant:          requireRelevant,
				hasClinicalTrials: null,
			};
			syncSheetToDraft();
		});
	}

	// ── Patch desktop reset to also update mobile ─────────────────────────
	if (resetBtn) {
		resetBtn.addEventListener('click', function () {
			if (mobileSearchInput) mobileSearchInput.value = '';
			if (mobileClearBtn) mobileClearBtn.hidden = true;
			renderTokens();
		});
	}

	// ── Init mobile UI ─────────────────────────────────────────────────────
	if (mobileSearchInput) mobileSearchInput.value = state.keyword;
	if (mobileClearBtn) mobileClearBtn.hidden = !state.keyword;
	populateMobileCategoryChips();
	renderTokens();

})();
