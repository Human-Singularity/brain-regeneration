/* medicines-feed.js — EMA and FDA medicines tab for condition pages (/conditions/{slug}/medicines/).
 * Fetches all products for the subject from the GregoryAi /medicines/ endpoint in one go
 * (a subject has only a few dozen) and filters, sorts and searches in the browser.
 * Also renders the "Latest EU regulatory events" timeline (/medicines/events/), lazy
 * per-card history (/medicines/{id}/), URL state (?category=) and the mobile bottom sheet.
 *
 * Wording rules (see docs/medicines-tab-plan.md): "Opinion" is never shown as authorised;
 * latest_ec_decision_date is never labelled as the approval date; empty states say
 * "No centrally authorised medicine", never "not approved".
 * Each regulator keeps its own wording: an FDA record is never "Authorised in the EU" and an
 * EMA record is never "Approved by the FDA". A null flag (the other regulator's field) draws
 * no chip. FDA data covers NDAs/BLAs only, so absence is never "not approved in the US".
 */
(function () {
	'use strict';

	var mount = document.getElementById('medicines-list');
	if (!mount) return;

	var apiBase   = (mount.dataset.apiBase || window.__API_BASE__ || 'https://api.brain-regeneration.com').replace(/\/$/, '');
	var endpoint  = mount.dataset.endpoint || (apiBase + '/medicines/');
	var subjectId = mount.dataset.subjectId || '';
	var condition = mount.dataset.condition || 'this condition';
	var papersUrl = mount.dataset.papersUrl || '';
	var eventsEndpoint = endpoint.replace(/\/?$/, '/') + 'events/';
	var eventsMount = document.getElementById('medicines-events');

	var $ = function (id) { return document.getElementById(id); };
	var searchInput    = $('medicines-search-input');
	var categorySelect = $('medicines-category-select');
	var statusSelect   = $('medicines-status-select');
	var regulatorSelect = $('medicines-regulator-select');
	var genericsCheck  = $('medicines-generics');
	var sortSelect     = $('medicines-sort-select');
	var resetBtn       = $('medicines-reset-btn');
	var resultCount    = $('medicines-result-count');
	var mobileCount    = $('medicines-mobile-result-count');

	var escHtml = BR.escHtml, decodeEntities = BR.decodeEntities, stripHtml = BR.stripHtml;
	var safeLink = BR.safeLink, debounce = BR.debounce;
	var cache = BR.makeCache('brMedicines2:', 2 * 60 * 60 * 1000); // 2 hours

	var DEFAULT_SORT = 'approval';
	var state = {
		keyword: '', category: '', status: '', regulator: '', generics: false, sort: DEFAULT_SORT,
		products: [], loaded: false, categories: [], categoryGroups: []
	};
	var historyCache = {};

	function formatDate(iso) {
		if (!iso) return '';
		var d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
		if (isNaN(d)) return '';
		return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
	}

	// The FDA writes names in capitals. Show normal case when a name has no lowercase letter.
	function niceName(str) {
		str = decodeEntities(str || '');
		if (!str || /[a-z]/.test(str)) return str;
		return str.toLowerCase().replace(/(^|[\s\-\/(])([a-z])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); });
	}

	function isFda(p) { return p.regulator === 'fda'; }
	function regulatorLabel(p) { return isFda(p) ? 'FDA' : 'EMA'; }
	function regulatorSource(p) {
		return p.source || (isFda(p) ? 'U.S. Food and Drug Administration' : 'European Medicines Agency');
	}

	// ── Status handling ─────────────────────────────────────────────────────
	var ENDED = { withdrawn: 1, expired: 1, revoked: 1, lapsed: 1, suspended: 1 };

	function statusGroup(p) {
		var s = (p.status || '').toLowerCase();
		if (isFda(p)) {
			if (s === 'approved') return 'fda_approved';
			if (s === 'tentatively approved') return 'fda_tentative';
			if (s === 'discontinued') return 'fda_discontinued';
			if (s === 'revoked') return 'fda_revoked';
			return 'other';
		}
		if (s === 'authorised') return 'authorised';
		if (s.indexOf('opinion') === 0) return 'review';
		if (s === 'refused') return 'refused';
		if (ENDED[s]) return 'ended';
		if (s === 'application withdrawn' || s === 'withdrawn from rolling review') return 'application_withdrawn';
		return 'other';
	}

	var STATUS_LABELS = {
		authorised: 'Authorised', review: 'Under review', refused: 'Refused',
		ended: 'No longer authorised', application_withdrawn: 'Application withdrawn',
		fda_approved: 'FDA: Approved', fda_tentative: 'FDA: Tentatively approved',
		fda_discontinued: 'FDA: Discontinued', fda_revoked: 'FDA: Revoked'
	};
	var REGULATOR_LABELS = { ema: 'EMA only', fda: 'FDA only' };

	// → { label, cls, date }
	function badgeFor(p) {
		var s = (p.status || '').toLowerCase(), op = (p.opinion_status || '').toLowerCase();
		var auth = formatDate(p.authorisation_date);
		if (isFda(p)) {
			var fdate = auth ? 'Approved on ' + auth : '';
			if (s === 'approved') return { label: 'Approved by the FDA', cls: 'ok', date: fdate };
			if (s === 'tentatively approved') return { label: 'Tentatively approved by the FDA', cls: 'review', date: auth ? 'First approved ' + auth : '' };
			if (s === 'discontinued') return { label: 'Discontinued in the US', cls: 'ended', date: auth ? 'Approved ' + auth : '' };
			if (s === 'revoked') return { label: 'US licence revoked', cls: 'bad', date: auth ? 'Approved ' + auth : '' };
			return { label: p.status || 'Unknown status', cls: 'ended', date: fdate };
		}
		if (s === 'authorised') {
			return { label: 'Authorised in the EU', cls: 'ok', date: auth ? 'Authorised on ' + auth : '' };
		}
		if (s.indexOf('opinion') === 0) {
			var od = formatDate(p.opinion_date);
			var date = od ? 'CHMP opinion on ' + od : '';
			if (s.indexOf('re-examination') !== -1) return { label: 'Opinion under re-examination', cls: 'review', date: date };
			if (op === 'positive') return { label: 'Positive opinion — awaiting EU decision', cls: 'review', date: date };
			if (op === 'negative') return { label: 'Negative opinion', cls: 'bad', date: date };
			return { label: 'CHMP opinion — awaiting EU decision', cls: 'review', date: date };
		}
		if (s === 'refused') {
			var rd = formatDate(p.refusal_date);
			return { label: 'Refused', cls: 'bad', date: rd ? 'Refused on ' + rd : '' };
		}
		if (s === 'suspended') {
			var sd = formatDate(p.suspension_date);
			return { label: 'Suspended', cls: 'bad', date: sd ? 'Suspended on ' + sd : '' };
		}
		if (s === 'withdrawn' || s === 'expired' || s === 'revoked' || s === 'lapsed') {
			var end = formatDate(p.end_date), parts = [];
			if (auth) parts.push('Authorised ' + auth);
			if (end) parts.push('ended ' + end);
			return { label: 'No longer authorised (' + p.status + ')', cls: 'ended', date: parts.join(', ') };
		}
		if (s === 'application withdrawn') {
			var wd = formatDate(p.application_withdrawal_date);
			return { label: 'Application withdrawn', cls: 'ended', date: wd ? 'Withdrawn on ' + wd : '' };
		}
		return { label: p.status || 'Unknown status', cls: 'ended', date: '' };
	}

	// ── URL state ───────────────────────────────────────────────────────────
	function readURL() {
		var p = new URLSearchParams(window.location.search);
		state.keyword  = p.get('q') || '';
		state.category = p.get('category') || '';
		state.status   = STATUS_LABELS[p.get('status')] ? p.get('status') : '';
		state.regulator = REGULATOR_LABELS[p.get('regulator')] ? p.get('regulator') : '';
		state.generics = p.get('generics') === 'true';
		state.sort     = ({ approval: 1, approval_asc: 1, updated: 1 })[p.get('sort')] ? p.get('sort') : DEFAULT_SORT;
	}

	function writeURL() {
		var p = new URLSearchParams();
		if (state.keyword)  p.set('q', state.keyword);
		if (state.category) p.set('category', state.category);
		if (state.status)   p.set('status', state.status);
		if (state.regulator) p.set('regulator', state.regulator);
		if (state.generics) p.set('generics', 'true');
		if (state.sort !== DEFAULT_SORT) p.set('sort', state.sort);
		history.replaceState(null, '', window.location.pathname + (p.toString() ? '?' + p.toString() : ''));
	}

	function track(filter, value) {
		if (window.umami && typeof window.umami.track === 'function') {
			window.umami.track('Medicines: Filter', { filter: filter, value: String(value) });
		}
	}

	// ── Data loading ────────────────────────────────────────────────────────
	function fetchAll(url, acc) {
		return fetch(url).then(function (r) {
			if (!r.ok) throw new Error('HTTP ' + r.status);
			return r.json();
		}).then(function (data) {
			acc = acc.concat(data.results || []);
			return data.next ? fetchAll(data.next, acc) : acc;
		});
	}

	function productsURL() {
		var p = new URLSearchParams();
		p.set('format', 'json');
		if (subjectId) p.set('subject_id', subjectId);
		p.set('page_size', '100');
		p.set('ordering', '-authorisation_date');
		if (state.generics) p.set('include_generics', 'true');
		return endpoint + '?' + p.toString();
	}

	var lastLoadURL = '';
	function loadProducts() {
		var url = productsURL();
		lastLoadURL = url;
		var cached = cache.get(url);
		if (cached) { state.products = cached; state.loaded = true; afterLoad(); return; }
		renderSkeleton();
		fetchAll(url, []).then(function (rows) {
			if (rows.length) cache.set(url, rows);
			if (url !== lastLoadURL) return;
			state.products = rows;
			state.loaded = true;
			afterLoad();
		}).catch(function () { if (url === lastLoadURL) renderError(); });
	}

	function afterLoad() {
		updateCategoryAvailability();
		render();
		updateCategoryFeed();
	}

	// ── Filtering ───────────────────────────────────────────────────────────
	function hasCategory(p, id) {
		return (p.categories || []).some(function (c) { return String(c.id) === String(id); });
	}

	function visibleProducts() {
		var q = state.keyword.toLowerCase();
		var list = state.products.filter(function (p) {
			if (state.category && !hasCategory(p, state.category)) return false;
			if (state.regulator && (p.regulator || 'ema') !== state.regulator) return false;
			if (state.status && statusGroup(p) !== state.status) return false;
			if (q) {
				var hay = [p.name, p.inn, p.active_substance, (p.substances || []).join(' '), (p.brand_names || []).join(' ')].join(' ').toLowerCase();
				if (hay.indexOf(q) === -1) return false;
			}
			return true;
		});
		var key = state.sort === 'updated' ? 'ema_last_updated' : 'authorisation_date';
		var dir = state.sort === 'approval_asc' ? 1 : -1;
		return list.map(function (p, i) { return [p, i]; }).sort(function (a, b) {
			var x = a[0][key] || '', y = b[0][key] || '';
			if (!x !== !y) return x ? -1 : 1; // missing dates always last
			if (x !== y) return x < y ? -dir : dir;
			return a[1] - b[1];
		}).map(function (t) { return t[0]; });
	}

	function categoryLabel(id) {
		var c = state.categories.filter(function (c) { return String(c.id) === String(id); })[0];
		return c ? c.name : id;
	}

	// ── Render ──────────────────────────────────────────────────────────────
	function renderSkeleton() {
		var html = '';
		for (var i = 0; i < 3; i++) html += '<div class="paper-skeleton"><div class="paper-skeleton-title"></div><div class="paper-skeleton-meta"></div><div class="paper-skeleton-body"></div></div>';
		mount.innerHTML = html;
	}

	function renderError() {
		mount.innerHTML = '<div class="paper-empty"><p>We could not load the medicines. <button class="btn-outline-teal" id="medicines-retry-btn" style="margin-left:8px;padding:4px 12px;font-size:14px;">Try again</button></p></div>';
		var b = $('medicines-retry-btn');
		if (b) b.addEventListener('click', loadProducts);
	}

	function emptyMessage() {
		if (!state.products.length) {
			return 'No centrally authorised or FDA-approved medicines for ' + escHtml(condition) + ' yet. Medicines authorised by individual EU countries don’t appear in EMA’s central register, and the FDA data covers new drugs and biologics only.';
		}
		if (state.category && !state.products.some(function (p) { return hasCategory(p, state.category); })) {
			return escHtml(categoryLabel(state.category)) + ': no centrally authorised medicine and none in the FDA data. It may still be in trials, or authorised elsewhere.';
		}
		return 'No results. <a href="#" data-medicines-clear>Clear filters</a>';
	}

	function chip(text, title) {
		return '<span class="medicine-chip"' + (title ? ' title="' + escHtml(title) + '"' : '') + '>' + escHtml(text) + '</span>';
	}

	// ── Grouping: one card per drug (substance_key), one line per regulator record ──
	function recordBrands(p) {
		var list = (p.brand_names && p.brand_names.length) ? p.brand_names : String(p.name || '').split(' / ');
		return list.map(function (n) { return niceName(n).toLowerCase(); });
	}

	function groupRecords(records) {
		var byKey = {}, groups = [];
		records.forEach(function (p) {
			var key = p.substance_key || ('id:' + p.id);
			if (!byKey[key]) { byKey[key] = { key: key, records: [] }; groups.push(byKey[key]); }
			byKey[key].records.push(p);
		});
		groups.forEach(function (g) {
			// EMA lines first, then FDA; within a regulator keep the current-status and date order
			g.records.sort(function (x, y) {
				var rx = isFda(x) ? 1 : 0, ry = isFda(y) ? 1 : 0;
				if (rx !== ry) return rx - ry;
				var ax = statusGroup(x) === 'authorised' || statusGroup(x) === 'fda_approved' ? 0 : 1;
				var ay = statusGroup(y) === 'authorised' || statusGroup(y) === 'fda_approved' ? 0 : 1;
				return ax - ay;
			});
			var ema = g.records.filter(function (p) { return !isFda(p); })[0];
			var fda = g.records.filter(isFda)[0];
			g.title = ema ? niceName(ema.name || 'Unnamed medicine')
				: niceName((fda.brand_names && fda.brand_names[0]) || String(fda.name || 'Unnamed medicine').split(' / ')[0]);
			var subs = ema && ema.substances && ema.substances.length ? ema.substances
				: (g.key.indexOf('id:') === 0 ? [] : g.key.split('+'));
			g.substances = subs.length ? subs.join(', ') : niceName((ema || fda).inn || (ema || fda).active_substance || '');
		});
		return groups;
	}

	function buildLine(p, title) {
		var link = safeLink(p.url);
		var reg = regulatorLabel(p), source = regulatorSource(p), b = badgeFor(p);
		var show = recordBrands(p).indexOf(title.toLowerCase()) === -1;
		var prod = show ? ' <strong class="medicine-line-name">' + escHtml(niceName((p.brand_names && p.brand_names[0]) || p.name || '')) + '</strong>' : '';
		var appNo = isFda(p) && p.fda_application_number
			? '<span class="medicine-muted">' + escHtml(p.fda_application_number) + (p.fda_center ? ' · ' + escHtml(p.fda_center) : '') + '</span>' : '';
		var ec = (p.latest_ec_decision_date && p.latest_ec_decision_date !== p.authorisation_date)
			? '<span class="medicine-muted">Latest EC decision ' + escHtml(formatDate(p.latest_ec_decision_date)) + '</span>' : '';
		return '<li class="medicine-line" data-id="' + escHtml(String(p.id)) + '">' +
			'<div class="medicine-line-main">' +
				'<span class="medicine-badge medicine-badge--reg" title="' + escHtml(source) + '">' + reg + '</span>' + prod +
				'<span class="medicine-badge medicine-badge--' + b.cls + '">' + escHtml(b.label) + '</span>' +
				(b.date ? '<span class="medicine-date">' + escHtml(b.date) + '</span>' : '') +
				appNo + ec +
				'<a class="medicine-source-link" href="' + escHtml(link) + '" target="_blank" rel="noopener noreferrer" data-umami-event="Medicines: Open ' + reg + ' page" data-umami-event-medicine="' + escHtml(title) + '">' + escHtml(source) + ' ↗' +
				'<span class="visually-hidden"> (opens in a new tab)</span></a>' +
				'<button type="button" class="medicine-link-btn" data-medicines-history aria-expanded="false" data-umami-event="Medicines: Show history">Show history</button>' +
			'</div>' +
			'<div class="medicine-history" hidden></div>' +
		'</li>';
	}

	function buildCard(g) {
		var recs = g.records;
		var withInd = recs.filter(function (p) { return p.indication; })[0];
		var indication = withInd ? stripHtml(decodeEntities(withInd.indication)).trim() : '';
		var long = indication.length > 260;

		var chips = '', seenChip = {};
		function addChip(text, title) { if (!seenChip[text]) { seenChip[text] = 1; chips += chip(text, title); } }
		recs.forEach(function (p) {
			if (p.orphan_medicine)          addChip('Orphan medicine');
			if (p.conditional_approval)     addChip('Conditional approval');
			if (p.advanced_therapy)         addChip('Advanced therapy');
			if (p.prime_priority_medicine)  addChip('PRIME', 'EMA priority medicines scheme');
			if (p.biosimilar)               addChip('Biosimilar');
			if (p.generic)                  addChip('Generic');
		});

		var seenCat = {}, cats = '';
		recs.forEach(function (p) {
			(p.categories || []).forEach(function (c) {
				if (seenCat[c.id]) return;
				seenCat[c.id] = 1;
				var label = escHtml(decodeEntities(c.category_name || c.category_slug || ''));
				var attrs = ' class="condition-tag" style="font-size:12px;padding:2px 8px;"';
				cats += papersUrl
					? '<a href="' + escHtml(papersUrl + '?category=' + encodeURIComponent(c.id)) + '"' + attrs + '>' + label + '</a>'
					: '<span' + attrs + '>' + label + '</span>';
			});
		});

		var holders = [];
		recs.forEach(function (p) { var h = niceName(p.holder || ''); if (h && holders.indexOf(h) === -1) holders.push(h); });

		return '<article class="paper-card medicine-card" data-key="' + escHtml(g.key) + '">' +
			'<div class="paper-card-title">' + escHtml(g.title) + '</div>' +
			(g.substances ? '<div class="medicine-inn">' + escHtml(g.substances) + '</div>' : '') +
			'<ul class="medicine-lines">' + recs.map(function (p) { return buildLine(p, g.title); }).join('') + '</ul>' +
			(indication
				? '<div class="paper-card-abstract medicine-indication' + (long ? ' is-clamped' : '') + '">' + escHtml(indication) + '</div>' +
				  (long ? '<button type="button" class="medicine-link-btn" data-medicines-more aria-expanded="false">Show more</button>' : '')
				: '') +
			(chips ? '<div class="medicine-chips">' + chips + '</div>' : '') +
			(cats ? '<div class="paper-card-categories">' + cats + '</div>' : '') +
			(holders.length ? '<div class="paper-card-meta medicine-foot"><span>' + escHtml(holders.join(' · ')) + '</span></div>' : '') +
		'</article>';
	}

	function render() {
		var groups = groupRecords(visibleProducts());
		var text = groups.length + ' medicine' + (groups.length !== 1 ? 's' : '');
		if (resultCount) resultCount.textContent = text;
		if (mobileCount) mobileCount.textContent = text;
		mount.innerHTML = groups.length
			? groups.map(buildCard).join('')
			: '<div class="paper-empty"><p>' + emptyMessage() + '</p></div>';
		writeURL();
		renderTokens();
	}

	// ── Card interactions ───────────────────────────────────────────────────
	function historyHtml(d) {
		var events = d.events, grouped = d.grouped || [];
		var also = grouped.length
			? '<p class="medicine-muted">Also authorised as: ' + grouped.map(function (g) {
				var name = escHtml(niceName(g.name || ''));
				return g.url ? '<a href="' + escHtml(safeLink(g.url)) + '" target="_blank" rel="noopener noreferrer">' + name + '</a>' : name;
			}).join(', ') + '</p>'
			: '';
		if (!events || !events.length) return also + '<p class="medicine-muted">No recorded events yet.</p>';
		return also + '<ul class="medicine-history-list">' + events.map(function (e) {
			return '<li><span class="medicine-history-date">' + escHtml(formatDate(e.event_date)) + '</span> ' + escHtml(e.kind_label || e.kind || '') + '</li>';
		}).join('') + '</ul>';
	}

	mount.addEventListener('click', function (e) {
		var more = e.target.closest('[data-medicines-more]');
		if (more) {
			var ind = more.previousElementSibling;
			var open = ind.classList.toggle('is-clamped') === false;
			more.textContent = open ? 'Show less' : 'Show more';
			more.setAttribute('aria-expanded', open ? 'true' : 'false');
			return;
		}
		var clear = e.target.closest('[data-medicines-clear]');
		if (clear) { e.preventDefault(); resetState(); syncUIFromState(); loadProducts(); return; }

		var hbtn = e.target.closest('[data-medicines-history]');
		if (!hbtn) return;
		var line = hbtn.closest('.medicine-line');
		var panel = line.querySelector('.medicine-history');
		var id = line.dataset.id;
		if (!panel.hidden) {
			panel.hidden = true;
			hbtn.textContent = 'Show history';
			hbtn.setAttribute('aria-expanded', 'false');
			return;
		}
		panel.hidden = false;
		hbtn.textContent = 'Hide history';
		hbtn.setAttribute('aria-expanded', 'true');
		if (historyCache[id]) { panel.innerHTML = historyHtml(historyCache[id]); return; }
		panel.innerHTML = '<p class="medicine-muted">Loading…</p>';
		fetch(apiBase + '/medicines/' + encodeURIComponent(id) + '/?format=json')
			.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
			.then(function (d) { historyCache[id] = { events: d.events || [], grouped: d.grouped_products || [] }; panel.innerHTML = historyHtml(historyCache[id]); })
			.catch(function () { panel.innerHTML = '<p class="medicine-muted">We could not load the history.</p>'; });
	});

	// ── Timeline ────────────────────────────────────────────────────────────
	var lastEventsURL = '';
	function loadEvents() {
		if (!eventsMount) return;
		var p = new URLSearchParams();
		p.set('format', 'json');
		if (subjectId) p.set('subject_id', subjectId);
		if (state.category) p.set('category_id', state.category);
		if (state.generics) p.set('include_generics', 'true');
		if (state.regulator) p.set('regulator', state.regulator);
		p.set('basis', 'observed');
		p.set('page_size', '10');
		var url = eventsEndpoint + '?' + p.toString();
		lastEventsURL = url;
		var cached = cache.get(url);
		if (cached) { renderEvents(cached); return; }
		fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
			.then(function (d) {
				var rows = d.results || [];
				if (rows.length) cache.set(url, rows);
				if (url === lastEventsURL) renderEvents(rows);
			})
			.catch(function () { if (url === lastEventsURL) eventsMount.innerHTML = '<p class="medicine-muted">We could not load the events.</p>'; });
	}

	function renderEvents(rows) {
		if (!rows.length) { eventsMount.innerHTML = '<p class="medicine-muted">No recent regulatory events.</p>'; return; }
		eventsMount.innerHTML = '<ul class="medicine-events-list">' + rows.map(function (e) {
			var m = e.medicine || {};
			var name = escHtml(niceName(m.name || 'Medicine'));
			var reg = regulatorLabel(m);
			var ref = (e.kind === 'fda_approved' || e.kind === 'fda_efficacy_supplement') && e.to_value
				? ' <span class="medicine-muted">(' + escHtml(e.to_value) + ')</span>' : '';
			return '<li><span class="medicine-history-date">' + escHtml(formatDate(e.event_date)) + '</span> · ' +
				(m.url ? '<a href="' + escHtml(safeLink(m.url)) + '" target="_blank" rel="noopener noreferrer" data-umami-event="Medicines: Open ' + reg + ' page">' + name + '</a>' : name) +
				' <span class="medicine-badge medicine-badge--reg">' + reg + '</span>' +
				' — ' + escHtml(e.kind_label || e.kind || '') + ref + '</li>';
		}).join('') + '</ul>';
	}

	// ── Categories ──────────────────────────────────────────────────────────
	function populateCategorySelect() {
		if (!categorySelect) return;
		while (categorySelect.options.length > 1) categorySelect.remove(1);
		var byName = function (a, b) { return (a.name || '').localeCompare(b.name || ''); };
		state.categoryGroups.forEach(function (g) {
			var group = document.createElement('optgroup');
			group.label = g.label;
			(g.categories || []).slice().sort(byName).forEach(function (c) {
				if (!c.id) return;
				var opt = document.createElement('option');
				opt.value = String(c.id);
				opt.textContent = c.name;
				group.appendChild(opt);
			});
			categorySelect.appendChild(group);
		});
		categorySelect.value = state.category;
	}

	function populateMobileCategoryChips() {
		var group = $('medicines-sheet-category');
		if (!group) return;
		group.querySelectorAll('.sheet-chip:not([data-value=""])').forEach(function (c) { c.remove(); });
		state.categories.forEach(function (c) {
			if (!c.id) return;
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'sheet-chip';
			btn.dataset.value = String(c.id);
			btn.textContent = c.name;
			group.appendChild(btn);
		});
	}

	// Disable categories no loaded product belongs to; keep the selected one enabled.
	function updateCategoryAvailability() {
		if (!state.loaded) return;
		var used = {};
		state.products.forEach(function (p) { (p.categories || []).forEach(function (c) { used[String(c.id)] = true; }); });
		var empty = function (id) { return !used[id] && String(id) !== String(state.category); };
		if (categorySelect) {
			Array.prototype.forEach.call(categorySelect.options, function (o) {
				if (o.value) o.disabled = empty(o.value);
			});
		}
		var group = $('medicines-sheet-category');
		if (group) {
			group.querySelectorAll('.sheet-chip:not([data-value=""])').forEach(function (c) {
				c.disabled = empty(c.dataset.value);
			});
		}
	}

	// Per-category RSS feed, added to every RSS dropdown while a category is selected.
	function categorySlug() {
		for (var i = 0; i < state.products.length; i++) {
			var cats = state.products[i].categories || [];
			for (var j = 0; j < cats.length; j++) {
				if (String(cats[j].id) === String(state.category)) return cats[j].category_slug;
			}
		}
		return '';
	}

	function updateCategoryFeed() {
		var slug = state.category ? categorySlug() : '';
		document.querySelectorAll('[data-rss-dropdown] .rss-feed-list').forEach(function (list) {
			var old = list.querySelector('[data-medicines-cat-feed]');
			if (old) old.remove();
			if (!slug) return;
			var first = list.querySelector('input[readonly]');
			var m = first && /\/feed\/sites\/(\d+)\//.exec(first.value);
			if (!m) return;
			var url = apiBase + '/feed/sites/' + m[1] + '/medicines/category/' + encodeURIComponent(slug) + '/';
			var label = categoryLabel(state.category) + ' approvals';
			var li = document.createElement('li');
			li.className = 'rss-feed-item';
			li.setAttribute('data-medicines-cat-feed', '');
			li.innerHTML = '<span class="rss-option-label">' + escHtml(label) + '</span>' +
				'<span class="rss-option-desc">EU regulatory events for this category</span>' +
				'<div class="search-feed-url"><input type="text" class="search-feed-url-input" value="' + escHtml(url) + '" readonly spellcheck="false" aria-label="' + escHtml(label) + ' feed link">' +
				'<button type="button" class="search-feed-copy" data-umami-event="RSS: Follow feed" data-umami-event-action="copy" data-umami-event-feed="medicines-category">Copy</button></div>';
			var input = li.querySelector('input'), btn = li.querySelector('button');
			btn.addEventListener('click', function () {
				var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 2000); };
				if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { input.select(); });
				else { input.select(); try { document.execCommand('copy'); done(); } catch (e) { /* user can copy manually */ } }
			});
			list.appendChild(li);
		});
	}

	// ── State sync + desktop events ─────────────────────────────────────────
	function syncUIFromState() {
		if (searchInput)    searchInput.value = state.keyword;
		if (categorySelect) categorySelect.value = state.category;
		if (statusSelect)   statusSelect.value = state.status;
		if (regulatorSelect) regulatorSelect.value = state.regulator;
		if (genericsCheck)  genericsCheck.checked = state.generics;
		if (sortSelect)     sortSelect.value = state.sort;
		var ms = $('medicines-mobile-search'), mc = $('medicines-mobile-clear');
		if (ms) ms.value = state.keyword;
		if (mc) mc.hidden = !state.keyword;
	}

	function resetState() {
		state.keyword = ''; state.category = ''; state.status = ''; state.regulator = ''; state.generics = false; state.sort = DEFAULT_SORT;
	}

	function categoryChanged() {
		updateCategoryAvailability();
		render();
		updateCategoryFeed();
		loadEvents();
	}

	function setGenerics(v) {
		if (state.generics === v) return;
		state.generics = v;
		track('generics', v);
		loadProducts();
		loadEvents();
	}

	if (searchInput) searchInput.addEventListener('input', debounce(function () {
		state.keyword = searchInput.value.trim();
		var ms = $('medicines-mobile-search'); if (ms) ms.value = state.keyword;
		if (state.keyword) track('search', 'text');
		render();
	}, 200));
	if (categorySelect) categorySelect.addEventListener('change', function () { state.category = categorySelect.value; track('category', state.category || 'all'); categoryChanged(); });
	if (regulatorSelect) regulatorSelect.addEventListener('change', function () { state.regulator = regulatorSelect.value; track('regulator', state.regulator || 'both'); render(); loadEvents(); });
	if (statusSelect)   statusSelect.addEventListener('change',   function () { state.status = statusSelect.value; track('status', state.status || 'all'); render(); });
	if (genericsCheck)  genericsCheck.addEventListener('change',  function () { setGenerics(genericsCheck.checked); });
	if (sortSelect)     sortSelect.addEventListener('change',     function () { state.sort = sortSelect.value; render(); });
	if (resetBtn) resetBtn.addEventListener('click', function () {
		var hadGenerics = state.generics, hadCategory = state.category, hadRegulator = state.regulator;
		resetState(); syncUIFromState();
		if (hadGenerics) { loadProducts(); loadEvents(); }
		else { render(); if (hadCategory) { categoryChanged(); } else if (hadRegulator) loadEvents(); }
	});
	var searchForm = $('medicines-filter-form');
	if (searchForm) searchForm.addEventListener('submit', function (e) { e.preventDefault(); });

	// ── Mobile UI ───────────────────────────────────────────────────────────
	var mobileSearch = $('medicines-mobile-search');
	var mobileClear  = $('medicines-mobile-clear');
	var tokenStrip   = $('medicines-filter-tokens');
	var fabCount     = $('medicines-fab-count');
	var sheetEl      = $('medicines-filter-sheet');
	var setActiveChip = BR.feedUI.setActiveChip;
	var buildToken    = BR.feedUI.buildToken;
	var draft = {};

	function resetDraft() {
		draft = { category: state.category, status: state.status, regulator: state.regulator, generics: state.generics, sort: state.sort };
	}
	function syncSheetToDraft() {
		setActiveChip('medicines-sheet-category', draft.category);
		setActiveChip('medicines-sheet-status', draft.status);
		setActiveChip('medicines-sheet-regulator', draft.regulator);
		setActiveChip('medicines-sheet-generics', String(draft.generics));
		setActiveChip('medicines-sheet-sort', draft.sort);
	}
	function wireChipGroup(groupId, onChange) {
		var group = $(groupId);
		if (!group) return;
		group.addEventListener('click', function (e) {
			var chip = e.target.closest('.sheet-chip');
			if (!chip || chip.disabled) return;
			setActiveChip(groupId, chip.dataset.value);
			onChange(chip.dataset.value);
		});
	}
	wireChipGroup('medicines-sheet-category', function (v) { draft.category = v; });
	wireChipGroup('medicines-sheet-status',   function (v) { draft.status = v; });
	wireChipGroup('medicines-sheet-regulator', function (v) { draft.regulator = v; });
	wireChipGroup('medicines-sheet-generics', function (v) { draft.generics = v === 'true'; });
	wireChipGroup('medicines-sheet-sort',     function (v) { draft.sort = v; });

	function renderTokens() {
		var tokens = [];
		if (state.category) tokens.push([categoryLabel(state.category), 'category']);
		if (state.regulator) tokens.push([REGULATOR_LABELS[state.regulator], 'regulator']);
		if (state.status)   tokens.push([STATUS_LABELS[state.status], 'status']);
		if (state.generics) tokens.push(['Generics shown', 'generics']);
		if (state.sort !== DEFAULT_SORT && sortSelect) tokens.push([sortSelect.options[sortSelect.selectedIndex].text, 'sort']);
		if (fabCount) { fabCount.textContent = String(tokens.length); fabCount.hidden = !tokens.length; }
		if (!tokenStrip) return;
		var add = tokenStrip.querySelector('.token-add-filters');
		while (tokenStrip.firstChild) tokenStrip.removeChild(tokenStrip.firstChild);
		tokens.forEach(function (t) { tokenStrip.appendChild(buildToken(t[0], t[1])); });
		if (add) tokenStrip.appendChild(add);
		tokenStrip.hidden = !tokens.length;
	}

	if (tokenStrip) tokenStrip.addEventListener('click', function (e) {
		var rm = e.target.closest('.filter-token-remove');
		var token = rm && rm.closest('.filter-token');
		if (!token) return;
		var k = token.dataset.filter;
		if (k === 'category') { state.category = ''; syncUIFromState(); categoryChanged(); return; }
		if (k === 'regulator') { state.regulator = ''; syncUIFromState(); render(); loadEvents(); return; }
		if (k === 'status') state.status = '';
		else if (k === 'sort') state.sort = DEFAULT_SORT;
		else if (k === 'generics') { setGenerics(false); syncUIFromState(); return; }
		syncUIFromState();
		render();
	});

	if (mobileSearch) mobileSearch.addEventListener('input', debounce(function () {
		state.keyword = mobileSearch.value.trim();
		if (searchInput) searchInput.value = state.keyword;
		if (mobileClear) mobileClear.hidden = !state.keyword;
		render();
	}, 200));
	if (mobileClear) mobileClear.addEventListener('click', function () { state.keyword = ''; syncUIFromState(); render(); });

	if (sheetEl) sheetEl.addEventListener('show.bs.offcanvas', function () { resetDraft(); syncSheetToDraft(); });
	var sheetReset = $('medicines-sheet-reset'), sheetApply = $('medicines-sheet-apply');
	if (sheetReset) sheetReset.addEventListener('click', function () {
		draft = { category: '', status: '', regulator: '', generics: false, sort: DEFAULT_SORT };
		syncSheetToDraft();
	});
	if (sheetApply) sheetApply.addEventListener('click', function () {
		var catChanged = draft.category !== state.category, genChanged = draft.generics !== state.generics;
		var regChanged = draft.regulator !== state.regulator;
		state.category = draft.category; state.status = draft.status; state.regulator = draft.regulator; state.sort = draft.sort;
		syncUIFromState();
		if (genChanged) setGenerics(draft.generics);
		else if (catChanged) categoryChanged();
		else { render(); if (regChanged) loadEvents(); }
		if (regChanged && !catChanged && !genChanged) { /* events reloaded above */ }
		if (genericsCheck) genericsCheck.checked = state.generics;
		if (window.bootstrap && bootstrap.Offcanvas) {
			var inst = bootstrap.Offcanvas.getInstance(sheetEl);
			if (inst) inst.hide();
		}
	});

	// ── Init ────────────────────────────────────────────────────────────────
	try {
		var parsed = JSON.parse(mount.dataset.categoryGroups || 'null');
		if (Array.isArray(parsed)) {
			state.categoryGroups = parsed;
			state.categories = parsed.reduce(function (acc, g) { return acc.concat(Array.isArray(g.categories) ? g.categories : []); }, []);
		}
	} catch (e) { /* non-fatal: the category filter just has no options */ }

	readURL();
	populateCategorySelect();
	populateMobileCategoryChips();
	syncUIFromState();
	loadProducts();
	loadEvents();
})();
