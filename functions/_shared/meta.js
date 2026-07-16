// Shared helpers for Pages Functions that inject per-record <head> metadata.
// This file lives under a directory (_shared/) whose name starts with an
// underscore, which is what excludes it from Cloudflare Pages' file-based
// routing — it's not routable as its own request handler either way.

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
		.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => codePointToChar(parseInt(hex, 16), match))
		.replace(/&#(\d+);/g, (match, dec) => codePointToChar(parseInt(dec, 10), match));
}

// String.fromCodePoint throws RangeError on invalid code points (e.g. a malformed
// numeric entity like "&#999999999;"). This must never throw — a thrown error here
// would surface as an unhandled exception mid-HTMLRewriter-transform and turn a
// cosmetic entity-decoding issue into a 5xx, defeating the fail-open design.
function codePointToChar(codePoint, fallback) {
	if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return fallback;
	try {
		return String.fromCodePoint(codePoint);
	} catch {
		return fallback;
	}
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

// Strips tags and decodes entities regardless of which order the source data
// combined them in. A single stripHtml-then-decodeEntities pass misses tags
// that were entity-encoded (e.g. "&lt;i&gt;text&lt;/i&gt;") — decoding after
// the strip turns them into live "<i>...</i>" markup with nothing left to
// remove it. Stripping again after decoding catches that case too, without
// needing to know or assume which encoding a given field used.
function toPlainText(str) {
	return stripHtml(decodeEntities(stripHtml(str || '')));
}

function buildDescription(rawHtmlOrText, maxLen = 155) {
	return truncate(toPlainText(rawHtmlOrText), maxLen);
}

// Plain text without truncating — for <title>/OG tags and JSON-LD values,
// where literal "&lt;i&gt;" or leftover markup would look broken.
function cleanText(str) {
	return toPlainText(str).replace(/\s+/g, ' ').trim();
}

// Safe to drop into a <script type="application/ld+json"> body: valid JSON with
// '<' escaped so a value like "</script>" cannot terminate the tag early.
function toSafeJsonLd(obj) {
	return JSON.stringify(obj).replace(/</g, '\\u003c');
}

// A stalled/slow origin must never be allowed to run out the Pages Function's
// own execution limit — that would surface as a hard error instead of the
// unmodified shell, defeating fail-open. Bound the API call with an explicit
// timeout well under that limit so a timeout is always our own graceful null.
async function fetchJson(url, cacheTtl, timeoutMs = 5000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			headers: { Accept: 'application/json' },
			cf: { cacheTtl, cacheEverything: true },
			signal: controller.signal,
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
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
	cleanText,
	toSafeJsonLd,
	fetchJson,
	SetText,
	SetAttr,
	RemoveElement,
	AppendJsonLd,
};
