/* research-feed.js — Research papers feed for conditions, research-area, and advanced-search pages.
 * Fetches from api.brain-regeneration.com/articles/ (search via ?search= param).
 * Supports: category filter (server-side), text search (server-side),
 * server-side ordering, URL state, ML/expert scores, CSV download, pagination,
 * mobile bottom-sheet filter UI, author typeahead, open-access filter,
 * multi-subject intersect, and site-wide category fetch.
 */
(function () {
	'use strict';

	var mount = document.getElementById('papers-list');
	if (!mount) return;

	var apiBase          = mount.dataset.apiBase          || 'https://api.brain-regeneration.com';
	var teamId           = mount.dataset.teamId           || '';
	var subjectId        = mount.dataset.subjectId        || '';
	var requireRelevant  = mount.dataset.requireRelevant  !== 'false';

	var articlesEndpoint = apiBase.replace(/\/$/, '') + '/articles/';

	// ── UI references ────────────────────────────────────────────────────────
	var searchInput      = document.getElementById('papers-search-input');
	var categorySelect   = document.getElementById('papers-category-select');
	var subjectsSelect       = document.getElementById('papers-subject-select');
	var subjectsMulti        = document.getElementById('papers-subjects-multi');
	var conditionsSelect     = document.getElementById('papers-conditions-select');
	var researchAreasSelect  = document.getElementById('papers-research-areas-select');
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

	var authorInput        = document.getElementById('papers-author-input');
	var authorHidden       = document.getElementById('papers-author-id');
	var authorSuggestions  = document.getElementById('papers-author-suggestions');
	var openAccessCheck    = document.getElementById('papers-open-access');
	var dateFromInput      = document.getElementById('papers-date-from');
	var dateToInput        = document.getElementById('papers-date-to');

	var firstBtn         = document.getElementById('papers-first-btn');
	var prevBtn          = document.getElementById('papers-prev-btn');
	var nextBtn          = document.getElementById('papers-next-btn');
	var lastBtn          = document.getElementById('papers-last-btn');
	var paginationNums   = document.getElementById('papers-pagination-numbers');

	// Tab count badges
	var tabPapersCount = document.getElementById('tab-papers-count');
	var tabTrialsCount = document.getElementById('tab-trials-count');

	// Desktop chip groups (advanced search page)
	var conditionChips = document.getElementById('papers-condition-chips');
	var areaChips      = document.getElementById('papers-area-chips');
	var moreFiltersBtn = document.getElementById('papers-more-filters-btn');
	var advancedPanel  = document.getElementById('papers-advanced-panel');
	var desktopTokens  = document.getElementById('papers-desktop-tokens');

	// ── State ─────────────────────────────────────────────────────────────
	var state = {
		page:               1,
		totalPages:         1,
		totalCount:         0,
		pageSize:           10,
		keyword:            '',
		category:           '',   // slug
		subjects:           '',   // combined comma-separated subject IDs (derived in advanced mode)
		conditionSubjects:  '',   // comma-separated condition subject IDs (advanced chip mode)
		areaSubjects:       '',   // comma-separated research area subject IDs (advanced chip mode)
		subjectsMode:       'all', // 'all' = AND, 'any' = OR for conditions
		areasMode:          'all', // 'all' = AND, 'any' = OR for research areas
		sort:               'date',
		relevant:           requireRelevant,  // true = curated feed, false = full feed
		hasClinicalTrials:  null, // null = no filter, true/false = has_clinical_trials param
		authorId:           '',   // author_id filter
		openAccess:         false, // open_access=true filter
		dateFrom:           '',
		dateTo:             '',
		results:            [],   // current page articles
		categories:         [],   // flat list (populated from category_groups or data-categories)
		categoryGroups:     [],   // grouped list (populated from data-category-groups)
	};

	// ── Cache ─────────────────────────────────────────────────────────────
	var cache = BR.makeCache('brPapers:', 6 * 60 * 60 * 1000); // 6 hours
	function getCached(url) { return cache.get(url); }
	function setCached(url, data) { cache.set(url, data); }

	// ── Helpers (generic ones shared via window.BR; see js/br-utils.js) ─────
	var escHtml         = BR.escHtml;
	var decodeEntities  = BR.decodeEntities;
	var stripHtml       = BR.stripHtml;
	var truncate        = BR.truncate;
	var safeLink        = BR.safeLink;
	var slugify         = BR.slugify;
	var debounce        = BR.debounce;
	var formatDate      = BR.formatDate;

	function parseMarkdown(str) {
		if (str == null || str === '') return '';
		var s = String(str);
		var links = [];
		// Extract links before escaping so URLs survive
		s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, text, url) {
			var tag = '<a href="' + escHtml(safeLink(url.trim())) + '" target="_blank" rel="noopener noreferrer">' + escHtml(text) + '</a>';
			links.push(tag);
			return '\x00' + (links.length - 1) + '\x00';
		});
		s = escHtml(s);
		s = s.replace(/\x00(\d+)\x00/g, function (_, i) { return links[+i]; });
		s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
		s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
		s = s.replace(/\n\n+/g, '</p><p>');
		s = s.replace(/\n/g, '<br>');
		return '<p>' + s + '</p>';
	}

	function formatAuthors(authors) {
		if (!authors || !authors.length) return '';
		var names = authors.map(function (a) { return a.full_name; });
		return names.length > 3 ? names.slice(0, 3).join(', ') + ' et al.' : names.join(', ');
	}

	function todayISO() {
		return new Date().toISOString().slice(0, 10);
	}

	// ── URL state ──────────────────────────────────────────────────────────

	function readURL() {
		var params = new URLSearchParams(window.location.search);
		state.keyword            = params.get('q')             || '';
		state.category           = params.get('category')      || '';
		if (params.has('conditions') || params.has('areas')) {
			state.conditionSubjects = params.get('conditions')      || '';
			state.areaSubjects      = params.get('areas')           || '';
			state.subjectsMode      = params.get('conditions_mode') || 'all';
			state.areasMode         = params.get('areas_mode')      || 'all';
			state.subjects          = [state.conditionSubjects, state.areaSubjects].filter(Boolean).join(',');
		} else {
			state.subjects          = params.get('subjects')      || '';
			state.conditionSubjects = '';
			state.areaSubjects      = '';
			state.subjectsMode      = params.get('subjects_mode') || 'all';
			state.areasMode         = 'all';
		}
		state.sort               = params.get('sort')          || 'date';
		if (state.sort === 'relevance') state.sort = 'ml_score'; // canonicalize old bookmarked URLs
		state.relevant           = params.has('relevant') ? params.get('relevant') !== 'false' : requireRelevant;
		state.hasClinicalTrials  = params.has('has_clinical_trials') ? params.get('has_clinical_trials') !== 'false' : null;
		state.authorId           = params.get('author_id')  || '';
		state.openAccess         = params.get('open_access') === 'true';
		state.dateFrom           = params.get('date_from')   || '';
		state.dateTo             = params.get('date_to')     || '';
		state.page               = parseInt(params.get('page') || '1', 10) || 1;
	}

	function writeURL(push) {
		var params = new URLSearchParams();
		if (state.keyword)                    params.set('q',                    state.keyword);
		if (state.category)                   params.set('category',             state.category);
		if (conditionChips || areaChips) {
			if (state.conditionSubjects)          params.set('conditions',           state.conditionSubjects);
			if (state.subjectsMode !== 'all')     params.set('conditions_mode',      state.subjectsMode);
			if (state.areaSubjects)               params.set('areas',                state.areaSubjects);
			if (state.areasMode !== 'all')        params.set('areas_mode',           state.areasMode);
		} else {
			if (state.subjects)                   params.set('subjects',             state.subjects);
			if (state.subjectsMode !== 'all')     params.set('subjects_mode',        state.subjectsMode);
		}
		params.set('sort',                    state.sort);
		params.set('relevant',                String(state.relevant));
		if (state.hasClinicalTrials !== null) params.set('has_clinical_trials',  String(state.hasClinicalTrials));
		if (state.authorId)                   params.set('author_id',            state.authorId);
		if (state.openAccess)                 params.set('open_access',          'true');
		if (state.dateFrom)                   params.set('date_from',            state.dateFrom);
		if (state.dateTo)                     params.set('date_to',              state.dateTo);
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
		if (sortSelect)     sortSelect.value     = state.sort;
		if (relevantSelect) {
			if (state.hasClinicalTrials !== null) {
				relevantSelect.value = 'has_clinical_trials_' + (state.hasClinicalTrials ? 'true' : 'false');
			} else {
				relevantSelect.value = String(state.relevant);
			}
		}
		// Subject selects: split single-select (advanced) or combined
		var subjectIds = (state.subjects || '').split(',').filter(Boolean);
		if (conditionsSelect || researchAreasSelect) {
			if (conditionsSelect)    Array.from(conditionsSelect.options).forEach(function (o) { o.selected = subjectIds.indexOf(o.value) !== -1; });
			if (researchAreasSelect) Array.from(researchAreasSelect.options).forEach(function (o) { o.selected = subjectIds.indexOf(o.value) !== -1; });
		} else if (subjectsMulti) {
			Array.from(subjectsMulti.options).forEach(function (opt) { opt.selected = subjectIds.indexOf(opt.value) !== -1; });
		} else if (subjectsSelect) {
			subjectsSelect.value = state.subjects;
		}
		if (authorHidden)    authorHidden.value      = state.authorId;
		if (openAccessCheck) openAccessCheck.checked = state.openAccess;
		if (dateFromInput)   dateFromInput.value     = state.dateFrom;
		if (dateToInput)     dateToInput.value       = state.dateTo;
		renderCategoryPanel();

		// Sync desktop chips
		var allSubjectIds = (state.subjects || '').split(',').filter(Boolean);
		var conditionIds = state.conditionSubjects
			? state.conditionSubjects.split(',').filter(Boolean)
			: allSubjectIds;
		var areaIds = state.areaSubjects
			? state.areaSubjects.split(',').filter(Boolean)
			: allSubjectIds;
		if (conditionChips) {
			conditionChips.querySelectorAll('.search-chip').forEach(function (chip) {
				BR.feedUI.setSearchChipActive(chip, conditionIds.indexOf(chip.dataset.value || '') !== -1);
			});
		}
		if (areaChips) {
			areaChips.querySelectorAll('.search-chip').forEach(function (chip) {
				BR.feedUI.setSearchChipActive(chip, areaIds.indexOf(chip.dataset.value || '') !== -1);
			});
		}
		// Sync desktop conditions mode toggle
		var papersSubjectsModeEl = document.getElementById('papers-subjects-mode');
		if (papersSubjectsModeEl) {
			papersSubjectsModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
				b.classList.toggle('active', b.dataset.mode === state.subjectsMode);
				b.setAttribute('aria-pressed', b.dataset.mode === state.subjectsMode ? 'true' : 'false');
			});
		}
		// Sync desktop research areas mode toggle
		var papersAreasModeEl = document.getElementById('papers-areas-mode');
		if (papersAreasModeEl) {
			papersAreasModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
				b.classList.toggle('active', b.dataset.mode === state.areasMode);
				b.setAttribute('aria-pressed', b.dataset.mode === state.areasMode ? 'true' : 'false');
			});
		}
	}

	// ── API URL builders ──────────────────────────────────────────────────

	function sortToOrdering(sort) {
		var map = {
			'date':            '-published_date',
			'date_asc':        'published_date',
			'discovery':       '-discovery_date',
			'discovery_asc':   'discovery_date',
			'title_asc':       'title',
			'title_desc':      '-title',
			'ml_score':        '-ml_score',
			'ml_score_asc':    'ml_score',
			'relevance':       '-ml_score', // backward compat for old bookmarked URLs
		};
		return map[sort] || '-published_date';
	}

	function buildSubjectParams(url) {
		if (conditionChips || areaChips) {
			var _subjectsAll = [], _subjectsAny = [];
			if (state.conditionSubjects) {
				var _cids = state.conditionSubjects.split(',').filter(Boolean);
				if (state.subjectsMode === 'any') _subjectsAny = _subjectsAny.concat(_cids);
				else _subjectsAll = _subjectsAll.concat(_cids);
			}
			if (state.areaSubjects) {
				var _aids = state.areaSubjects.split(',').filter(Boolean);
				if (state.areasMode === 'any') _subjectsAny = _subjectsAny.concat(_aids);
				else _subjectsAll = _subjectsAll.concat(_aids);
			}
			if (_subjectsAll.length) url.searchParams.set('subjects',     _subjectsAll.join(','));
			if (_subjectsAny.length) url.searchParams.set('subjects_any', _subjectsAny.join(','));
		} else {
			if (state.subjects) url.searchParams.set(state.subjectsMode === 'any' ? 'subjects_any' : 'subjects', state.subjects);
		}
	}

	function buildURL(page) {
		var base = articlesEndpoint;
		var url  = new URL(base);
		url.searchParams.set('format',     'json');
		if (teamId)           url.searchParams.set('team_id',       teamId);
		if (subjectId)        url.searchParams.set('subject_id',    subjectId);
		if (state.keyword)    url.searchParams.set('search',        state.keyword);
		if (state.category)   url.searchParams.set('category_id',   state.category);
		buildSubjectParams(url);
		if (state.authorId)   url.searchParams.set('author_id',     state.authorId);
		if (state.openAccess) url.searchParams.set('open_access',   'true');
		if (state.dateFrom)   url.searchParams.set('published_date_after',  state.dateFrom);
		if (state.dateTo)     url.searchParams.set('published_date_before', state.dateTo);
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
		var base = articlesEndpoint;
		var url  = new URL(base);
		url.searchParams.set('format',      'csv');
		url.searchParams.set('all_results', 'true');
		if (teamId)           url.searchParams.set('team_id',       teamId);
		if (subjectId)        url.searchParams.set('subject_id',    subjectId);
		if (state.keyword)    url.searchParams.set('search',        state.keyword);
		if (state.category)   url.searchParams.set('category_id',   state.category);
		buildSubjectParams(url);
		if (state.authorId)   url.searchParams.set('author_id',     state.authorId);
		if (state.openAccess) url.searchParams.set('open_access',          'true');
		if (state.dateFrom)   url.searchParams.set('published_date_after',  state.dateFrom);
		if (state.dateTo)     url.searchParams.set('published_date_before', state.dateTo);
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
		if (!sid) return ''; // site-wide: no single subject to check
		var found = relevances.some(function (r) {
			return r.subject && r.subject.id === sid && r.is_relevant === true;
		});
		if (!found) return '';
		return '<span class="expert-badge" title="Marked relevant by a curator">Curator-selected</span>';
	}

	function buildCard(a) {
		var authors  = decodeEntities(formatAuthors(a.authors));
		var date     = formatDate(a.published_date);
		var journal  = decodeEntities(a.container_title || '');
		var abstract = truncate(stripHtml(a.summary || ''), 200);
		var accessBadge = a.access === 'open'
			? '<span class="access-badge open">Open Access</span>'
			: '<span class="access-badge restricted">Subscription</span>';
		var doiLink = a.doi
			? '<a class="paper-card-doi" href="https://doi.org/' + escHtml(a.doi) + '" target="_blank" rel="noopener noreferrer">DOI</a>'
			: '';

		var mlScores = '';
		if (a.ml_predictions && a.ml_predictions.length) {
			// Keep only the most recent prediction per algorithm (higher id = more recent run).
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
					return '<span class="condition-tag" style="font-size:12px;padding:2px 8px;">' + escHtml(decodeEntities(c.category_name || c.slug || c)) + '</span>';
				}).join('') +
			'</div>';
		}

		var rawUrl = a.article_id ? '/articles/' + encodeURIComponent(a.article_id) + '/' : safeLink(a.link);
		return '<article class="paper-card">' +
			'<div class="paper-card-title">' +
				'<a href="' + escHtml(rawUrl) + '">' + escHtml(decodeEntities(a.title)) + '</a>' +
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
		return articles; // ordering is always server-side via the `ordering` param
	}

	function renderCards(articles) {
		var sorted = applySort(articles);
		if (!sorted.length) { renderEmpty(); return; }
		mount.innerHTML = sorted.map(buildCard).join('');
	}

	// ── Sparklines ───────────────────────────────────────────────────────

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

	function makeSVGMultiSparkline(seriesList) {
		var W = 120, H = 40;
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
		var articleCounts  = last12Months(monthly.monthly_article_counts          || []);
		var trialCounts    = last12Months(monthly.monthly_trial_counts             || []);
		var mlCounts       = last12Months(monthly.monthly_relevant_article_counts  || []);

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

		var url = new URL(apiBase.replace(/\/$/, '') + '/categories/');
		url.searchParams.set('team_id', teamId);
		url.searchParams.set('category_id', catId);
		url.searchParams.set('include_authors', 'false');
		url.searchParams.set('monthly_counts', 'true');

		var catCacheKey = url.toString();
		var catCached = getCached(catCacheKey);

		if (categoryPanelDesc) categoryPanelDesc.innerHTML = '';
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
				categoryPanelDesc.innerHTML = parseMarkdown(match.category_description);
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
					if (categoryPanelDesc) categoryPanelDesc.innerHTML = '';
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
			if (tabPapersCount && page === 1) tabPapersCount.textContent = (cached.count || 0).toLocaleString();
			writeURL(push === true);
			renderDesktopTokens();
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
				if (tabPapersCount && page === 1) tabPapersCount.textContent = (data.count || 0).toLocaleString();
				writeURL(push === true);
				renderDesktopTokens();
			})
			.catch(renderError);
	}

	// ── Categories ─────────────────────────────────────────────────────────

	function populateCategorySelect() {
		if (!categorySelect) return;
		while (categorySelect.options.length > 1) categorySelect.remove(1);

		if (state.categoryGroups.length) {
			state.categoryGroups.forEach(function (g) {
				var group = document.createElement('optgroup');
				group.label = g.label;
				(g.categories || []).slice().sort(function (a, b) {
					return (a.name || '').localeCompare(b.name || '');
				}).forEach(function (c) {
					if (!c.id) return;
					var opt = document.createElement('option');
					opt.value       = String(c.id);
					opt.textContent = c.name;
					group.appendChild(opt);
				});
				categorySelect.appendChild(group);
			});
		} else {
			state.categories.slice().sort(function (a, b) {
				return (a.name || '').localeCompare(b.name || '');
			}).forEach(function (c) {
				if (!c.id) return;
				var opt = document.createElement('option');
				opt.value       = String(c.id);
				opt.textContent = c.name;
				categorySelect.appendChild(opt);
			});
		}

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
		var bom  = '﻿';
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

	// ── Author typeahead ───────────────────────────────────────────────────

	function hideAuthorSuggestions() {
		if (authorSuggestions) authorSuggestions.hidden = true;
	}

	function showAuthorSuggestions(authors) {
		if (!authorSuggestions) return;
		if (!authors.length) { hideAuthorSuggestions(); return; }
		var html = authors.map(function (a) {
			return '<button type="button" class="author-suggestion-item" data-id="' + escHtml(String(a.author_id)) + '">' +
				escHtml(a.full_name) +
			'</button>';
		}).join('');
		authorSuggestions.innerHTML = html;
		authorSuggestions.hidden = false;
	}

	var authorDebounceTimer;
	if (authorInput) {
		authorInput.addEventListener('input', function () {
			var q = authorInput.value.trim();
			if (authorHidden) authorHidden.value = '';
			state.authorId = '';
			clearTimeout(authorDebounceTimer);
			hideAuthorSuggestions();
			if (q.length < 2) return;
			authorDebounceTimer = setTimeout(function () {
				var aUrl = new URL(apiBase.replace(/\/$/, '') + '/authors/');
				aUrl.searchParams.set('search', q);
				if (teamId) aUrl.searchParams.set('team_id', teamId);
				aUrl.searchParams.set('format', 'json');
				aUrl.searchParams.set('page_size', '8');
				fetch(aUrl.toString())
					.then(function (r) { return r.json(); })
					.then(function (data) { showAuthorSuggestions(data.results || []); })
					.catch(hideAuthorSuggestions);
			}, 300);
		});

		if (authorSuggestions) {
			authorSuggestions.addEventListener('click', function (e) {
				var item = e.target.closest('.author-suggestion-item');
				if (!item) return;
				state.authorId = item.dataset.id || '';
				if (authorHidden) authorHidden.value = state.authorId;
				authorInput.value = item.textContent.trim();
				hideAuthorSuggestions();
				state.page = 1;
				fetchPage(1, false);
			});
		}

		document.addEventListener('click', function (e) {
			if (authorSuggestions && !authorInput.contains(e.target) && !authorSuggestions.contains(e.target)) {
				hideAuthorSuggestions();
			}
		});
	}

	// ── Event listeners ────────────────────────────────────────────────────

	function collectDesktopConditions() {
		if (!conditionChips) return '';
		return Array.from(conditionChips.querySelectorAll('.search-chip.search-chip--active'))
			.map(function (c) { return c.dataset.value; }).filter(Boolean).join(',');
	}

	function collectDesktopAreas() {
		if (!areaChips) return '';
		return Array.from(areaChips.querySelectorAll('.search-chip.search-chip--active'))
			.map(function (c) { return c.dataset.value; }).filter(Boolean).join(',');
	}

	function collectDesktopSubjects() {
		return [collectDesktopConditions(), collectDesktopAreas()].filter(Boolean).join(',');
	}

	function readSubjectsFromControls() {
		if (conditionChips || areaChips) {
			return collectDesktopSubjects();
		}
		if (conditionsSelect || researchAreasSelect) {
			var ids = [];
			if (conditionsSelect)    Array.from(conditionsSelect.selectedOptions    || []).forEach(function (o) { if (o.value) ids.push(o.value); });
			if (researchAreasSelect) Array.from(researchAreasSelect.selectedOptions || []).forEach(function (o) { if (o.value) ids.push(o.value); });
			return ids.join(',');
		}
		if (subjectsMulti) {
			return Array.from(subjectsMulti.selectedOptions || []).map(function (o) { return o.value; }).filter(Boolean).join(',');
		}
		return subjectsSelect ? subjectsSelect.value : '';
	}

	function doSearch() {
		state.keyword   = searchInput    ? searchInput.value.trim()    : '';
		state.category  = categorySelect ? categorySelect.value        : '';
		if (conditionChips || areaChips) {
			state.conditionSubjects = collectDesktopConditions();
			state.areaSubjects      = collectDesktopAreas();
			state.subjects          = [state.conditionSubjects, state.areaSubjects].filter(Boolean).join(',');
		} else {
			state.subjects = readSubjectsFromControls();
		}
		if (openAccessCheck) state.openAccess = openAccessCheck.checked;
		if (dateFromInput) state.dateFrom = dateFromInput.value;
		if (dateToInput)   state.dateTo   = dateToInput.value;
		state.page      = 1;
		renderCategoryPanel();
		if (!state.category) hideCategoryPanel();
		fetchPage(1, false);
	}

	if (searchBtn) {
		searchBtn.addEventListener('click', doSearch);
	}

	if (searchInput) {
		searchInput.addEventListener('keydown', function (e) {
			if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
		});
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
			fetchPage(1, false);
		});
	}

	if (subjectsSelect) {
		subjectsSelect.addEventListener('change', function () {
			state.subjects = this.value;
			state.page     = 1;
			fetchPage(1, false);
		});
	}

	if (subjectsMulti) {
		subjectsMulti.addEventListener('change', function () {
			state.subjects = readSubjectsFromControls();
			state.page     = 1;
			fetchPage(1, false);
		});
	}
	if (conditionsSelect) {
		conditionsSelect.addEventListener('change', function () {
			state.subjects = readSubjectsFromControls();
			state.page     = 1;
			fetchPage(1, false);
		});
	}
	if (researchAreasSelect) {
		researchAreasSelect.addEventListener('change', function () {
			state.subjects = readSubjectsFromControls();
			state.page     = 1;
			fetchPage(1, false);
		});
	}

	if (openAccessCheck) {
		openAccessCheck.addEventListener('change', function () {
			state.openAccess = this.checked;
			state.page       = 1;
			fetchPage(1, false);
		});
	}

	if (dateFromInput) {
		dateFromInput.addEventListener('change', function () {
			state.dateFrom = this.value;
			state.page     = 1;
			fetchPage(1, false);
		});
	}
	if (dateToInput) {
		dateToInput.addEventListener('change', function () {
			state.dateTo = this.value;
			state.page   = 1;
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
			state.subjectsMode      = 'all';
			state.page              = 1;
			state.sort              = 'date';
			state.relevant          = requireRelevant;
			state.hasClinicalTrials = null;
			state.authorId          = '';
			state.openAccess        = false;
			state.dateFrom          = '';
			state.dateTo            = '';
			if (papersSubjectsModeEl) {
				papersSubjectsModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
					b.classList.toggle('active', b.dataset.mode === 'all');
					b.setAttribute('aria-pressed', b.dataset.mode === 'all' ? 'true' : 'false');
				});
			}
			if (searchInput)     searchInput.value     = '';
			if (categorySelect)  categorySelect.value  = '';
			if (subjectsSelect)      subjectsSelect.value  = '';
			if (subjectsMulti)       Array.from(subjectsMulti.options).forEach(function (o) { o.selected = false; });
			if (conditionsSelect)    Array.from(conditionsSelect.options).forEach(function (o) { o.selected = false; });
			if (researchAreasSelect) Array.from(researchAreasSelect.options).forEach(function (o) { o.selected = false; });
			if (sortSelect)      sortSelect.value      = 'date';
			if (relevantSelect)  relevantSelect.value  = String(requireRelevant);
			if (authorInput)     authorInput.value     = '';
			if (authorHidden)    authorHidden.value    = '';
			if (openAccessCheck) openAccessCheck.checked = false;
			if (dateFromInput)   dateFromInput.value   = '';
			if (dateToInput)     dateToInput.value     = '';
			[conditionChips, areaChips].forEach(function (g) {
				if (g) g.querySelectorAll('.search-chip').forEach(function (c) { BR.feedUI.setSearchChipActive(c, false); });
			});
			hideAuthorSuggestions();
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

	BR.feedUI.wireDownloadDropdown(downloadToggle, {
		onPage: downloadPageCSV,
		onAll:  downloadAllCSV
	});

	// ── Desktop conditions mode toggle ─────────────────────────────────────────
	var papersSubjectsModeEl = document.getElementById('papers-subjects-mode');
	if (papersSubjectsModeEl) {
		papersSubjectsModeEl.addEventListener('click', function (e) {
			var btn = e.target.closest('.subjects-mode-btn');
			if (!btn) return;
			papersSubjectsModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
				b.classList.remove('active');
				b.setAttribute('aria-pressed', 'false');
			});
			btn.classList.add('active');
			btn.setAttribute('aria-pressed', 'true');
			state.subjectsMode = btn.dataset.mode;
			if (state.conditionSubjects) fetchPage(1, false);
		});
	}

	// ── Desktop research areas mode toggle ─────────────────────────────────────
	var papersAreasModeEl = document.getElementById('papers-areas-mode');
	if (papersAreasModeEl) {
		papersAreasModeEl.addEventListener('click', function (e) {
			var btn = e.target.closest('.subjects-mode-btn');
			if (!btn) return;
			papersAreasModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
				b.classList.remove('active');
				b.setAttribute('aria-pressed', 'false');
			});
			btn.classList.add('active');
			btn.setAttribute('aria-pressed', 'true');
			state.areasMode = btn.dataset.mode;
			if (state.areaSubjects) fetchPage(1, false);
		});
	}

	// ── Desktop chip filter (advanced search) ─────────────────────────────

	function renderDesktopTokens() {
		if (!desktopTokens) return;
		var items = [];

		if (state.subjects) {
			state.subjects.split(',').filter(Boolean).forEach(function (id) {
				var label = id;
				document.querySelectorAll('.search-chip').forEach(function (c) {
					if (c.dataset.value === id) label = c.textContent.trim();
				});
				items.push({ label: label, key: 'subject:' + id });
			});
		}
		if (state.authorId && authorInput && authorInput.value) {
			items.push({ label: 'Author: ' + authorInput.value, key: 'author' });
		}
		if (state.openAccess) {
			items.push({ label: 'Open access only', key: 'oa' });
		}
		if (state.category && categorySelect) {
			var catLabel = state.category;
			for (var ci = 0; ci < categorySelect.options.length; ci++) {
				if (categorySelect.options[ci].value === state.category) { catLabel = categorySelect.options[ci].text; break; }
			}
			items.push({ label: catLabel, key: 'category' });
		}
		if (state.dateFrom || state.dateTo) {
			items.push({ label: 'Date: ' + (state.dateFrom || '…') + ' – ' + (state.dateTo || '…'), key: 'date' });
		}
		if (state.hasClinicalTrials !== null) {
			items.push({ label: state.hasClinicalTrials ? 'With clinical trials' : 'Without clinical trials', key: 'show' });
		}

		desktopTokens.hidden = items.length === 0;
		if (items.length === 0) return;

		desktopTokens.innerHTML = '<span class="search-tokens__label">Filtering by:</span>' +
			items.map(function (item) {
				return '<span class="search-token">' + escHtml(item.label) +
					'<button class="search-token__x" data-key="' + escHtml(item.key) + '" aria-label="Remove ' + escHtml(item.label) + ' filter">×</button>' +
					'</span>';
			}).join('') +
			'<button class="search-clear-all" id="papers-desktop-clear-all">Clear all</button>';

		desktopTokens.querySelectorAll('.search-token__x').forEach(function (btn) {
			btn.addEventListener('click', function () { removeDesktopToken(btn.dataset.key); });
		});
		var clearAllBtn = document.getElementById('papers-desktop-clear-all');
		if (clearAllBtn) {
			clearAllBtn.addEventListener('click', function () {
				state.subjects = '';
				state.conditionSubjects = '';
				state.areaSubjects = '';
				state.subjectsMode = 'all';
				state.areasMode = 'all';
				state.authorId = '';
				state.openAccess = false;
				state.category = '';
				state.dateFrom = '';
				state.dateTo = '';
				state.hasClinicalTrials = null;
				state.page = 1;
				[conditionChips, areaChips].forEach(function (g) {
					if (g) g.querySelectorAll('.search-chip').forEach(function (c) { BR.feedUI.setSearchChipActive(c, false); });
				});
				[papersSubjectsModeEl, papersAreasModeEl].forEach(function (modeEl) {
					if (!modeEl) return;
					modeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
						b.classList.toggle('active', b.dataset.mode === 'all');
						b.setAttribute('aria-pressed', b.dataset.mode === 'all' ? 'true' : 'false');
					});
				});
				if (authorInput)     authorInput.value = '';
				if (authorHidden)    authorHidden.value = '';
				if (openAccessCheck) openAccessCheck.checked = false;
				if (categorySelect)  categorySelect.value = '';
				if (dateFromInput)   dateFromInput.value = '';
				if (dateToInput)     dateToInput.value = '';
				hideCategoryPanel();
				fetchPage(1, false);
			});
		}
	}

	function removeDesktopToken(key) {
		if (key.indexOf('subject:') === 0) {
			var removeId = key.slice(8);
			if (conditionChips || areaChips) {
				state.conditionSubjects = (state.conditionSubjects || '').split(',').filter(function (x) { return x !== removeId; }).join(',');
				state.areaSubjects      = (state.areaSubjects      || '').split(',').filter(function (x) { return x !== removeId; }).join(',');
				state.subjects          = [state.conditionSubjects, state.areaSubjects].filter(Boolean).join(',');
			} else {
				var ids = (state.subjects || '').split(',').filter(Boolean);
				state.subjects = ids.filter(function (x) { return x !== removeId; }).join(',');
			}
			document.querySelectorAll('.search-chip').forEach(function (c) {
				if (c.dataset.value === removeId) BR.feedUI.setSearchChipActive(c, false);
			});
		} else if (key === 'author') {
			state.authorId = '';
			if (authorInput) authorInput.value = '';
			if (authorHidden) authorHidden.value = '';
		} else if (key === 'oa') {
			state.openAccess = false;
			if (openAccessCheck) openAccessCheck.checked = false;
		} else if (key === 'category') {
			state.category = '';
			if (categorySelect) categorySelect.value = '';
			hideCategoryPanel();
		} else if (key === 'date') {
			state.dateFrom = '';
			state.dateTo = '';
			if (dateFromInput) dateFromInput.value = '';
			if (dateToInput) dateToInput.value = '';
		} else if (key === 'show') {
			state.hasClinicalTrials = null;
			state.relevant = requireRelevant;
			if (relevantSelect) relevantSelect.value = String(requireRelevant);
		}
		state.page = 1;
		fetchPage(1, false);
	}

	function wireDesktopChipGroup(group, onCollect) {
		if (!group) return;
		group.addEventListener('click', function (e) {
			var chip = e.target.closest('.search-chip');
			if (!chip) return;
			BR.feedUI.setSearchChipActive(chip, !chip.classList.contains('search-chip--active'));
			onCollect();
			state.subjects = [state.conditionSubjects, state.areaSubjects].filter(Boolean).join(',');
			state.page = 1;
			fetchPage(1, false);
		});
	}
	wireDesktopChipGroup(conditionChips, function () { state.conditionSubjects = collectDesktopConditions(); });
	wireDesktopChipGroup(areaChips,      function () { state.areaSubjects      = collectDesktopAreas(); });

	BR.feedUI.wireMoreFilters(moreFiltersBtn, advancedPanel, 'papers-more-arrow');

	BR.feedUI.wireHintTags(function (hint) {
		if (searchInput) searchInput.value = hint;
		state.keyword = hint;
		state.page = 1;
		fetchPage(1, false);
	});

	// ── Init ───────────────────────────────────────────────────────────────
	readURL();
	syncUIFromState();

	try {
		var rawGroups = mount.dataset.categoryGroups;
		if (rawGroups) {
			var parsedGroups = JSON.parse(rawGroups);
			if (Array.isArray(parsedGroups) && parsedGroups.length) {
				state.categoryGroups = parsedGroups;
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
	} catch (e) { /* non-fatal: category select will just have no options */ }

	// Fetch categories from API when the mount requests it (site-wide advanced search)
	if (mount.dataset.fetchCategories === 'true' && !state.categories.length && !state.categoryGroups.length) {
		var catFetchUrl = new URL(apiBase.replace(/\/$/, '') + '/categories/');
		catFetchUrl.searchParams.set('team_id', teamId);
		catFetchUrl.searchParams.set('format', 'json');
		fetch(catFetchUrl.toString())
			.then(function (r) { return r.json(); })
			.then(function (data) {
				var cats = (data.results || []).map(function (c) {
					return { id: c.id, name: c.category_name };
				});
				cats.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
				state.categories = cats;
				populateCategorySelect();
				populateMobileCategoryChips();
			})
			.catch(function () { /* non-fatal */ });
	}

	populateCategorySelect();

	fetchPage(state.page, false);

	// Background fetch for trials tab count badge
	if (tabTrialsCount) {
		var trialsCountUrl = articlesEndpoint.replace('/articles/', '/trials/') + '?format=json&page_size=1' + (teamId ? '&team_id=' + teamId : '');
		fetch(trialsCountUrl)
			.then(function (r) { return r.json(); })
			.then(function (d) { if (d.count != null) tabTrialsCount.textContent = d.count.toLocaleString(); })
			.catch(function () {});
	}

	// ── Mobile UI ──────────────────────────────────────────────────────────
	// Wires the mobile search bar, filter token strip, and bottom sheet.
	// All state changes call the same fetchPage() used by desktop controls.

	var mobileBar        = document.getElementById('papers-mobile-bar');
	if (!mobileBar) return;

	var mobileSearchInput = document.getElementById('papers-mobile-search');
	var mobileClearBtn    = document.getElementById('papers-mobile-clear');
	var tokenStrip        = document.getElementById('papers-filter-tokens');
	var fabBtn            = document.getElementById('papers-filter-fab');
	var fabCount          = document.getElementById('papers-fab-count');
	var sheetEl           = document.getElementById('papers-filter-sheet');
	var sheetApply        = document.getElementById('papers-sheet-apply');
	var sheetReset        = document.getElementById('papers-sheet-reset');
	var mobileResultCount = document.getElementById('papers-mobile-result-count');

	// Mobile-sheet author inputs (advanced page only)
	var sheetAuthorInput = document.getElementById('papers-sheet-author-input');
	var sheetAuthorId    = document.getElementById('papers-sheet-author-id');

	var draft = {};

	function activeIdsForGroup(groupId) {
		var group = document.getElementById(groupId);
		if (!group) return '';
		var allIds = (state.subjects || '').split(',').filter(Boolean);
		var groupVals = Array.from(group.querySelectorAll('.sheet-chip[data-value]'))
			.map(function (c) { return c.dataset.value; }).filter(Boolean);
		return allIds.filter(function (id) { return groupVals.indexOf(id) !== -1; }).join(',');
	}

	function resetDraft() {
		draft = {
			category:              state.category,
			subjects:              state.subjects,
			subjectsMode:          state.subjectsMode,
			areasMode:             state.areasMode,
			conditionSubject:      activeIdsForGroup('papers-sheet-conditions'),
			researchAreaSubject:   activeIdsForGroup('papers-sheet-research-areas'),
			sort:                  state.sort,
			relevant:              state.relevant,
			hasClinicalTrials:     state.hasClinicalTrials,
			authorId:              state.authorId,
			openAccess:            state.openAccess,
		};
	}

	var setActiveChip = BR.feedUI.setActiveChip;

	function syncSheetToDraft() {
		setActiveChip('papers-sheet-category',       draft.category);
		setActiveChip('papers-sheet-sort',           draft.sort);
		setActiveChip('papers-sheet-subjects-mode',  draft.subjectsMode || 'all');
		setActiveChip('papers-sheet-areas-mode',     draft.areasMode    || 'all');
		var showVal;
		if (draft.hasClinicalTrials === true)      showVal = 'has_clinical_trials_true';
		else if (draft.hasClinicalTrials === false) showVal = 'has_clinical_trials_false';
		else                                        showVal = String(draft.relevant);
		setActiveChip('papers-sheet-show', showVal);

		// Condition / research-area: multi-select chip groups (advanced) or combined (standard)
		var condGroup = document.getElementById('papers-sheet-conditions');
		if (condGroup) {
			var condIds = (draft.conditionSubject || '').split(',').filter(Boolean);
			condGroup.querySelectorAll('.sheet-chip').forEach(function (chip) {
				chip.classList.toggle('active', Boolean(chip.dataset.value) && condIds.indexOf(chip.dataset.value) !== -1);
			});
		}
		var raGroup = document.getElementById('papers-sheet-research-areas');
		if (raGroup) {
			var raIds = (draft.researchAreaSubject || '').split(',').filter(Boolean);
			raGroup.querySelectorAll('.sheet-chip').forEach(function (chip) {
				chip.classList.toggle('active', Boolean(chip.dataset.value) && raIds.indexOf(chip.dataset.value) !== -1);
			});
		}
		var subjectsGroup = document.getElementById('papers-sheet-subjects');
		if (subjectsGroup) {
			if (subjectsGroup.dataset.multi === 'true') {
				var activeSubjectIds = (draft.subjects || '').split(',').filter(Boolean);
				subjectsGroup.querySelectorAll('.sheet-chip').forEach(function (chip) {
					chip.classList.toggle('active', Boolean(chip.dataset.value) && activeSubjectIds.indexOf(chip.dataset.value) !== -1);
				});
			} else {
				setActiveChip('papers-sheet-subjects', draft.subjects);
			}
		}

		// Open-access chip (advanced)
		setActiveChip('papers-sheet-open-access', String(draft.openAccess));

		// Author (advanced)
		if (sheetAuthorInput) sheetAuthorInput.value = draft.authorId ? (authorInput ? authorInput.value : '') : '';
		if (sheetAuthorId)    sheetAuthorId.value    = draft.authorId || '';
	}

	function wireChipGroup(groupId, onChange) {
		var group = document.getElementById(groupId);
		if (!group) return;
		if (group.dataset.multi === 'true') {
			// Multi-select: each chip toggles independently; "clear" chip deselects all
			group.addEventListener('click', function (e) {
				var chip = e.target.closest('.sheet-chip');
				if (!chip) return;
				if (!chip.dataset.value) {
					// Clear button
					group.querySelectorAll('.sheet-chip').forEach(function (c) { c.classList.remove('active'); });
					onChange('');
				} else {
					chip.classList.toggle('active');
					var active = Array.from(group.querySelectorAll('.sheet-chip[data-value].active'))
						.map(function (c) { return c.dataset.value; }).filter(Boolean);
					onChange(active.join(','));
				}
			});
		} else {
			group.addEventListener('click', function (e) {
				var chip = e.target.closest('.sheet-chip');
				if (!chip) return;
				var chips = group.querySelectorAll('.sheet-chip');
				chips.forEach(function (c) { c.classList.remove('active'); });
				chip.classList.add('active');
				onChange(chip.dataset.value);
			});
		}
	}

	function populateMobileCategoryChips() {
		var group = document.getElementById('papers-sheet-category');
		if (!group) return;
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

	function categoryLabel(id) {
		if (!id) return '';
		var cat = state.categories.find(function (c) { return String(c.id) === id; });
		return cat ? cat.name : id;
	}

	function subjectLabel(id) {
		if (!id) return '';
		var groupIds = ['papers-sheet-conditions', 'papers-sheet-research-areas', 'papers-sheet-subjects'];
		for (var gi = 0; gi < groupIds.length; gi++) {
			var grp = document.getElementById(groupIds[gi]);
			if (!grp) continue;
			var chip = grp.querySelector('.sheet-chip[data-value="' + id + '"]');
			if (chip) return chip.textContent.trim();
		}
		return id;
	}

	var buildToken = BR.feedUI.buildToken;

	function removeToken(filterKey) {
		if (filterKey === 'category')    { state.category = ''; hideCategoryPanel(); }
		else if (filterKey === 'subjects') {
			state.subjects = '';
			state.conditionSubjects = '';
			state.areaSubjects = '';
			if (conditionsSelect)    Array.from(conditionsSelect.options).forEach(function (o) { o.selected = false; });
			if (researchAreasSelect) Array.from(researchAreasSelect.options).forEach(function (o) { o.selected = false; });
			if (subjectsMulti)       Array.from(subjectsMulti.options).forEach(function (o) { o.selected = false; });
		}
		else if (filterKey === 'sort')     state.sort = 'date';
		else if (filterKey === 'author')   { state.authorId = ''; if (authorInput) authorInput.value = ''; if (authorHidden) authorHidden.value = ''; }
		else if (filterKey === 'oa')       { state.openAccess = false; if (openAccessCheck) openAccessCheck.checked = false; }
		else if (filterKey === 'dateRange') {
			state.dateFrom = '';
			state.dateTo   = '';
			if (dateFromInput) dateFromInput.value = '';
			if (dateToInput)   dateToInput.value   = '';
		}
		else if (filterKey === 'show') {
			state.relevant = requireRelevant;
			state.hasClinicalTrials = null;
		}
		state.page = 1;
		fetchPage(1, false);
		renderTokens();
	}

	function renderTokens() {
		if (!tokenStrip) return;
		var addChip = tokenStrip.querySelector('.token-add-filters');
		while (tokenStrip.firstChild) tokenStrip.removeChild(tokenStrip.firstChild);

		var hasTokens = false;

		if (state.category) {
			tokenStrip.appendChild(buildToken(categoryLabel(state.category), 'category'));
			hasTokens = true;
		}
		if (state.subjects) {
			// Show first subject name + count if multiple
			var ids = state.subjects.split(',').filter(Boolean);
			var label = subjectLabel(ids[0]) + (ids.length > 1 ? ' +' + (ids.length - 1) : '');
			tokenStrip.appendChild(buildToken(label, 'subjects'));
			hasTokens = true;
		}
		if (state.authorId) {
			var authorDisplay = (authorInput && authorInput.value) ? authorInput.value : 'Author';
			tokenStrip.appendChild(buildToken(authorDisplay, 'author'));
			hasTokens = true;
		}
		if (state.openAccess) {
			tokenStrip.appendChild(buildToken('Open access', 'oa'));
			hasTokens = true;
		}
		if (state.sort && state.sort !== 'date') {
			var sortLabel = state.sort;
			if (sortSelect) {
				for (var i = 0; i < sortSelect.options.length; i++) {
					if (sortSelect.options[i].value === state.sort) {
						sortLabel = sortSelect.options[i].text;
						break;
					}
				}
			}
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
		if (state.dateFrom || state.dateTo) {
			var dateLabel = 'Date: ' + (state.dateFrom || '…') + ' – ' + (state.dateTo || '…');
			tokenStrip.appendChild(buildToken(dateLabel, 'dateRange'));
			hasTokens = true;
		}

		if (addChip) tokenStrip.appendChild(addChip);
		tokenStrip.hidden = !hasTokens;

		updateFabCount();
	}

	function updateFabCount() {
		var count = 0;
		if (state.category)  count++;
		if (state.subjects)  count++;
		if (state.authorId)  count++;
		if (state.openAccess) count++;
		if (state.sort && state.sort !== 'date') count++;
		if (state.hasClinicalTrials !== null) count++;
		else if (state.relevant !== requireRelevant) count++;
		if (state.dateFrom || state.dateTo) count++;

		if (!fabCount) return;
		fabCount.textContent = String(count);
		fabCount.hidden = count === 0;
	}

	var _origUpdateCounter = updateCounter;
	updateCounter = function (count) {
		_origUpdateCounter(count);
		if (mobileResultCount && resultCount) {
			mobileResultCount.innerHTML = resultCount.innerHTML;
		}
	};

	if (mobileSearchInput) {
		mobileSearchInput.addEventListener('input', debounce(function () {
			state.keyword = mobileSearchInput.value.trim();
			state.page = 1;
			if (mobileClearBtn) mobileClearBtn.hidden = !state.keyword;
			fetchPage(1, false);
			renderTokens();
		}, 200));

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

	if (tokenStrip) {
		tokenStrip.addEventListener('click', function (e) {
			var removeBtn = e.target.closest('.filter-token-remove');
			if (!removeBtn) return;
			var token = removeBtn.closest('.filter-token');
			if (!token) return;
			removeToken(token.dataset.filter);
		});
	}

	// Multi-chip groups that both contribute to draft.subjects (advanced mode)
	function wireSubjectChipGroup(groupId) {
		var group = document.getElementById(groupId);
		if (!group) return;
		var groupVals = Array.from(group.querySelectorAll('.sheet-chip[data-value]'))
			.map(function (c) { return c.dataset.value; }).filter(Boolean);
		group.addEventListener('click', function (e) {
			var chip = e.target.closest('.sheet-chip');
			if (!chip) return;
			var v = chip.dataset.value;
			var cur = (draft.subjects || '').split(',').filter(Boolean);
			if (!v) {
				// Clear button: remove all IDs from this group out of draft.subjects
				draft.subjects = cur.filter(function (id) { return groupVals.indexOf(id) === -1; }).join(',');
				group.querySelectorAll('.sheet-chip').forEach(function (c) { c.classList.remove('active'); });
			} else {
				chip.classList.toggle('active');
				var idx = cur.indexOf(v);
				if (chip.classList.contains('active')) { if (idx === -1) cur.push(v); }
				else                                   { if (idx !== -1) cur.splice(idx, 1); }
				draft.subjects = cur.join(',');
			}
		});
	}
	wireChipGroup('papers-sheet-conditions',     function (val) { draft.conditionSubject    = val; });
	wireChipGroup('papers-sheet-research-areas', function (val) { draft.researchAreaSubject = val; });
	wireChipGroup('papers-sheet-category',        function (val) { draft.category      = val; });
	wireChipGroup('papers-sheet-subjects',         function (val) { draft.subjects      = val; });
	wireChipGroup('papers-sheet-subjects-mode',    function (val) { draft.subjectsMode  = val; });
	wireChipGroup('papers-sheet-areas-mode',       function (val) { draft.areasMode     = val; });
	wireChipGroup('papers-sheet-sort',       function (val) { draft.sort = val; });
	wireChipGroup('papers-sheet-show', function (val) {
		if (val === 'has_clinical_trials_true')       { draft.hasClinicalTrials = true;  draft.relevant = requireRelevant; }
		else if (val === 'has_clinical_trials_false') { draft.hasClinicalTrials = false; draft.relevant = requireRelevant; }
		else                                          { draft.hasClinicalTrials = null;  draft.relevant = val !== 'false'; }
	});
	wireChipGroup('papers-sheet-open-access', function (val) { draft.openAccess = val === 'true'; });

	// Mobile sheet author typeahead
	if (sheetAuthorInput) {
		var sheetAuthorTimer;
		sheetAuthorInput.addEventListener('input', function () {
			var q = sheetAuthorInput.value.trim();
			if (sheetAuthorId) sheetAuthorId.value = '';
			draft.authorId = '';
			clearTimeout(sheetAuthorTimer);
			if (q.length < 2) return;
			sheetAuthorTimer = setTimeout(function () {
				var aUrl = new URL(apiBase.replace(/\/$/, '') + '/authors/');
				aUrl.searchParams.set('search', q);
				if (teamId) aUrl.searchParams.set('team_id', teamId);
				aUrl.searchParams.set('format', 'json');
				aUrl.searchParams.set('page_size', '8');
				fetch(aUrl.toString())
					.then(function (r) { return r.json(); })
					.then(function (data) {
						var authors = data.results || [];
						if (authors.length > 0) {
							var a0 = authors[0];
							var fullName = (a0.full_name || ((a0.first_name || '') + ' ' + (a0.last_name || '')).trim()).trim().toLowerCase();
							if (q.toLowerCase() === fullName) {
								draft.authorId = String(a0.author_id);
								if (sheetAuthorId) sheetAuthorId.value = draft.authorId;
							}
						}
					})
					.catch(function () {});
			}, 400);
		});
	}

	if (sheetEl) {
		sheetEl.addEventListener('show.bs.offcanvas', function () {
			resetDraft();
			populateMobileCategoryChips();
			syncSheetToDraft();
		});
	}

	if (sheetApply) {
		sheetApply.addEventListener('click', function () {
			state.category          = draft.category          !== undefined ? draft.category          : state.category;
			if (draft.conditionSubject !== undefined || draft.researchAreaSubject !== undefined) {
				state.conditionSubjects = draft.conditionSubject  !== undefined ? draft.conditionSubject  : state.conditionSubjects;
				state.areaSubjects      = draft.researchAreaSubject !== undefined ? draft.researchAreaSubject : state.areaSubjects;
				state.subjects          = [state.conditionSubjects, state.areaSubjects].filter(Boolean).join(',');
				if (conditionsSelect) {
					var condSyncIds = (state.conditionSubjects || '').split(',').filter(Boolean);
					Array.from(conditionsSelect.options).forEach(function (o) { o.selected = condSyncIds.indexOf(o.value) !== -1; });
				}
				if (researchAreasSelect) {
					var raSyncIds = (state.areaSubjects || '').split(',').filter(Boolean);
					Array.from(researchAreasSelect.options).forEach(function (o) { o.selected = raSyncIds.indexOf(o.value) !== -1; });
				}
			} else {
				state.subjects = draft.subjects !== undefined ? draft.subjects : state.subjects;
			}
			state.sort              = draft.sort               !== undefined ? draft.sort               : state.sort;
			state.subjectsMode      = draft.subjectsMode       !== undefined ? draft.subjectsMode       : state.subjectsMode;
			state.areasMode         = draft.areasMode          !== undefined ? draft.areasMode          : state.areasMode;
			state.relevant          = draft.relevant           !== undefined ? draft.relevant           : state.relevant;
			state.hasClinicalTrials = draft.hasClinicalTrials  !== undefined ? draft.hasClinicalTrials  : state.hasClinicalTrials;
			state.openAccess        = draft.openAccess         !== undefined ? draft.openAccess         : state.openAccess;
			if (papersSubjectsModeEl) {
				papersSubjectsModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
					b.classList.toggle('active', b.dataset.mode === state.subjectsMode);
					b.setAttribute('aria-pressed', b.dataset.mode === state.subjectsMode ? 'true' : 'false');
				});
			}
			if (papersAreasModeEl) {
				papersAreasModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
					b.classList.toggle('active', b.dataset.mode === state.areasMode);
					b.setAttribute('aria-pressed', b.dataset.mode === state.areasMode ? 'true' : 'false');
				});
			}
			if (draft.authorId !== undefined) {
				state.authorId = draft.authorId;
				// Sync desktop author display
				if (authorInput && sheetAuthorInput) authorInput.value = sheetAuthorInput.value;
				if (authorHidden) authorHidden.value = state.authorId;
			}
			state.page = 1;

			if (state.category) { renderCategoryPanel(); } else { hideCategoryPanel(); }

			fetchPage(1, false);
			renderTokens();

			if (window.bootstrap && bootstrap.Offcanvas) {
				var offcanvasInstance = bootstrap.Offcanvas.getInstance(sheetEl);
				if (offcanvasInstance) offcanvasInstance.hide();
			}
		});
	}

	if (sheetReset) {
		sheetReset.addEventListener('click', function () {
			draft = {
				category:            '',
				subjects:            '',
				subjectsMode:        'all',
				areasMode:           'all',
				conditionSubject:    '',
				researchAreaSubject: '',
				sort:                'date',
				relevant:            requireRelevant,
				hasClinicalTrials:   null,
				authorId:            '',
				openAccess:          false,
			};
			if (sheetAuthorInput) sheetAuthorInput.value = '';
			if (sheetAuthorId)    sheetAuthorId.value    = '';
			syncSheetToDraft();
		});
	}

	if (resetBtn) {
		resetBtn.addEventListener('click', function () {
			if (mobileSearchInput) mobileSearchInput.value = '';
			if (mobileClearBtn) mobileClearBtn.hidden = true;
			if (sheetAuthorInput) sheetAuthorInput.value = '';
			if (sheetAuthorId)    sheetAuthorId.value    = '';
			renderTokens();
		});
	}

	if (mobileSearchInput) mobileSearchInput.value = state.keyword;
	if (mobileClearBtn) mobileClearBtn.hidden = !state.keyword;
	populateMobileCategoryChips();
	renderTokens();

})();
