import {
	API_BASE,
	SITE_ORIGIN,
	SITE_ID,
	buildDescription,
	cleanText,
	truncate,
	decodeEntities,
	leadText,
	ownEditorial,
	normalizeOrcid,
	primarySubjectLink,
	authorName,
	fetchJson,
	SetText,
	SetAttr,
	AppendJsonLd,
} from '../_shared/meta.js';

const META_DESCRIPTION_LEN = 160;
const JSONLD_DESCRIPTION_LEN = 300;
// Some records are whole conference proceedings (e.g. /articles/1703/ has a
// ~140 KB summary). The abstract is for crawlers, not a full-text copy.
const ABSTRACT_LEN = 5000;
const MAX_KEYWORDS = 25;

// Our own words first (plain-English summary, then takeaways), then the paper's
// abstract. Keep in step with articleDescriptionSource() in article-single.js.
function descriptionSource(data, editorial) {
	if (editorial) {
		const plain = leadText(editorial.summary_plain_english);
		if (plain) return plain;
		const takeaways = cleanText(editorial.takeaways);
		if (takeaways) return takeaways;
	}
	return cleanText(data.summary);
}

// Folds spelling variants of one term to the same key, so "Alzheimer's Disease",
// "Alzheimer’s disease" and "Alzheimer Disease" (subject, author keyword, MeSH)
// count once: lowercase, drop a possessive 's, keep only letters and digits.
function keywordKey(text) {
	return text.toLowerCase().replace(/['’]s\b/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
}

// Subjects, then the paper's keywords, then major-topic MeSH descriptors.
// Deduped (first spelling wins) and capped: a record can carry 80+ terms.
function buildKeywords(data) {
	const seen = new Set();
	const out = [];
	const add = (value) => {
		if (out.length >= MAX_KEYWORDS || typeof value !== 'string') return;
		const text = cleanText(value);
		const key = keywordKey(text);
		if (!text || seen.has(key)) return;
		seen.add(key);
		out.push(text);
	};
	(data.subjects || []).forEach((s) => s && add(s.subject_name));
	(data.keywords || []).forEach(add);
	(data.mesh || []).forEach((m) => m && m.major_topic && add(m.descriptor));
	return out;
}

function buildAuthor(a) {
	const person = { '@type': 'Person', name: cleanText(authorName(a)) };
	const given = cleanText(a.given_name);
	const family = cleanText(a.family_name);
	if (given) person.givenName = given;
	if (family) person.familyName = family;
	const orcid = normalizeOrcid(a.ORCID || a.orcid);
	if (orcid) {
		person.url = `${SITE_ORIGIN}/authors/${orcid}/`;
		person.sameAs = `https://orcid.org/${orcid}`;
	}
	return person;
}

function buildIdentifiers(data) {
	const ids = [];
	const add = (propertyID, value) => {
		const v = value ? String(value).trim() : '';
		if (v) ids.push({ '@type': 'PropertyValue', propertyID, value: v });
	};
	add('DOI', data.doi);
	add('PMID', data.pmid);
	add('PMCID', data.pmcid);
	return ids;
}

// Same page regardless of query string, fragment or trailing slash.
function pageKey(url) {
	try {
		const u = new URL(url);
		return (u.host + u.pathname).toLowerCase().replace(/\/+$/, '');
	} catch {
		return null;
	}
}

// Clean identifier URLs first, then the source link unless it is one of them
// (the link is often a PubMed URL with tracking parameters).
function buildSameAs(data) {
	const urls = [];
	const keys = new Set();
	const add = (url) => {
		if (!url || !/^https?:\/\//i.test(url)) return;
		const key = pageKey(url);
		if (!key || keys.has(key)) return;
		keys.add(key);
		urls.push(url);
	};
	if (data.doi) add(`https://doi.org/${String(data.doi).trim()}`);
	if (data.pmid) add(`https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(String(data.pmid).trim())}/`);
	if (data.pmcid) add(`https://www.ncbi.nlm.nih.gov/pmc/articles/${encodeURIComponent(String(data.pmcid).trim())}/`);
	add(data.link);
	return urls;
}

function buildJsonLd(data, editorial, url, title) {
	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'ScholarlyArticle',
		headline: title,
		url,
		mainEntityOfPage: url,
	};

	const description = buildDescription(descriptionSource(data, editorial), JSONLD_DESCRIPTION_LEN);
	if (description) jsonLd.description = description;

	const abstract = truncate(cleanText(data.summary), ABSTRACT_LEN);
	if (abstract) jsonLd.abstract = abstract;

	const keywords = buildKeywords(data);
	if (keywords.length) jsonLd.keywords = keywords;

	if (data.published_date) jsonLd.datePublished = data.published_date;
	// No dateModified: the API has no modified date. discovery_date is when the
	// article was indexed, not when it changed. Add it once GregoryAi exposes an
	// editorial updated_at (see docs/article-jsonld-enrichment-plan.md, D1).

	if (Array.isArray(data.authors) && data.authors.length) {
		const authors = data.authors.filter((a) => a && authorName(a)).map(buildAuthor);
		if (authors.length) jsonLd.author = authors;
	}

	if (data.publisher) {
		jsonLd.publisher = { '@type': 'Organization', name: decodeEntities(data.publisher) };
	}

	if (data.container_title) {
		jsonLd.isPartOf = { '@type': 'Periodical', name: decodeEntities(data.container_title) };
	}

	const identifiers = buildIdentifiers(data);
	if (identifiers.length) jsonLd.identifier = identifiers;

	const sameAs = buildSameAs(data);
	if (sameAs.length) jsonLd.sameAs = sameAs.length === 1 ? sameAs[0] : sameAs;

	if (data.access) {
		jsonLd.isAccessibleForFree = data.access === 'open';
	}

	return jsonLd;
}

// Home › {primary subject's papers page} › article. A condition's landing page is
// its clinical-trials tab, so link its research-papers tab instead (for a research
// area they are the same page). Must match the visible breadcrumb that
// article-single.js renders from the same map and the same rule.
function buildBreadcrumb(data, links, url, title) {
	const subject = primarySubjectLink(data.subjects, links);
	if (!subject) return null;
	const parentUrl = subject.papers || subject.url;
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
			{ '@type': 'ListItem', position: 2, name: cleanText(subject.name), item: new URL(parentUrl, SITE_ORIGIN).href },
			{ '@type': 'ListItem', position: 3, name: title, item: url },
		],
	};
}

// Built by layouts/articles/article-shell.html. Missing or broken → no breadcrumb.
async function fetchSubjectLinks(env, requestUrl) {
	try {
		const res = await env.ASSETS.fetch(new Request(new URL('/subject-links.json', requestUrl)));
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

export async function onRequest(context) {
	const { params, env, request } = context;
	const id = params.id;

	const shellURL = new URL('/articles/', request.url);
	const shell = await env.ASSETS.fetch(new Request(shellURL, request));

	// Non-numeric id, or the shell itself is broken → pass through untouched.
	if (!/^\d+$/.test(id) || !shell.ok) return shell;

	const [data, links] = await Promise.all([
		fetchJson(`${API_BASE}/articles/${id}/?format=json&include=editorial&site_id=${SITE_ID}`, 3600),
		fetchSubjectLinks(env, request.url),
	]);

	// Unknown id / API down / malformed response → fail open with the unmodified shell.
	if (!data || !data.title) return shell;

	// Plain text, not just entity-decoded — titles can carry embedded tags (e.g.
	// "<i>genus</i> species") which must not leak into <title>/OG text or JSON-LD.
	const title = cleanText(data.title);
	const pageTitle = `${title} — Brain Regeneration Observatory`;
	const editorial = ownEditorial(data);
	const description = buildDescription(descriptionSource(data, editorial), META_DESCRIPTION_LEN);
	const canonicalUrl = `${SITE_ORIGIN}/articles/${id}/`;

	const jsonLd = [buildJsonLd(data, editorial, canonicalUrl, title)];
	const breadcrumb = buildBreadcrumb(data, links, canonicalUrl, title);
	if (breadcrumb) jsonLd.push(breadcrumb);

	return new HTMLRewriter()
		.on('title', new SetText(pageTitle))
		.on('meta[name="description"]', new SetAttr('content', description))
		.on('meta[property="og:title"]', new SetAttr('content', title))
		.on('meta[property="og:description"]', new SetAttr('content', description))
		.on('meta[property="og:url"]', new SetAttr('content', canonicalUrl))
		.on('meta[name="twitter:title"]', new SetAttr('content', title))
		.on('meta[name="twitter:description"]', new SetAttr('content', description))
		.on('link[rel="canonical"]', new SetAttr('href', canonicalUrl))
		.on('head', new AppendJsonLd(jsonLd))
		.transform(shell);
}
