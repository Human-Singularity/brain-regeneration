/* feed-ui.js — shared UI machinery for the research-papers and clinical-trials
 * feeds (research-feed.js / trials-feed.js). Exposes window.BR.feedUI.
 *
 * These are the pieces both feeds previously implemented byte-for-byte
 * identically: the filter-token factory, single-select sheet-chip activation,
 * the CSV download split-button, the advanced "more filters" toggle, and the
 * hero hint tags. Each feed keeps its own state, URL building, filter set, and
 * card rendering — only this mechanical wiring is shared.
 *
 * Loaded synchronously in <head> right after br-utils.js, so it is available to
 * the deferred feed scripts.
 */
(function (window) {
	'use strict';

	// Build a removable filter-token chip for the mobile token strip.
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

	// Set a desktop search-chip's active state and its ARIA pressed state together,
	// so assistive tech always sees the toggle's on/off state.
	function setSearchChipActive(chip, on) {
		chip.classList.toggle('search-chip--active', on);
		chip.setAttribute('aria-pressed', on ? 'true' : 'false');
	}

	// Single-select: mark the chip in a group whose data-value === value as active.
	function setActiveChip(groupId, value) {
		var group = document.getElementById(groupId);
		if (!group) return;
		group.querySelectorAll('.sheet-chip').forEach(function (chip) {
			chip.classList.toggle('active', chip.dataset.value === value);
		});
	}

	// Wire the CSV download split-button: toggle open/close, route the
	// page/all selections to handlers.onPage / handlers.onAll, close on outside click.
	function wireDownloadDropdown(toggle, handlers) {
		if (!toggle) return;
		var menu = toggle.parentElement.querySelector('.download-menu');

		toggle.addEventListener('click', function (e) {
			e.stopPropagation();
			var open = toggle.getAttribute('aria-expanded') === 'true';
			toggle.setAttribute('aria-expanded', String(!open));
			if (menu) menu.classList.toggle('is-open', !open);
		});

		if (menu) {
			menu.addEventListener('click', function (e) {
				var btn = e.target.closest('.download-option');
				if (!btn) return;
				if (btn.dataset.scope === 'all') handlers.onAll(); else handlers.onPage();
				toggle.setAttribute('aria-expanded', 'false');
				menu.classList.remove('is-open');
			});
		}

		document.addEventListener('click', function () {
			toggle.setAttribute('aria-expanded', 'false');
			if (menu) menu.classList.remove('is-open');
		});
	}

	// ── Copy panels: the RSS dropdown and "Get updates for this search" ──────
	// A toolbar button (aria-expanded, aria-controls) opens a panel holding feed
	// URLs in read-only fields, each with a Copy button. Clicking the button
	// again, Escape or a click outside closes it; focusing a field selects it.
	// The URLs are never links, so crawlers have nothing to follow.

	// Copy `text`; resolves when it is on the clipboard, rejects otherwise.
	// The Clipboard API needs a secure context (https or localhost); elsewhere,
	// or if it is refused, fall back to selecting `input` and execCommand.
	function copyText(text, input) {
		if (navigator.clipboard && window.isSecureContext) {
			return navigator.clipboard.writeText(text).catch(function () { return copyBySelection(input); });
		}
		return copyBySelection(input);
	}

	function copyBySelection(input) {
		return new Promise(function (resolve, reject) {
			if (!input) { reject(); return; }
			input.focus();
			input.select();
			var ok = false;
			try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
			if (ok) resolve(); else reject();
		});
	}

	function panelOf(toggle) {
		return toggle ? document.getElementById(toggle.getAttribute('aria-controls')) : null;
	}

	function setPanelOpen(root, open) {
		var toggle = root.querySelector('button[aria-controls]');
		var panel = panelOf(toggle);
		if (!toggle || !panel) return;
		toggle.setAttribute('aria-expanded', String(open));
		panel.classList.toggle('is-open', open);
	}

	// onOpen, if given, runs each time the panel opens.
	function wireCopyPanel(root, onOpen) {
		var toggle = root.querySelector('button[aria-controls]');
		var panel = panelOf(toggle);
		if (!toggle || !panel) return false;
		toggle.addEventListener('click', function () {
			var open = toggle.getAttribute('aria-expanded') === 'true';
			setPanelOpen(root, !open);
			if (!open && onOpen) onOpen();
		});
		toggle.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') setPanelOpen(root, false);
		});
		panel.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') { setPanelOpen(root, false); toggle.focus(); }
		});
		panel.querySelectorAll('input[readonly]').forEach(function (input) {
			input.addEventListener('focus', function () { input.select(); });
		});
		// Capture phase so a sibling dropdown's stopPropagation can't keep this one open.
		document.addEventListener('click', function (e) {
			if (!root.contains(e.target)) setPanelOpen(root, false);
		}, true);
		return true;
	}

	// RSS dropdown (partials/feeds/rss-dropdown.html): one row per feed. Copy
	// marks its row "Copied" for a few seconds; a failed copy leaves the URL
	// selected for Ctrl/Cmd+C and says so.
	var COPIED_RESET_MS = 2500;

	function wireRssDropdown(root) {
		if (!root || root.dataset.rssWired) return;
		if (!wireCopyPanel(root)) return;
		root.dataset.rssWired = '1';
		var status = root.querySelector('[data-rss-copy-status]');
		var rows = root.querySelectorAll('[data-rss-feed]');

		function resetRow(row) {
			row.classList.remove('is-copied');
			var b = row.querySelector('[data-rss-copy]');
			if (b) b.textContent = 'Copy';
		}

		rows.forEach(function (row) {
			var input = row.querySelector('input[readonly]');
			var btn = row.querySelector('[data-rss-copy]');
			if (!input || !btn) return;
			var timer = null;
			btn.addEventListener('click', function () {
				copyText(input.value, input).then(function () {
					rows.forEach(resetRow);
					row.classList.add('is-copied');
					btn.textContent = 'Copied';
					if (status) status.textContent = (row.dataset.feedLabel || 'Feed') + ' link copied to your clipboard';
					clearTimeout(timer);
					timer = setTimeout(function () { resetRow(row); }, COPIED_RESET_MS);
				}, function () {
					if (status) status.textContent = 'Copy the selected link with Ctrl+C or \u2318C';
					input.focus();
					input.select();
				});
				input.scrollLeft = 0;
			});
		});
	}

	function wireAllRssDropdowns() {
		document.querySelectorAll('[data-rss-dropdown]').forEach(wireRssDropdown);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireAllRssDropdowns);
	else wireAllRssDropdowns();

	// ── "Get updates for this search" RSS feed ───────────────────────────────
	// Server-side the toolbar only has an empty, hidden shell
	// (partials/feeds/search-rss.html). Once a search has actually run, a feed
	// script calls updateSearchFeed() with the search translated into the feed's
	// own parameter names; this builds the URL, puts it in the shell's read-only
	// field and unhides the shell. Anything the feed cannot express must be
	// reported with hideSearchFeed() (never approximate: a broader feed is a
	// wrong feed). Clicking the button copies the URL (wireSearchFeed below).
	var SEARCH_FEED_MAX_TEXT = 300;
	var searchFeedToken = 0;
	var slugCache = {};

	function searchFeedShells() {
		return document.querySelectorAll('[data-search-feed]');
	}

	function setSearchFeedUrl(shell, url, kind) {
		var input = shell.querySelector('[data-search-feed-url]');
		var status = shell.querySelector('[data-search-feed-status]');
		shell.dataset.feedUrl = url;
		if (input) input.value = url;
		if (status) status.textContent = '';
		shell.querySelectorAll('[data-umami-event]').forEach(function (el) {
			if (kind) el.setAttribute('data-umami-event-kind', kind);
			else el.removeAttribute('data-umami-event-kind');
		});
	}

	function hideSearchFeed() {
		searchFeedToken++;
		searchFeedShells().forEach(function (shell) {
			setPanelOpen(shell, false);
			setSearchFeedUrl(shell, '', '');
			shell.hidden = true;
		});
	}

	// Copy the shell's feed URL and say so in its status line. On failure the
	// URL is left selected in the field so Ctrl/Cmd+C copies it.
	function copySearchFeed(shell) {
		var url = shell.dataset.feedUrl || '';
		var input = shell.querySelector('[data-search-feed-url]');
		var status = shell.querySelector('[data-search-feed-status]');
		if (!url) return;
		copyText(url, input).then(function () {
			if (status) status.textContent = 'Feed link copied to your clipboard';
			shell.classList.add('is-copied');
		}, function () {
			if (status) status.textContent = 'Copy the feed link below';
			shell.classList.remove('is-copied');
			if (input) { input.focus(); input.select(); }
		});
		if (input) input.scrollLeft = 0;
	}

	// Opening the panel copies the URL and shows it (wireCopyPanel handles
	// closing); the Copy button copies again.
	function wireSearchFeed(shell) {
		if (!shell || shell.dataset.searchFeedWired) return;
		var opened = wireCopyPanel(shell, function () {
			shell.classList.remove('is-copied');
			copySearchFeed(shell);
		});
		if (!opened) return;
		shell.dataset.searchFeedWired = '1';
		var again = shell.querySelector('[data-search-feed-copy]');
		if (again) again.addEventListener('click', function () { copySearchFeed(shell); });
	}

	function wireAllSearchFeeds() {
		searchFeedShells().forEach(wireSearchFeed);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireAllSearchFeeds);
	else wireAllSearchFeeds();

	// Resolve an id to the backend slug the feeds use (categories and sponsors
	// only carry numeric ids in the page's own state). Memoised per page load.
	function lookupSlug(url, pick) {
		if (!slugCache[url]) {
			slugCache[url] = fetch(url)
				.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
				.then(pick)
				.catch(function () { delete slugCache[url]; return ''; });
		}
		return slugCache[url];
	}

	function categorySlug(apiBase, id) {
		var url = apiBase.replace(/\/$/, '') + '/categories/?format=json&include_authors=false&category_id=' + encodeURIComponent(id);
		return lookupSlug(url, function (d) {
			var c = d && d.results && d.results[0];
			return c && String(c.id) === String(id) ? (c.category_slug || '') : '';
		});
	}

	function sponsorSlug(apiBase, id) {
		var url = apiBase.replace(/\/$/, '') + '/sponsors/' + encodeURIComponent(id) + '/?format=json';
		return lookupSlug(url, function (d) { return d && d.slug ? d.slug : ''; });
	}

	// spec: { kind: 'articles'|'trials'|'patents', apiBase,
	//         params: { feedParam: value, … }   (empty values are skipped)
	//         categoryId, sponsorId }           (resolved to category_slug /
	//                                            applicant_sponsor_slug here)
	function updateSearchFeed(spec) {
		var shells = searchFeedShells();
		if (!shells.length) return;
		var token = ++searchFeedToken;
		var apiBase = spec.apiBase;
		var lookups = [];
		if (spec.categoryId) lookups.push(categorySlug(apiBase, spec.categoryId).then(function (s) { return ['category_slug', s]; }));
		if (spec.sponsorId)  lookups.push(sponsorSlug(apiBase, spec.sponsorId).then(function (s) { return ['applicant_sponsor_slug', s]; }));

		Promise.all(lookups).then(function (pairs) {
			if (token !== searchFeedToken) return; // a newer search superseded this one
			var params = {};
			Object.keys(spec.params || {}).forEach(function (k) { params[k] = spec.params[k]; });
			for (var i = 0; i < pairs.length; i++) {
				if (!pairs[i][1]) { hideSearchFeed(); return; } // unresolved filter: never publish a broader feed
				params[pairs[i][0]] = pairs[i][1];
			}
			var qs = new URLSearchParams();
			var keys = Object.keys(params).sort();
			for (var j = 0; j < keys.length; j++) {
				var v = params[keys[j]];
				if (v === '' || v === null || v === undefined || v === false) continue;
				v = String(v);
				if (v.length > SEARCH_FEED_MAX_TEXT) { hideSearchFeed(); return; }
				qs.set(keys[j], v);
			}
			shells.forEach(function (shell) {
				var siteId = shell.dataset.feedSiteId || '';
				if (!siteId) { shell.hidden = true; return; }
				var url = apiBase.replace(/\/$/, '') + '/feed/sites/' + encodeURIComponent(siteId) + '/' + spec.kind + '/search/' + (qs.toString() ? '?' + qs.toString() : '');
				if (url !== shell.dataset.feedUrl) setPanelOpen(shell, false); // never leave a stale URL on show
				wireSearchFeed(shell);
				setSearchFeedUrl(shell, url, spec.kind);
				shell.hidden = false;
			});
		});
	}

	// Wire the advanced "More filters / Fewer filters" panel toggle.
	function wireMoreFilters(btn, panel, arrowId) {
		if (!btn || !panel) return;
		btn.addEventListener('click', function () {
			var open = !panel.hidden;
			panel.hidden = open;
			var arrow = arrowId ? document.getElementById(arrowId) : null;
			var label = btn.querySelector('.search-more-btn__label');
			if (arrow) arrow.classList.toggle('search-more-btn__arrow--open', !open);
			if (label) label.textContent = open ? 'More filters' : 'Fewer filters';
		});
	}

	// Wire the hero "Try:" hint tags; onPick(hint) runs the feed-specific search.
	function wireHintTags(onPick) {
		document.querySelectorAll('.search-hero__hint-tag').forEach(function (btn) {
			btn.addEventListener('click', function () { onPick(btn.dataset.hint || ''); });
		});
	}

	window.BR = window.BR || {};
	window.BR.feedUI = {
		buildToken: buildToken,
		setSearchChipActive: setSearchChipActive,
		setActiveChip: setActiveChip,
		wireDownloadDropdown: wireDownloadDropdown,
		wireRssDropdown: wireRssDropdown,
		updateSearchFeed: updateSearchFeed,
		hideSearchFeed: hideSearchFeed,
		wireMoreFilters: wireMoreFilters,
		wireHintTags: wireHintTags
	};
})(window);
