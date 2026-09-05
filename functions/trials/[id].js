import {
	API_BASE,
	SITE_ORIGIN,
	buildDescription,
	cleanText,
	fetchJson,
	SetText,
	SetAttr,
	AppendJsonLd,
} from '../_shared/meta.js';

function buildJsonLd(data, id, title) {
	const url = `${SITE_ORIGIN}/trials/${id}/`;
	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'MedicalTrial',
		name: title,
		url,
		mainEntityOfPage: url,
	};

	if (data.condition) {
		jsonLd.studySubject = { '@type': 'MedicalCondition', name: cleanText(data.condition) };
	}

	if (data.primary_sponsor) {
		jsonLd.sponsor = { '@type': 'Organization', name: cleanText(data.primary_sponsor) };
	}

	if (data.phase_normalized || data.phase) {
		jsonLd.trialDesign = cleanText(data.phase_normalized || data.phase);
	}

	if (data.date_registration) jsonLd.datePosted = data.date_registration;

	if (data.identifiers && data.identifiers.nct) {
		jsonLd.identifier = data.identifiers.nct;
	}

	if (data.link) {
		jsonLd.sameAs = data.link;
	}

	return jsonLd;
}

// The canonical URL is /trials/{trial_id}/, but a trial is more often known by a
// registry identifier (NCT/EUCT/EudraCT/CTIS). /trials/{identifier}/ resolves the
// identifier against the API's `identifiers` filter — an exact, case-insensitive
// match on registry ids only (not acronyms or org_study_id, confirmed against the
// live API) — and 301s to the canonical id URL when it resolves to exactly one
// trial. Ambiguous (0 or >1 matches) or a failed lookup fails open to the shell,
// same as an unknown numeric id.
async function resolveIdentifier(id, requestUrl) {
	const list = await fetchJson(`${API_BASE}/trials/?format=json&identifiers=${encodeURIComponent(id)}`, 3600);
	const results = list && Array.isArray(list.results) ? list.results : [];
	if (results.length !== 1 || !results[0].trial_id) return null;
	const original = new URL(requestUrl);
	return `${SITE_ORIGIN}/trials/${results[0].trial_id}/${original.search}`;
}

export async function onRequest(context) {
	const { params, env, request } = context;
	const id = params.id;

	const shellURL = new URL('/trials/', request.url);
	const shell = await env.ASSETS.fetch(new Request(shellURL, request));

	if (!shell.ok) return shell;

	if (!/^\d+$/.test(id)) {
		const canonicalUrl = await resolveIdentifier(id, request.url);
		return canonicalUrl ? Response.redirect(canonicalUrl, 301) : shell;
	}

	const data = await fetchJson(`${API_BASE}/trials/${id}/?format=json`, 3600);

	// Unknown id / API down / malformed response → fail open with the unmodified shell.
	if (!data || !data.title) return shell;

	const title = cleanText(data.title);
	const pageTitle = `${title} — Brain Regeneration Observatory`;
	const description = buildDescription(data.summary);
	const canonicalUrl = `${SITE_ORIGIN}/trials/${id}/`;

	return new HTMLRewriter()
		.on('title', new SetText(pageTitle))
		.on('meta[name="description"]', new SetAttr('content', description))
		.on('meta[property="og:title"]', new SetAttr('content', title))
		.on('meta[property="og:description"]', new SetAttr('content', description))
		.on('meta[property="og:url"]', new SetAttr('content', canonicalUrl))
		.on('meta[name="twitter:title"]', new SetAttr('content', title))
		.on('meta[name="twitter:description"]', new SetAttr('content', description))
		.on('link[rel="canonical"]', new SetAttr('href', canonicalUrl))
		.on('head', new AppendJsonLd([buildJsonLd(data, id, title)]))
		.transform(shell);
}
