/**
 * Citation metadata for reference managers (Zotero, Mendeley).
 *
 * One file, two runtimes:
 *  - the browser loads it as a classic script → window.BR.citation
 *    (research-feed.js and patents-feed.js put a COinS span in each card);
 *  - functions/articles/[id].js imports it (CommonJS) to write Highwire
 *    citation_* <meta> tags into the article page's <head>.
 * No DOM, no fetch: plain functions over GregoryAi API records.
 *
 * What the tools read, from Zotero's own translators:
 *  - "Embedded Metadata" reads citation_* tags. The item type comes from the
 *    container tag (citation_journal_title → journal article,
 *    citation_conference_title → conference paper, last one wins); with none,
 *    a DC.type of "preprint" decides, provided og:type is not "website".
 *    The item's URL is citation_public_url, so saved items link back to us.
 *  - "COinS" reads <span class="Z3988" title="{OpenURL}">, one per item, so a
 *    list page offers a pick-several dialog. Zotero re-scans a client-rendered
 *    page when it gets a ZoteroItemUpdated event (notifyReferenceManagers).
 */
(function (root, factory) {
	var api = factory();
	if (typeof module === 'object' && module.exports) {
		module.exports = api;
	} else {
		root.BR = root.BR || {};
		root.BR.citation = api;
	}
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	var SITE_TIME_ZONE = 'Europe/Lisbon';
	var ABSTRACT_MAX = 10000;

	// ── Text ────────────────────────────────────────────────────────────

	function codePointToChar(codePoint, fallback) {
		if (!isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return fallback;
		try {
			return String.fromCodePoint(codePoint);
		} catch (e) {
			return fallback;
		}
	}

	// Named entities first: some titles double-encode ("&amp;#946;" for β).
	function decodeEntities(str) {
		return String(str || '')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#0?39;/g, "'")
			.replace(/&apos;/g, "'")
			.replace(/&nbsp;/g, ' ')
			.replace(/&#x([0-9a-fA-F]+);/g, function (m, hex) { return codePointToChar(parseInt(hex, 16), m); })
			.replace(/&#(\d+);/g, function (m, dec) { return codePointToChar(parseInt(dec, 10), m); });
	}

	// Inline markup goes without a trace ("<i>in vivo</i>." → "in vivo."),
	// anything else leaves a space so words on either side stay apart.
	var INLINE_TAG = /<\/?(?:jats:|mml:)?(?:i|b|em|strong|u|sup|sub|span|a|small|sc|italic|bold|underline|styled-content|inline-formula|math|mi|mn|mo|mrow|msub|msup)\b[^>]*>/gi;

	function stripTags(str) {
		return String(str || '').replace(INLINE_TAG, '').replace(/<[^>]*>/g, ' ');
	}

	// Plain, single-line text: strip, decode, strip again (entity-encoded tags).
	function plainText(str) {
		return stripTags(decodeEntities(stripTags(str))).replace(/\s+/g, ' ').trim();
	}

	function truncate(text, maxLen) {
		if (text.length <= maxLen) return text;
		var cut = text.slice(0, maxLen);
		var lastSpace = cut.lastIndexOf(' ');
		return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…';
	}

	// A PubMed citation line: "Neurology. 2026 Dec 2;107(11):e1. doi: …"
	var PUBMED_CITATION_LINE = /^[^.]{1,150}\.\s+(?:19|20)\d{2}\b/;
	var ABSTRACT_HEADING = /^(?:abstract|summary)$/i;

	/**
	 * The paper's abstract as one line of plain text, without what the feeds
	 * that delivered it wrapped around it:
	 *  - PubMed RSS: the leading citation line, a bold "ABSTRACT" heading and the
	 *    trailing "PMID: … | DOI: …" line;
	 *  - Crossref JATS: an "Abstract" title; section titles become "Methods: …";
	 *  - HAL: the "International audience ;" prefix;
	 *  - a trailing copyright line.
	 */
	function cleanAbstract(html) {
		var s = String(html || '');
		if (!s.trim()) return '';
		// Drop markup whose text would only add noise.
		s = s.replace(/<(jats:)?(tex-math|graphic|inline-graphic)\b[\s\S]*?(<\/\1?\2>|\/>)/gi, ' ');
		// Section titles → "Title: " (an "Abstract" title is dropped below).
		s = s.replace(/<(?:jats:)?title\b[^>]*>([\s\S]*?)<\/(?:jats:)?title>/gi, function (m, inner) {
			var t = plainText(inner).replace(/[\s:.]+$/, '');
			return t ? '\n\n' + t + ': ' : ' ';
		});
		// Block boundaries → paragraph breaks, so blocks can be judged one by one.
		s = s.replace(/<\/?(?:jats:)?(?:p|div|sec|li|list|br)\b[^>]*>/gi, '\n\n');
		var blocks = s.split(/\n{2,}/).map(plainText).filter(Boolean);

		if (blocks.length > 1 && PUBMED_CITATION_LINE.test(blocks[0])) blocks.shift();
		blocks = blocks.filter(function (b) {
			return !ABSTRACT_HEADING.test(b.replace(/[\s:.]+$/, '')) && !/^PMID:/i.test(b);
		});
		// Trailing copyright lines, and headings left with nothing under them
		// ("Graphical Abstract" above an image we dropped).
		while (blocks.length && (/^(?:copyright\b|©|\(c\)\s)/i.test(blocks[blocks.length - 1])
			|| /:$|^graphical abstract$/i.test(blocks[blocks.length - 1]))) blocks.pop();
		// Some records carry a placeholder instead of an abstract.
		if (blocks.length === 1 && /^no abstract(?: available)?\.?$/i.test(blocks[0])) return '';

		var text = blocks.join(' ')
			.replace(/^International audience\s*;?\s*/i, '')
			.replace(/^(?:abstract|summary)\s*[:.]\s*/i, '')
			.replace(/\s*graphical abstract\s*:?$/i, '')
			.replace(/\s+/g, ' ')
			.trim();
		return truncate(text, ABSTRACT_MAX);
	}

	// ── Record fields ───────────────────────────────────────────────────

	/** "YYYY-MM-DD" as a calendar day in Lisbon, or ''. The API stores Lisbon
	 *  midnights in UTC ("2021-05-10T23:00:00Z" is 11 May). */
	function isoDate(value) {
		if (!value) return '';
		var str = String(value).trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
		var d = new Date(str);
		if (isNaN(d.getTime())) return '';
		try {
			var parts = {};
			new Intl.DateTimeFormat('en-GB', {
				timeZone: SITE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
			}).formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
			if (parts.year && parts.month && parts.day) return parts.year + '-' + parts.month + '-' + parts.day;
		} catch (e) { /* no time zone data: fall back to UTC */ }
		return d.toISOString().slice(0, 10);
	}

	/** "Family, Given" when the parts are known, else the name as written. */
	function authorName(a) {
		if (!a) return '';
		var family = plainText(a.family_name);
		var given = plainText(a.given_name);
		if (family) return given ? family + ', ' + given : family;
		return plainText(a.credit_name || a.full_name);
	}

	function authorNames(record) {
		return (Array.isArray(record.authors) ? record.authors : []).map(authorName).filter(Boolean);
	}

	var PREPRINT_SERVERS = [
		{ name: 'bioRxiv', re: /biorxiv/i },
		{ name: 'medRxiv', re: /medrxiv/i },
		{ name: 'arXiv', re: /(^|[^a-z])arxiv/i },
		{ name: 'ChemRxiv', re: /chemrxiv/i },
		{ name: 'PsyArXiv', re: /psyarxiv/i },
		{ name: 'Research Square', re: /research\s*square|researchsquare\.com/i },
		{ name: 'Preprints.org', re: /preprints\.org/i },
		{ name: 'SSRN', re: /\bssrn\b/i },
		{ name: 'Authorea', re: /authorea/i },
	];
	// DOI prefixes that only preprints use (bioRxiv/medRxiv share 10.1101 with
	// CSHL journals, but only preprints have a date-shaped suffix; 10.64898 is
	// openRxiv, which took both servers over in 2025).
	var PREPRINT_DOI = /^10\.(?:1101\/\d{4}\.\d{2}\.\d{2}\.|64898\/|21203\/rs\.|20944\/preprints|2139\/ssrn|48550\/arxiv|26434\/chemrxiv|31234\/osf\.io|22541\/au\.)/i;

	function hostOf(url) {
		try { return new URL(String(url)).hostname; } catch (e) { return ''; }
	}

	function preprintServer(record) {
		var haystacks = [plainText(record.container_title), hostOf(record.link)];
		for (var i = 0; i < PREPRINT_SERVERS.length; i++) {
			for (var j = 0; j < haystacks.length; j++) {
				if (haystacks[j] && PREPRINT_SERVERS[i].re.test(haystacks[j])) return PREPRINT_SERVERS[i].name;
			}
		}
		return '';
	}

	function hasType(record, names) {
		var types = Array.isArray(record.publication_types) ? record.publication_types : [];
		return types.some(function (t) { return names.indexOf(String(t).trim().toLowerCase()) !== -1; });
	}

	/** 'preprint', 'conference' or 'journal' (the default: reviews, case
	 *  reports, letters… are all journal articles to a reference manager). */
	function recordKind(record) {
		if (hasType(record, ['preprint'])
			|| PREPRINT_DOI.test(String(record.doi || '').trim())
			|| preprintServer(record)) return 'preprint';
		if (hasType(record, ['congress', 'conference proceedings', 'conference paper'])
			&& plainText(record.container_title)) return 'conference';
		return 'journal';
	}

	/** The preprint server's name: "bioRxiv : the preprint server for biology" → "bioRxiv". */
	function repositoryName(record) {
		return preprintServer(record)
			|| plainText(record.container_title).split(/\s+:\s+/)[0]
			|| plainText(record.publisher);
	}

	/** PubMed Central PDF for open-access papers deposited there, or ''. */
	function pdfUrl(record) {
		var pmcid = String(record.pmcid || '').trim().toUpperCase();
		if (record.access !== 'open' || !/^PMC\d+$/.test(pmcid)) return '';
		return 'https://pmc.ncbi.nlm.nih.gov/articles/' + pmcid + '/pdf/';
	}

	function paperKeywords(record) {
		var seen = {};
		var out = [];
		(Array.isArray(record.keywords) ? record.keywords : []).forEach(function (k) {
			var text = plainText(k).replace(/;/g, ',');
			var key = text.toLowerCase();
			if (text && !seen[key]) { seen[key] = true; out.push(text); }
		});
		return out;
	}

	// ── Highwire <meta> tags (article pages) ────────────────────────────

	/**
	 * [name, content] pairs for the article page's <head>, in order.
	 * pageUrl is our own page: it becomes the saved item's URL.
	 */
	function highwireTags(record, pageUrl) {
		var tags = [];
		var add = function (name, value) {
			var v = value == null ? '' : String(value).trim();
			if (v) tags.push([name, v]);
		};
		var kind = recordKind(record);
		var container = plainText(record.container_title);

		add('citation_title', plainText(record.title));
		var authors = authorNames(record);
		// With a single citation_author, Zotero splits "van der Berg, Anna Maria"
		// at the comma into two people. A trailing ";" makes it a one-item list.
		if (authors.length === 1 && /\s.*,.*\s/.test(authors[0])) authors[0] += ';';
		authors.forEach(function (name) { add('citation_author', name); });
		add('citation_publication_date', isoDate(record.published_date).replace(/-/g, '/'));

		if (kind === 'preprint') {
			add('citation_publisher', repositoryName(record));
		} else {
			// The container tag sets the item type; for a conference paper,
			// citation_conference_title has to come last.
			if (kind === 'conference') {
				add('citation_inbook_title', container);
				add('citation_conference_title', container);
			} else {
				add('citation_journal_title', container);
			}
			add('citation_publisher', plainText(record.publisher));
		}

		add('citation_doi', String(record.doi || '').trim());
		add('citation_pmid', String(record.pmid || '').trim());
		add('citation_abstract', cleanAbstract(record.summary));
		add('citation_keywords', paperKeywords(record).join('; '));
		add('citation_public_url', pageUrl);
		add('citation_pdf_url', pdfUrl(record));
		if (kind === 'preprint') add('DC.type', 'preprint');
		return tags;
	}

	// ── COinS (feed pages) ──────────────────────────────────────────────

	function kev(pairs) {
		return pairs
			.filter(function (p) { return p[1] != null && String(p[1]).trim() !== ''; })
			.map(function (p) { return p[0] + '=' + encodeURIComponent(String(p[1]).trim()); })
			.join('&');
	}

	/** OpenURL ContextObject for a paper. pageUrl: our /articles/{id}/ page. */
	function articleCoins(record, pageUrl) {
		var kind = recordKind(record);
		var title = plainText(record.title);
		var container = plainText(record.container_title);
		var authors = authorNames(record);
		var pairs = [['ctx_ver', 'Z39.88-2004']];
		if (kind === 'preprint') {
			// No preprint format in OpenURL; Dublin Core + rft.type does it in Zotero.
			pairs.push(['rft_val_fmt', 'info:ofi/fmt:kev:mtx:dc'], ['rft.type', 'preprint'], ['rft.title', title]);
			authors.forEach(function (n) { pairs.push(['rft.creator', n]); });
			pairs.push(['rft.pub', repositoryName(record)]);
		} else if (kind === 'conference') {
			pairs.push(['rft_val_fmt', 'info:ofi/fmt:kev:mtx:book'], ['rft.genre', 'proceeding'],
				['rft.atitle', title], ['rft.btitle', container]);
			authors.forEach(function (n) { pairs.push(['rft.au', n]); });
			pairs.push(['rft.pub', plainText(record.publisher)]);
		} else {
			pairs.push(['rft_val_fmt', 'info:ofi/fmt:kev:mtx:journal'], ['rft.genre', 'article'],
				['rft.atitle', title], ['rft.jtitle', container]);
			authors.forEach(function (n) { pairs.push(['rft.au', n]); });
			pairs.push(['rft.pub', plainText(record.publisher)]);
		}
		pairs.push(['rft.date', isoDate(record.published_date)]);
		if (record.doi) pairs.push(['rft_id', 'info:doi/' + String(record.doi).trim()]);
		if (record.pmid) pairs.push(['rft_id', 'info:pmid/' + String(record.pmid).trim()]);
		pairs.push(['rft_id', pageUrl]);
		pairs.push(['rft.description', cleanAbstract(record.summary)]);
		return kev(pairs);
	}

	/**
	 * OpenURL ContextObject for a patent family. opts.title / opts.assignees
	 * override the record's (the feed shows sentence-cased titles and tidied
	 * applicant names). The URL stays Espacenet's: we have no patent page, and
	 * the EPO licence asks us to keep that link.
	 */
	function patentCoins(record, opts) {
		opts = opts || {};
		var assignees = opts.assignees || (record.applicants || []).map(function (a) {
			return plainText(a && (a.raw_name || a.sponsor_name));
		});
		return kev([
			['ctx_ver', 'Z39.88-2004'],
			['rft_val_fmt', 'info:ofi/fmt:kev:mtx:patent'],
			['rft.title', opts.title || plainText(record.title)],
			['rft.assignee', assignees.filter(Boolean).join('; ')],
			['rft.number', record.representative_publication],
			// Zotero files rft.date as the issue date. Not rft.appldate: it lands
			// in the same field and would overwrite it.
			['rft.date', isoDate(record.earliest_publication_date)],
			['rft_id', /^https?:\/\//i.test(record.link || '') ? record.link : ''],
		]);
	}

	/** Ask reference-manager extensions to re-scan a page whose items were
	 *  rendered after load (Zotero listens for this event). */
	function notifyReferenceManagers() {
		if (typeof document === 'undefined' || typeof Event !== 'function') return;
		try {
			document.dispatchEvent(new Event('ZoteroItemUpdated', { bubbles: true, cancelable: true }));
		} catch (e) { /* never break the feed over this */ }
	}

	return {
		cleanAbstract: cleanAbstract,
		isoDate: isoDate,
		authorName: authorName,
		recordKind: recordKind,
		repositoryName: repositoryName,
		pdfUrl: pdfUrl,
		highwireTags: highwireTags,
		articleCoins: articleCoins,
		patentCoins: patentCoins,
		notifyReferenceManagers: notifyReferenceManagers,
	};
});
