/* funding-calls.js — homepage "Funding calls & opportunities" widget.
 *
 * Renders into #funding-calls from the same-origin proxy at
 * functions/api/funding-calls.js (never the ABN feed directly — see
 * docs/funding-calls-section-plan.md §1 for why). Self-invoking, no-ops
 * unless its mount exists, config from data-* attributes — same shape as
 * research-spotlight.js.
 *
 * Deliberately lazy: the fetch only fires once the section is about to
 * enter the viewport, so a visitor who never scrolls this far costs zero
 * requests.
 */
(function () {
	'use strict';

	var mount = document.getElementById('funding-calls');
	if (!mount) return;

	var endpoint = mount.dataset.endpoint;
	var limit = mount.dataset.limit || '8';
	if (!endpoint) return;

	var escHtml = BR.escHtml;
	var escHtmlSafeTags = BR.escHtmlAllowSafeTags || escHtml;
	var safeLink = BR.safeLink;
	var formatDate = BR.formatDate;
	var cache = BR.makeCache('brFunding:', 3 * 60 * 60 * 1000); // matches the proxy's edge TTL

	var CACHE_KEY = 'items:' + limit;
	var FALLBACK_URL = 'https://observatorio.abneuro.org.br/editais?utm_source=brain-regeneration&utm_medium=referral&utm_campaign=funding-calls';

	// Mirrors the proxy's own clamp (functions/api/funding-calls.js) so the
	// skeleton reserves the same height the real rows will occupy — a count
	// fixed at 4 regardless of `limit` would still shift the credit block
	// below once the actual (e.g. 8-row) response renders.
	var parsedLimit = parseInt(limit, 10);
	var skeletonCount = isFinite(parsedLimit) ? Math.min(24, Math.max(1, parsedLimit)) : 8;

	function renderSkeleton() {
		var rows = '';
		for (var i = 0; i < skeletonCount; i++) {
			rows += '<div class="fc-skeleton"><span class="fc-skeleton-title"></span><span class="fc-skeleton-meta"></span></div>';
		}
		mount.innerHTML = '<div class="fc-rows">' + rows + '</div>';
	}

	function renderEmpty() {
		mount.setAttribute('aria-busy', 'false');
		mount.innerHTML = '<p class="fc-empty">No funding calls available right now — see the full list below.</p>';
	}

	function itemLink(item) {
		var href = item.link ? safeLink(item.link) : '#';
		return href === '#' ? FALLBACK_URL : href;
	}

	function rowLabel(item, deadlineText) {
		var label = item.title || '';
		if (item.funder) label += ' — ' + item.funder;
		if (deadlineText) label += ', apply by ' + deadlineText;
		return label;
	}

	function renderRow(item) {
		var href = escHtml(itemLink(item));
		var title = escHtmlSafeTags(item.title || '');
		var funder = escHtml(item.funder || '');
		var place = escHtml(item.place || '');
		var deadlineText = item.deadline ? formatDate(item.deadline) : '';
		var deadline = escHtml(deadlineText);
		var label = escHtml(rowLabel(item, deadlineText));

		return (
			'<a class="fc-row" href="' + href + '" target="_blank" rel="noopener noreferrer" aria-label="' + label + '">' +
				'<span class="fc-row-main">' +
					'<span class="fc-row-title">' + title + '</span>' +
					'<span class="fc-row-meta">' +
						(funder ? '<span class="fc-row-funder">' + funder + '</span>' : '') +
						(place ? '<span class="fc-row-place">' + place + '</span>' : '') +
					'</span>' +
				'</span>' +
				(deadline ? '<span class="fc-deadline">' + deadline + '</span>' : '') +
				'<span class="fc-arrow" aria-hidden="true">↗</span>' +
			'</a>'
		);
	}

	function render(items) {
		mount.setAttribute('aria-busy', 'false');
		if (!items || !items.length) {
			renderEmpty();
			return;
		}
		mount.innerHTML = '<div class="fc-rows">' + items.map(renderRow).join('') + '</div>';
	}

	function load() {
		var cached = cache.get(CACHE_KEY);
		if (cached) {
			render(cached);
			return;
		}

		var url = new URL(endpoint, window.location.origin);
		url.searchParams.set('limit', limit);

		fetch(url.toString())
			.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
			.then(function (data) {
				var items = (data && data.items) || [];
				cache.set(CACHE_KEY, items);
				render(items);
			})
			.catch(function () { renderEmpty(); });
	}

	// Reserve the row height immediately so scrolling into view later causes
	// no layout shift.
	renderSkeleton();

	var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 1); };

	var observer = new IntersectionObserver(function (entries) {
		for (var i = 0; i < entries.length; i++) {
			if (!entries[i].isIntersecting) continue;
			observer.disconnect();
			idle(load, { timeout: 3000 });
			break;
		}
	}, { rootMargin: '200px' });

	observer.observe(mount);
})();
