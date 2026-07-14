/* br-utils.js — shared helpers for Brain Regeneration feed/widget scripts.
 *
 * Exposes a single global, window.BR, consumed by research-feed.js,
 * trials-feed.js, research-spotlight.js and the inline scripts on the
 * homepage and conditions list. Loaded synchronously in <head>
 * (partials/head.html) so it is available to both inline page scripts and
 * the deferred feed scripts.
 *
 * Pure helpers + a tiny localStorage cache factory. No DOM/network side
 * effects at load time.
 */
(function (window) {
	'use strict';

	// Escape a string for safe insertion into HTML text or double-quoted attributes.
	function escHtml(str) {
		if (str == null) return '';
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	// Decode HTML entities in API-provided text (the API returns e.g. journal
	// names as "Leukemia &amp; Lymphoma"). Run this BEFORE escHtml at the
	// insertion point — escaping a raw API value directly would double-encode it
	// and render the literal "&amp;". Uses a detached <textarea>, which is safe:
	// it is never inserted into the document and the result is always re-escaped.
	var _decodeEl;
	function decodeEntities(str) {
		if (str == null || str === '') return '';
		if (!_decodeEl) _decodeEl = document.createElement('textarea');
		_decodeEl.innerHTML = String(str);
		return _decodeEl.value;
	}

	// Strip HTML tags, decode the handful of entities our API returns, collapse whitespace.
	function stripHtml(str) {
		if (!str) return '';
		return String(str)
			.replace(/<[^>]*>/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&nbsp;/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	// Truncate to `limit` chars on a word boundary, appending an ellipsis.
	// Operates on the string as given — strip first if the input may contain HTML.
	function truncate(str, limit) {
		var s = String(str == null ? '' : str);
		if (s.length <= limit) return s;
		var cut = s.lastIndexOf(' ', limit);
		return s.slice(0, cut > 0 ? cut : limit) + '…';
	}

	// Trailing-edge debounce that preserves `this` and arguments.
	function debounce(fn, ms) {
		var t;
		return function () {
			var ctx = this, args = arguments;
			clearTimeout(t);
			t = setTimeout(function () { fn.apply(ctx, args); }, ms);
		};
	}

	// Format an ISO date as a short en-GB date (e.g. "5 Mar 2025").
	function formatDate(iso, opts) {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString('en-GB', opts || { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function slugify(str) {
		return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
	}

	// Return a safe http(s) URL or '#' for anything else (javascript:, data:, malformed).
	function safeLink(url) {
		if (!url) return '#';
		try {
			var parsed = new URL(String(url));
			if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '#';
			return parsed.href;
		} catch (e) { return '#'; }
	}

	// Fire a Umami custom event for an executed search, carrying the actual
	// query words/expressions the visitor typed. No-ops when the query is
	// empty (nothing to report) or Umami isn't loaded, and skips re-firing
	// when the query is unchanged from the last call for this event name —
	// feeds re-run their search function on every unrelated filter change
	// (phase, status, sort…), and only a new/changed keyword is worth an event.
	var _lastTrackedQuery = {};
	function trackSearch(eventName, query, context) {
		query = (query == null) ? '' : String(query).trim();
		if (!query || _lastTrackedQuery[eventName] === query) return;
		_lastTrackedQuery[eventName] = query;
		if (typeof window.umami === 'undefined' || typeof window.umami.track !== 'function') return;
		var payload = { query: query };
		if (context) payload.context = context;
		window.umami.track(eventName, payload);
	}

	// makeCache(prefix, ttlMs) → { get(key), set(key, data) }
	// Namespaced, TTL-expiring localStorage wrapper. Keys are stored as
	// prefix + key; entries carry a timestamp and expire after ttl. Tolerant of
	// quota errors / private mode (set is a no-op, get returns null).
	function makeCache(prefix, ttl) {
		// Only null/undefined gets the default prefix; '' means "no prefix"
		// (call sites that pass fully-qualified keys rely on this).
		prefix = (prefix == null) ? 'br:' : prefix;
		ttl = ttl || (60 * 60 * 1000);
		return {
			get: function (key) {
				try {
					var raw = localStorage.getItem(prefix + key);
					if (!raw) return null;
					var entry = JSON.parse(raw);
					if (Date.now() - entry.ts > ttl) {
						localStorage.removeItem(prefix + key);
						return null;
					}
					return entry.data;
				} catch (e) { return null; }
			},
			set: function (key, data) {
				try {
					localStorage.setItem(prefix + key, JSON.stringify({ ts: Date.now(), data: data }));
				} catch (e) { /* quota exceeded / private mode — ignore */ }
			}
		};
	}

	window.BR = Object.assign(window.BR || {}, {
		escHtml: escHtml,
		decodeEntities: decodeEntities,
		stripHtml: stripHtml,
		truncate: truncate,
		debounce: debounce,
		formatDate: formatDate,
		slugify: slugify,
		safeLink: safeLink,
		makeCache: makeCache,
		trackSearch: trackSearch
	});
})(window);
