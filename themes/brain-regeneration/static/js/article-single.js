/* article-single.js — Single article view (Option B: Two-column, sticky sidebar)
 * Extracts the article ID from the URL path (/articles/{id}/),
 * fetches from the Gregory MS API, and renders the two-column layout.
 */
(function () {
	'use strict';

	// ── Mount points ──────────────────────────────────────────────────────
	var shell        = document.getElementById('article-shell');
	if (!shell) return;

	var loading      = document.getElementById('article-loading');
	var errorEl      = document.getElementById('article-error');
	var retryBtn     = document.getElementById('article-retry-btn');
	var content      = document.getElementById('article-content');
	var bcArea       = document.getElementById('article-breadcrumb-area');
	var bcSep2       = document.getElementById('article-breadcrumb-sep2');
	var bcLabel      = document.getElementById('article-breadcrumb-label');

	var apiBase      = (shell.dataset.apiBase || window.__API_BASE__ || 'https://api.gregory-ms.com').replace(/\/$/, '');

	// ── Extract article ID from URL ───────────────────────────────────────
	// Supports: /articles/28491/ and /articles/28491
	function parseArticleId() {
		var parts = window.location.pathname.replace(/\/$/, '').split('/');
		var id = parts[parts.length - 1];
		return /^\d+$/.test(id) ? id : null;
	}

	var articleId = parseArticleId();

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

	function formatDate(iso) {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric', month: 'short', year: 'numeric'
		});
	}

	function formatAuthors(authors) {
		if (!authors || !authors.length) return '';
		return authors.map(function (a) { return a.full_name || ''; }).filter(Boolean).join(', ');
	}

	// ── SVG icons (inline, matches the mockup icon set) ──────────────────

	function icon(name, size) {
		size = size || 16;
		var paths = {
			external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
			quote:    '<path d="M3 21c3 0 7-1 7-8V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3"/><path d="M14 21c3 0 7-1 7-8V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3"/>',
			bookmark: '<path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l7-4 7 4z"/>',
			share:    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
			bell:     '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
			calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
			file:     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
			lock:     '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
			unlock:   '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
			cpu:      '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
			flask:    '<path d="M9 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-10V2"/><path d="M9 2h6"/>',
			pin:      '<path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
			sparkle:  '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
			history:  '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
			alert:    '<path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
		};
		var d = paths[name] || '';
		return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
			'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
			'aria-hidden="true" style="display:inline-block;vertical-align:-2px;flex-shrink:0">' +
			d + '</svg>';
	}

	// ── ML predictions processing ─────────────────────────────────────────
	// The API returns a flat list of predictions: { algorithm, probability_score, predicted_relevant, subject: {name} }
	// We group by subject name and render one row per subject.
	function groupPredictions(preds) {
		if (!preds || !preds.length) return [];
		var bySubject = {};
		var subjectOrder = [];
		preds.forEach(function (p) {
			var subjectName = (p.subject && (p.subject.subject_name || p.subject.name)) || 'General';
			if (!bySubject[subjectName]) {
				bySubject[subjectName] = [];
				subjectOrder.push(subjectName);
			}
			bySubject[subjectName].push(p);
		});
		return subjectOrder.map(function (name) {
			var algos = bySubject[name];
			// Sort by id descending to get latest run per algo
			var latestByAlgo = {};
			algos.forEach(function (p) {
				var algo = p.algorithm || 'ML';
				var existing = latestByAlgo[algo];
				if (!existing || (p.id || 0) > (existing.id || 0)) {
					latestByAlgo[algo] = p;
				}
			});
			var latest = Object.keys(latestByAlgo).map(function (k) { return latestByAlgo[k]; });
			var passCount = latest.filter(function (p) { return p.predicted_relevant && (p.probability_score || 0) >= 0.8; }).length;
			var passes = passCount >= Math.ceil(latest.length / 2);
			return { subject: name, algorithms: latest, passes: passes };
		});
	}

	// ── Render blocks ─────────────────────────────────────────────────────

	function renderRetractedBanner() {
		return '<div class="retracted-banner" role="alert">' +
			'<span class="retracted-banner__icon">' + icon('alert', 22) + '</span>' +
			'<div>' +
				'<p class="retracted-banner__title">Retracted</p>' +
				'<p class="retracted-banner__body">This article has been retracted by the publisher. ' +
				'The findings should not be cited as evidence.</p>' +
			'</div></div>';
	}

	function renderArticleHeader(a) {
		var kind = a.article_type || a.kind || 'article';
		var kindLabel = kind === 'science paper' || kind === 'science_paper' ? 'Science paper' : 'Article';
		var authors   = formatAuthors(a.authors);
		return '<header>' +
			'<div class="article-eyebrow">' +
				'<span>' + escHtml(kindLabel) + '</span>' +
				'<span class="dot" aria-hidden="true"></span>' +
				'<span class="muted">Indexed ' + escHtml(formatDate(a.discovery_date || a.added_date)) + '</span>' +
				'<span class="dot" aria-hidden="true"></span>' +
				'<span class="muted">ID #' + escHtml(String(a.article_id || a.id || '')) + '</span>' +
			'</div>' +
			'<h1 class="article-title">' + escHtml(a.title) + '</h1>' +
			(authors ? '<p class="article-authors">' + escHtml(authors) + '</p>' : '') +
			'<p class="article-source">' +
				(a.container_title ? '<strong>' + escHtml(a.container_title) + '</strong> · ' : '') +
				(a.publisher ? escHtml(a.publisher) + ' · ' : '') +
				'Published ' + escHtml(formatDate(a.published_date)) +
			'</p>' +
		'</header>';
	}

	function renderMetaInline(a) {
		var accessIcon = a.access === 'open' ? icon('unlock', 14) : icon('lock', 14);
		var accessBadge = a.access === 'open'
			? '<span class="badge badge--open">Open access</span>'
			: '<span class="badge badge--restricted">Restricted</span>';
		return '<div class="meta-inline">' +
			(a.doi ? '<span class="meta-inline__cell">' + icon('file', 14) + ' DOI <span class="mono">' + escHtml(a.doi) + '</span></span>' : '') +
			'<span class="meta-inline__cell">' + icon('calendar', 14) + ' Published <strong>' + escHtml(formatDate(a.published_date)) + '</strong></span>' +
			'<span class="meta-inline__cell">' + icon('history', 14) + ' Indexed <strong>' + escHtml(formatDate(a.discovery_date || a.added_date)) + '</strong></span>' +
			'<span class="meta-inline__cell">' + accessIcon + ' ' + accessBadge + '</span>' +
		'</div>';
	}

	function renderActionRow(a) {
		var doiHref = a.doi ? 'https://doi.org/' + encodeURIComponent(a.doi) : safeLink(a.link);
		return '<div class="action-row">' +
			'<a class="btn btn--amber" href="' + escHtml(safeLink(a.link)) + '" target="_blank" rel="noopener noreferrer">' +
				icon('external', 16) + ' Read full article' +
			'</a>' +
			(a.doi ? '<a class="btn btn--ghost" href="' + escHtml(doiHref) + '" target="_blank" rel="noopener noreferrer">' + icon('file', 14) + ' DOI</a>' : '') +
			'<button class="btn btn--ghost" id="article-share-btn" aria-label="Share">' + icon('share', 14) + ' Share</button>' +
		'</div>';
	}

	function renderPlainEnglish(summary) {
		if (!summary) return '';
		return '<div class="plain-english">' +
			'<span class="plain-english__label">' + icon('sparkle', 12) + ' Plain English · written by our team</span>' +
			'<p class="plain-english__body">' + escHtml(summary) + '</p>' +
		'</div>';
	}

	var subjectUrls = window.__SUBJECT_URLS__ || {};

	function subjectUrl(name) {
		// Normalise to lowercase for lookup — matches Hugo's `.Title | lower` at build time.
		return subjectUrls[String(name).toLowerCase().trim()] || null;
	}

	function renderSubjects(a) {
		var subjects   = a.subjects   || [];
		var categories = a.team_categories || [];
		if (!subjects.length && !categories.length) return '';
		var out = '';
		if (subjects.length) {
			out += '<div class="tag-list">';
			subjects.forEach(function (s) {
				var name = s.subject_name || s.name || s;
				var url  = subjectUrl(name);
				if (url) {
					out += '<a class="tag-item" href="' + escHtml(url) + '">' + escHtml(name) + '</a>';
				} else {
					out += '<span class="tag-item">' + escHtml(name) + '</span>';
				}
			});
			out += '</div>';
		}
		if (categories.length) {
			out += '<div class="tag-list">';
			categories.forEach(function (c) {
				var name = c.category_name || c.slug || c;
				out += '<span class="tag-item tag-item--team"># ' + escHtml(name) + '</span>';
			});
			out += '</div>';
		}
		return out;
	}

	function renderMLWidget(grouped) {
		if (!grouped || !grouped.length) return '';
		var rows = grouped.map(function (g) {
			var verdictCls = g.passes ? 'ml-row__verdict--pass' : 'ml-row__verdict--fail';
			var verdictLabel = g.passes ? 'Relevant' : 'Below threshold';
			var algos = g.algorithms.map(function (al) {
				var score = al.probability_score || 0;
				var pct   = Math.round(score * 100);
				var low   = score < 0.8;
				return '<div class="ml-algo">' +
					'<span>' + escHtml(al.algorithm || 'ML') + '</span>' +
					'<span class="ml-algo__bar"><span class="ml-algo__bar-fill' + (low ? ' ml-algo__bar-fill--low' : '') + '" style="width:' + pct + '%"></span></span>' +
					'<span class="ml-algo__pct' + (low ? ' ml-algo__pct--low' : '') + '">' + pct + '%</span>' +
				'</div>';
			}).join('');
			return '<div class="ml-row">' +
				'<div class="ml-row__head"><p class="ml-row__subject">' + escHtml(g.subject) + '</p></div>' +
				'<span class="ml-row__verdict ' + verdictCls + '">' +
					'<span class="dot" aria-hidden="true"></span>' + escHtml(verdictLabel) +
				'</span>' +
				(algos ? '<div class="ml-algos">' + algos + '</div>' : '') +
			'</div>';
		}).join('');

		return '<div class="ml-widget">' +
			'<div class="ml-widget__head">' +
				'<p class="ml-widget__title">' + icon('cpu', 12) + ' ML relevance</p>' +
			'</div>' +
			'<p class="ml-widget__caption">Scored by independent algorithms. Threshold 0.8.</p>' +
			rows +
		'</div>';
	}

	function renderAsideCitation(a) {
		var rows = '';
		if (a.doi) {
			rows += '<dt>DOI</dt><dd class="mono"><a href="https://doi.org/' + encodeURIComponent(a.doi) + '" target="_blank" rel="noopener noreferrer">' + escHtml(a.doi) + '</a></dd>';
		}
		if (a.container_title) {
			rows += '<dt>Journal</dt><dd style="font-style:italic">' + escHtml(a.container_title) + '</dd>';
		}
		if (a.publisher) {
			rows += '<dt>Publisher</dt><dd>' + escHtml(a.publisher) + '</dd>';
		}
		if (a.sources && a.sources.length) {
			rows += '<dt>Sources</dt><dd>' + escHtml(a.sources.join(' · ')) + '</dd>';
		}
		return '<div class="aside-card">' +
			'<p class="aside-card__label">Citation &amp; access</p>' +
			'<dl>' + rows + '</dl>' +
		'</div>';
	}

	function renderSubscribeCTA(a) {
		var areaName = (a.subjects && a.subjects[0] && (a.subjects[0].subject_name || a.subjects[0].name)) || 'this area';
		return '<div class="aside-card aside-card--tint">' +
			'<p class="aside-card__label">' + icon('bell', 12) + ' Stay informed</p>' +
			'<p class="aside-card__body">Get a weekly digest of new <strong>' + escHtml(areaName) + '</strong> papers.</p>' +
			'<a href="/subscribe/" class="btn btn--outline-teal" style="font-size:13px;padding:7px 16px;">Subscribe to digest ' + icon('external', 14) + '</a>' +
		'</div>';
	}

	function renderRelatedTrials(trials) {
		if (!trials || !trials.length) return '';
		var cards = trials.map(function (t) {
			var title  = t.title || '';
			var href   = safeLink(t.link) || '#';
			// Extract NCT ID from the ClinicalTrials.gov link if present
			var nct    = '';
			if (t.link) {
				var m = String(t.link).match(/NCT\d+/i);
				if (m) nct = m[0].toUpperCase();
			}

			return '<a class="related-trial" href="' + escHtml(href) + '" target="_blank" rel="noopener noreferrer">' +
				'<div class="related-trial__head">' +
					'<p class="related-trial__title">' + escHtml(title) + '</p>' +
				'</div>' +
				(nct ? '<p class="related-trial__nct">' + escHtml(nct) + '</p>' : '') +
			'</a>';
		}).join('');

		return '<section class="article-section">' +
			'<div class="article-section__head">' +
				'<h2>' + icon('flask', 12) + ' Related trials</h2>' +
			'</div>' +
			'<p style="font-family:var(--font-heading);font-size:13px;color:var(--color-muted);margin:-8px 0 14px;">Clinical trials referenced in the abstract</p>' +
			'<div class="related-trials-grid">' + cards + '</div>' +
		'</section>';
	}

	function renderArticle(a) {
		var mlGrouped = groupPredictions(a.ml_predictions);
		var summary   = a.summary_plain_english || '';
		var trials    = a.clinical_trials || [];

		var main = renderArticleHeader(a) +
			renderMetaInline(a) +
			renderActionRow(a);

		if (summary) {
			main += '<section class="article-section">' +
				'<div class="article-section__head"><h2>' + icon('sparkle', 12) + ' In plain English</h2></div>' +
				renderPlainEnglish(summary) +
			'</section>';
		}

		var subjects = renderSubjects(a);
		if (subjects) {
			main += '<section class="article-section">' +
				'<div class="article-section__head"><h2>Subjects</h2></div>' +
				subjects +
			'</section>';
		}

		main += renderRelatedTrials(trials);

		main += '<p class="article-provenance">' +
			'Found via ' + escHtml((a.sources || []).join(' · ') || 'GregoryAI') + '. ' +
			'Indexed automatically by GregoryAI; tags reviewed by curators.' +
			'<a href="/contact/">Suggest a correction →</a>' +
		'</p>';

		var aside = renderAsideCitation(a) +
			(mlGrouped.length ? renderMLWidget(mlGrouped) : '') +
			renderSubscribeCTA(a);

		return (a.retracted ? renderRetractedBanner() : '') +
			'<div class="article-grid">' +
				'<div class="article-grid__main">' + main + '</div>' +
				'<aside class="article-grid__aside">' + aside + '</aside>' +
			'</div>';
	}

	// ── Share button ──────────────────────────────────────────────────────

	function initShareButton() {
		var btn = document.getElementById('article-share-btn');
		if (!btn) return;
		btn.addEventListener('click', function () {
			if (navigator.share) {
				navigator.share({
					title: document.title,
					url:   window.location.href,
				}).catch(function () { /* user cancelled */ });
			} else {
				navigator.clipboard.writeText(window.location.href).then(function () {
					btn.textContent = 'Copied!';
					setTimeout(function () {
						btn.innerHTML = icon('share', 14) + ' Share';
					}, 2000);
				});
			}
		});
	}

	// ── Update breadcrumb ─────────────────────────────────────────────────

	function updateBreadcrumb(a) {
		var area = (a.subjects && a.subjects[0] && (a.subjects[0].subject_name || a.subjects[0].name));
		if (area && bcArea) {
			bcArea.textContent = area;
			if (bcSep2) bcSep2.removeAttribute('hidden');
		}
		if (bcLabel) {
			bcLabel.textContent = 'Article #' + (a.article_id || a.id || articleId);
		}
		// Update <title>
		document.title = a.title + ' — Brain Regeneration Observatory';
	}

	// ── State ─────────────────────────────────────────────────────────────

	function showLoading() {
		loading.hidden = false;
		errorEl.hidden = true;
		content.hidden = true;
	}

	function showError() {
		loading.hidden = true;
		errorEl.hidden = false;
		content.hidden = true;
	}

	function showContent(html) {
		loading.hidden = true;
		errorEl.hidden = true;
		content.innerHTML = html;
		content.hidden = false;
		initShareButton();
	}

	// ── Fetch ─────────────────────────────────────────────────────────────

	function fetchArticle(id) {
		showLoading();
		var url = apiBase + '/articles/' + encodeURIComponent(id) + '/?format=json';
		fetch(url, { headers: { 'Accept': 'application/json' } })
			.then(function (resp) {
				if (!resp.ok) throw new Error('HTTP ' + resp.status);
				return resp.json();
			})
			.then(function (article) {
				updateBreadcrumb(article);
				showContent(renderArticle(article));
			})
			.catch(function () {
				showError();
			});
	}

	// ── Init ──────────────────────────────────────────────────────────────

	if (retryBtn) {
		retryBtn.addEventListener('click', function () {
			if (articleId) fetchArticle(articleId);
		});
	}

	if (!articleId) {
		// No numeric ID in URL — show error
		showError();
		if (bcLabel) bcLabel.textContent = 'Not found';
	} else {
		fetchArticle(articleId);
	}

}());
