// Sends readers who click an RSS feed's title to the page the feed comes from.
//
// GregoryAi links every feed's channel to the homepage with the feed's scope in
// the query string ("Channel link" in its docs/03-api-and-rss-feeds.md):
//
//   /?kind=articles&category_id=111&category_slug=fractalkine&subject_id=1
//     &utm_medium=rss&utm_source=articles_search_feed
//
// feedLinkTarget() turns that into the matching page, here
//
//   /conditions/multiple-sclerosis/research-papers/?category=111&relevant=false
//     &utm_medium=rss&utm_source=articles_search_feed
//
// using /feed-routes.json (built by Hugo from each page's api.subject_id and
// api.endpoint) to find the page for a subject and kind.

// Feed parameter → the page's own parameter, per kind. A feed filter the page has
// no equivalent for is dropped: the reader lands on a page that shows a little
// more than the feed, never on the homepage.
const PAGE_PARAMS = {
	articles: {
		category_id: 'category',
		search: 'q',
		relevant: 'relevant',
		open_access: 'open_access',
	},
	trials: {
		category_id: 'category',
		search: 'q',
		recruitment_status_normalized: 'status',
		phase_normalized: 'phase',
		country: 'country',
	},
	patents: {
		category_id: 'category',
		search: 'q',
		has_grant: 'granted',
		has_trial_link: 'trials',
	},
	medicines: {
		category_id: 'category',
		regulator: 'regulator',
	},
};

// What a page assumes when its parameter is missing, where that differs from
// what the feed shows. Condition pages list only relevant papers and only
// recruiting trials by default; a feed without those filters lists everything.
const FEED_DEFAULTS = {
	articles: { relevant: 'false' },
	trials: { status: '' },
};

// A subject with no page of its own goes to the site-wide search page, which
// takes the subject under this name.
const SEARCH_SUBJECT_PARAM = {
	articles: 'subjects',
	trials: 'conditions',
};

// → "/path/?query" for the page the feed comes from, or null when the link is
// not a feed link or no page shows that feed (the homepage is served as before).
export function feedLinkTarget(params, routes) {
	const kind = params.get('kind');
	const names = Object.hasOwn(PAGE_PARAMS, kind) ? PAGE_PARAMS[kind] : null;
	if (!names || !routes) return null;

	const query = new URLSearchParams();
	const subjectId = params.get('subject_id') || '';
	let path = routes.subjects?.[subjectId]?.[kind];
	if (!path) {
		path = routes.search?.[kind];
		if (!path) return null;
		if (subjectId) query.set(SEARCH_SUBJECT_PARAM[kind], subjectId);
	}

	for (const [feedName, pageName] of Object.entries(names)) {
		const value = params.get(feedName);
		if (value) query.set(pageName, value);
	}
	for (const [pageName, value] of Object.entries(FEED_DEFAULTS[kind] || {})) {
		if (!query.has(pageName)) query.set(pageName, value);
	}
	for (const [key, value] of params) {
		if (key.startsWith('utm_')) query.append(key, value);
	}

	const search = query.toString();
	return search ? `${path}?${search}` : path;
}

// The route map, or null when it can't be read (the homepage is served instead).
export async function loadFeedRoutes(env, origin) {
	try {
		const response = await env.ASSETS.fetch(new URL('/feed-routes.json', origin));
		if (!response.ok) return null;
		return await response.json();
	} catch {
		return null;
	}
}
