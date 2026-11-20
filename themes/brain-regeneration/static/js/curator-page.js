/* curator-page.js — the Research tabs on /curators/{slug}/ ("From the lab" / "Latest in
 * {area}"). Everything else on the page is rendered by Hugo at build time. No-ops without
 * a [data-cu-tabs] section. Arrow keys, Home and End move between tabs (WAI-ARIA tabs). */
(function () {
	'use strict';
	document.querySelectorAll('[data-cu-tabs]').forEach(function (section) {
		var tabs = Array.prototype.slice.call(section.querySelectorAll('[role="tab"]'));
		if (tabs.length < 2) return;

		function select(tab, focus) {
			tabs.forEach(function (t) {
				var on = t === tab;
				t.setAttribute('aria-selected', on ? 'true' : 'false');
				t.tabIndex = on ? 0 : -1;
				var panel = document.getElementById(t.getAttribute('aria-controls'));
				if (panel) panel.hidden = !on;
			});
			if (focus) tab.focus();
		}

		tabs.forEach(function (tab, i) {
			tab.addEventListener('click', function () { select(tab, false); });
			tab.addEventListener('keydown', function (e) {
				var next = null;
				if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
				else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
				else if (e.key === 'Home') next = tabs[0];
				else if (e.key === 'End') next = tabs[tabs.length - 1];
				if (next) { e.preventDefault(); select(next, true); }
			});
		});
	});
})();
