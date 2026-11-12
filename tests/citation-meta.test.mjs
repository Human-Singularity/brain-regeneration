// node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import citation from '../themes/brain-regeneration/static/js/citation-meta.js';
import { escapeAttr } from '../functions/_shared/meta.js';

const PAGE = 'https://brain-regeneration.com/articles/332847/';

const paper = {
	article_id: 332847,
	title: 'Glial progenitor-like state is preferentially co-opted in <i>glioblastoma</i>.',
	summary: '<jats:title>Abstract</jats:title><jats:p>Oncofetal reprogramming &amp; more.</jats:p>',
	published_date: '2026-11-11T00:00:00Z',
	publisher: 'Elsevier BV',
	container_title: 'Neuron',
	authors: [
		{ given_name: 'Susana I', family_name: 'Ramos', full_name: 'Susana I Ramos' },
		{ given_name: null, family_name: null, full_name: 'Consortium Name' },
	],
	doi: '10.1016/j.neuron.2026.10.012',
	pmid: '43014311',
	pmcid: null,
	publication_types: ['Journal Article'],
	keywords: ['ATAC-seq', 'atac-seq', 'POU3F3'],
	access: 'unknown',
};

const tagMap = (tags) => tags.reduce((m, [k, v]) => ((m[k] = m[k] || []).push(v), m), {});

test('a journal article gets Highwire tags that point back to our page', () => {
	const t = tagMap(citation.highwireTags(paper, PAGE));
	assert.deepEqual(t.citation_title, ['Glial progenitor-like state is preferentially co-opted in glioblastoma.']);
	assert.deepEqual(t.citation_author, ['Ramos, Susana I', 'Consortium Name']);
	assert.deepEqual(t.citation_publication_date, ['2026/11/11']);
	assert.deepEqual(t.citation_journal_title, ['Neuron']);
	assert.deepEqual(t.citation_publisher, ['Elsevier BV']);
	assert.deepEqual(t.citation_doi, ['10.1016/j.neuron.2026.10.012']);
	assert.deepEqual(t.citation_pmid, ['43014311']);
	assert.deepEqual(t.citation_abstract, ['Oncofetal reprogramming & more.']);
	assert.deepEqual(t.citation_keywords, ['ATAC-seq; POU3F3']);
	assert.deepEqual(t.citation_public_url, [PAGE]);
	assert.equal(t.citation_pdf_url, undefined);
	assert.equal(t['DC.type'], undefined);
});

test('open-access papers in PubMed Central get a PDF link', () => {
	const t = tagMap(citation.highwireTags({ ...paper, access: 'open', pmcid: 'PMC123' }, PAGE));
	assert.deepEqual(t.citation_pdf_url, ['https://pmc.ncbi.nlm.nih.gov/articles/PMC123/pdf/']);
	// Not open access, or not in PMC → no PDF.
	assert.equal(citation.pdfUrl({ access: 'restricted', pmcid: 'PMC123' }), '');
	assert.equal(citation.pdfUrl({ access: 'open', pmcid: null }), '');
});

test('preprints carry DC.type and the server name, and no journal title', () => {
	const pre = {
		...paper,
		container_title: 'bioRxiv : the preprint server for biology',
		publisher: 'openRxiv',
		doi: '10.64898/2026.11.09.765314',
		publication_types: ['Preprint'],
	};
	assert.equal(citation.recordKind(pre), 'preprint');
	const t = tagMap(citation.highwireTags(pre, PAGE));
	assert.equal(t.citation_journal_title, undefined);
	assert.deepEqual(t.citation_publisher, ['bioRxiv']);
	assert.deepEqual(t['DC.type'], ['preprint']);
	// Recognised by DOI or link alone, too.
	assert.equal(citation.recordKind({ doi: '10.1101/2024.01.02.573917' }), 'preprint');
	assert.equal(citation.recordKind({ doi: '10.1101/gad.123.4' }), 'journal');
	assert.equal(citation.recordKind({ link: 'https://www.medrxiv.org/content/x' }), 'preprint');
	assert.equal(citation.repositoryName({ link: 'https://www.medrxiv.org/content/x' }), 'medRxiv');
});

test('conference papers end with the conference tag, which sets the item type', () => {
	const conf = { ...paper, container_title: 'BMC Proceedings', publication_types: ['Congress'] };
	const tags = citation.highwireTags(conf, PAGE).map(([k]) => k);
	assert.ok(!tags.includes('citation_journal_title'));
	assert.ok(tags.indexOf('citation_inbook_title') < tags.indexOf('citation_conference_title'));
	// Proceedings of the National Academy of Sciences is a journal.
	assert.equal(citation.recordKind({ container_title: 'Proceedings of the National Academy of Sciences' }), 'journal');
});

test('a single author whose names both contain spaces is not split in two by Zotero', () => {
	const one = { ...paper, authors: [{ given_name: 'Anna Maria', family_name: 'van der Berg' }] };
	assert.deepEqual(tagMap(citation.highwireTags(one, PAGE)).citation_author, ['van der Berg, Anna Maria;']);
});

test('dates are calendar days in Lisbon', () => {
	assert.equal(citation.isoDate('2021-05-10T23:00:00Z'), '2021-05-11'); // summer, UTC+1
	assert.equal(citation.isoDate('2026-01-10T23:00:00Z'), '2026-01-10'); // winter, UTC
	assert.equal(citation.isoDate('2025-04-30'), '2025-04-30');
	assert.equal(citation.isoDate('not a date'), '');
	assert.equal(citation.isoDate(null), '');
});

test('PubMed RSS abstracts lose the citation line, ABSTRACT heading and PMID footer', () => {
	const html = '<div><p>Neuroimaging Clin N Am. 2027 Feb;37(1):51-67. doi: 10.1016/j.nic.2026.07.003. Epub 2026 Sep 30.</p>' +
		'<p><b>ABSTRACT</b></p><p>Molecular neuroimaging has shifted.</p><p>It informs diagnosis.</p>' +
		'<p>Copyright © 2026 Elsevier Inc.</p>' +
		'<p>PMID:<a href="https://pubmed.ncbi.nlm.nih.gov/43014985/">43014985</a> | DOI:<a href="https://doi.org/x">x</a></p></div>';
	assert.equal(citation.cleanAbstract(html), 'Molecular neuroimaging has shifted. It informs diagnosis.');
});

test('JATS abstracts keep section titles as labels', () => {
	const html = '<jats:title>Abstract</jats:title><jats:sec><jats:title>Background</jats:title><jats:p>One.</jats:p></jats:sec>' +
		'<jats:sec><jats:title>Methods:</jats:title><jats:p>Two <jats:italic>in vivo</jats:italic>.</jats:p></jats:sec>';
	assert.equal(citation.cleanAbstract(html), 'Background: One. Methods: Two in vivo.');
});

test('placeholders and junk prefixes and suffixes are removed', () => {
	assert.equal(citation.cleanAbstract('NO ABSTRACT'), '');
	assert.equal(citation.cleanAbstract(''), '');
	assert.equal(citation.cleanAbstract('International audience ; Text here.'), 'Text here.');
	assert.equal(citation.cleanAbstract('Text here. Graphical Abstract'), 'Text here.');
	assert.equal(citation.cleanAbstract('&lt;i&gt;Encoded&lt;/i&gt; tags'), 'Encoded tags');
});

const parse = (kev) => kev.split('&').map((p) => {
	const [k, v] = p.split('=');
	return [k, decodeURIComponent(v)];
});

test('a journal article COinS links to our page and carries the abstract', () => {
	const pairs = parse(citation.articleCoins(paper, PAGE));
	const get = (k) => pairs.filter(([key]) => key === k).map(([, v]) => v);
	assert.deepEqual(get('rft_val_fmt'), ['info:ofi/fmt:kev:mtx:journal']);
	assert.deepEqual(get('rft.atitle'), ['Glial progenitor-like state is preferentially co-opted in glioblastoma.']);
	assert.deepEqual(get('rft.jtitle'), ['Neuron']);
	assert.deepEqual(get('rft.au'), ['Ramos, Susana I', 'Consortium Name']);
	assert.deepEqual(get('rft.date'), ['2026-11-11']);
	assert.deepEqual(get('rft_id'), ['info:doi/10.1016/j.neuron.2026.10.012', 'info:pmid/43014311', PAGE]);
	assert.deepEqual(get('rft.description'), ['Oncofetal reprogramming & more.']);
});

test('preprint and conference COinS use the formats Zotero maps to those types', () => {
	const pre = parse(citation.articleCoins({ ...paper, publication_types: ['Preprint'] }, PAGE));
	assert.ok(pre.some(([k, v]) => k === 'rft_val_fmt' && v === 'info:ofi/fmt:kev:mtx:dc'));
	assert.ok(pre.some(([k, v]) => k === 'rft.type' && v === 'preprint'));
	const conf = parse(citation.articleCoins({ ...paper, publication_types: ['Congress'] }, PAGE));
	assert.ok(conf.some(([k, v]) => k === 'rft.genre' && v === 'proceeding'));
	assert.ok(conf.some(([k, v]) => k === 'rft.btitle' && v === 'Neuron'));
});

test('a patent COinS uses the patent format and the Espacenet link', () => {
	const patent = {
		title: 'SOLUBLE INTERLEUKIN-7 RECEPTOR (SIL7R) DIAGNOSTIC METHODS',
		representative_publication: 'WO2026232009A1',
		link: 'https://worldwide.espacenet.com/publicationDetails/biblio?CC=WO&NR=2026232009A1',
		earliest_publication_date: '2026-11-05',
		applicants: [{ raw_name: 'ACME, INC.' }, { raw_name: 'Uni' }],
	};
	const pairs = parse(citation.patentCoins(patent, { title: 'Soluble interleukin-7 receptor', assignees: ['Acme, Inc.', 'Uni'] }));
	assert.deepEqual(pairs, [
		['ctx_ver', 'Z39.88-2004'],
		['rft_val_fmt', 'info:ofi/fmt:kev:mtx:patent'],
		['rft.title', 'Soluble interleukin-7 receptor'],
		['rft.assignee', 'Acme, Inc.; Uni'],
		['rft.number', 'WO2026232009A1'],
		['rft.date', '2026-11-05'],
		['rft_id', patent.link],
	]);
	assert.ok(parse(citation.patentCoins({ ...patent, link: 'javascript:alert(1)' })).every(([k]) => k !== 'rft_id'));
});

test('meta content is attribute-escaped', () => {
	assert.equal(escapeAttr('a "b" <c> & d'), 'a &quot;b&quot; &lt;c&gt; &amp; d');
});
