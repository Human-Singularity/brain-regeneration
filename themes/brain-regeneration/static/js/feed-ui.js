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
		wireMoreFilters: wireMoreFilters,
		wireHintTags: wireHintTags
	};
})(window);
