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

	// Wire a toolbar link menu (the RSS dropdown, partials/feeds/rss-dropdown.html):
	// `root` holds a toggle button (aria-expanded) and a .download-menu of
	// role=menuitem links. Click toggles; Escape closes and returns focus to the
	// toggle; ArrowDown/Up/Home/End move between items; clicking or focusing
	// outside closes. Sibling of wireDownloadDropdown (which routes button
	// options to handlers); links navigate on their own.
	function wireMenuDropdown(root) {
		if (!root || root.dataset.menuWired) return;
		var toggle = root.querySelector('button[aria-haspopup]');
		var menu = root.querySelector('.download-menu');
		if (!toggle || !menu) return;
		root.dataset.menuWired = '1';

		function items() { return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]')); }
		function setOpen(open, focusItem) {
			toggle.setAttribute('aria-expanded', String(open));
			menu.classList.toggle('is-open', open);
			if (open && focusItem) { var list = items(); if (list.length) list[0].focus(); }
		}

		toggle.addEventListener('click', function () {
			setOpen(toggle.getAttribute('aria-expanded') !== 'true', false);
		});
		toggle.addEventListener('keydown', function (e) {
			if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true, true); }
		});
		menu.addEventListener('keydown', function (e) {
			var list = items();
			var i = list.indexOf(document.activeElement);
			if (e.key === 'Escape') { setOpen(false); toggle.focus(); }
			else if (e.key === 'ArrowDown') { e.preventDefault(); if (list.length) list[(i + 1) % list.length].focus(); }
			else if (e.key === 'ArrowUp') { e.preventDefault(); if (list.length) list[(i - 1 + list.length) % list.length].focus(); }
			else if (e.key === 'Home') { e.preventDefault(); if (list.length) list[0].focus(); }
			else if (e.key === 'End') { e.preventDefault(); if (list.length) list[list.length - 1].focus(); }
			else if (e.key === 'Tab') { setOpen(false); }
		});
		menu.addEventListener('click', function (e) {
			if (e.target.closest('[role="menuitem"]')) setOpen(false);
		});
		// Capture phase so a sibling dropdown's stopPropagation can't keep this one open.
		document.addEventListener('click', function (e) {
			if (!root.contains(e.target)) setOpen(false);
		}, true);
	}

	// Wire every server-rendered RSS menu once the DOM is ready.
	function wireAllMenuDropdowns() {
		document.querySelectorAll('[data-rss-menu]').forEach(wireMenuDropdown);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireAllMenuDropdowns);
	else wireAllMenuDropdowns();

	// ── "Get updates for this search" RSS feed ───────────────────────────────
	// Server-side the toolbar only has an empty, hidden shell
	// (partials/feeds/search-rss.html). Once a search has actually run, a feed
	// script calls updateSearchFeed() with the search translated into the feed's
	// own parameter names; this builds the URL, creates the <a rel="nofollow">
	// and unhides the shell. Anything the feed cannot express must be reported
	// with hideSearchFeed() (never approximate: a broader feed is a wrong feed).
	var SEARCH_FEED_MAX_TEXT = 300;
	var searchFeedToken = 0;
	var slugCache = {};

	function searchFeedShells() {
		return document.querySelectorAll('[data-search-feed]');
	}

	function hideSearchFeed() {
		searchFeedToken++;
		searchFeedShells().forEach(function (shell) {
			shell.hidden = true;
			var slot = shell.querySelector('[data-search-feed-slot]');
			if (slot) slot.textContent = '';
		});
	}

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
				var slot = shell.querySelector('[data-search-feed-slot]');
				if (!siteId || !slot) { shell.hidden = true; return; }
				var a = document.createElement('a');
				a.className = 'download-option rss-option';
				a.setAttribute('role', 'menuitem');
				a.rel = 'nofollow noopener';
				a.target = '_blank';
				a.href = apiBase.replace(/\/$/, '') + '/feed/sites/' + encodeURIComponent(siteId) + '/' + spec.kind + '/search/' + (qs.toString() ? '?' + qs.toString() : '');
				a.setAttribute('data-umami-event', 'RSS: Follow search feed');
				a.setAttribute('data-umami-event-kind', spec.kind);
				var label = document.createElement('span');
				label.className = 'rss-option-label';
				label.textContent = 'RSS feed for this search';
				var desc = document.createElement('span');
				desc.className = 'rss-option-desc';
				desc.textContent = 'New results, newest first';
				a.appendChild(label);
				a.appendChild(desc);
				slot.textContent = '';
				slot.appendChild(a);
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
		wireMenuDropdown: wireMenuDropdown,
		updateSearchFeed: updateSearchFeed,
		hideSearchFeed: hideSearchFeed,
		wireMoreFilters: wireMoreFilters,
		wireHintTags: wireHintTags
	};
})(window);
