import {
	API_BASE,
	SITE_ORIGIN,
	buildDescription,
	cleanText,
	decodeEntities,
	authorName,
	fetchJson,
	SetText,
	SetAttr,
	AppendJsonLd,
} from '../_shared/meta.js';

function buildJsonLd(data, id, title) {
	const url = `${SITE_ORIGIN}/articles/${id}/`;
	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'ScholarlyArticle',
		headline: title,
		url,
		mainEntityOfPage: url,
	};

	if (data.published_date) jsonLd.datePublished = data.published_date;

	if (Array.isArray(data.authors) && data.authors.length) {
		jsonLd.author = data.authors
			.filter((a) => a && authorName(a))
			.map((a) => ({ '@type': 'Person', name: cleanText(authorName(a)) }));
	}

	if (data.publisher) {
		jsonLd.publisher = { '@type': 'Organization', name: decodeEntities(data.publisher) };
	}

	if (data.container_title) {
		jsonLd.isPartOf = { '@type': 'Periodical', name: decodeEntities(data.container_title) };
	}

	if (data.link) {
		jsonLd.sameAs = data.link;
	}

	if (data.doi) {
		jsonLd.identifier = `https://doi.org/${data.doi}`;
	}

	if (data.access) {
		jsonLd.isAccessibleForFree = data.access === 'open';
	}

	return jsonLd;
}

export async function onRequest(context) {
	const { params, env, request } = context;
	const id = params.id;

	const shellURL = new URL('/articles/', request.url);
	const shell = await env.ASSETS.fetch(new Request(shellURL, request));

	// Non-numeric id, or the shell itself is broken → pass through untouched.
	if (!/^\d+$/.test(id) || !shell.ok) return shell;

	const data = await fetchJson(`${API_BASE}/articles/${id}/?format=json`, 3600);

	// Unknown id / API down / malformed response → fail open with the unmodified shell.
	if (!data || !data.title) return shell;

	// Plain text, not just entity-decoded — titles can carry embedded tags (e.g.
	// "<i>genus</i> species") which must not leak into <title>/OG text or JSON-LD.
	const title = cleanText(data.title);
	const pageTitle = `${title} — Brain Regeneration Observatory`;
	const description = buildDescription(data.summary);
	const canonicalUrl = `${SITE_ORIGIN}/articles/${id}/`;

	return new HTMLRewriter()
		.on('title', new SetText(pageTitle))
		.on('meta[name="description"]', new SetAttr('content', description))
		.on('meta[property="og:title"]', new SetAttr('content', title))
		.on('meta[property="og:description"]', new SetAttr('content', description))
		.on('meta[property="og:url"]', new SetAttr('content', canonicalUrl))
		.on('meta[name="twitter:title"]', new SetAttr('content', title))
		.on('meta[name="twitter:description"]', new SetAttr('content', description))
		.on('link[rel="canonical"]', new SetAttr('href', canonicalUrl))
		// noindex stays in place until Task 2 (removing it from content/articles/_index.md
		// front matter) lands and this is verified live — do not strip it here.
		.on('head', new AppendJsonLd([buildJsonLd(data, id, title)]))
		.transform(shell);
}
