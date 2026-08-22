// GET /api/funding-calls — same-origin proxy for the ABN / REDONE.br public
// funding-calls RSS feed (observatorio.abneuro.org.br/editais/rss).
//
// Exists because the origin only sends Access-Control-Allow-Origin for
// localhost (verified 2026-08-22) — a direct browser fetch works in
// `hugo-dev` and dies silently in production. Proxying through a Worker
// sidesteps that CORS gap and lets us fix the feed's data quality issues
// (see functions below) in one place instead of in every consumer.
//
// See docs/funding-calls-section-plan.md for the full rationale.

import { decodeEntities } from '../_shared/meta.js';

const UPSTREAM_URL = 'https://observatorio.abneuro.org.br/editais/rss?limit=400&lang=en';

// The origin 403s unrecognised clients (verified: bare Python urllib refused,
// curl accepted). Identify ourselves explicitly, both to get through and as
// good citizenship toward a partner's server.
const USER_AGENT = 'brain-regeneration.com funding-calls proxy (+https://brain-regeneration.com/)';

// Case-insensitive, word-boundary neurology vocabulary. Written as one string
// (JS RegExp has no 'x'/extended flag) but grouped the same way the spec does.
const NEURO = new RegExp(
	'\\b(' +
		'neuro\\w*|brain|cerebr\\w*|encephal\\w*|encefal\\w*' +
		'|myelin\\w*|mielin\\w*|demyelin\\w*' +
		'|alzheimer\\w*|parkinson\\w*|huntington\\w*|dementia\\w*|dem[êe]ncia\\w*' +
		'|epilep\\w*|epilepsia' +
		'|sclerosis|esclerose\\w*|amyotroph\\w*|amiotr[óo]fic\\w*|ELA|ALS' +
		'|stroke|avc|spinal\\s+cord|medula\\s+espinh\\w*|traumatic\\s+brain|concussion' +
		'|migraine\\w*|enxaqueca|cefaleia|headache' +
		'|ataxia\\w*|dystonia|distonia|neuropath\\w*|neuropat\\w*' +
		'|glioma|glioblastoma|meningi\\w*' +
		')\\b',
	'i'
);

// FAPESP descriptions open with a fixed "Instituição: … Cidade: …" prefix.
// Matching the neurology vocabulary against that prefix is a systematic
// false-positive source (e.g. any grant hosted at an "Instituto de
// Neurociências" would match "neuro" regardless of its actual topic), so it
// must be stripped before the filter runs.
const STRIP_BOILERPLATE = /Institui[çc][ãa]o:.*?(?=Inscri|Source:|$)|Cidade:\s*[^\n]*?(?=Inscri|Source:|$)/gis;

const PLACE_MAP = { internacional: 'International', brasil: 'Brazil' };
// Terms where the category's region slot is already a country/international
// marker rather than a state or city — used to avoid producing a redundant
// "Brazil, Brazil"-style place from joining region + country.
const REGION_IS_COUNTRY_TERM = new Set(['usa', 'brasil', 'brazil', 'internacional', 'international']);

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 24;

function normalizePlace(raw) {
	const s = (raw || '').trim();
	if (!s) return '';
	return PLACE_MAP[s.toLowerCase()] || s;
}

// Every description ends with a structured summary line, confirmed present
// across the live corpus:
//   Source: {funder} · {region}[ — {country}][ · Type: {type}]
// e.g. "FAPESP · São Paulo — Brazil · Type: Oportunidade" or, for funders
// with no distinct region, "AAN · USA — United States" (no Type segment —
// most non-Brazilian funders don't carry one). This is a more reliable
// source for place/type than the <category> tags alone.
function parseSourceLine(descriptionText) {
	const m = descriptionText.match(/Source:\s*([^\n<]+)/i);
	if (!m) return { region: '', country: '', type: '' };

	const segments = m[1].split('·').map((s) => s.trim());
	const regionSegment = segments[1] || '';
	const [region = '', country = ''] = regionSegment.split(/\s+—\s+/).map((s) => s.trim());
	const typeSegment = segments.find((s) => /^Type:/i.test(s));
	const type = typeSegment ? typeSegment.replace(/^Type:\s*/i, '').trim() : '';

	return { region, country, type };
}

// Extracts every capture-group-1 match of `pattern` against `text`, forcing
// the global flag on regardless of what the caller's pattern already carries.
function extractAll(pattern, text) {
	const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
	const re = new RegExp(pattern.source, flags);
	const out = [];
	let m;
	while ((m = re.exec(text))) out.push(m[1]);
	return out;
}

function extractOne(pattern, text) {
	const m = text.match(pattern);
	return m ? m[1] : '';
}

// The feed's <link> values sometimes contain leftover italics markup around
// species names (FAPESP), e.g. "…-genoma-em-<i>leishmania<-i>/9567/" once
// entities are decoded — the closing tag is itself malformed ("<-i>" instead
// of "</i>"). Strip anything tag-shaped rather than trying to match the two
// specific forms seen so far.
function stripLinkMarkup(url) {
	return url.replace(/<\/?-?[a-z]+>/gi, '');
}

// FAPESP: "Inscrições até: 24/08/2026" → DD/MM/YYYY.
// NIH/Grants.gov: "Inscrições até 10/08/2027 (MM/DD/AAAA)" → MM/DD/YYYY, and
// says so explicitly. Same field, two formats, differing punctuation — see
// §4.1 of the plan for the verified NIH regression this guards against
// (PAR-25-327 must resolve to 2027-10-08, not 2027-08-10).
function parseDeadline(descriptionText) {
	const m = descriptionText.match(/Inscri\S*\s*at[ée]:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
	if (!m) return null;

	const a = parseInt(m[1], 10);
	const b = parseInt(m[2], 10);
	const year = parseInt(m[3], 10);
	const isMonthDay = /\(MM\/DD\/AAAA\)/i.test(descriptionText);

	let month = isMonthDay ? a : b;
	let day = isMonthDay ? b : a;
	// Whichever raw component is > 12 must be the day, regardless of the
	// marker — a defensive sanity check, not just a format switch.
	if (a > 12) {
		day = a;
		month = b;
	} else if (b > 12) {
		day = b;
		month = a;
	}

	if (month < 1 || month > 12 || day < 1 || day > 31) return null;

	const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	const d = new Date(`${iso}T00:00:00Z`);
	if (Number.isNaN(d.getTime()) || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null;
	return iso;
}

// region is sometimes a state/city (FAPESP · São Paulo), sometimes already a
// country/international marker (CNPq · Brasil, AAN · USA, IBRO ·
// Internacional). Only join region + country when the region is genuinely a
// finer-grained place than the country — otherwise "Brasil" + "Brazil" would
// render as the redundant "Brasil, Brazil".
function parsePlace(region, country) {
	if (REGION_IS_COUNTRY_TERM.has(region.toLowerCase())) {
		return normalizePlace(region) || country;
	}
	if (region && country && region !== country) {
		return `${region}, ${country}`;
	}
	return region || country || '';
}

function parseItem(rawItem) {
	const titleRaw = extractOne(/<title>([\s\S]*?)<\/title>/i, rawItem);
	const linkRaw = extractOne(/<link>([\s\S]*?)<\/link>/i, rawItem);
	const guidRaw = extractOne(/<guid[^>]*>([\s\S]*?)<\/guid>/i, rawItem);
	const descriptionRaw = extractOne(/<description>([\s\S]*?)<\/description>/i, rawItem);
	const pubDateRaw = extractOne(/<pubDate>([\s\S]*?)<\/pubDate>/i, rawItem);
	const categoriesRaw = extractAll(/<category>([\s\S]*?)<\/category>/i, rawItem);

	if (!titleRaw || !guidRaw || !pubDateRaw) return null;

	const publishedDate = new Date(pubDateRaw);
	if (Number.isNaN(publishedDate.getTime())) return null;

	const title = decodeEntities(titleRaw).trim();
	const link = stripLinkMarkup(decodeEntities(linkRaw).trim());
	const id = decodeEntities(guidRaw).trim();
	const description = decodeEntities(descriptionRaw);
	const categories = categoriesRaw.map((c) => decodeEntities(c).trim()).filter(Boolean);

	const [funderRaw] = (categories[0] || '').split('·');
	const funder = (funderRaw || '').trim();
	const source = parseSourceLine(description);
	const place = parsePlace(source.region, source.country);
	// Prefer the "Source:" line's explicit "Type: X" label; fall back to a
	// later <category> tag for the rare item whose Source line lacks one.
	const type = source.type || categories.slice(1).find((c) => c.length > 0 && c.length < 40) || '';
	const deadline = parseDeadline(description);

	// Neurology filter runs against title + categories + the description with
	// the FAPESP institutional boilerplate stripped out (see STRIP_BOILERPLATE).
	const strippedDescription = description.replace(STRIP_BOILERPLATE, '');
	const haystack = `${title} ${categories.join(' ')} ${strippedDescription}`;
	if (!NEURO.test(haystack)) return null;

	return {
		id,
		title,
		link,
		funder,
		place,
		type,
		deadline,
		published: publishedDate.toISOString(),
	};
}

// Naive "take the newest N" skews toward whichever funder posted most on the
// day of collection (pubDate is the crawl date, not the funder's own
// publication date — many items share one pubDate). Round-robin across
// distinct funders — in the order they first appear in the newest-first
// list — before taking a second item from any one of them.
function roundRobinByFunder(items) {
	const queues = new Map();
	const order = [];
	for (const item of items) {
		const key = item.funder || '';
		if (!queues.has(key)) {
			queues.set(key, []);
			order.push(key);
		}
		queues.get(key).push(item);
	}

	const result = [];
	let remaining = items.length;
	while (remaining > 0) {
		for (const key of order) {
			const queue = queues.get(key);
			if (queue.length) {
				result.push(queue.shift());
				remaining--;
			}
		}
	}
	return result;
}

async function fetchFeed() {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 8000);
	try {
		const res = await fetch(UPSTREAM_URL, {
			headers: {
				'User-Agent': USER_AGENT,
				Accept: 'application/rss+xml, application/xml, text/xml',
			},
			// The feed's own Cache-Control is "max-age=0, must-revalidate, private",
			// which would otherwise defeat edge caching entirely. This lets the
			// edge do conditional (ETag/If-None-Match) requests on our behalf —
			// confirmed to return 304 on the live origin.
			cf: { cacheTtl: 3600, cacheEverything: true },
			signal: controller.signal,
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

export async function onRequest(context) {
	const { request } = context;
	const url = new URL(request.url);
	const limitParam = parseInt(url.searchParams.get('limit'), 10);
	const limit = Number.isFinite(limitParam) ? Math.min(MAX_LIMIT, Math.max(1, limitParam)) : DEFAULT_LIMIT;

	const respond = (body) =>
		new Response(JSON.stringify(body), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=1800, s-maxage=10800, stale-while-revalidate=86400',
			},
		});

	const xml = await fetchFeed();
	// Fail open: an upstream error degrades the widget to its empty state
	// rather than surfacing a 5xx.
	if (!xml) return respond({ items: [], error: 'upstream' });

	const rawItems = extractAll(/<item>([\s\S]*?)<\/item>/i, xml);

	const seen = new Set();
	const items = [];
	for (const raw of rawItems) {
		let parsed = null;
		try {
			parsed = parseItem(raw);
		} catch {
			// A single malformed item must not take down the whole response —
			// skip it and keep whatever else parsed.
		}
		if (!parsed || seen.has(parsed.id)) continue;
		seen.add(parsed.id);
		items.push(parsed);
	}

	items.sort((a, b) => new Date(b.published) - new Date(a.published));
	const diversified = roundRobinByFunder(items).slice(0, limit);
	diversified.sort((a, b) => new Date(b.published) - new Date(a.published));

	return respond({ items: diversified });
}
