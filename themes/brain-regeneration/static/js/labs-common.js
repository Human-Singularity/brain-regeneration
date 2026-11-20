/* labs-common.js — helpers shared by the Research groups scripts (labs-directory.js,
 * lab-page.js, labs-embed.js). Exposes window.BR.labs. Needs br-utils.js (window.BR).
 *
 * The API (GregoryAi /labs/) endpoints are passed in through data-* attributes on each
 * mount; this file never reads params.apiBase itself.
 */
(function (window) {
	'use strict';

	var BR = window.BR || (window.BR = {});
	var escHtml = BR.escHtml, decodeEntities = BR.decodeEntities;
	var cache = BR.makeCache('brLabs:', 2 * 60 * 60 * 1000); // 2 hours

	var ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

	// Decode API entities, then escape: safe for HTML text and quoted attributes.
	function t(str) { return escHtml(decodeEntities(str == null ? '' : str)); }

	function num(n) { return Number(n || 0).toLocaleString('en-GB'); }

	function plural(n, one, many) { return n === 1 ? one : many; }

	function parseJsonAttr(el, name, fallback) {
		try { return JSON.parse(el.getAttribute(name) || ''); } catch (e) { return fallback; }
	}

	function trimSlash(url) { return String(url || '').replace(/\/$/, ''); }

	// Everything a script needs from its mount element.
	function readConfig(el) {
		var cats = parseJsonAttr(el, 'data-categories', []);
		var catMap = {};
		cats.forEach(function (c) { catMap[String(c.id)] = c.name; });
		var subjects = parseJsonAttr(el, 'data-subjects', []);
		var subjMap = {};
		subjects.forEach(function (s) { subjMap[String(s.id)] = s.name; });
		return {
			apiBase: trimSlash(el.getAttribute('data-api-base') || window.__API_BASE__ || 'https://api.brain-regeneration.com'),
			labBase: el.getAttribute('data-lab-base') || '/labs/',
			authorBase: el.getAttribute('data-author-base') || '/authors/',
			categories: cats,
			categoryNames: catMap,
			subjects: subjects,
			subjectNames: subjMap,
			// {"<lab id>": {url, name}}: labs that are scientific curators (partials/curators/lab-map.html)
			curators: parseJsonAttr(el, 'data-curators', {})
		};
	}

	// A lab's categories, kept only when configured on the condition pages and
	// labelled with the configured name. API order (most papers first) is kept.
	function allowedCategories(lab, cfg) {
		return ((lab && lab.categories) || []).filter(function (c) {
			return cfg.categoryNames[String(c.id)] != null;
		}).map(function (c) {
			return Object.assign({}, c, { name: cfg.categoryNames[String(c.id)] });
		});
	}

	var regionNames = null;
	function countryName(code) {
		if (!code) return '';
		code = String(code).toUpperCase();
		try {
			if (!regionNames) regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
			return regionNames.of(code) || code;
		} catch (e) { return code; }
	}

	// "Institution · Country", either part may be missing.
	function placeText(lab) {
		var inst = lab && lab.institution;
		if (!inst) return '';
		var parts = [];
		if (inst.name) parts.push(decodeEntities(inst.name));
		if (inst.country_code) parts.push(countryName(inst.country_code));
		return parts.join(' · ');
	}

	function hasOrcid(p) { return !!(p && p.orcid && ORCID_RE.test(String(p.orcid).toUpperCase())); }

	function authorHref(cfg, p) { return cfg.authorBase + encodeURIComponent(String(p.orcid).toUpperCase()) + '/'; }

	// A person's name, as a link to their author page when they have an ORCID iD.
	function personHtml(cfg, p, linkAttrs) {
		var name = t(p.full_name);
		if (hasOrcid(p)) return '<a href="' + escHtml(authorHref(cfg, p)) + '"' + (linkAttrs || '') + '>' + name + '</a>';
		return name;
	}

	// Subject a lab's headline numbers are about: the first subject (API order: most
	// relevant papers, then most papers). Returns null when the lab has none.
	function topSubject(lab) { return (lab.subjects && lab.subjects[0]) || null; }

	function infoIcon(size) {
		return '<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
	}
	function pinIcon(size) {
		return '<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
	}
	function userIcon(size) {
		return '<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
	}

	// GET json with the 2-hour localStorage cache. Rejects with an Error whose
	// .status is the HTTP status (404 means "no such lab").
	function getJson(url) {
		var hit = cache.get(url);
		if (hit) return Promise.resolve(hit);
		return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
			if (!r.ok) { var e = new Error('http ' + r.status); e.status = r.status; throw e; }
			return r.json();
		}).then(function (data) { cache.set(url, data); return data; });
	}

	// ISO 3166-1 alpha-2 codes offered in the directory's Country filter. A fixed list
	// of countries that publish in these fields; names come from Intl.DisplayNames.
	var COUNTRY_CODES = ('AR AT AU BE BG BR CA CH CL CN CO CZ DE DK EG ES FI FR GB GR HK HR HU ID IE IL IN IR IT JO JP KR ' +
		'LB LT LU MX MY NL NO NZ PE PK PL PT QA RO RS RU SA SE SG SI SK TH TN TR TW UA US UY ZA').split(' ');

	// A lab that is a scientific curator links to its curator page instead of /labs/{id}/.
	function curatorOf(cfg, lab) { return (lab && cfg.curators && cfg.curators[String(lab.id)]) || null; }
	function labHref(cfg, lab) {
		var c = curatorOf(cfg, lab);
		return c ? c.url : cfg.labBase + lab.id + '/';
	}
	function curatorBadge(cfg, lab) {
		return curatorOf(cfg, lab)
			? '<span class="cu-labbadge"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 2.9 6.9L22 9.6l-5.4 4.8 1.6 7.3L12 17.8 5.8 21.7l1.6-7.3L2 9.6l7.1-.7z"/></svg>Scientific curator</span>'
			: '';
	}

	function countryOptions() {
		return COUNTRY_CODES.map(function (c) { return { code: c, name: countryName(c) }; })
			.sort(function (a, b) { return a.name.localeCompare(b.name, 'en'); });
	}

	BR.labs = {
		cache: cache, ORCID_RE: ORCID_RE, t: t, num: num, plural: plural, readConfig: readConfig,
		allowedCategories: allowedCategories, countryName: countryName, placeText: placeText,
		hasOrcid: hasOrcid, authorHref: authorHref, personHtml: personHtml, topSubject: topSubject,
		infoIcon: infoIcon, pinIcon: pinIcon, userIcon: userIcon, getJson: getJson,
		countryOptions: countryOptions, curatorOf: curatorOf, labHref: labHref, curatorBadge: curatorBadge
	};
})(window);
