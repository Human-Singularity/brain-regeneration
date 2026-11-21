/* lab-page.js — /labs/{id}/ research group page.
 * static/_redirects (and functions/labs/[id].js) serve the same shell for every numeric
 * id; this script reads the id from the URL path (or ?id= for local previews), fetches
 * GregoryAi's /labs/{id}/ and renders the header, research focus bars and members.
 * A 404 from the API means the lab was merged or dropped: it renders the "no longer
 * listed" state. Server-side <head> metadata comes from functions/labs/[id].js.
 */
(function () {
	'use strict';

	var shell = document.getElementById('lab-shell');
	if (!shell || !window.BR || !BR.labs) return;

	var L = BR.labs, t = L.t, escHtml = BR.escHtml;
	var cfg = L.readConfig(shell);
	var siteTitle = shell.getAttribute('data-site-title') || 'Brain Regeneration Observatory';

	var loadingEl = document.getElementById('lab-loading'), notfoundEl = document.getElementById('lab-notfound');
	var errorEl = document.getElementById('lab-error'), contentEl = document.getElementById('lab-content');
	var statusEl = document.getElementById('lab-status'), crumbEl = document.getElementById('lab-crumb');

	var TOPICS_COLLAPSED = 10, MEMBERS_COLLAPSED = 12;

	function labId() {
		var m = window.location.pathname.match(/\/labs\/(\d+)\/?$/);
		if (m) return m[1];
		var q = new URLSearchParams(window.location.search).get('id');
		return /^\d+$/.test(q || '') ? q : '';
	}

	function setNoindex() {
		if (document.querySelector('meta[name="robots"]')) return;
		var m = document.createElement('meta');
		m.name = 'robots'; m.content = 'noindex, nofollow';
		document.head.appendChild(m);
	}

	function showState(which) {
		loadingEl.hidden = which !== 'loading';
		notfoundEl.hidden = which !== 'notfound';
		errorEl.hidden = which !== 'error';
		contentEl.hidden = which !== 'content';
		statusEl.textContent = which === 'loading' ? 'Loading research group…'
			: which === 'notfound' ? 'This research group is no longer listed.'
			: which === 'error' ? 'We could not load this research group.' : '';
		if (which === 'notfound' || which === 'error') {
			setNoindex();
			document.title = (which === 'notfound' ? 'Research group not listed' : 'Research group') + ' — ' + siteTitle;
			crumbEl.textContent = 'Not listed';
		}
	}

	// ── Pieces ──────────────────────────────────────────────────────────────
	function stat(value, label) {
		return '<div class="lab-stat"><div class="lab-stat__value">' + escHtml(value) + '</div><div class="lab-stat__label">' + escHtml(label) + '</div></div>';
	}

	function bar(articles, recent, max) {
		var w = Math.max(4, Math.round(articles / max * 100));
		var rw = articles ? Math.round(recent / articles * 100) : 0;
		return '<div class="lab-bar" aria-hidden="true"><div class="lab-bar__total" style="width:' + w + '%"><div class="lab-bar__recent" style="width:' + rw + '%"></div></div></div>';
	}

	function maxOf(list) {
		return Math.max.apply(null, list.map(function (x) { return x.articles || 0; }).concat([1]));
	}

	function subjectRow(s, max) {
		var url = BR.subjectUrl ? BR.subjectUrl({ id: s.id, name: s.name }) : null;
		var name = url ? '<a href="' + escHtml(url) + '">' + t(s.name) + '</a>' : '<span>' + t(s.name) + '</span>';
		return '<div class="lab-row">' +
			'<div class="lab-row__top"><span class="lab-row__name">' + name + '</span>' +
			'<span class="lab-row__num">' + L.num(s.articles) + ' papers · ' + L.num(s.recent_articles) + ' since ' + L.recentSince + '</span></div>' +
			bar(s.articles, s.recent_articles, max) + '</div>';
	}

	function topicRow(c, subjects, max, hidden) {
		var url = BR.categoryUrl ? BR.categoryUrl(c.id, subjects, 'papers') : null;
		var name = url ? '<a href="' + escHtml(url) + '">' + t(c.name) + '</a>' : '<span>' + t(c.name) + '</span>';
		return '<div class="lab-topic"' + (hidden ? ' data-extra hidden' : '') + '>' +
			'<span class="lab-topic__name">' + name + '</span>' + bar(c.articles, c.recent_articles, max) +
			'<span class="lab-topic__num">' + L.num(c.articles) + ' <span class="lab-muted">· ' + L.num(c.recent_articles) + ' new</span></span></div>';
	}

	function initials(name) {
		return String(name || '').split(/[\s-]+/).filter(Boolean).map(function (p) { return p.charAt(0); }).slice(0, 2).join('').toUpperCase();
	}

	function memberItem(m, hidden) {
		var nm = L.personHtml(cfg, m, ' class="lab-member__link"');
		return '<li class="lab-member"' + (hidden ? ' data-extra hidden' : '') + '>' +
			'<span class="lab-member__mark" aria-hidden="true">' + avatarInner(m, initials(decodeEntitiesSafe(m.full_name))) + '</span>' + nm + '</li>';
	}
	// A member's photo (data/author_avatars.yaml, by ORCID iD) or their initials.
	var avatars = BR.readAvatars ? BR.readAvatars(shell) : {};
	function avatarInner(m, inits) {
		return BR.avatarHtml && L.hasOrcid(m) ? BR.avatarHtml(avatars, m.orcid, inits) : escHtml(inits);
	}
	function decodeEntitiesSafe(s) { return BR.decodeEntities(s == null ? '' : s); }

	function formatUpdated(iso) {
		if (!iso) return '';
		var d = new Date(iso);
		if (isNaN(d)) return '';
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	// ── Page ────────────────────────────────────────────────────────────────
	function render(lab) {
		var head = lab.head, headName = head && head.full_name ? decodeEntitiesSafe(head.full_name) : '';
		var place = L.placeText(lab);
		var subjects = lab.subjects || [];
		var top = L.topSubject(lab);
		var cats = L.allowedCategories(lab, cfg);
		var members = lab.members || [];
		var inst = lab.institution || {};

		var latestYear = subjects.reduce(function (y, s) { return Math.max(y, s.latest_article_year || 0); }, 0);
		var stats = stat(L.num(lab.member_count), 'Members');
		if (top) {
			stats += stat(L.num(top.articles), 'Papers on ' + decodeEntitiesSafe(top.name));
			stats += stat(L.num(top.recent_articles), 'Since ' + L.recentSince);
		}
		if (latestYear) stats += stat(String(latestYear), 'Latest paper');

		var buttons = '';
		if (head && L.hasOrcid(head)) {
			buttons += '<a class="btn-outline-teal" href="' + escHtml(L.authorHref(cfg, head)) + '">Papers by ' + t(head.full_name) + ' &rarr;</a>';
		}
		if (inst.ror) {
			buttons += '<a class="btn-download" href="https://ror.org/' + encodeURIComponent(inst.ror) + '" target="_blank" rel="noopener noreferrer">Institution on ROR <span aria-hidden="true">↗</span></a>';
		}

		var correction = 'mailto:team@brain-regeneration.com?subject=' + encodeURIComponent('Research group correction: ' + decodeEntitiesSafe(lab.name) + ' (' + lab.id + ')');
		var note = lab.curated ? '' :
			'<p class="labs-note">' + L.infoIcon(18) + '<span>We grouped these people automatically from publication data: ' +
			(headName ? t(headName) + ' and the' : 'The') + ' co-authors who publish with ' + (headName ? 'them' : 'the lead author') +
			' most often. It may not match the lab’s own list of members. <a href="' + escHtml(correction) + '">Suggest a correction</a></span></p>';

		var html =
			'<section class="bg-tint labs-header labs-header--lab"><div class="container lab-header">' +
				'<div><p class="labs-eyebrow">Research group</p><h1>' + t(lab.name) + '</h1>' +
				'<p class="lab-header__meta">' +
					(headName ? '<span>' + L.userIcon(18) + 'Led by ' + '<strong>' + L.personHtml(cfg, head) + '</strong></span>' : '') +
					(place ? '<span>' + L.pinIcon(18) + t(place) + '</span>' : '') +
				'</p></div>' +
				'<div class="lab-stats">' + stats + '</div>' +
				(buttons ? '<div class="labs-actions">' + buttons + '</div>' : '') + note +
			'</div></section>';

		if (subjects.length || cats.length) {
			var smax = maxOf(subjects), cmax = maxOf(cats);
			html += '<section class="section labs-focus"><div class="container">' +
				'<div class="lab-focus__head"><div><h2>Research focus</h2>' +
				'<p>Papers by ' + (headName ? t(headName) + ' or a member' : 'the lead author or a member') + ', by the conditions and topics we track.</p></div>' +
				'<div class="lab-legend" aria-hidden="true"><span><i class="lab-legend__recent"></i>Since ' + L.recentSince + '</span><span><i class="lab-legend__older"></i>Before ' + L.recentSince + '</span></div></div>' +
				'<div class="lab-focus__cols">' +
				(subjects.length ? '<div class="lab-focus__col"><h3>Conditions</h3>' + subjects.map(function (s) { return subjectRow(s, smax); }).join('') + '</div>' : '') +
				(cats.length ? '<div class="lab-focus__col lab-focus__col--wide"><h3>Research topics</h3>' +
					cats.map(function (c, i) { return topicRow(c, subjects, cmax, i >= TOPICS_COLLAPSED); }).join('') +
					(cats.length > TOPICS_COLLAPSED ? '<button type="button" class="btn-download lab-toggle" id="lab-topics-toggle" aria-expanded="false" data-label="Show all ' + cats.length + ' topics">Show all ' + cats.length + ' topics</button>' : '') +
					'</div>' : '') +
				'</div></div></section>';
		}

		var updated = formatUpdated(lab.topics_last_changed);
		html += '<section class="section bg-sand labs-members"><div class="container"><h2>Members</h2>';
		if (members.length) {
			var mc = lab.member_count || members.length;
			html += '<p class="labs-members__lede">' + L.num(mc) + ' ' + L.plural(mc, 'person who has', 'people who have') +
				' published with ' + (headName ? t(headName) : 'the lead author') + ' more than once, most shared papers first. Names without a link have no ORCID iD on record, so they have no author page yet.</p>' +
				'<ul class="lab-members">' + members.map(function (m, i) { return memberItem(m, i >= MEMBERS_COLLAPSED); }).join('') + '</ul>' +
				(members.length > MEMBERS_COLLAPSED ? '<button type="button" class="btn-outline-teal lab-toggle" id="lab-members-toggle" aria-expanded="false" data-label="Show all ' + members.length + ' members">Show all ' + members.length + ' members</button>' : '');
		} else {
			html += '<p class="labs-members__lede">No regular co-authors listed yet.</p>';
		}
		html += (updated ? '<p class="labs-updated">Counts updated ' + escHtml(updated) + '. We refresh them twice a day.</p>' : '') +
			'</div></section>';

		contentEl.innerHTML = html;
		wireToggle('lab-topics-toggle', '.lab-topic[data-extra]', 'Show fewer topics');
		wireToggle('lab-members-toggle', '.lab-member[data-extra]', 'Show fewer members');
	}

	function wireToggle(id, sel, collapseLabel) {
		var btn = document.getElementById(id);
		if (!btn) return;
		btn.addEventListener('click', function () {
			var open = btn.getAttribute('aria-expanded') !== 'true';
			contentEl.querySelectorAll(sel).forEach(function (el) { el.hidden = !open; });
			btn.setAttribute('aria-expanded', open ? 'true' : 'false');
			btn.textContent = open ? collapseLabel : btn.getAttribute('data-label');
		});
	}

	function load() {
		var id = labId();
		if (!id) { showState('notfound'); return; }
		// A scientific curator's lab has its own page. functions/labs/[id].js redirects there
		// on Cloudflare; this covers `hugo server` and any request that skipped the function.
		var curator = cfg.curators[id];
		if (curator && curator.url) { window.location.replace(curator.url); return; }
		showState('loading');
		L.getJson(cfg.apiBase + '/labs/' + id + '/?format=json').then(function (lab) {
			var name = decodeEntitiesSafe(lab.name);
			document.title = name + ' — ' + siteTitle;
			crumbEl.textContent = name;
			render(lab);
			showState('content');
		}).catch(function (err) {
			showState(err && err.status === 404 ? 'notfound' : 'error');
		});
	}

	document.getElementById('lab-retry').addEventListener('click', load);
	load();
})();
