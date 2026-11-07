// node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedLinkTarget, loadFeedRoutes } from '../functions/_shared/feed-link.js';

const ROUTES = {
	search: { articles: '/search/', trials: '/search/clinical-trials/' },
	subjects: {
		1: {
			articles: '/conditions/multiple-sclerosis/research-papers/',
			trials: '/conditions/multiple-sclerosis/clinical-trials/',
			patents: '/conditions/multiple-sclerosis/patents/',
			medicines: '/conditions/multiple-sclerosis/medicines/',
		},
		12: { articles: '/research-areas/neuroinflammation/' },
	},
};

const target = (query) => feedLinkTarget(new URLSearchParams(query), ROUTES);

test('a category search feed lands on its condition page with the category selected', () => {
	assert.equal(
		target('kind=articles&category_id=111&category_slug=fractalkine&subject_id=1&utm_medium=rss&utm_source=articles_search_feed'),
		'/conditions/multiple-sclerosis/research-papers/?category=111&relevant=false&utm_medium=rss&utm_source=articles_search_feed',
	);
});

test('a relevant-only feed keeps the filter and the search becomes the page keyword', () => {
	assert.equal(
		target('kind=articles&subject_id=12&relevant=true&search=microglia'),
		'/research-areas/neuroinflammation/?q=microglia&relevant=true',
	);
});

test('a subject with no page goes to the site-wide search, scoped to it', () => {
	assert.equal(target('kind=articles&subject_id=99&category_id=5'), '/search/?subjects=99&category=5&relevant=false');
	assert.equal(target('kind=trials&subject_id=99'), '/search/clinical-trials/?conditions=99&status=');
});

test('a feed scoped to no subject goes to the site-wide search', () => {
	assert.equal(target('kind=articles&category_id=7&utm_medium=rss'), '/search/?category=7&relevant=false&utm_medium=rss');
});

test('trial feeds carry their status, and show every status when they have none', () => {
	assert.equal(
		target('kind=trials&subject_id=1&recruitment_status_normalized=recruiting,not_yet_recruiting'),
		'/conditions/multiple-sclerosis/clinical-trials/?status=recruiting%2Cnot_yet_recruiting',
	);
	assert.equal(target('kind=trials&subject_id=1'), '/conditions/multiple-sclerosis/clinical-trials/?status=');
});

test('patent and medicine feeds map their own filters', () => {
	assert.equal(
		target('kind=patents&subject_id=1&has_grant=true&has_trial_link=true&applicant_sponsor_slug=acme'),
		'/conditions/multiple-sclerosis/patents/?granted=true&trials=true',
	);
	assert.equal(
		target('kind=medicines&subject_id=1&category_id=3&regulator=fda'),
		'/conditions/multiple-sclerosis/medicines/?category=3&regulator=fda',
	);
});

test('a link no page shows is left alone', () => {
	assert.equal(target('kind=patents&subject_id=12'), null);
	assert.equal(target('kind=medicines&category_id=3'), null);
	assert.equal(target('kind=constructor&subject_id=1'), null);
	assert.equal(target('kind=toString'), null);
	assert.equal(target('subject_id=1'), null);
	assert.equal(feedLinkTarget(new URLSearchParams('kind=articles&subject_id=1'), null), null);
});

test('the route map fails open', async () => {
	const env = (fetch) => ({ ASSETS: { fetch } });
	assert.equal(await loadFeedRoutes(env(async () => new Response('', { status: 404 })), 'https://x.test'), null);
	assert.equal(await loadFeedRoutes(env(async () => { throw new Error('down'); }), 'https://x.test'), null);
	assert.equal(await loadFeedRoutes(env(async () => new Response('not json')), 'https://x.test'), null);
	assert.deepEqual(await loadFeedRoutes(env(async () => Response.json(ROUTES)), 'https://x.test'), ROUTES);
});
