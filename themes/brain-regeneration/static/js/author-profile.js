/* author-profile.js — Author profile page (/authors/{orcid}/).
 * Extracts the ORCID from the URL path, resolves it against GregoryAI's
 * /authors/ endpoint, then renders a profile built from that author record
 * plus their tracked articles (/articles/?author_id=).
 *
 * GregoryAI's author record (see /authors/{id}/) does not currently expose:
 * institutional affiliation, a "tracked since" date, a topics/collaborators
 * breakdown, or ORCID-based lookup. Where the design calls for those, this
 * script derives a best-effort value from the author's fetched articles and
 * labels it as sampled when the fetch was capped. See the improvement-request
 * notes in communication/gregoryai-api-requests-author-profile.md.
 */
(function () {
	'use strict';

	var shell = document.getElementById('author-shell');
	if (!shell) return;

	var loadingEl   = document.getElementById('author-loading');
	var notfoundEl  = document.getElementById('author-notfound');
	var errorEl     = document.getElementById('author-error');
	var retryBtn    = document.getElementById('author-retry-btn');
	var contentEl   = document.getElementById('author-content');
	var apiBase     = (shell.dataset.apiBase || window.__API_BASE__ || 'https://api.brain-regeneration.com').replace(/\/$/, '');

	// Safe local fallbacks mirroring br-utils.js, in case window.BR isn't
	// present — these must not be no-ops, since API data is rendered via
	// innerHTML below and unescaped values would be an XSS/open-redirect risk.
	function fallbackEscHtml(str) {
		if (str == null) return '';
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}
	var _fallbackDecodeEl;
	function fallbackDecodeEntities(str) {
		if (str == null || str === '') return '';
		if (!_fallbackDecodeEl) _fallbackDecodeEl = document.createElement('textarea');
		_fallbackDecodeEl.innerHTML = String(str);
		return _fallbackDecodeEl.value;
	}
	function fallbackSafeLink(url) {
		if (!url) return '#';
		try {
			var parsed = new URL(String(url));
			if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '#';
			return parsed.href;
		} catch (e) { return '#'; }
	}

	var BR             = window.BR || {};
	var escHtml        = BR.escHtml        || fallbackEscHtml;
	var decodeEntities = BR.decodeEntities || fallbackDecodeEntities;
	var safeLink       = BR.safeLink       || fallbackSafeLink;

	var ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
	var AGG_PAGE_SIZE = 100;
	var AGG_MAX_PAGES = 5; // cap aggregation at 500 tracked papers

	function parseOrcid() {
		var parts = window.location.pathname.replace(/\/$/, '').split('/');
		var id = parts[parts.length - 1];
		return ORCID_RE.test(id) ? id : null;
	}

	var orcid = parseOrcid();

	function showState(which) {
		if (loadingEl)  loadingEl.hidden  = which !== 'loading';
		if (notfoundEl) notfoundEl.hidden = which !== 'notfound';
		if (errorEl)    errorEl.hidden    = which !== 'error';
		if (contentEl)  contentEl.hidden  = which !== 'content';
	}

	if (!orcid) { showState('notfound'); return; }

	function fetchJson(url) {
		return fetch(url).then(function (r) {
			if (!r.ok) throw new Error('http ' + r.status);
			return r.json();
		});
	}

	function findAuthorByOrcid() {
		var url = new URL(apiBase + '/authors/');
		url.searchParams.set('search', orcid);
		url.searchParams.set('format', 'json');
		url.searchParams.set('page_size', '50');
		return fetchJson(url.toString()).then(function (data) {
			var results = data.results || [];
			var match = results.filter(function (a) {
				return a && a.ORCID && String(a.ORCID).toUpperCase() === orcid.toUpperCase();
			})[0];
			return match || null;
		});
	}

	function fetchAggregateArticles(authorId) {
		var collected = [];
		function loadPage(pageNum) {
			var url = new URL(apiBase + '/articles/');
			url.searchParams.set('author_id', authorId);
			url.searchParams.set('ordering', '-published_date');
			url.searchParams.set('page_size', String(AGG_PAGE_SIZE));
			url.searchParams.set('page', String(pageNum));
			url.searchParams.set('format', 'json');
			return fetchJson(url.toString()).then(function (data) {
				collected = collected.concat(data.results || []);
				if (data.next && pageNum < AGG_MAX_PAGES) return loadPage(pageNum + 1);
				return { articles: collected, truncated: !!data.next };
			});
		}
		return loadPage(1);
	}

	function fetchDisplayPapers(authorId, sort) {
		var url = new URL(apiBase + '/articles/');
		url.searchParams.set('author_id', authorId);
		url.searchParams.set('ordering', sort === 'relevance' ? '-ml_score' : '-published_date');
		url.searchParams.set('page_size', '3');
		url.searchParams.set('format', 'json');
		return fetchJson(url.toString()).then(function (data) { return data.results || []; });
	}

	// ── relevance: majority vote across the latest run per algorithm, same
	// threshold (0.8) and logic as article-single.js's groupPredictions ──
	function articleRelevance(a) {
		var preds = a.ml_predictions || [];
		if (!preds.length) return { label: 'Unrated', cls: 'unrated' };
		var latestByAlgo = {};
		preds.forEach(function (p) {
			var algo = p.algorithm || 'ML';
			var existing = latestByAlgo[algo];
			if (!existing || (p.id || 0) > (existing.id || 0)) latestByAlgo[algo] = p;
		});
		var latest = Object.keys(latestByAlgo).map(function (k) { return latestByAlgo[k]; });
		var passCount = latest.filter(function (p) { return p.predicted_relevant && (p.probability_score || 0) >= 0.8; }).length;
		var passes = passCount >= Math.ceil(latest.length / 2);
		return passes ? { label: 'Relevant', cls: 'pass' } : { label: 'Below threshold', cls: 'medium' };
	}

	function computeAggregates(articles, authorRecord) {
		var subjectsMap = {};
		var collabMap = {};
		var years = [];

		articles.forEach(function (a) {
			var subs = a.subjects || [];
			var cats = a.team_categories || [];
			subs.forEach(function (s) {
				var name = s.subject_name || s.name;
				if (!name) return;
				if (!subjectsMap[name]) subjectsMap[name] = { count: 0, categories: {} };
				subjectsMap[name].count++;
				cats.forEach(function (c) {
					var cname = c.category_name || c.slug;
					if (!cname) return;
					subjectsMap[name].categories[cname] = (subjectsMap[name].categories[cname] || 0) + 1;
				});
			});

			var selfName = (authorRecord.full_name || '').trim().toLowerCase();
			(a.authors || []).forEach(function (au) {
				if (!au || !au.full_name) return;
				var isSelf = (au.author_id != null && authorRecord.author_id != null)
					? au.author_id === authorRecord.author_id
					: (!!selfName && au.full_name.trim().toLowerCase() === selfName);
				if (isSelf) return;
				var key = au.author_id != null ? String(au.author_id) : au.full_name;
				if (!collabMap[key]) collabMap[key] = { name: au.full_name, orcid: au.ORCID || null, count: 0 };
				if (!collabMap[key].orcid && au.ORCID) collabMap[key].orcid = au.ORCID;
				collabMap[key].count++;
			});

			var y = a.published_date ? new Date(a.published_date).getFullYear() : NaN;
			if (Number.isFinite(y) && y > 1900) years.push(y);
		});

		var subjects = Object.keys(subjectsMap).map(function (name) {
			var s = subjectsMap[name];
			var categories = Object.keys(s.categories).map(function (c) {
				return { name: c, count: s.categories[c] };
			}).sort(function (a, b) { return b.count - a.count; }).slice(0, 6);
			return { name: name, count: s.count, categories: categories };
		}).sort(function (a, b) { return b.count - a.count; });

		var allCollaborators = Object.keys(collabMap).map(function (k) { return collabMap[k]; })
			.sort(function (a, b) { return b.count - a.count; });

		return {
			subjects: subjects,
			collaboratorsTotal: allCollaborators.length,
			collaborators: allCollaborators.slice(0, 8),
			earliestYear: years.length ? Math.min.apply(null, years) : null
		};
	}

	// ── identity mark: teal initials disc + amber relevance gauge ring ──
	var PALETTE = ['#1A6B6A', '#E8913A', '#14807E', '#0F5E5C', '#3E7C7B', '#1A6B39', '#B06D24', '#2A6B6A'];

	function initialsOf(a) {
		var g = (a.given_name || '').trim().charAt(0);
		var f = (a.family_name || '').trim().charAt(0);
		if (g || f) return (g + f).toUpperCase();
		var parts = (a.full_name || '').trim().split(/\s+/);
		return ((parts[0] || '').charAt(0) + (parts[parts.length - 1] || '').charAt(0)).toUpperCase();
	}

	function renderIdentityMark(relevantPct) {
		var ring = 'conic-gradient(from -90deg,#E8913A 0 ' + relevantPct + '%,rgba(255,255,255,.5) ' + relevantPct + '% 100%)';
		var title = relevantPct + '% of tracked papers flagged relevant by GregoryAI';
		return '<div class="author-mark" title="' + escHtml(title) + '" aria-label="' + escHtml(title) + '" style="background:' + ring + '">' +
			'<div class="author-mark__disc">' + escHtml(initialsOf(state.author)) + '</div>' +
		'</div>';
	}

	function renderPaperCard(a) {
		var rel = articleRelevance(a);
		var authors = (a.authors || []).map(function (x) { return x.full_name; }).filter(Boolean);
		var coauthorCount = Math.max(0, authors.length - 1);
		var accessOpen = a.access === 'open';
		var categories = a.team_categories || [];
		var subjects = a.subjects || [];
		var url = a.article_id ? '/articles/' + encodeURIComponent(a.article_id) + '/' : safeLink(a.link);
		var year = a.published_date ? new Date(a.published_date).getFullYear() : '';

		var chips = '';
		if (categories.length) {
			chips += '<span class="author-chip author-chip--category">' + escHtml(decodeEntities(categories[0].category_name || categories[0].slug || '')) + '</span>';
		}
		subjects.slice(0, 2).forEach(function (s) {
			chips += '<span class="author-chip">' + escHtml(decodeEntities(s.subject_name || s.name || '')) + '</span>';
		});

		return '<a class="author-paper-card" href="' + escHtml(url) + '">' +
			'<div class="author-paper-card__badges">' +
				'<span class="relevance-badge' + (rel.cls === 'medium' ? ' medium' : (rel.cls === 'unrated' ? ' unrated' : '')) + '"><span class="dot"></span>' + escHtml(rel.label) + '</span>' +
				'<span class="access-badge ' + (accessOpen ? 'open' : 'restricted') + '">' + (accessOpen ? 'Open access' : 'Restricted') + '</span>' +
			'</div>' +
			'<div class="author-paper-card__title">' + escHtml(decodeEntities(a.title || '')) + '</div>' +
			'<div class="author-paper-card__meta">' +
				(a.container_title ? '<span class="author-paper-card__journal">' + escHtml(decodeEntities(a.container_title)) + '</span> · ' : '') +
				(year ? year + ' · ' : '') +
				coauthorCount + ' co-author' + (coauthorCount === 1 ? '' : 's') +
			'</div>' +
			(chips ? '<div class="author-paper-card__chips">' + chips + '</div>' : '') +
		'</a>';
	}

	function renderPapersList(papers) {
		var listEl = document.getElementById('author-papers-list');
		if (!listEl) return;
		if (!papers.length) {
			listEl.innerHTML = '<p class="author-empty-note">No tracked papers yet.</p>';
			return;
		}
		listEl.innerHTML = papers.map(renderPaperCard).join('');
	}

	function renderSubjects(subjects) {
		if (!subjects.length) return '<p class="author-empty-note">No subjects matched yet.</p>';
		return subjects.map(function (s) {
			var chips = s.categories.map(function (c) {
				return '<span class="author-collab-chip">' + escHtml(decodeEntities(c.name)) + ' <span class="author-chip__count">' + c.count + '</span></span>';
			}).join('');
			return '<div class="author-subject">' +
				'<div class="author-subject__head"><span class="author-subject__name">' + escHtml(decodeEntities(s.name)) + '</span>' +
				'<span class="author-subject__count">' + s.count + ' paper' + (s.count === 1 ? '' : 's') + '</span></div>' +
				(chips ? '<div class="author-subject__chips">' + chips + '</div>' : '') +
			'</div>';
		}).join('');
	}

	function collabInitials(name) {
		var parts = String(name || '').trim().split(/\s+/);
		return ((parts[0] || '').charAt(0) + (parts[parts.length - 1] || '').charAt(0)).toUpperCase();
	}

	function renderCollaborators(collaborators) {
		if (!collaborators.length) return '<p class="author-empty-note">No frequent collaborators found yet.</p>';
		return collaborators.map(function (c, i) {
			var hasOrcid = !!c.orcid;
			var tag = hasOrcid ? 'a' : 'div';
			var linkAttrs = hasOrcid ? ' href="/authors/' + escHtml(encodeURIComponent(c.orcid)) + '/"' : '';
			var cls = 'author-collaborator' + (hasOrcid ? '' : ' author-collaborator--no-orcid');
			var title = hasOrcid ? '' : ' title="No ORCID on file — no profile page yet"';
			return '<' + tag + ' class="' + cls + '"' + linkAttrs + title + '>' +
				'<div class="author-collaborator__avatar" style="background:' + PALETTE[i % PALETTE.length] + '">' + escHtml(collabInitials(c.name)) + '</div>' +
				'<div><div class="author-collaborator__name">' + escHtml(decodeEntities(c.name)) + '</div>' +
				'<div class="author-collaborator__meta">' + c.count + ' shared paper' + (c.count === 1 ? '' : 's') + '</div></div>' +
			'</' + tag + '>';
		}).join('');
	}

	// ── module state ──
	var state = { sort: 'recent', bioOpen: false, author: null, aggregates: null };

	function wireSort() {
		var recentBtn = document.getElementById('author-sort-recent');
		var relevantBtn = document.getElementById('author-sort-relevant');
		if (!recentBtn || !relevantBtn) return;
		function apply(sort) {
			state.sort = sort;
			recentBtn.classList.toggle('active', sort === 'recent');
			relevantBtn.classList.toggle('active', sort === 'relevance');
			var listEl = document.getElementById('author-papers-list');
			if (listEl) listEl.setAttribute('aria-busy', 'true');
			fetchDisplayPapers(state.author.author_id, sort).then(function (papers) {
				renderPapersList(papers);
				if (listEl) listEl.removeAttribute('aria-busy');
			}).catch(function () {
				if (listEl) listEl.removeAttribute('aria-busy');
			});
		}
		recentBtn.addEventListener('click', function () { apply('recent'); });
		relevantBtn.addEventListener('click', function () { apply('relevance'); });
	}

	function wireBioToggle() {
		var btn = document.getElementById('author-bio-toggle');
		var bioEl = document.getElementById('author-bio-text');
		if (!btn || !bioEl) return;
		btn.addEventListener('click', function () {
			state.bioOpen = !state.bioOpen;
			bioEl.classList.toggle('clamped', !state.bioOpen);
			btn.textContent = state.bioOpen ? 'Read less' : 'Read more';
			btn.setAttribute('aria-expanded', String(state.bioOpen));
		});
	}

	function renderPage(author, agg) {
		var articlesCount = author.articles_count || 0;
		var relevantCount = author.relevant_articles_count || 0;
		var relevantPct = articlesCount ? Math.round((relevantCount / articlesCount) * 100) : 0;

		var bioParagraphs = (author.biography || '').split(/\n\s*\n/).filter(Boolean)
			.map(function (p) { return '<p>' + escHtml(p.trim()) + '</p>'; }).join('');

		var sinceText = agg.earliestYear ? ('Since ' + agg.earliestYear) : '—';

		var statsHtml = [
			{ value: String(articlesCount), label: 'Papers indexed' },
			{ value: String(agg.subjects.length), label: 'Topics spanned' },
			{ value: String(agg.collaboratorsTotal), label: 'Collaborators' },
			{ value: relevantPct + '%', label: 'Flagged relevant' },
			{ value: sinceText, label: 'Tracked here' }
		].map(function (s) {
			return '<div class="author-stat"><div class="author-stat__value">' + escHtml(s.value) + '</div><div class="author-stat__label">' + escHtml(s.label) + '</div></div>';
		}).join('');

		var searchHref = '/search/' + (author.author_id ? ('?author_id=' + encodeURIComponent(author.author_id)) : '');
		var rssHref = apiBase + '/feed/author/' + encodeURIComponent(author.ORCID);

		var sampleNote = agg.truncated
			? '<p class="author-sample-note">Sidebar and topic/collaborator counts are based on the ' + agg.sampleSize + ' most recently tracked papers (out of ' + articlesCount + ' indexed) — full aggregation across all papers is pending a backend improvement.</p>'
			: '';

		contentEl.innerHTML =
			'<div class="author-card">' +
				'<div class="author-header">' +
					renderIdentityMark(relevantPct) +
					'<div class="author-header__id">' +
						'<div class="author-eyebrow">Author</div>' +
						'<h1>' + escHtml(decodeEntities(author.full_name || '')) + '</h1>' +
						(author.country ? '<div class="author-affiliation">' + escHtml(author.country) + '</div>' : '') +
						'<div class="author-orcid-row">' +
							'<span class="author-orcid-label">ORCID</span>' +
							'<a class="author-orcid-pill" href="https://orcid.org/' + encodeURIComponent(author.ORCID) + '" target="_blank" rel="noopener noreferrer">' + escHtml(author.ORCID) + '</a>' +
						'</div>' +
					'</div>' +
					'<a class="author-follow-btn" href="' + escHtml(rssHref) + '" target="_blank" rel="noopener noreferrer">' +
						'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="5" cy="19" r="2.2" fill="currentColor"></circle><path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path><path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path></svg>' +
						'Follow new papers' +
					'</a>' +
				'</div>' +
				'<div class="author-stats">' + statsHtml + '</div>' +
				'<div class="author-body">' +
					'<div class="author-main">' +
						(author.biography ? (
							'<div class="author-bio">' +
								'<div class="author-bio__text clamped" id="author-bio-text">' + bioParagraphs + '</div>' +
								'<button type="button" class="author-bio__toggle" id="author-bio-toggle" aria-controls="author-bio-text" aria-expanded="false">Read more</button>' +
							'</div>'
						) : '<p class="author-empty-note">No biography on file yet.</p>') +
						'<div class="author-papers-head">' +
							'<h2>Papers</h2>' +
							'<div class="author-sort-toggle">' +
								'<button type="button" id="author-sort-recent" class="active">Most recent</button>' +
								'<button type="button" id="author-sort-relevant">Most relevant</button>' +
							'</div>' +
						'</div>' +
						'<div id="author-papers-list" class="author-papers-list"></div>' +
						'<div class="author-search-more">' +
							'<a href="' + escHtml(searchHref) + '">See all papers in advanced search <span aria-hidden="true">&rarr;</span></a>' +
						'</div>' +
					'</div>' +
					'<div class="author-sidebar">' +
						'<h3 class="author-sidebar__eyebrow">Research focus</h3>' +
						'<p class="author-sidebar__caption">Subjects this author publishes in, with the categories matched within each.</p>' +
						'<div class="author-subjects">' + renderSubjects(agg.subjects) + '</div>' +
						'<h3 class="author-sidebar__eyebrow">Frequent collaborators</h3>' +
						'<div class="author-collaborators">' + renderCollaborators(agg.collaborators) + '</div>' +
						sampleNote +
					'</div>' +
				'</div>' +
				'<div class="author-footer">Showing up to 3 of ' + articlesCount + ' tracked here · Relevance ranked by GregoryAI · Open by design</div>' +
			'</div>';

		wireSort();
		wireBioToggle();
	}

	findAuthorByOrcid().then(function (author) {
		if (!author) { showState('notfound'); return null; }
		state.author = author;
		return Promise.all([
			fetchAggregateArticles(author.author_id),
			fetchDisplayPapers(author.author_id, 'recent')
		]).then(function (results) {
			var aggData = results[0];
			var papers = results[1];
			var agg = computeAggregates(aggData.articles, author);
			agg.truncated = aggData.truncated;
			agg.sampleSize = aggData.articles.length;
			state.aggregates = agg;
			renderPage(author, agg);
			renderPapersList(papers);
			showState('content');
		});
	}).catch(function () {
		showState('error');
	});

	if (retryBtn) {
		retryBtn.addEventListener('click', function () {
			window.location.reload();
		});
	}
})();
