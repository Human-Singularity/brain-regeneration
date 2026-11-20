import {
	API_BASE,
	SITE_ORIGIN,
	buildDescription,
	cleanText,
	SetText,
	SetAttr,
	AppendJsonLd,
} from '../_shared/meta.js';

// GET /labs/{id}/ → the lab shell (/labs/lab/) with a real <head>: title, description,
// canonical and OG/Twitter tags, plus Organization JSON-LD. lab-page.js still renders the
// body client-side. Labs are not in any sitemap (the backend has no lab sitemap yet).
//
// A lab the API no longer lists answers 404, and the shell is served with that status so
// crawlers drop the old URL; lab-page.js renders the "no longer listed" state from the
// same 404. Any other failure (API down, timeout) fails open: the unmodified shell, 200.

async function fetchLab(id) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 5000);
	try {
		const res = await fetch(`${API_BASE}/labs/${id}/?format=json`, {
			headers: { Accept: 'application/json' },
			cf: { cacheTtl: 3600, cacheEverything: true },
			signal: controller.signal,
		});
		if (res.status === 404) return { missing: true };
		if (!res.ok) return null;
		return { lab: await res.json() };
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

function countryName(code) {
	if (!code) return '';
	try {
		return new Intl.DisplayNames(['en'], { type: 'region' }).of(String(code).toUpperCase()) || '';
	} catch {
		return '';
	}
}

function buildSummary(lab, name) {
	const head = lab.head && lab.head.full_name ? cleanText(lab.head.full_name) : '';
	const inst = lab.institution || {};
	const place = [inst.name ? cleanText(inst.name) : '', countryName(inst.country_code)].filter(Boolean).join(', ');
	let text = head
		? `${name}: a research group led by ${head}${place ? ` at ${place}` : ''}.`
		: `${name}: a research group${place ? ` at ${place}` : ''}.`;
	if (lab.member_count) text += ` ${lab.member_count} ${lab.member_count === 1 ? 'member' : 'members'}.`;
	const subjects = (lab.subjects || []).slice(0, 3).map((s) => cleanText(s.name)).filter(Boolean);
	if (subjects.length) text += ` Publishes on ${subjects.join(', ')}.`;
	return buildDescription(text);
}

function buildJsonLd(lab, id, name) {
	const url = `${SITE_ORIGIN}/labs/${id}/`;
	const jsonLd = { '@context': 'https://schema.org', '@type': 'Organization', name, url, mainEntityOfPage: url };
	const inst = lab.institution;
	if (inst && inst.name) {
		jsonLd.parentOrganization = { '@type': 'Organization', name: cleanText(inst.name) };
		if (inst.ror) jsonLd.parentOrganization.sameAs = `https://ror.org/${inst.ror}`;
	}
	return jsonLd;
}

export async function onRequest(context) {
	const { params, env, request } = context;
	const id = String(params.id || '');

	const shellURL = new URL('/labs/lab/', request.url);
	const shell = await env.ASSETS.fetch(new Request(shellURL, request));

	// Not a numeric id (including the shell's own /labs/lab/ path), or the shell is broken.
	if (!/^\d+$/.test(id) || !shell.ok) return shell;

	const found = await fetchLab(id);
	if (!found) return shell; // API down / timeout / malformed: fail open

	if (found.missing) {
		const headers = new Headers(shell.headers);
		headers.set('X-Robots-Tag', 'noindex');
		return new Response(shell.body, { status: 404, statusText: 'Not Found', headers });
	}

	const lab = found.lab;
	const name = lab && lab.name ? cleanText(lab.name) : '';
	if (!name) return shell;

	const pageTitle = `${name} — Research groups — Brain Regeneration Observatory`;
	const description = buildSummary(lab, name);
	const canonicalUrl = `${SITE_ORIGIN}/labs/${id}/`;

	return new HTMLRewriter()
		.on('title', new SetText(pageTitle))
		.on('meta[name="description"]', new SetAttr('content', description))
		.on('meta[property="og:title"]', new SetAttr('content', name))
		.on('meta[property="og:description"]', new SetAttr('content', description))
		.on('meta[property="og:url"]', new SetAttr('content', canonicalUrl))
		.on('meta[name="twitter:title"]', new SetAttr('content', name))
		.on('meta[name="twitter:description"]', new SetAttr('content', description))
		.on('link[rel="canonical"]', new SetAttr('href', canonicalUrl))
		.on('head', new AppendJsonLd([buildJsonLd(lab, id, name)]))
		.transform(shell);
}
