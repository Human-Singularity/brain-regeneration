// Shared helpers for Pages Functions that inject per-record <head> metadata.
// Filename starts with an underscore so Cloudflare Pages excludes it from routing.

const API_BASE = 'https://api.brain-regeneration.com';
const SITE_ORIGIN = 'https://brain-regeneration.com';

function decodeEntities(str) {
	if (!str) return '';
	// Named entities first — some titles double-encode (e.g. "&amp;#946;" for β),
	// so a numeric entity can only appear after &amp; is unwrapped.
	const named = str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, ' ');
	return named
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripHtml(html) {
	if (!html) return '';
	return html.replace(/<[^>]*>/g, ' ');
}

// Truncates plain text to ~maxLen chars on a word boundary.
function truncate(text, maxLen) {
	const clean = text.replace(/\s+/g, ' ').trim();
	if (clean.length <= maxLen) return clean;
	const cut = clean.slice(0, maxLen);
	const lastSpace = cut.lastIndexOf(' ');
	return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

function buildDescription(rawHtmlOrText, maxLen = 155) {
	const decoded = decodeEntities(stripHtml(rawHtmlOrText || ''));
	return truncate(decoded, maxLen);
}

// Safe to drop into a <script type="application/ld+json"> body: valid JSON with
// '<' escaped so a value like "</script>" cannot terminate the tag early.
function toSafeJsonLd(obj) {
	return JSON.stringify(obj).replace(/</g, '\\u003c');
}

async function fetchJson(url, cacheTtl) {
	try {
		const res = await fetch(url, {
			headers: { Accept: 'application/json' },
			cf: { cacheTtl, cacheEverything: true },
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

// HTMLRewriter element handler: replaces text content, escaping it as text (not HTML).
class SetText {
	constructor(content) {
		this.content = content;
	}
	element(element) {
		element.setInnerContent(this.content, { html: false });
	}
}

class SetAttr {
	constructor(attr, value) {
		this.attr = attr;
		this.value = value;
	}
	element(element) {
		element.setAttribute(this.attr, this.value);
	}
}

class RemoveElement {
	element(element) {
		element.remove();
	}
}

// Appends a <script type="application/ld+json"> just before </head>.
class AppendJsonLd {
	constructor(jsonLdObjects) {
		this.jsonLdObjects = jsonLdObjects;
	}
	element(element) {
		for (const obj of this.jsonLdObjects) {
			element.append(
				`<script type="application/ld+json">${toSafeJsonLd(obj)}</script>`,
				{ html: true }
			);
		}
	}
}

export {
	API_BASE,
	SITE_ORIGIN,
	decodeEntities,
	stripHtml,
	truncate,
	buildDescription,
	toSafeJsonLd,
	fetchJson,
	SetText,
	SetAttr,
	RemoveElement,
	AppendJsonLd,
};
