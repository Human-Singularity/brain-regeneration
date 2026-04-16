(function () {
	'use strict';

	var container = document.getElementById('spotlight-papers');
	if (!container) return;

	var endpoint  = container.dataset.endpoint;
	var teamId    = container.dataset.teamId;
	var subjectId = container.dataset.subjectId;
	if (!endpoint || !teamId || !subjectId) return;

	var CACHE_KEY = 'brSpotlight:' + teamId + ':' + subjectId;
	var CACHE_TTL = 60 * 60 * 1000;

	function getCached(key) {
		try {
			var raw = localStorage.getItem(key);
			if (!raw) return null;
			var entry = JSON.parse(raw);
			if (Date.now() - entry.ts > CACHE_TTL) return null;
			return entry.data;
		} catch (e) { return null; }
	}

	function setCached(key, data) {
		try {
			localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
		} catch (e) {}
	}

	function escHtml(str) {
		var el = document.createElement('span');
		el.textContent = str;
		return el.innerHTML;
	}

	function formatDate(iso) {
		if (!iso) return '';
		var d = new Date(iso);
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function shortAuthors(authors) {
		if (!authors || !authors.length) return '';
		var first = authors[0];
		var name = first.family || '';
		if (first.given) name += ' ' + first.given.charAt(0) + '.';
		if (authors.length > 1) name += ' et al.';
		return name;
	}

	function renderCard(a) {
		var link    = escHtml(a.link || '');
		var title   = escHtml(a.title || '');
		var journal = escHtml(a.container_title || '');
		var authors = escHtml(shortAuthors(a.authors));
		var date    = escHtml(formatDate(a.published_date));
		var accessBadge = a.access === 'open'
			? '<span class="access-badge open">Open Access</span>'
			: '<span class="access-badge restricted">Subscription</span>';

		return '<a href="' + link + '" class="spotlight-item" target="_blank" rel="noopener noreferrer">' +
			(journal ? '<span class="spotlight-item-journal">' + journal + '</span>' : '') +
			'<span class="spotlight-item-title">' + title + '</span>' +
			'<span class="spotlight-item-meta">' +
				(authors ? '<span>' + authors + '</span>' : '') +
				(date ? '<span>' + date + '</span>' : '') +
				accessBadge +
			'</span>' +
		'</a>';
	}

	function render(articles) {
		if (!articles || articles.length === 0) {
			container.innerHTML = '<p style="font-family: var(--font-heading); font-size: 14px; color: var(--color-muted);">No spotlight papers available right now.</p>';
			return;
		}
		container.innerHTML = articles.map(renderCard).join('');
	}

	var cached = getCached(CACHE_KEY);
	if (cached) { render(cached); return; }

	var url = new URL(endpoint);
	url.searchParams.set('format', 'json');
	url.searchParams.set('relevant', 'true');
	url.searchParams.set('team_id', teamId);
	url.searchParams.set('subject_id', subjectId);
	url.searchParams.set('page_size', '5');

	fetch(url.toString())
		.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
		.then(function (data) {
			var articles = data.results || data;
			setCached(CACHE_KEY, articles);
			render(articles);
		})
		.catch(function () {
			container.innerHTML = '<p style="font-family: var(--font-heading); font-size: 14px; color: var(--color-muted);">Could not load spotlight papers.</p>';
		});
})();
