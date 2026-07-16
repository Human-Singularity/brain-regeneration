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

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

async function findAuthorByOrcid(orcid) {
	const url = new URL(`${API_BASE}/authors/`);
	url.searchParams.set('orcid', orcid);
	url.searchParams.set('format', 'json');
	const data = await fetchJson(url.toString(), 3600);
	if (!data) return null;
	const results = data.results || [];
	return results[0] || null;
}

function buildJsonLd(author, orcid) {
	const url = `${SITE_ORIGIN}/authors/${orcid}/`;
	return {
		'@context': 'https://schema.org',
		'@type': 'Person',
		name: cleanText(author.full_name || ''),
		url,
		mainEntityOfPage: url,
		sameAs: `https://orcid.org/${orcid}`,
	};
}

export async function onRequest(context) {
	const { params, env, request } = context;
	const orcid = String(params.orcid || '').toUpperCase();

	const shellURL = new URL('/authors/', request.url);
	const shell = await env.ASSETS.fetch(new Request(shellURL, request));

	// Malformed ORCID, or the shell itself is broken → pass through untouched.
	if (!ORCID_RE.test(orcid) || !shell.ok) return shell;

	const author = await findAuthorByOrcid(orcid);

	// Unknown ORCID / API down / malformed response → fail open with the unmodified shell.
	if (!author || !author.full_name) return shell;

	const name = cleanText(author.full_name);
	const pageTitle = `${name} — Brain Regeneration Observatory`;
	const description = buildDescription(
		`${name} — researcher profile tracked by the Brain Regeneration Observatory, including publications and clinical trial involvement in neurodegenerative disease research.`
	);
	const canonicalUrl = `${SITE_ORIGIN}/authors/${orcid}/`;

	return new HTMLRewriter()
		.on('title', new SetText(pageTitle))
		.on('meta[name="description"]', new SetAttr('content', description))
		.on('meta[property="og:title"]', new SetAttr('content', name))
		.on('meta[property="og:description"]', new SetAttr('content', description))
		.on('meta[property="og:url"]', new SetAttr('content', canonicalUrl))
		.on('meta[name="twitter:title"]', new SetAttr('content', name))
		.on('meta[name="twitter:description"]', new SetAttr('content', description))
		.on('link[rel="canonical"]', new SetAttr('href', canonicalUrl))
		// noindex stays in place until Task 2 (removing it from content/authors/_index.md
		// front matter) lands and this is verified live — do not strip it here.
		.on('head', new AppendJsonLd([buildJsonLd(author, orcid)]))
		.transform(shell);
}
