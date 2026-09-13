/* trial-single.js — Single clinical-trial detail view
 * Extracts the trial ID from the URL path (/trials/{id}/),
 * fetches from the GregoryAi API, and renders the trial record.
 */
(function () {
	'use strict';

	// ── Mount points ──────────────────────────────────────────────────────
	var shell     = document.getElementById('trial-shell');
	if (!shell) return;

	var loading   = document.getElementById('trial-loading');
	var errorEl   = document.getElementById('trial-error');
	var retryBtn  = document.getElementById('trial-retry-btn');
	var content   = document.getElementById('trial-content');
	var apiBase   = (shell.dataset.apiBase || window.__API_BASE__ || 'https://api.brain-regeneration.com').replace(/\/$/, '');
	var siteTitle = shell.dataset.siteTitle || 'Brain Regeneration Observatory';
	var siteDesc  = shell.dataset.siteDescription || 'Brain Regeneration Observatory';

	// ── Extract trial ID / identifier from URL ───────────────────────────
	// Canonical: /trials/{trial_id}/ (numeric). Also supported: /trials/{identifier}/
	// (NCT/EUCT/EudraCT/CTIS) — in production the Pages Function at
	// functions/trials/[id].js already 301s this to the canonical URL at the edge;
	// this client-side resolution is the fallback for local dev (plain `hugo server`
	// has no Functions runtime) and for the rare case the edge lookup fails open.
	function parsePathSegment() {
		var parts = window.location.pathname.replace(/\/$/, '').split('/');
		return parts[parts.length - 1] || '';
	}

	// ── Helpers (mirrors br-utils.js fallbacks, in case window.BR isn't present) ──

	function fallbackEscHtml(str) {
		if (str == null) return '';
		return String(str)
			.replace(/&/g,  '&amp;')
			.replace(/</g,  '&lt;')
			.replace(/>/g,  '&gt;')
			.replace(/"/g,  '&quot;')
			.replace(/'/g,  '&#39;');
	}

	var _fallbackDecodeEl;
	function fallbackDecodeEntities(str) {
		if (str == null || str === '') return '';
		if (!_fallbackDecodeEl) _fallbackDecodeEl = document.createElement('textarea');
		_fallbackDecodeEl.innerHTML = String(str);
		return _fallbackDecodeEl.value;
	}

	var BR             = window.BR || {};
	var escHtml        = BR.escHtml        || fallbackEscHtml;
	var decodeEntities = BR.decodeEntities || fallbackDecodeEntities;

	// Some registry summaries (esp. CTIS-sourced) carry literal structural HTML —
	// "<b>Conditions</b>: ... <br />" — rather than plain text. Escape everything
	// first, then unescape only an exact allowlist of safe, attribute-free inline
	// tags (including self-closing <br/>), so that formatting renders without
	// opening up arbitrary markup from API data.
	var SUMMARY_SAFE_TAGS = ['b', 'i', 'strong', 'em'];
	var summarySafeTagPattern = new RegExp('&lt;(/?)(' + SUMMARY_SAFE_TAGS.join('|') + ')&gt;', 'gi');
	var summarySafeBrPattern = /&lt;br\s*\/?&gt;/gi;
	function escHtmlAllowRegistryTags(str) {
		return escHtml(str)
			.replace(summarySafeBrPattern, '<br>')
			.replace(summarySafeTagPattern, '<$1$2>');
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
		var d = new Date(iso);
		if (!Number.isFinite(d.getTime())) return '—';
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	function toISOStringSafe(value) {
		if (!value) return '';
		var d = new Date(value);
		if (!Number.isFinite(d.getTime())) return '';
		return d.toISOString();
	}

	function stripHtml(str) {
		if (str == null) return '';
		return String(str).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
	}

	function truncate(str, maxLen) {
		if (!str) return '';
		if (str.length <= maxLen) return str;
		return str.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
	}

	function upsertMetaByName(name, value) {
		if (!value) return;
		var el = document.querySelector('meta[name="' + name + '"]');
		if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
		el.setAttribute('content', value);
	}
	function upsertMetaByProperty(property, value) {
		if (!value) return;
		var el = document.querySelector('meta[property="' + property + '"]');
		if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
		el.setAttribute('content', value);
	}
	function upsertCanonical(url) {
		if (!url) return;
		var el = document.querySelector('link[rel="canonical"]');
		if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
		el.setAttribute('href', url);
	}
	function normalizedPageUrl() {
		var path = window.location.pathname;
		if (path.charAt(path.length - 1) !== '/') path += '/';
		return window.location.origin + path;
	}

	// ── Phase / recruitment-status vocab (matches trials-feed.js) ───────────
	var PHASE_LABELS = {
		early_phase_1: 'Early Phase 1',
		phase_1:       'Phase 1',
		phase_1_2:     'Phase 1/2',
		phase_2:       'Phase 2',
		phase_2_3:     'Phase 2/3',
		phase_3:       'Phase 3',
		phase_3_4:     'Phase 3/4',
		phase_4:       'Phase 4',
		post_market:   'Post-market',
		not_applicable:'Not applicable',
	};

	var STATUS_MAP = {
		not_yet_recruiting:      { cls: 'badge-phase',      label: 'Not yet recruiting' },
		recruiting:              { cls: 'badge-recruiting', label: 'Recruiting' },
		enrolling_by_invitation: { cls: 'badge-phase',      label: 'Enrolling by invitation' },
		active_not_recruiting:   { cls: 'badge-active',     label: 'Active, not recruiting' },
		not_recruiting:          { cls: 'badge-phase',      label: 'Not recruiting' },
		suspended:               { cls: 'badge-completed',  label: 'Suspended' },
		completed:               { cls: 'badge-completed',  label: 'Completed' },
		terminated:              { cls: 'badge-completed',  label: 'Terminated' },
		withdrawn:               { cls: 'badge-completed',  label: 'Withdrawn' },
		unknown:                 { cls: 'badge-phase',      label: 'Unknown' },
	};

	function statusInfo(t) {
		var norm = t.recruitment_status_normalized;
		if (norm && norm !== 'other' && STATUS_MAP[norm]) return STATUS_MAP[norm];
		return { cls: 'badge-phase', label: t.recruitment_status || 'Unknown' };
	}

	function formatPhase(t) {
		var norm = t.phase_normalized;
		if (norm && norm !== 'other') return PHASE_LABELS[norm] || norm;
		return t.phase || '';
	}

	// ── Country code → name (subset covering the registries we index) ──────
	var COUNTRY_NAMES = {
		US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', DE: 'Germany',
		FR: 'France', IT: 'Italy', ES: 'Spain', PT: 'Portugal', NL: 'Netherlands', BE: 'Belgium',
		CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
		IE: 'Ireland', PL: 'Poland', CZ: 'Czech Republic', GR: 'Greece', HU: 'Hungary', RO: 'Romania',
		JP: 'Japan', CN: 'China', KR: 'South Korea', IN: 'India', BR: 'Brazil', MX: 'Mexico',
		AR: 'Argentina', ZA: 'South Africa', IL: 'Israel', TR: 'Turkey', RU: 'Russia', NZ: 'New Zealand',
		SG: 'Singapore', TW: 'Taiwan', HK: 'Hong Kong', UA: 'Ukraine',
	};
	function countryName(code) { return COUNTRY_NAMES[(code || '').toUpperCase()] || code || 'Unknown'; }

	// ── Registry naming from URL / source_register ──────────────────────────
	function registryLabelForUrl(url) {
		if (!url) return '';
		if (url.indexOf('clinicaltrials.gov') !== -1)   return 'ClinicalTrials.gov';
		if (url.indexOf('euclinicaltrials.eu') !== -1)  return 'EU Clinical Trials Information System';
		if (url.indexOf('clinicaltrialsregister.eu') !== -1) return 'EU Clinical Trials Register (EudraCT)';
		if (url.indexOf('who.int') !== -1)              return 'WHO ICTRP';
		return '';
	}
	function registryName(data) {
		return data.source_register || registryLabelForUrl(data.link) || 'the registry';
	}

	// ── Text parsing helpers for registry free-text fields ──────────────────

	function parseBullets(text) {
		if (!text) return [];
		return String(text).split('\n')
			.map(function (l) { return l.replace(/^\s*\\?[-*]\s*/, '').trim(); })
			.filter(Boolean);
	}

	// inclusion_criteria commonly bundles both inclusion and exclusion text; split
	// it out only when the API hasn't already separated the two.
	function parseCriteria(data) {
		var raw = data.inclusion_criteria || '';
		var exclusionRaw = data.exclusion_criteria || '';
		var inclusionText = raw;
		if (!exclusionRaw && raw) {
			var parts = raw.split(/\n\s*(?:Key\s+)?Exclusion Criteria:?\s*\n?/i);
			if (parts.length > 1) {
				inclusionText = parts[0];
				exclusionRaw = parts.slice(1).join('\n');
			}
		}
		inclusionText = inclusionText.replace(/^\s*(?:Key\s+)?Inclusion Criteria:?\s*\n+/i, '');
		exclusionRaw  = exclusionRaw.replace(/^\s*(?:Key\s+)?Exclusion Criteria:?\s*\n+/i, '');
		return {
			inclusion: parseBullets(inclusionText),
			exclusion: parseBullets(exclusionRaw),
		};
	}

	function titleCaseType(type) {
		if (!type) return 'Other';
		return type.toLowerCase().split('_').map(function (w) {
			return w.charAt(0).toUpperCase() + w.slice(1);
		}).join(' ');
	}

	// `intervention` is a newline-delimited "TYPE: Name - Description" free-text field.
	function parseInterventions(str) {
		if (!str) return [];
		return String(str).split('\n').map(function (line) {
			line = line.trim();
			if (!line) return null;
			var colonIdx = line.indexOf(':');
			if (colonIdx === -1) return { type: '', name: line, desc: '' };
			var type = line.slice(0, colonIdx).trim();
			var rest = line.slice(colonIdx + 1).trim();
			var dashIdx = rest.indexOf(' - ');
			if (dashIdx === -1) return { type: type, name: rest, desc: '' };
			return { type: type, name: rest.slice(0, dashIdx).trim(), desc: rest.slice(dashIdx + 3).trim() };
		}).filter(Boolean);
	}

	// "<outcome text>.:  (<timeframe>)" free-text format.
	function parseOutcomeLine(line) {
		var m = /^(.*):\s*\(([^)]*)\)\s*$/.exec(line.trim());
		if (m) return { text: m[1].trim(), timeframe: m[2].trim() };
		return { text: line.trim(), timeframe: '' };
	}
	function parseOutcomes(str) {
		if (!str) return [];
		return String(str).split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(parseOutcomeLine);
	}

	// "Through month 3" reads naturally as "Measured through month 3"; anything
	// else ("3 months") reads naturally as "Measured at 3 months".
	function timeframePhrase(tf) {
		if (!tf) return '';
		if (/^through\b/i.test(tf)) return 'Measured ' + tf.charAt(0).toLowerCase() + tf.slice(1);
		return 'Measured at ' + tf;
	}

	// Humanizes free-text ALL_CAPS registry vocab ("Allocation: RANDOMIZED...")
	// into sentence case without a hand-rolled dictionary of every value.
	function humanizeRegistryText(str) {
		if (!str) return '';
		var out = String(str).replace(/\b[A-Z][A-Z_]{2,}\b/g, function (word) {
			return word.toLowerCase().replace(/_/g, ' ');
		});
		return out.charAt(0).toUpperCase() + out.slice(1);
	}

	function formatAge(data) {
		var min = data.inclusion_agemin ? String(data.inclusion_agemin).replace(/\s*years?$/i, '').trim() : '';
		var max = data.inclusion_agemax ? String(data.inclusion_agemax).replace(/\s*years?$/i, '').trim() : '';
		if (min && max) return min + ' to ' + max + ' years';
		if (min) return min + ' years and older';
		if (max) return 'Up to ' + max + ' years';
		return 'Not specified';
	}

	function formatSex(data) {
		var norm = data.inclusion_gender_normalized;
		if (norm === 'all') return 'Any';
		if (norm === 'female') return 'Female';
		if (norm === 'male') return 'Male';
		return data.inclusion_gender || 'Not specified';
	}

	function formatEnrollment(data) {
		var n = data.target_size;
		if (!n) return 'Not specified';
		return /^\d+$/.test(String(n).trim()) ? Number(n).toLocaleString() + ' participants' : escHtml(String(n));
	}

	// ── Metadata (title/description/canonical/JSON-LD) ──────────────────────

	function trialDescription(t) {
		var summary = stripHtml(t.summary || '');
		if (summary) return truncate(summary, 180);
		return truncate('Registry record for ' + stripHtml(t.title || 'this clinical trial') + '.', 180);
	}

	function browserTitle(t) {
		var title = stripHtml(t.title || 'Clinical trial');
		var context = [];
		if (t.acronym) context.push(stripHtml(t.acronym));
		var nct = t.identifiers && t.identifiers.nct;
		if (nct) context.push(nct);
		var parts = [title, context.slice(0, 2).join(' · ')].filter(Boolean);
		parts.push(siteTitle);
		return parts.join(' | ');
	}

	function updateStructuredData(t, pageUrl, descriptionText) {
		var el = document.getElementById('trial-jsonld-dynamic');
		if (!el) {
			el = document.createElement('script');
			el.type = 'application/ld+json';
			el.id = 'trial-jsonld-dynamic';
			document.head.appendChild(el);
		}
		var data = {
			'@context': 'https://schema.org',
			'@type': 'MedicalTrial',
			name: stripHtml(t.title || ''),
			description: descriptionText,
			url: pageUrl,
			trialDesign: formatPhase(t) || undefined,
			studySubject: t.condition ? { '@type': 'MedicalCondition', name: stripHtml(t.condition) } : undefined,
		};
		if (t.primary_sponsor) data.sponsor = { '@type': 'Organization', name: stripHtml(t.primary_sponsor) };
		if (t.identifiers && t.identifiers.nct) data.identifier = t.identifiers.nct;
		var registeredIso = toISOStringSafe(t.date_registration);
		if (registeredIso) data.datePosted = registeredIso;
		var sourceLink = safeLink(t.link);
		if (sourceLink && sourceLink !== '#') data.sameAs = sourceLink;
		Object.keys(data).forEach(function (k) { if (data[k] === undefined) delete data[k]; });
		el.textContent = JSON.stringify(data);
	}

	function updateRuntimeMetadata(t) {
		var pageUrl = normalizedPageUrl();
		var title = browserTitle(t);
		var descriptionText = trialDescription(t) || siteDesc;

		document.title = title;
		upsertCanonical(pageUrl);
		upsertMetaByName('description', descriptionText);
		upsertMetaByName('twitter:title', title);
		upsertMetaByName('twitter:description', descriptionText);
		upsertMetaByName('twitter:url', pageUrl);
		upsertMetaByProperty('og:title', title);
		upsertMetaByProperty('og:description', descriptionText);
		upsertMetaByProperty('og:url', pageUrl);
		upsertMetaByProperty('og:type', 'website');

		updateStructuredData(t, pageUrl, descriptionText);
	}

	// ── Render blocks ─────────────────────────────────────────────────────

	function renderBreadcrumb(t) {
		var nct = (t.identifiers && t.identifiers.nct) || t.acronym || ('Trial ' + t.trial_id);
		return '<nav class="trial-breadcrumb" aria-label="Breadcrumb">' +
			'<a href="/observatory/">Observatory</a>' +
			'<span class="trial-breadcrumb__sep">/</span>' +
			'<a href="/search/clinical-trials/">Clinical trials</a>' +
			'<span class="trial-breadcrumb__sep">/</span>' +
			'<span class="trial-breadcrumb__current">' + escHtml(nct) + '</span>' +
		'</nav>';
	}

	function renderSyncBar(t) {
		var registry = registryName(t);
		return '<div class="trial-sync-bar">' +
			'<span class="trial-sync-bar__text">Synced with ' + escHtml(registry) + ' on ' + escHtml(formatDate(t.last_refreshed_on)) + '</span>' +
			(t.link ? '<a class="trial-sync-bar__link" href="' + escHtml(safeLink(t.link)) + '" target="_blank" rel="noopener noreferrer">View the original record &rarr;</a>' : '') +
		'</div>';
	}

	function renderStatusBlock(t) {
		var s = statusInfo(t);
		return '<div class="trial-status-block">' +
			'<span class="trial-status-block__label">Recruitment status</span>' +
			'<div class="trial-status-block__row">' +
				'<span class="' + s.cls + '">' + escHtml(s.label) + '</span>' +
				(t.recruitment_status ? '<span class="trial-status-block__registry-term">registry term: ' + escHtml(t.recruitment_status) + '</span>' : '') +
			'</div>' +
		'</div>';
	}

	function renderChips(t) {
		var nct = t.identifiers && t.identifiers.nct;
		var registry = registryName(t);
		return '<div class="trial-chip-row">' +
			(t.acronym ? '<span class="trial-chip">' + escHtml(t.acronym) + '</span>' : '') +
			(nct       ? '<span class="trial-chip">' + escHtml(nct) + '</span>' : '') +
			'<span class="trial-chip trial-chip--registry"><span class="trial-chip__label">Registry</span>' + escHtml(registry) + '</span>' +
		'</div>';
	}

	function renderSponsorLine(t) {
		var bits = [];
		if (t.primary_sponsor) bits.push('Sponsored by <strong>' + escHtml(decodeEntities(t.primary_sponsor)) + '</strong>');
		bits.push('sponsor type ' + (t.sponsor_type ? escHtml(t.sponsor_type) : '<em>not reported</em>'));
		if (t.date_registration) bits.push('registered ' + escHtml(formatDate(t.date_registration)));
		return '<p class="trial-sponsor-line">' + bits.join(' &middot; ') + '</p>';
	}

	function renderSummary(t) {
		var summary = decodeEntities(t.summary || '');
		if (!summary) return '';
		return '<p class="trial-summary trial-summary--clamped" id="trial-summary-text">' + escHtmlAllowRegistryTags(summary) + '</p>' +
			'<div class="trial-summary-row">' +
				'<button type="button" class="trial-toggle-link" id="trial-summary-toggle" aria-expanded="false" aria-controls="trial-summary-text" hidden>Read the full summary</button>' +
				'<span class="trial-summary-row__hint">Summary as published by the registry.</span>' +
			'</div>';
	}

	function renderConditionBox(t) {
		if (!t.condition) return '';
		return '<div class="trial-condition-box">' +
			'<span class="trial-condition-box__label">Condition, as recorded by the registry</span>' +
			'<span class="trial-condition-box__value">&ldquo;' + escHtml(decodeEntities(t.condition)) + '&rdquo;</span>' +
		'</div>';
	}

	function renderEligibility(t) {
		var stats = [
			{ label: 'Enrollment target', value: formatEnrollment(t) },
			{ label: 'Age',              value: formatAge(t) },
			{ label: 'Sex eligible',     value: formatSex(t) },
			{ label: 'Phase',            value: formatPhase(t) || 'Not specified' },
		];
		var statsHtml = stats.map(function (s) {
			return '<div class="trial-quickstats__item"><span class="trial-quickstats__label">' + escHtml(s.label) + '</span>' +
				'<span class="trial-quickstats__value">' + escHtml(s.value) + '</span></div>';
		}).join('');

		var criteria = parseCriteria(t);
		var hasCriteria = criteria.inclusion.length || criteria.exclusion.length;
		var criteriaHtml = '';
		if (hasCriteria) {
			criteriaHtml = '<div class="trial-criteria-box">' +
				'<div class="trial-criteria-box__body" id="trial-criteria-body">' +
					(criteria.inclusion.length ?
						'<span class="trial-criteria-box__label">Key inclusion criteria</span>' +
						'<ul>' + criteria.inclusion.map(function (c) { return '<li>' + escHtml(c) + '</li>'; }).join('') + '</ul>'
						: '') +
					(criteria.exclusion.length ?
						'<span class="trial-criteria-box__label">Key exclusion criteria</span>' +
						'<ul>' + criteria.exclusion.map(function (c) { return '<li>' + escHtml(c) + '</li>'; }).join('') + '</ul>'
						: '') +
				'</div>' +
				'<button type="button" class="trial-criteria-box__toggle" id="trial-criteria-toggle" aria-expanded="false" aria-controls="trial-criteria-body" hidden>Read the full criteria</button>' +
			'</div>';
		}

		return '<h2 class="trial-section-heading">Eligibility</h2>' +
			'<div class="trial-quickstats">' + statsHtml + '</div>' +
			criteriaHtml +
			'<p class="trial-disclaimer">Eligibility is decided by the study team, not by this page. Criteria here are a copy of the registry text and may be out of date by the time you read them.</p>';
	}

	function renderInterventions(t) {
		var items = parseInterventions(t.intervention);
		if (!items.length) return '';
		var rows = items.map(function (it) {
			return '<div class="trial-intervention">' +
				'<span class="trial-intervention__type">' + escHtml(titleCaseType(it.type)) + '</span>' +
				'<span class="trial-intervention__body"><strong>' + escHtml(decodeEntities(it.name)) + '</strong>' +
					(it.desc ? ' — ' + escHtml(decodeEntities(it.desc)) : '') +
				'</span>' +
			'</div>';
		}).join('');
		return '<h2 class="trial-section-heading">Interventions</h2>' +
			'<div class="trial-interventions">' + rows + '</div>';
	}

	function renderOutcomes(t) {
		var primary = parseOutcomes(t.primary_outcome);
		var secondary = parseOutcomes(t.secondary_outcome);
		if (!primary.length && !secondary.length) return '';

		var html = '<h2 class="trial-section-heading">Outcomes</h2>';
		if (primary.length) {
			html += '<div class="trial-outcome-block"><span class="trial-outcome-block__label">Primary outcome</span>' +
				primary.map(function (o) {
					return '<p>' + escHtml(o.text) + (o.timeframe ? ' <span class="trial-outcome-timeframe">' + escHtml(timeframePhrase(o.timeframe)) + '.</span>' : '') + '</p>';
				}).join('') +
			'</div>';
		}
		if (secondary.length) {
			html += '<div class="trial-outcome-block"><span class="trial-outcome-block__label">Secondary outcomes</span>' +
				'<ul>' + secondary.map(function (o) {
					return '<li>' + escHtml(o.text) + (o.timeframe ? ' <span class="trial-outcome-timeframe">' + escHtml(o.timeframe) + '.</span>' : '') + '</li>';
				}).join('') + '</ul>' +
			'</div>';
		}
		return html;
	}

	function renderLocations(t) {
		var sites = t.trial_sites || [];
		if (!sites.length) {
			var countries = (t.trial_countries && t.trial_countries.length ? t.trial_countries.map(function (c) { return c.country; }) : t.countries_normalized) || [];
			var countryText = countries.length ? countries.map(countryName).join(', ') : (t.countries || '');
			return '<h2 class="trial-section-heading">Locations</h2>' +
				'<p class="trial-locations-empty">' + (countryText
					? 'Site-level location data is not available yet. Registered countries: ' + escHtml(countryText) + '.'
					: 'Location details were not reported by the registry.') + '</p>';
		}

		var byCountry = {};
		var order = [];
		sites.forEach(function (s) {
			var code = s.country || 'Unknown';
			if (!byCountry[code]) { byCountry[code] = []; order.push(code); }
			byCountry[code].push(s);
		});

		var blocks = order.map(function (code, idx) {
			var group = byCountry[code];
			var panelId = 'trial-location-panel-' + idx;
			var rows = group.map(function (s) {
				var place = [s.city, s.state, s.postcode].filter(Boolean).join(', ');
				return '<div class="trial-site-row">' +
					'<span class="trial-site-row__name">' + escHtml(decodeEntities(s.name || 'Study site')) + '</span>' +
					(place ? '<span class="trial-site-row__place">' + escHtml(place) + '</span>' : '') +
				'</div>';
			}).join('');
			return '<div class="trial-locations">' +
				'<button type="button" class="trial-locations__head" aria-expanded="false" aria-controls="' + panelId + '">' +
					'<span class="trial-locations__country">' + escHtml(countryName(code)) + '</span>' +
					'<span class="trial-locations__head-right">' +
						'<span class="trial-locations__count">' + group.length + ' site' + (group.length !== 1 ? 's' : '') + '</span>' +
						'<span class="trial-locations__chevron" aria-hidden="true">&#9656;</span>' +
					'</span>' +
				'</button>' +
				'<div class="trial-locations__panel" id="' + panelId + '" hidden>' +
					rows +
					'<div class="trial-locations__footnote">Contact details for each site are held by the registry. Follow the record link to reach them.</div>' +
				'</div>' +
			'</div>';
		}).join('');

		return '<h2 class="trial-section-heading">Locations</h2>' + blocks;
	}

	function renderStudyDesign(t) {
		var items = [
			{ label: 'Study type', value: t.study_type ? humanizeRegistryText(t.study_type) : '' },
			{ label: 'Study design', value: t.study_design ? humanizeRegistryText(t.study_design) : '' },
			{ label: 'Detailed description', value: t.ctg_detailed_description ? decodeEntities(t.ctg_detailed_description) : '' },
		];
		var grid = items.map(function (i) {
			return '<div class="trial-design-grid__item"><span class="trial-design-grid__label">' + escHtml(i.label) + '</span>' +
				(i.value
					? '<span class="trial-design-grid__value">' + escHtml(i.value) + '</span>'
					: '<span class="trial-design-grid__value trial-design-grid__value--absent">Not reported</span>') +
			'</div>';
		}).join('');
		return '<h2 class="trial-section-heading">Study design</h2><div class="trial-design-grid">' + grid + '</div>';
	}

	function renderLinkedResearch(t) {
		var articles = t.articles || [];
		if (!articles.length) {
			return '<h2 class="trial-section-heading">Research on this trial</h2>' +
				'<div class="trial-research-empty">' +
					'<span class="trial-research-empty__title">No papers in the Observatory are linked to this trial yet.</span>' +
					'<span class="trial-research-empty__body">We link a paper when its registry identifier matches this trial. Papers about the same treatment can be found through the research areas.</span>' +
				'</div>';
		}
		var cards = articles.map(function (a) {
			var id = a.article_id || a.id;
			var href = id ? '/articles/' + encodeURIComponent(id) + '/' : safeLink(a.link);
			return '<a class="trial-research-card" href="' + escHtml(href) + '">' +
				'<p class="trial-research-card__title">' + escHtml(decodeEntities(a.title || 'Untitled')) + '</p>' +
			'</a>';
		}).join('');
		return '<h2 class="trial-section-heading">Research on this trial</h2><div class="trial-research-list">' + cards + '</div>';
	}

	// ── Identifiers ────────────────────────────────────────────────────────
	//
	// The API's `identifiers` map is keyed by registry, but several keys can
	// describe the *same* registry record — trial 508 carries both
	// `euct: "2023-510127-30-00"` and `ctis: "CTIS2023-510127-30-00"`, which is
	// one EU CTIS registration written two ways. The display unit is therefore a
	// registry record, not a raw key: entries are grouped, deduped, and paired
	// with the matching URL from `links` so every id that has a source is
	// clickable (`t.link` alone only ever covers the primary registry).
	//
	// `identifiers`/`links` keys are an open vocabulary — the WHO ICTRP feeds
	// bring in registries beyond the ones named below, and `links` sometimes
	// keys by hostname (`chictr.org.cn`) rather than by registry slug. Anything
	// unknown degrades to an upper-cased key rather than being dropped.
	var REGISTRY_INFO = {
		nct:     { group: 'ctgov',   name: 'ClinicalTrials.gov',             links: ['ctgov', 'nct', 'clinicaltrials.gov'] },
		euct:    { group: 'eu-ctis', name: 'EU CTIS',                        links: ['ctis', 'euct', 'euclinicaltrials.eu'] },
		ctis:    { group: 'eu-ctis', name: 'EU CTIS',                        links: ['ctis', 'euct', 'euclinicaltrials.eu'] },
		euctr:   { group: 'eudract', name: 'EU Clinical Trials Register',    links: ['euctr', 'eudract', 'clinicaltrialsregister.eu'] },
		eudract: { group: 'eudract', name: 'EU Clinical Trials Register',    links: ['euctr', 'eudract', 'clinicaltrialsregister.eu'] },
		isrctn:  { group: 'isrctn',  name: 'ISRCTN',                         links: ['isrctn', 'isrctn.com'] },
		drks:    { group: 'drks',    name: 'German Clinical Trials Register',links: ['drks', 'drks.de'] },
		nl:      { group: 'nl',      name: 'Netherlands Trial Register',     links: ['onderzoekmetmensen.nl', 'nl', 'ntr'] },
		ntr:     { group: 'nl',      name: 'Netherlands Trial Register',     links: ['onderzoekmetmensen.nl', 'nl', 'ntr'] },
		jprn:    { group: 'jprn',    name: 'Japan Primary Registries Network', links: ['jrct.mhlw.go.jp', 'center6.umin.ac.jp', 'jprn', 'jrct', 'umin'] },
		chictr:  { group: 'chictr',  name: 'Chinese Clinical Trial Registry', links: ['chictr.org.cn', 'chictr'] },
		ctri:    { group: 'ctri',    name: 'Clinical Trials Registry — India', links: ['ctri', 'ctri.nic.in'] },
		irct:    { group: 'irct',    name: 'Iranian Registry of Clinical Trials', links: ['irct', 'irct.ir'] },
		actrn:   { group: 'anzctr',  name: 'ANZCTR',                         links: ['anzctr', 'actrn', 'anzctr.org.au'] },
		anzctr:  { group: 'anzctr',  name: 'ANZCTR',                         links: ['anzctr', 'actrn', 'anzctr.org.au'] },
		kct:     { group: 'kct',     name: 'Clinical Research Information Service (Korea)', links: ['kct', 'cris.nih.go.kr'] },
		rbr:     { group: 'rbr',     name: 'Brazilian Clinical Trials Registry', links: ['rbr', 'ensaiosclinicos.gov.br'] },
		pactr:   { group: 'pactr',   name: 'Pan African Clinical Trials Registry', links: ['pactr', 'pactr.samrc.ac.za'] },
		tctr:    { group: 'tctr',    name: 'Thai Clinical Trials Registry',  links: ['tctr', 'thaiclinicaltrials.org'] },
		slctr:   { group: 'slctr',   name: 'Sri Lanka Clinical Trials Registry', links: ['slctr', 'slctr.lk'] },
		per:     { group: 'per',     name: 'Peruvian Clinical Trials Registry', links: ['per', 'ensayosclinicos-repec.ins.gob.pe'] },
		rpcec:   { group: 'rpcec',   name: 'Cuban Public Registry of Clinical Trials', links: ['rpcec', 'rpcec.sld.cu'] },
		lbctr:   { group: 'lbctr',   name: 'Lebanese Clinical Trials Registry', links: ['lbctr', 'lbctr.emro.who.int'] },
		itmctr:  { group: 'itmctr',  name: 'ITMCTR',                         links: ['itmctr'] },
	};

	// Order the registry records so the most widely-cited id leads.
	var REGISTRY_ORDER = ['nct', 'euct', 'ctis', 'euctr', 'eudract', 'isrctn', 'drks', 'nl', 'ntr', 'jprn', 'chictr'];

	function registryInfoFor(key) {
		return REGISTRY_INFO[key] || { group: key, name: String(key).toUpperCase(), links: [key] };
	}

	function alnumKey(value) { return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]/g, ''); }
	function digitKey(value) { return String(value == null ? '' : value).replace(/\D/g, ''); }

	// A registry key maps to its URL either by name (`links.ctgov` for `nct`) or,
	// when the feed keys by hostname, by the id's digits turning up in the URL —
	// "2023-510127-30-00" inside ".../?EUCT=2023-510127-30-00".
	function resolveIdentifierUrl(key, value, links, claimed) {
		var info = registryInfoFor(key);
		var i;
		for (i = 0; i < info.links.length; i++) {
			var lk = info.links[i];
			if (links[lk]) { claimed[lk] = true; return links[lk]; }
		}
		var core = digitKey(value);
		if (core.length >= 6) {
			var keys = Object.keys(links);
			for (i = 0; i < keys.length; i++) {
				// A link already matched by name belongs to that registry — don't
				// let a second identifier attach itself to the same URL.
				if (claimed[keys[i]]) continue;
				if (digitKey(links[keys[i]]).indexOf(core) !== -1) { claimed[keys[i]] = true; return links[keys[i]]; }
			}
		}
		return '';
	}

	// One entry per registry record: { registry, value, href }.
	function buildIdentifierEntries(t) {
		var ids   = t.identifiers || {};
		var links = {};
		Object.keys(t.links || {}).forEach(function (k) { if (t.links[k]) links[k] = t.links[k]; });

		var keys = Object.keys(ids).filter(function (k) { return ids[k] && k !== 'org_study_id'; });
		keys.sort(function (a, b) {
			var ia = REGISTRY_ORDER.indexOf(a), ib = REGISTRY_ORDER.indexOf(b);
			return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
		});

		var claimed = {};
		var byGroup = {};
		var entries = [];

		keys.forEach(function (key) {
			var info  = registryInfoFor(key);
			var value = String(ids[key]).trim();
			var href  = resolveIdentifierUrl(key, value, links, claimed);
			var prior = byGroup[info.group];
			if (prior) {
				// Same registration under a second key: keep the shorter, more
				// canonical spelling ("2023-510127-30-00" over "CTIS2023-510127-30-00")
				// and keep whichever of the two resolved a URL.
				if (!prior.href && href) prior.href = href;
				if (value.length < prior.value.length) prior.value = value;
				return;
			}
			var entry = { registry: info.name, value: value, href: href };
			byGroup[info.group] = entry;
			entries.push(entry);
		});

		if (!entries.length && t.link) {
			entries.push({ registry: registryName(t), value: registryName(t), href: t.link });
		}
		return entries;
	}

	// `secondary_id` is a free-text catch-all: grant numbers, IND numbers,
	// EudraCT numbers, sponsor codenames — semicolon- or comma-delimited, and
	// frequently repeating an id already shown above. Split conservatively (a
	// comma followed by a digit is a thousands separator, not a delimiter) and
	// drop anything that restates a value already on the page.
	function buildSecondaryIdentifiers(t, shownValues) {
		if (!t.secondary_id) return [];
		var shownAlnum  = shownValues.map(alnumKey).filter(Boolean);
		var shownDigits = shownValues.map(digitKey).filter(function (d) { return d.length >= 8; });
		var parts = [];
		String(t.secondary_id).split(/\s*;\s*/).forEach(function (chunk) {
			chunk.split(/,\s*(?=[^\d\s])/).forEach(function (raw) {
				var part = raw.trim().replace(/^[.,;:/\\\s]+|[.,;:/\\\s]+$/g, '');
				if (!part) return;
				var a = alnumKey(part);
				if (!a) return;
				// Containment catches "EudraCT Number: 2007-002964-90" restating
				// "2007-002964-90"; short tokens have to match outright, so a
				// five-digit sponsor code can't swallow an unrelated number.
				var duplicate = shownAlnum.some(function (s) {
					if (a === s) return true;
					if (Math.min(a.length, s.length) < 5) return false;
					return a.indexOf(s) !== -1 || s.indexOf(a) !== -1;
				});
				if (!duplicate) {
					var d = digitKey(part);
					duplicate = d.length >= 8 && shownDigits.indexOf(d) !== -1;
				}
				if (!duplicate && parts.indexOf(part) === -1) parts.push(part);
			});
		});
		return parts;
	}

	// One cell per identifier, laid out on the same grid rhythm as the panel's
	// Synced / Registry / Registered row above it: registry name as the label,
	// the id itself as the value, the whole value clickable when we hold a URL
	// for that registry.
	function renderIdentifierCell(registry, value, href, extraClass) {
		var label = '<span class="trial-id__registry">' + escHtml(registry) + '</span>';
		// safeLink degrades an unusable URL to '#'; render plain text rather than
		// a link that goes nowhere.
		var url = href ? safeLink(href) : '';
		if (url === '#') url = '';
		var body;
		if (url) {
			body = '<a class="trial-id__value trial-id__value--link" href="' + escHtml(url) + '" ' +
				'target="_blank" rel="noopener noreferrer" ' +
				'aria-label="' + escHtml(value + ' on ' + registry + ' (opens in a new tab)') + '">' +
				escHtml(value) + '<span class="trial-id__external" aria-hidden="true">&#8599;</span></a>';
		} else {
			body = '<span class="trial-id__value">' + escHtml(value) + '</span>';
		}
		return '<li class="trial-id' + (extraClass ? ' ' + extraClass : '') + '">' + label + body + '</li>';
	}

	function renderProvenance(t) {
		var entries = buildIdentifierEntries(t);
		var cells = entries.map(function (e) {
			return renderIdentifierCell(e.registry, e.value, e.href, '');
		});

		// The sponsor's own protocol number identifies the study at the sponsor,
		// not a registry record — same grid, but labelled apart and never linked.
		var orgStudyId = (t.identifiers && t.identifiers.org_study_id) || '';
		if (orgStudyId) {
			cells.push(renderIdentifierCell('Sponsor protocol number', String(orgStudyId), '', 'trial-id--sponsor'));
		}

		var shownValues = entries.map(function (e) { return e.value; });
		if (orgStudyId) shownValues.push(String(orgStudyId));
		var secondary = buildSecondaryIdentifiers(t, shownValues);
		var secondaryHtml = secondary.length
			? '<p class="trial-id-also">' +
				'<span class="trial-id-also__label">Also referenced as</span>' +
				secondary.map(function (s) {
					return '<span class="trial-id-also__value">' + escHtml(s) + '</span>';
				}).join('') +
			'</p>'
			: '';

		var identifiersHtml = cells.length
			? '<div class="trial-provenance__identifiers">' +
				'<span class="trial-provenance__label">Identifiers</span>' +
				'<ul class="trial-id-grid">' + cells.join('') + '</ul>' +
				secondaryHtml +
			'</div>'
			: '';

		return '<div class="trial-provenance">' +
			'<h2 class="trial-provenance__heading">Where this page comes from</h2>' +
			'<p class="trial-provenance__body">This page is our copy of the registry records listed below. Some trials are registered in more than one place, and each registry keeps its own version. We do not add to those records and we do not verify them.</p>' +
			'<div class="trial-provenance__grid">' +
				'<div class="trial-provenance__item"><span class="trial-provenance__label">Synced</span><span class="trial-provenance__value">' + escHtml(formatDate(t.last_refreshed_on)) + '</span></div>' +
				'<div class="trial-provenance__item"><span class="trial-provenance__label">Primary registry</span><span class="trial-provenance__value">' + escHtml(registryName(t)) + '</span></div>' +
				'<div class="trial-provenance__item"><span class="trial-provenance__label">Registered</span><span class="trial-provenance__value">' + escHtml(formatDate(t.date_registration)) + '</span></div>' +
			'</div>' +
			identifiersHtml +
		'</div>';
	}

	function renderTrial(t) {
		return renderBreadcrumb(t) +
			renderSyncBar(t) +
			renderStatusBlock(t) +
			'<h1 class="trial-title">' + escHtml(decodeEntities(t.title)) + '</h1>' +
			renderChips(t) +
			renderSponsorLine(t) +
			renderSummary(t) +
			renderConditionBox(t) +
			renderEligibility(t) +
			renderInterventions(t) +
			renderOutcomes(t) +
			renderLocations(t) +
			renderStudyDesign(t) +
			renderLinkedResearch(t) +
			renderProvenance(t);
	}

	// ── Interactive toggles (summary clamp + criteria expand) ───────────────

	// A toggle is only useful when its content actually overflows the collapsed
	// height — scrollHeight exceeding clientHeight is true whether the clamp is
	// -webkit-line-clamp (summary) or max-height (criteria). Short registry text
	// that already fits shouldn't offer a "read more" that reveals nothing new.
	function isTruncated(el) {
		return el.scrollHeight > el.clientHeight + 1;
	}

	function initToggles() {
		var summaryToggle = document.getElementById('trial-summary-toggle');
		var summaryText   = document.getElementById('trial-summary-text');
		if (summaryToggle && summaryText) {
			if (isTruncated(summaryText)) summaryToggle.hidden = false;
			summaryToggle.addEventListener('click', function () {
				var open = summaryText.classList.toggle('trial-summary--open');
				summaryText.classList.toggle('trial-summary--clamped', !open);
				summaryToggle.setAttribute('aria-expanded', String(open));
				summaryToggle.textContent = open ? 'Show less' : 'Read the full summary';
			});
		}

		var criteriaToggle = document.getElementById('trial-criteria-toggle');
		var criteriaBody   = document.getElementById('trial-criteria-body');
		if (criteriaToggle && criteriaBody) {
			if (isTruncated(criteriaBody)) criteriaToggle.hidden = false;
			criteriaToggle.addEventListener('click', function () {
				var open = criteriaBody.classList.toggle('trial-criteria-box__body--open');
				criteriaToggle.setAttribute('aria-expanded', String(open));
				criteriaToggle.textContent = open ? 'Show less' : 'Read the full criteria';
			});
		}

		document.querySelectorAll('.trial-locations__head').forEach(function (head) {
			var panel = document.getElementById(head.getAttribute('aria-controls'));
			if (!panel) return;
			head.addEventListener('click', function () {
				panel.hidden = !panel.hidden;
				head.setAttribute('aria-expanded', String(!panel.hidden));
			});
		});
	}

	// ── State ─────────────────────────────────────────────────────────────

	function showLoading() { loading.hidden = false; errorEl.hidden = true; content.hidden = true; }
	function showError()   { loading.hidden = true; errorEl.hidden = false; content.hidden = true; }
	function showContent(html) {
		loading.hidden = true;
		errorEl.hidden = true;
		content.innerHTML = html;
		content.hidden = false;
		initToggles();
	}

	// ── Fetch ─────────────────────────────────────────────────────────────

	function fetchTrial(id) {
		showLoading();
		var url = apiBase + '/trials/' + encodeURIComponent(id) + '/?format=json';
		fetch(url, { headers: { 'Accept': 'application/json' } })
			.then(function (resp) {
				if (!resp.ok) throw new Error('HTTP ' + resp.status);
				return resp.json();
			})
			.then(function (trial) {
				updateRuntimeMetadata(trial);
				showContent(renderTrial(trial));
			})
			.catch(function () {
				showError();
			});
	}

	// Resolves a non-numeric path segment (a registry identifier) to its canonical
	// trial_id via the API's `identifiers` filter — confirmed against the live API
	// to be an exact, case-insensitive match on registry ids only (not acronyms or
	// org_study_id), so a single result is a safe redirect target. Rewrites the
	// URL bar to the canonical path (so the browser's address bar, and any
	// canonical/OG tags updateRuntimeMetadata sets, reflect /trials/{trial_id}/)
	// without a full navigation, then fetches as normal.
	function resolveIdentifierThenFetch(identifier) {
		showLoading();
		var url = apiBase + '/trials/?format=json&identifiers=' + encodeURIComponent(identifier);
		fetch(url, { headers: { 'Accept': 'application/json' } })
			.then(function (resp) {
				if (!resp.ok) throw new Error('HTTP ' + resp.status);
				return resp.json();
			})
			.then(function (data) {
				var results = (data && data.results) || [];
				if (results.length !== 1 || !results[0].trial_id) throw new Error('Trial not found');
				var canonicalId = String(results[0].trial_id);
				var canonicalPath = '/trials/' + canonicalId + '/';
				if (window.location.pathname !== canonicalPath) {
					history.replaceState(null, '', canonicalPath + window.location.search);
				}
				fetchTrial(canonicalId);
			})
			.catch(function () {
				showError();
			});
	}

	// ── Init ──────────────────────────────────────────────────────────────

	function loadTrial() {
		var segment = parsePathSegment();
		if (!segment) {
			showError();
		} else if (/^\d+$/.test(segment)) {
			fetchTrial(segment);
		} else {
			resolveIdentifierThenFetch(segment);
		}
	}

	if (retryBtn) {
		retryBtn.addEventListener('click', loadTrial);
	}

	loadTrial();

}());
