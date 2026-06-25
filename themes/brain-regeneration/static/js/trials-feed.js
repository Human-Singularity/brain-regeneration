/* trials-feed.js — Clinical trial listing for condition pages
 * Fetches from api.brain-regeneration.com/trials/, renders trial cards,
 * populates stats bar, handles search/phase/status filters,
 * pagination, and 1-hour client-side caching.
 */
(function () {
	'use strict';

	var listEl = document.getElementById('trials-list');
	if (!listEl) return;

	var endpoint  = listEl.dataset.endpoint  || (window.__API_BASE__ || 'https://api.brain-regeneration.com') + '/trials/';
	var teamId    = listEl.dataset.teamId    || '';
	var subjectId = listEl.dataset.subjectId || '';

	var categoryGroups = [];
	try { if (listEl.dataset.categoryGroups) categoryGroups = JSON.parse(listEl.dataset.categoryGroups); } catch (e) {}

	// ── UI references ────────────────────────────────────────────────────────
	var searchInput       = document.getElementById('search-input');
	var filterCategory    = document.getElementById('filter-category');
	var filterIdentifiers = document.getElementById('filter-identifiers');
	var filterAcronym     = document.getElementById('filter-acronym');
	var filterPhase       = document.getElementById('filter-phase');
	var filterStatus      = document.getElementById('filter-status');
	var filterCountry     = document.getElementById('filter-country');
	var filterHasResults  = document.getElementById('filter-has-results');
	var filterStudyType   = document.getElementById('filter-study-type');
	var filterSubjects    = document.getElementById('filter-subjects');
	var filterDateFrom    = document.getElementById('filter-date-from');
	var filterDateTo      = document.getElementById('filter-date-to');
	var sortOrder         = document.getElementById('sort-order');
	var resetBtn          = document.getElementById('reset-filters');
	var clearBtn        = document.getElementById('clear-filters');
	var downloadToggle  = document.getElementById('download-toggle');
	var resultsCountEl  = document.getElementById('results-count');
	var paginationEl    = document.getElementById('pagination');
	var prevBtn         = document.getElementById('prev-btn');
	var nextBtn         = document.getElementById('next-btn');
	var noResults       = document.getElementById('no-results');

	// Tab count badges
	var tabPapersCount = document.getElementById('tab-papers-count');
	var tabTrialsCount = document.getElementById('tab-trials-count');

	// Desktop chip groups (advanced search page)
	var trialsConditionChips       = document.getElementById('trials-condition-chips');
	var trialsMoreBtn              = document.getElementById('trials-more-filters-btn');
	var trialsAdvPanel             = document.getElementById('trials-advanced-panel');
	var trialsDesktopCategoryRow   = document.getElementById('trials-category-row');
	var trialsDesktopCategoryChips = document.getElementById('trials-category-chips');

	// Per-condition category groups embedded by Hugo (advanced search only)
	var categoriesBySubject = {};
	try {
		if (trialsConditionChips && trialsConditionChips.dataset.categoriesBySubject) {
			categoriesBySubject = JSON.parse(trialsConditionChips.dataset.categoriesBySubject);
		}
	} catch (e) {}

	// ── State ────────────────────────────────────────────────────────────────
	// Normalise the default status value to uppercase to match what the API expects.
	var rawDefaultStatus = listEl.dataset.defaultStatus || '';
	var normaliseStatus  = function (s) { return s ? s.toUpperCase().replace(/ /g, '_') : ''; };

	var state = {
		page:         1,
		totalPages:   1,
		total:        0,
		keyword:      '',
		identifiers:  '',
		acronym:      '',
		phase:        listEl.dataset.defaultPhase  || '',
		status:       normaliseStatus(rawDefaultStatus),
		country:      '',
		sort:         '-discovery_date',
		hasResults:   false,
		subjects:     '',
		subjectsMode: 'all', // 'all' = AND (?subjects=), 'any' = OR (?subjects_any=)
		studyType:    '',
		dateFrom:     '',
		dateTo:       '',
		categoryId:   '',
	};

	// ── URL state ─────────────────────────────────────────────────────────────

	function readURL() {
		var params = new URLSearchParams(window.location.search);
		state.keyword      = params.get('q')               || '';
		state.subjects     = params.get('conditions')      || '';
		state.subjectsMode = params.get('conditions_mode') || 'all';
		state.categoryId   = params.get('category')        || '';
		// Use params.has() so an explicit empty param (user cleared a default) beats the data-attribute default.
		state.phase        = params.has('phase')   ? (params.get('phase')  || '') : (listEl.dataset.defaultPhase  || '');
		state.status       = params.has('status')  ? (params.get('status') || '') : normaliseStatus(rawDefaultStatus);
		state.studyType    = params.get('study_type')      || '';
		state.country      = params.get('country')         || '';
		state.identifiers  = params.get('identifiers')     || '';
		state.acronym      = params.get('acronym')         || '';
		state.hasResults   = params.get('has_results')     === 'true';
		state.dateFrom     = params.get('date_from')       || '';
		state.dateTo       = params.get('date_to')         || '';
		state.sort         = params.get('sort')            || '-discovery_date';
		state.page         = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
	}

	function writeURL(push) {
		var params = new URLSearchParams();
		var defaultPhase  = listEl.dataset.defaultPhase  || '';
		var defaultStatus = normaliseStatus(rawDefaultStatus);
		if (state.keyword)                params.set('q',               state.keyword);
		if (state.subjects)               params.set('conditions',      state.subjects);
		if (state.subjectsMode !== 'all') params.set('conditions_mode', state.subjectsMode);
		if (state.categoryId)             params.set('category',        state.categoryId);
		// Write phase/status when they differ from the page default so that an
		// explicitly-cleared default (state='') is represented as param= in the URL.
		if (state.phase  !== defaultPhase  && (state.phase  || defaultPhase))  params.set('phase',  state.phase);
		if (state.status !== defaultStatus && (state.status || defaultStatus)) params.set('status', state.status);
		if (state.studyType)              params.set('study_type',      state.studyType);
		if (state.country)                params.set('country',         state.country);
		if (state.identifiers)            params.set('identifiers',     state.identifiers);
		if (state.acronym)                params.set('acronym',         state.acronym);
		if (state.hasResults)             params.set('has_results',     'true');
		if (state.dateFrom)               params.set('date_from',       state.dateFrom);
		if (state.dateTo)                 params.set('date_to',         state.dateTo);
		if (state.sort !== '-discovery_date') params.set('sort',        state.sort);
		if (state.page > 1)               params.set('page',            String(state.page));
		var url = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
		if (push) {
			history.pushState(null, '', url);
		} else {
			history.replaceState(null, '', url);
		}
	}

	// Build/hide the per-condition category chip row (desktop + mobile sheet).
	// Reads committed state (not draft) and re-renders chips whenever the active
	// condition changes. Safe to call before mobile elements exist — falls back
	// gracefully when container IDs are absent.
	function updateCategoryRow() {
		var mobileGroup = document.getElementById('trials-sheet-category-group');
		var mobileChips = document.getElementById('trials-sheet-category');

		var activeIds = state.subjects ? state.subjects.split(',').filter(Boolean) : [];
		var groups    = activeIds.length === 1 ? (categoriesBySubject[activeIds[0]] || null) : null;

		if (!groups || !groups.length) {
			if (trialsDesktopCategoryRow) trialsDesktopCategoryRow.hidden = true;
			if (mobileGroup) mobileGroup.hidden = true;
			if (state.categoryId) {
				state.categoryId = '';
				if (filterCategory) filterCategory.value = '';
			}
			return;
		}

		function buildChips(container) {
			if (!container) return;
			container.innerHTML = '';
			var allBtn = document.createElement('button');
			allBtn.type = 'button';
			allBtn.className = 'search-chip';
			allBtn.dataset.value = '';
			allBtn.textContent = 'All categories';
			BR.feedUI.setSearchChipActive(allBtn, !state.categoryId);
			container.appendChild(allBtn);
			groups.forEach(function (grp) {
				(grp.categories || []).forEach(function (cat) {
					var btn = document.createElement('button');
					btn.type = 'button';
					btn.className = 'search-chip';
					btn.dataset.value = String(cat.id);
					btn.textContent = cat.name;
					BR.feedUI.setSearchChipActive(btn, String(cat.id) === state.categoryId);
					container.appendChild(btn);
				});
			});
		}

		buildChips(trialsDesktopCategoryChips);
		buildChips(mobileChips);
		if (trialsDesktopCategoryRow) trialsDesktopCategoryRow.hidden = false;
		if (mobileGroup) mobileGroup.hidden = false;
	}

	// ── Cache ────────────────────────────────────────────────────────────────
	// Call sites pass fully-qualified keys (brTrialsFeed:… / brTrialsStats:…),
	// so the factory prefix is empty.
	var cache = BR.makeCache('', 60 * 60 * 1000); // 1 hour
	function getCached(key) { return cache.get(key); }
	function setCached(key, data) { cache.set(key, data); }

	// ── Helpers ──────────────────────────────────────────────────────────────
	var debounce  = BR.debounce;
	var escHtml   = BR.escHtml;
	var stripHtml = BR.stripHtml;
	var truncate  = BR.truncate;  // pure truncate \u2014 strip HTML at the call site

	// ── API URL builder ──────────────────────────────────────────────────────
	function buildURL(page) {
		var url = new URL(endpoint);
		url.searchParams.set('format', 'json');
		if (teamId)       url.searchParams.set('team_id',    teamId);
		if (subjectId)    url.searchParams.set('subject_id', subjectId);
		if (state.keyword)     url.searchParams.set('search',             state.keyword);
		if (state.identifiers) url.searchParams.set('identifiers',        state.identifiers);
		if (state.acronym)     url.searchParams.set('acronym',            state.acronym);
		if (state.phase)       url.searchParams.set('phase',              state.phase);
		if (state.status)      url.searchParams.set('recruitment_status', state.status);
		if (state.country)     url.searchParams.set('countries',          state.country);
		if (state.hasResults)  url.searchParams.set('has_results',        'true');
		if (state.subjects)    url.searchParams.set(state.subjectsMode === 'any' ? 'subjects_any' : 'subjects', state.subjects);
		if (state.studyType)   url.searchParams.set('study_type',              state.studyType);
		if (state.dateFrom)    url.searchParams.set('date_registration_after',  state.dateFrom);
		if (state.dateTo)      url.searchParams.set('date_registration_before', state.dateTo);
		if (state.categoryId)  url.searchParams.set('category_id', state.categoryId);
		url.searchParams.set('ordering', state.sort);
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
		var summary   = truncate(stripHtml(t.summary), 300);
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
		url.searchParams.set('format',    'json');
		url.searchParams.set('team_id',   teamId);
		if (subjectId) url.searchParams.set('subject_id', subjectId);
		url.searchParams.set('page_size', '1');

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
		var _trialsFirst = document.getElementById('trials-first-btn');
		var _trialsLast  = document.getElementById('trials-last-btn');
		if (_trialsFirst) _trialsFirst.disabled = currentPage <= 1;
		if (_trialsLast)  _trialsLast.disabled  = currentPage >= totalPages;

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
	function fetchPage(page, push) {
		var url = buildURL(page);
		var cacheKey = 'brTrialsFeed:' + url;
		var cached = getCached(cacheKey);
		if (cached && cached.count > 0) {
			renderCards(cached.results || []);
			updatePagination(cached.current_page || page, cached.total_pages || 1, cached.count || 0);
			if (tabTrialsCount && page === 1) tabTrialsCount.textContent = (cached.count || 0).toLocaleString();
			writeURL(push === true);
			renderTrialsTokens();
			return;
		}

		renderLoading();
		fetch(url)
			.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
			.then(function (data) {
				if (data && data.count > 0) setCached(cacheKey, data);
				renderCards(data.results || []);
				updatePagination(data.current_page || page, data.total_pages || 1, data.count || 0);
				if (tabTrialsCount && page === 1) tabTrialsCount.textContent = (data.count || 0).toLocaleString();
				writeURL(push === true);
				renderTrialsTokens();
			})
			.catch(renderError);
	}

	// ── Event listeners ───────────────────────────────────────────────────────
	var filterForm = document.getElementById('trials-filter-form');

	function applyFilters() {
		state.keyword      = searchInput      ? searchInput.value.trim()      : '';
		state.identifiers  = filterIdentifiers ? filterIdentifiers.value.trim() : '';
		state.acronym      = filterAcronym     ? filterAcronym.value.trim()     : '';
		state.phase        = filterPhase      ? filterPhase.value              : '';
		state.status       = filterStatus     ? filterStatus.value             : '';
		state.country      = filterCountry    ? filterCountry.value.trim()     : '';
		state.sort         = sortOrder        ? sortOrder.value                : '-discovery_date';
		state.hasResults   = filterHasResults  ? filterHasResults.checked       : false;
		state.categoryId   = filterCategory   ? filterCategory.value           : '';
		if (trialsConditionChips) {
			var chipIds = [];
			trialsConditionChips.querySelectorAll('.search-chip.search-chip--active').forEach(function (c) {
				if (c.dataset.value) chipIds.push(c.dataset.value);
			});
			state.subjects = chipIds.join(',');
		} else {
			state.subjects = filterSubjects ? Array.from(filterSubjects.selectedOptions).map(function (o) { return o.value; }).join(',') : '';
		}
		var modeBtn = document.querySelector('#trials-subjects-mode .subjects-mode-btn.active');
		if (modeBtn) state.subjectsMode = modeBtn.dataset.mode || 'all';
		state.studyType    = filterStudyType ? filterStudyType.value : '';
		state.dateFrom     = filterDateFrom  ? filterDateFrom.value  : '';
		state.dateTo       = filterDateTo    ? filterDateTo.value    : '';
		fetchPage(1, true);
	}

	// Form submit handles both the Search button and Enter key from any field
	if (filterForm) {
		filterForm.addEventListener('submit', function (e) {
			e.preventDefault();
			applyFilters();
		});
	}

	// Individual fields also apply immediately for a snappy feel
	if (searchInput) {
		searchInput.addEventListener('input', debounce(applyFilters, 400));
	}

	if (filterIdentifiers) {
		filterIdentifiers.addEventListener('input', debounce(applyFilters, 600));
	}

	if (filterAcronym) {
		filterAcronym.addEventListener('input', debounce(applyFilters, 600));
	}

	if (filterPhase) {
		filterPhase.addEventListener('change', applyFilters);
	}

	if (filterStatus) {
		filterStatus.addEventListener('change', applyFilters);
	}

	if (filterCountry) {
		filterCountry.addEventListener('change', applyFilters);
	}
	if (sortOrder) {
		sortOrder.addEventListener('change', applyFilters);
	}
	if (filterHasResults) {
		filterHasResults.addEventListener('change', applyFilters);
	}
	if (filterCategory) {
		filterCategory.addEventListener('change', applyFilters);
	}
	if (filterStudyType) {
		filterStudyType.addEventListener('change', applyFilters);
	}
	if (filterSubjects) {
		filterSubjects.addEventListener('change', applyFilters);
	}
	if (filterDateFrom) filterDateFrom.addEventListener('change', applyFilters);
	if (filterDateTo)   filterDateTo.addEventListener('change', applyFilters);
	function resetAll() {
		state.keyword      = '';
		state.identifiers  = '';
		state.acronym      = '';
		state.phase        = '';
		state.status       = '';
		state.country      = '';
		state.sort         = '-discovery_date';
		state.hasResults   = false;
		state.subjects     = '';
		state.subjectsMode = 'all';
		state.studyType    = '';
		state.dateFrom     = '';
		state.dateTo       = '';
		state.categoryId   = '';
		if (trialsSubjectsModeEl) {
			trialsSubjectsModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
				b.classList.toggle('active', b.dataset.mode === 'all');
				b.setAttribute('aria-pressed', b.dataset.mode === 'all' ? 'true' : 'false');
			});
		}
		if (searchInput)       searchInput.value        = '';
		if (filterIdentifiers) filterIdentifiers.value  = '';
		if (filterAcronym)     filterAcronym.value      = '';
		if (filterPhase)       filterPhase.value        = '';
		if (filterStatus)      filterStatus.value       = '';
		if (filterCountry)     filterCountry.value      = '';
		if (sortOrder)         sortOrder.value          = '-discovery_date';
		if (filterHasResults)  filterHasResults.checked = false;
		if (filterCategory)    filterCategory.value     = '';
		if (filterStudyType)   filterStudyType.value    = '';
		if (filterSubjects)    Array.from(filterSubjects.options).forEach(function (o) { o.selected = false; });
		if (filterDateFrom)    filterDateFrom.value     = '';
		if (filterDateTo)      filterDateTo.value       = '';
		if (trialsConditionChips) {
			trialsConditionChips.querySelectorAll('.search-chip').forEach(function (c) { BR.feedUI.setSearchChipActive(c, false); });
		}
		updateCategoryRow();
		fetchPage(1, true);
	}

	if (resetBtn) resetBtn.addEventListener('click', resetAll);
	if (clearBtn) clearBtn.addEventListener('click', resetAll);

	// ── Desktop subjects mode toggle ─────────────────────────────────────────
	var trialsSubjectsModeEl = document.getElementById('trials-subjects-mode');
	if (trialsSubjectsModeEl) {
		trialsSubjectsModeEl.addEventListener('click', function (e) {
			var btn = e.target.closest('.subjects-mode-btn');
			if (!btn) return;
			trialsSubjectsModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
				b.classList.remove('active');
				b.setAttribute('aria-pressed', 'false');
			});
			btn.classList.add('active');
			btn.setAttribute('aria-pressed', 'true');
			state.subjectsMode = btn.dataset.mode;
			if (state.subjects) fetchPage(1, true);
		});
	}

	// ── Desktop condition chips ──────────────────────────────────────────────
	if (trialsConditionChips) {
		trialsConditionChips.addEventListener('click', function (e) {
			var chip = e.target.closest('.search-chip');
			if (!chip) return;
			BR.feedUI.setSearchChipActive(chip, !chip.classList.contains('search-chip--active'));
			var ids = [];
			trialsConditionChips.querySelectorAll('.search-chip.search-chip--active').forEach(function (c) {
				if (c.dataset.value) ids.push(c.dataset.value);
			});
			state.subjects = ids.join(',');
			state.categoryId = '';
			updateCategoryRow();
			fetchPage(1, true);
		});
	}

	// ── Desktop category chips (advanced search — populated by updateCategoryRow) ─
	if (trialsDesktopCategoryChips) {
		trialsDesktopCategoryChips.addEventListener('click', function (e) {
			var chip = e.target.closest('.search-chip');
			if (!chip) return;
			trialsDesktopCategoryChips.querySelectorAll('.search-chip').forEach(function (c) {
				BR.feedUI.setSearchChipActive(c, false);
			});
			BR.feedUI.setSearchChipActive(chip, true);
			state.categoryId = chip.dataset.value;
			fetchPage(1, true);
		});
	}

	// ── More filters toggle ──────────────────────────────────────────────────
	BR.feedUI.wireMoreFilters(trialsMoreBtn, trialsAdvPanel, 'trials-more-arrow');

	// ── Hero hint tags ───────────────────────────────────────────────────────
	BR.feedUI.wireHintTags(function (hint) {
		if (searchInput) searchInput.value = hint;
		applyFilters();
	});

	// ── Hero search button ───────────────────────────────────────────────────
	var heroSearchBtn = document.getElementById('search-btn');
	// Only the advanced-search hero button (type="button"); on condition pages
	// #search-btn is the form's submit button and is handled by the form submit
	// listener — binding here too would fire a second, stale-state fetch.
	if (heroSearchBtn && heroSearchBtn.type !== 'submit') {
		heroSearchBtn.addEventListener('click', applyFilters);
	}

	if (prevBtn) {
		prevBtn.addEventListener('click', function () {
			if (state.page > 1) fetchPage(state.page - 1, true);
		});
	}

	if (nextBtn) {
		nextBtn.addEventListener('click', function () {
			if (state.page < state.totalPages) fetchPage(state.page + 1, true);
		});
	}

	document.addEventListener('click', function (e) {
		var btn = e.target.closest && e.target.closest('.pagination-btn.page-num');
		if (btn && !btn.disabled) fetchPage(parseInt(btn.dataset.page, 10), true);
	});

	// ── CSV download ─────────────────────────────────────────────────────────
	function buildCSVURL(allResults) {
		var url = new URL(endpoint);
		url.searchParams.set('format', 'csv');
		if (teamId)        url.searchParams.set('team_id',    teamId);
		if (subjectId)     url.searchParams.set('subject_id', subjectId);
		if (state.keyword)     url.searchParams.set('search',             state.keyword);
		if (state.identifiers) url.searchParams.set('identifiers',        state.identifiers);
		if (state.acronym)     url.searchParams.set('acronym',            state.acronym);
		if (state.phase)       url.searchParams.set('phase',              state.phase);
		if (state.status)      url.searchParams.set('recruitment_status', state.status);
		if (state.country)     url.searchParams.set('countries',          state.country);
		if (state.hasResults)  url.searchParams.set('has_results',  'true');
		if (state.subjects)    url.searchParams.set(state.subjectsMode === 'any' ? 'subjects_any' : 'subjects', state.subjects);
		if (state.studyType)   url.searchParams.set('study_type',              state.studyType);
		if (state.dateFrom)    url.searchParams.set('date_registration_after',  state.dateFrom);
		if (state.dateTo)      url.searchParams.set('date_registration_before', state.dateTo);
		if (state.categoryId)  url.searchParams.set('category_id', state.categoryId);
		url.searchParams.set('ordering', state.sort);
		if (allResults) {
			url.searchParams.set('all_results', 'true');
		} else {
			url.searchParams.set('page', String(state.page));
		}
		return url.toString();
	}

	function buildFilename(allResults) {
		var parts = ['clinical-trials'];
		if (state.keyword)     parts.push(state.keyword.replace(/\s+/g, '-').toLowerCase());
		if (state.identifiers) parts.push(state.identifiers.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase());
		if (state.acronym)     parts.push(state.acronym.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase());
		if (state.phase)       parts.push(state.phase.toLowerCase());
		if (state.status)      parts.push(state.status.toLowerCase().replace(/_/g, '-'));
		if (state.country)     parts.push(state.country.replace(/\s+/g, '-').toLowerCase());
		if (!allResults)       parts.push('page-' + state.page);
		return parts.join('_') + '.csv';
	}

	function triggerDownload(allResults) {
		if (!downloadToggle) return;

		// Show loading state
		downloadToggle.classList.add('is-downloading');
		downloadToggle.disabled = true;

		fetch(buildCSVURL(allResults))
			.then(function (r) {
				if (!r.ok) throw new Error('HTTP ' + r.status);
				return r.blob();
			})
			.then(function (blob) {
				var url = URL.createObjectURL(blob);
				var a   = document.createElement('a');
				a.href     = url;
				a.download = buildFilename(allResults);
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				// Snap to solid green briefly to confirm completion
				downloadToggle.classList.remove('is-downloading');
				downloadToggle.classList.add('is-download-done');
				setTimeout(function () {
					downloadToggle.classList.remove('is-download-done');
					downloadToggle.disabled = false;
				}, 800);
			})
			.catch(function () {
				alert('Download failed. Please try again.');
				downloadToggle.classList.remove('is-downloading');
				downloadToggle.disabled = false;
			});
	}

	BR.feedUI.wireDownloadDropdown(downloadToggle, {
		onPage: function () { triggerDownload(false); },
		onAll:  function () { triggerDownload(true); }
	});

	// ── Init ──────────────────────────────────────────────────────────────────
	readURL();

	if (filterStatus && state.status) filterStatus.value = state.status;
	if (filterPhase  && state.phase)  filterPhase.value  = state.phase;

	// Populate category controls from category groups
	if (categoryGroups.length) {
		if (filterCategory) {
			categoryGroups.forEach(function (grp) {
				var og = document.createElement('optgroup');
				og.label = grp.label;
				(grp.categories || []).forEach(function (cat) {
					var opt = document.createElement('option');
					opt.value = String(cat.id);
					opt.textContent = cat.name;
					og.appendChild(opt);
				});
				filterCategory.appendChild(og);
			});
		}
		var trialsSheetCategoryEl = document.getElementById('trials-sheet-category');
		if (trialsSheetCategoryEl) {
			categoryGroups.forEach(function (grp) {
				(grp.categories || []).forEach(function (cat) {
					var btn = document.createElement('button');
					btn.type = 'button';
					btn.className = 'sheet-chip';
					btn.dataset.value = String(cat.id);
					btn.textContent = cat.name;
					trialsSheetCategoryEl.appendChild(btn);
				});
			});
		}
	}

	// Wire first/last page buttons added for numbered pagination
	var trialsFirstBtn = document.getElementById('trials-first-btn');
	var trialsLastBtn  = document.getElementById('trials-last-btn');
	if (trialsFirstBtn) trialsFirstBtn.addEventListener('click', function () { if (state.page > 1) fetchPage(1, true); });
	if (trialsLastBtn)  trialsLastBtn.addEventListener('click',  function () { if (state.page < state.totalPages) fetchPage(state.totalPages, true); });

	fetchStats(); // always fetches unfiltered aggregate stats
	fetchPage(state.page, false);

	// Background fetch for papers tab count badge
	if (tabPapersCount) {
		var papersEndpoint = endpoint.replace('/trials/', '/articles/');
		var papersCountUrl = papersEndpoint + '?format=json&page_size=1' + (teamId ? '&team_id=' + teamId : '');
		fetch(papersCountUrl)
			.then(function (r) { return r.json(); })
			.then(function (d) { if (d.count != null) tabPapersCount.textContent = d.count.toLocaleString(); })
			.catch(function () {});
	}

	// ── Mobile UI module ──────────────────────────────────────────────────────
	var trialsMobileBar    = document.getElementById('trials-mobile-bar');
	if (!trialsMobileBar) return; // mobile elements not present — skip

	var trialsMobileSearch      = document.getElementById('trials-mobile-search');
	var trialsMobileClear       = document.getElementById('trials-mobile-clear');
	var trialsTokenStrip        = document.getElementById('trials-filter-tokens');
	var trialsFabCount          = document.getElementById('trials-fab-count');
	var trialsSheetEl           = document.getElementById('trials-filter-sheet');
	var trialsSheetApply        = document.getElementById('trials-sheet-apply');
	var trialsSheetReset        = document.getElementById('trials-sheet-reset');
	var trialsMobileCount       = document.getElementById('trials-mobile-result-count');
	var trialsSheetIdentifiers  = document.getElementById('trials-sheet-identifiers-input');
	var trialsSheetAcronym      = document.getElementById('trials-sheet-acronym-input');

	// ── Sync state → UI controls (used by init and popstate) ─────────────────
	function syncUIFromState() {
		if (searchInput)       searchInput.value        = state.keyword;
		if (filterPhase)       filterPhase.value        = state.phase;
		if (filterStatus)      filterStatus.value       = state.status;
		if (sortOrder)         sortOrder.value          = state.sort;
		if (filterCountry)     filterCountry.value      = state.country;
		if (filterHasResults)  filterHasResults.checked = state.hasResults;
		if (filterStudyType)   filterStudyType.value    = state.studyType;
		if (filterDateFrom)    filterDateFrom.value     = state.dateFrom;
		if (filterDateTo)      filterDateTo.value       = state.dateTo;
		if (filterIdentifiers) filterIdentifiers.value  = state.identifiers;
		if (filterAcronym)     filterAcronym.value      = state.acronym;
		if (filterCategory)    filterCategory.value     = state.categoryId;
		if (filterSubjects) {
			var selIds = state.subjects ? state.subjects.split(',') : [];
			Array.from(filterSubjects.options).forEach(function (o) { o.selected = selIds.indexOf(o.value) !== -1; });
		}
		if (trialsConditionChips) {
			var chipIds = state.subjects ? state.subjects.split(',') : [];
			trialsConditionChips.querySelectorAll('.search-chip').forEach(function (c) {
				BR.feedUI.setSearchChipActive(c, chipIds.indexOf(c.dataset.value) !== -1);
			});
		}
		if (trialsSubjectsModeEl) {
			trialsSubjectsModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
				b.classList.toggle('active', b.dataset.mode === state.subjectsMode);
				b.setAttribute('aria-pressed', b.dataset.mode === state.subjectsMode ? 'true' : 'false');
			});
		}
		if (trialsMobileSearch) trialsMobileSearch.value = state.keyword;
		if (trialsMobileClear)  trialsMobileClear.hidden = !state.keyword;
		updateCategoryRow();
	}

	window.addEventListener('popstate', function () {
		readURL();
		syncUIFromState();
		fetchPage(state.page, false);
	});

	// Draft edited inside sheet; committed on "Show results"
	var trialsDraft = {};

	function trialsSubjectsArray(draft) {
		var s = draft !== undefined ? draft : trialsDraft;
		return s.subjects ? s.subjects.split(',').filter(Boolean) : [];
	}

	function syncTrialsSubjectChips() {
		var group = document.getElementById('trials-sheet-subjects');
		if (!group) return;
		var selected = trialsSubjectsArray();
		group.querySelectorAll('.sheet-chip').forEach(function (chip) {
			var v = chip.dataset.value;
			if (v === '') {
				chip.classList.toggle('active', selected.length === 0);
			} else {
				chip.classList.toggle('active', selected.indexOf(v) !== -1);
			}
		});
	}

	function resetTrialsDraft() {
		trialsDraft = {
			phase:        state.phase,
			status:       state.status,
			sort:         state.sort,
			hasResults:   state.hasResults,
			identifiers:  state.identifiers,
			acronym:      state.acronym,
			subjects:     state.subjects,
			subjectsMode: state.subjectsMode,
			studyType:    state.studyType,
			categoryId:   state.categoryId,
		};
	}

	// ── Sheet chip helpers ────────────────────────────────────────────────────

	var setTrialsActiveChip = BR.feedUI.setActiveChip;

	function syncTrialsSheetToDraft() {
		setTrialsActiveChip('trials-sheet-phase',         trialsDraft.phase);
		setTrialsActiveChip('trials-sheet-status',        trialsDraft.status);
		setTrialsActiveChip('trials-sheet-sort',          trialsDraft.sort);
		setTrialsActiveChip('trials-sheet-show',          trialsDraft.hasResults ? 'has_results' : '');
		setTrialsActiveChip('trials-sheet-study-type',    trialsDraft.studyType || '');
		setTrialsActiveChip('trials-sheet-subjects-mode', trialsDraft.subjectsMode || 'all');
		setTrialsActiveChip('trials-sheet-category',      trialsDraft.categoryId || '');
		if (trialsSheetIdentifiers) trialsSheetIdentifiers.value = trialsDraft.identifiers || '';
		if (trialsSheetAcronym)     trialsSheetAcronym.value     = trialsDraft.acronym     || '';
		syncTrialsSubjectChips();
	}

	function wireTrialsChipGroup(groupId, onChange) {
		var group = document.getElementById(groupId);
		if (!group) return;
		group.addEventListener('click', function (e) {
			var chip = e.target.closest('.sheet-chip');
			if (!chip) return;
			group.querySelectorAll('.sheet-chip').forEach(function (c) { c.classList.remove('active'); });
			chip.classList.add('active');
			onChange(chip.dataset.value);
		});
	}

	wireTrialsChipGroup('trials-sheet-phase',         function (v) { trialsDraft.phase = v; });
	wireTrialsChipGroup('trials-sheet-status',        function (v) { trialsDraft.status = v; });
	wireTrialsChipGroup('trials-sheet-sort',          function (v) { trialsDraft.sort = v; });
	wireTrialsChipGroup('trials-sheet-show',          function (v) { trialsDraft.hasResults = v === 'has_results'; });
	wireTrialsChipGroup('trials-sheet-study-type',    function (v) { trialsDraft.studyType = v; });
	wireTrialsChipGroup('trials-sheet-subjects-mode', function (v) { trialsDraft.subjectsMode = v; });
	wireTrialsChipGroup('trials-sheet-category',      function (v) { trialsDraft.categoryId = v; });

	// Multi-select subjects chip group
	(function () {
		var group = document.getElementById('trials-sheet-subjects');
		if (!group || group.dataset.multi !== 'true') return;
		group.addEventListener('click', function (e) {
			var chip = e.target.closest('.sheet-chip');
			if (!chip) return;
			var v = chip.dataset.value;
			if (v === '') {
				trialsDraft.subjects = '';
			} else {
				var arr = trialsSubjectsArray();
				var idx = arr.indexOf(v);
				if (idx === -1) { arr.push(v); } else { arr.splice(idx, 1); }
				trialsDraft.subjects = arr.join(',');
			}
			syncTrialsSubjectChips();
		});
	})();

	if (trialsSheetIdentifiers) {
		trialsSheetIdentifiers.addEventListener('input', function () {
			trialsDraft.identifiers = trialsSheetIdentifiers.value.trim();
		});
	}
	if (trialsSheetAcronym) {
		trialsSheetAcronym.addEventListener('input', function () {
			trialsDraft.acronym = trialsSheetAcronym.value.trim();
		});
	}

	// ── Token strip ───────────────────────────────────────────────────────────

	var buildTrialsToken = BR.feedUI.buildToken;

	function removeTrialsToken(filterKey) {
		if (filterKey === 'phase')       state.phase = '';
		if (filterKey === 'status')      state.status = '';
		if (filterKey === 'sort')        state.sort = '-discovery_date';
		if (filterKey === 'hasResults')  state.hasResults = false;
		if (filterKey === 'identifiers') state.identifiers = '';
		if (filterKey === 'acronym')     state.acronym = '';
		if (filterKey === 'subjects')    state.subjects = '';
		if (filterKey === 'studyType')   state.studyType = '';
		if (filterKey === 'dateRange')   { state.dateFrom = ''; state.dateTo = ''; }
		if (filterKey === 'categoryId')  state.categoryId = '';
		// Sync desktop controls
		if (filterPhase)       filterPhase.value        = state.phase;
		if (filterStatus)      filterStatus.value       = state.status;
		if (sortOrder)         sortOrder.value          = state.sort;
		if (filterHasResults)  filterHasResults.checked = state.hasResults;
		if (filterIdentifiers) filterIdentifiers.value  = state.identifiers;
		if (filterAcronym)     filterAcronym.value      = state.acronym;
		if (filterCategory)    filterCategory.value     = state.categoryId;
		if (filterStudyType)   filterStudyType.value    = state.studyType;
		if (filterSubjects)    Array.from(filterSubjects.options).forEach(function (o) { o.selected = state.subjects && state.subjects.split(',').indexOf(o.value) !== -1; });
		if (filterDateFrom)    filterDateFrom.value     = state.dateFrom;
		if (filterDateTo)      filterDateTo.value       = state.dateTo;
		updateCategoryRow();
		fetchPage(1, true);
	}

	function phaseLabel(v) {
		var map = { PHASE1: 'Phase 1', PHASE2: 'Phase 2', PHASE3: 'Phase 3', PHASE4: 'Phase 4' };
		return map[v] || v;
	}

	function statusLabel(v) {
		var d = STATUS_MAP[v];
		return d ? d.label : (v || '');
	}

	function renderTrialsTokens() {
		if (!trialsTokenStrip) return;
		var addChip = trialsTokenStrip.querySelector('.token-add-filters');
		while (trialsTokenStrip.firstChild) trialsTokenStrip.removeChild(trialsTokenStrip.firstChild);

		var hasTokens = false;

		if (state.subjects) {
			var subjectNames = [];
			if (filterSubjects) {
				var selectedIds = state.subjects.split(',');
				Array.from(filterSubjects.options).forEach(function (o) {
					if (selectedIds.indexOf(o.value) !== -1) subjectNames.push(o.text);
				});
			}
			trialsTokenStrip.appendChild(buildTrialsToken(subjectNames.length ? subjectNames.join(', ') : state.subjects, 'subjects'));
			hasTokens = true;
		}
		if (state.studyType) {
			trialsTokenStrip.appendChild(buildTrialsToken(state.studyType.charAt(0).toUpperCase() + state.studyType.slice(1), 'studyType'));
			hasTokens = true;
		}
		if (state.identifiers) {
			trialsTokenStrip.appendChild(buildTrialsToken('ID: ' + state.identifiers, 'identifiers'));
			hasTokens = true;
		}
		if (state.acronym) {
			trialsTokenStrip.appendChild(buildTrialsToken(state.acronym, 'acronym'));
			hasTokens = true;
		}
		if (state.phase) {
			trialsTokenStrip.appendChild(buildTrialsToken(phaseLabel(state.phase), 'phase'));
			hasTokens = true;
		}
		if (state.status) {
			trialsTokenStrip.appendChild(buildTrialsToken(statusLabel(state.status), 'status'));
			hasTokens = true;
		}
		if (state.sort && state.sort !== '-discovery_date') {
			var sortLabels = {
				'discovery_date':  'Date added (oldest)',
				'-last_updated':   'Last updated (newest)',
				'last_updated':    'Last updated (oldest)',
				'-published_date': 'Published (newest)',
				'published_date':  'Published (oldest)',
				'title':           'Title A–Z',
				'-title':          'Title Z–A',
			};
			trialsTokenStrip.appendChild(buildTrialsToken(sortLabels[state.sort] || state.sort, 'sort'));
			hasTokens = true;
		}
		if (state.hasResults) {
			trialsTokenStrip.appendChild(buildTrialsToken('With results', 'hasResults'));
			hasTokens = true;
		}
		if (state.categoryId) {
			var catName = state.categoryId;
			categoryGroups.forEach(function (grp) {
				(grp.categories || []).forEach(function (cat) {
					if (String(cat.id) === state.categoryId) catName = cat.name;
				});
			});
			trialsTokenStrip.appendChild(buildTrialsToken(catName, 'categoryId'));
			hasTokens = true;
		}
		if (state.dateFrom || state.dateTo) {
			var dateLabel = 'Date: ' + (state.dateFrom || '…') + ' – ' + (state.dateTo || '…');
			trialsTokenStrip.appendChild(buildTrialsToken(dateLabel, 'dateRange'));
			hasTokens = true;
		}

		if (addChip) trialsTokenStrip.appendChild(addChip);
		trialsTokenStrip.hidden = !hasTokens;

		updateTrialsFabCount();
	}

	function updateTrialsFabCount() {
		var count = 0;
		if (state.identifiers) count++;
		if (state.acronym) count++;
		if (state.phase) count++;
		if (state.status) count++;
		if (state.sort && state.sort !== '-discovery_date') count++;
		if (state.hasResults) count++;
		if (state.subjects)   count++;
		if (state.studyType)  count++;
		if (state.categoryId) count++;
		if (state.dateFrom || state.dateTo) count++;
		if (!trialsFabCount) return;
		trialsFabCount.textContent = String(count);
		trialsFabCount.hidden = count === 0;
	}

	function updateTrialsMobileCount() {
		if (!trialsMobileCount) return;
		var desktop = document.getElementById('results-count');
		if (desktop && desktop.innerHTML) trialsMobileCount.innerHTML = desktop.innerHTML;
	}

	// Patch updatePagination to mirror the result count on mobile
	var origUpdatePagination = updatePagination;
	updatePagination = function (currentPage, totalPages, total) {
		origUpdatePagination(currentPage, totalPages, total);
		updateTrialsMobileCount();
	};

	// ── Mobile search ─────────────────────────────────────────────────────────

	if (trialsMobileSearch) {
		trialsMobileSearch.addEventListener('input', debounce(function () {
			state.keyword = trialsMobileSearch.value.trim();
			if (searchInput) searchInput.value = state.keyword;
			if (trialsMobileClear) trialsMobileClear.hidden = !state.keyword;
			fetchPage(1, true);
		}, 200));
	}

	if (trialsMobileClear) {
		trialsMobileClear.addEventListener('click', function () {
			state.keyword = '';
			if (trialsMobileSearch) trialsMobileSearch.value = '';
			if (searchInput) searchInput.value = '';
			trialsMobileClear.hidden = true;
			fetchPage(1, true);
		});
	}

	// ── Token removal via delegation ──────────────────────────────────────────

	if (trialsTokenStrip) {
		trialsTokenStrip.addEventListener('click', function (e) {
			var removeBtn = e.target.closest('.filter-token-remove');
			if (!removeBtn) return;
			var token = removeBtn.closest('.filter-token');
			if (!token) return;
			removeTrialsToken(token.dataset.filter);
		});
	}

	// ── Sheet open: sync draft from live state ────────────────────────────────

	if (trialsSheetEl) {
		trialsSheetEl.addEventListener('show.bs.offcanvas', function () {
			resetTrialsDraft();
			updateCategoryRow();
			syncTrialsSheetToDraft();
		});
	}

	if (trialsSheetApply) {
		trialsSheetApply.addEventListener('click', function () {
			state.phase        = trialsDraft.phase        !== undefined ? trialsDraft.phase        : state.phase;
			state.status       = trialsDraft.status       !== undefined ? trialsDraft.status       : state.status;
			state.sort         = trialsDraft.sort         !== undefined ? trialsDraft.sort         : state.sort;
			state.hasResults   = trialsDraft.hasResults   !== undefined ? trialsDraft.hasResults   : state.hasResults;
			state.identifiers  = trialsDraft.identifiers  !== undefined ? trialsDraft.identifiers  : state.identifiers;
			state.acronym      = trialsDraft.acronym      !== undefined ? trialsDraft.acronym      : state.acronym;
			state.subjects     = trialsDraft.subjects     !== undefined ? trialsDraft.subjects     : state.subjects;
			state.subjectsMode = trialsDraft.subjectsMode !== undefined ? trialsDraft.subjectsMode : state.subjectsMode;
			state.studyType    = trialsDraft.studyType    !== undefined ? trialsDraft.studyType    : state.studyType;
			state.categoryId   = trialsDraft.categoryId   !== undefined ? trialsDraft.categoryId   : state.categoryId;
			if (trialsSubjectsModeEl) {
				trialsSubjectsModeEl.querySelectorAll('.subjects-mode-btn').forEach(function (b) {
					b.classList.toggle('active', b.dataset.mode === state.subjectsMode);
					b.setAttribute('aria-pressed', b.dataset.mode === state.subjectsMode ? 'true' : 'false');
				});
			}

			// Keep desktop controls in sync
			if (filterPhase)       filterPhase.value        = state.phase;
			if (filterStatus)      filterStatus.value       = state.status;
			if (sortOrder)         sortOrder.value          = state.sort;
			if (filterHasResults)  filterHasResults.checked = state.hasResults;
			if (filterIdentifiers) filterIdentifiers.value  = state.identifiers;
			if (filterAcronym)     filterAcronym.value      = state.acronym;
			if (filterCategory)    filterCategory.value     = state.categoryId;
			if (filterStudyType)   filterStudyType.value    = state.studyType;
			if (filterSubjects) {
				var selSubjects = state.subjects ? state.subjects.split(',') : [];
				Array.from(filterSubjects.options).forEach(function (o) { o.selected = selSubjects.indexOf(o.value) !== -1; });
			}

			updateCategoryRow();
			fetchPage(1, true);

			if (window.bootstrap && bootstrap.Offcanvas) {
				var inst = bootstrap.Offcanvas.getInstance(trialsSheetEl);
				if (inst) inst.hide();
			}
		});
	}

	if (trialsSheetReset) {
		trialsSheetReset.addEventListener('click', function () {
			trialsDraft = { phase: '', status: '', sort: '-discovery_date', hasResults: false, identifiers: '', acronym: '', subjects: '', subjectsMode: 'all', studyType: '', categoryId: '' };
			if (trialsSheetIdentifiers) trialsSheetIdentifiers.value = '';
			if (trialsSheetAcronym)     trialsSheetAcronym.value     = '';
			syncTrialsSheetToDraft();
		});
	}

	// Also update mobile tokens when desktop reset is clicked
	if (resetBtn) {
		resetBtn.addEventListener('click', function () {
			if (trialsMobileSearch)     trialsMobileSearch.value     = '';
			if (trialsMobileClear)      trialsMobileClear.hidden     = true;
			if (trialsSheetIdentifiers) trialsSheetIdentifiers.value = '';
			if (trialsSheetAcronym)     trialsSheetAcronym.value     = '';
			setTrialsActiveChip('trials-sheet-category', '');
			syncTrialsSubjectChips();
			renderTrialsTokens();
		});
	}
	if (clearBtn) {
		clearBtn.addEventListener('click', function () {
			if (trialsMobileSearch)     trialsMobileSearch.value     = '';
			if (trialsMobileClear)      trialsMobileClear.hidden     = true;
			if (trialsSheetIdentifiers) trialsSheetIdentifiers.value = '';
			if (trialsSheetAcronym)     trialsSheetAcronym.value     = '';
			setTrialsActiveChip('trials-sheet-category', '');
			syncTrialsSubjectChips();
			renderTrialsTokens();
		});
	}

	// ── Init mobile ───────────────────────────────────────────────────────────
	syncUIFromState();
	renderTrialsTokens();

})();
