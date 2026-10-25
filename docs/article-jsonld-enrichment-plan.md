# Enrich article ScholarlyArticle JSON-LD — implementation plan

Plan for [Human-Singularity/brain-regeneration#56](https://github.com/Human-Singularity/brain-regeneration/issues/56).
The JSON-LD that `functions/articles/[id].js` adds to `/articles/{id}/` is thin. The issue asks for
`description`/`abstract`, `keywords` (subjects), `dateModified`, `author` where the API has it, and
possibly a `BreadcrumbList`. If editorial data is used, the Function must send `&site_id=3`.

Scope: `functions/` (server-side head injection), plus one small Hugo change to support breadcrumbs.
No change is needed in GregoryAi to ship most of this. `dateModified` is the exception (§4).

---

## 1. What we emit today

`buildJsonLd()` in `functions/articles/[id].js` outputs `headline`, `url`, `mainEntityOfPage`,
`datePublished`, `author[]` (name only), `publisher` (the journal's publisher), `isPartOf`
(Periodical), `sameAs` (publisher link), `identifier` (DOI URL) and `isAccessibleForFree`.

Missing: no `description`, `abstract`, `keywords` or `dateModified`. Authors have no ORCID and no
link to our own `/authors/{orcid}/` pages. PMID/PMCID are ignored. There is no breadcrumb.

The static shell does not emit JSON-LD of its own on `/articles/` (`partials/head.html` skips the
`articles` section on purpose). `article-single.js` → `updateStructuredData()` only adds its own
ScholarlyArticle when the server one is missing (the fail-open case), so no duplicate is produced.

## 2. What the API gives us (checked against the live API, 2026-10-25)

`GET /articles/{id}/?format=json` (what the Function calls now):

| Field | Shape | Use |
|---|---|---|
| `summary` | Raw abstract, may contain HTML and `\r\n`; can be very long (1703 is a 42-abstract proceedings) | `abstract` (capped), `description` fallback |
| `subjects[]` | `{id, subject_name, …}` | `keywords`, breadcrumb |
| `keywords[]` | Plain strings (e.g. 9 on 329685, 0 on 1703) | `keywords` |
| `mesh[]` | `{descriptor, qualifier, major_topic}` | `keywords` (major topics only) |
| `authors[]` | `{given_name, family_name, full_name, ORCID}`; `ORCID` often null | `author[]` |
| `pmid`, `pmcid`, `doi` | Strings or null | `identifier[]`, `sameAs[]` |
| `publication_types[]` | e.g. `"Journal Article"` | not used (see §7) |
| `discovery_date` | When GregoryAi **indexed** the article | not `dateModified` (§4) |

`&include=editorial` adds `editorial[]`: `{site: {id, domain, name}, takeaways, summary_plain_english}`.
`summary_plain_english` is HTML and can be large (35 KB on 1703).

**The `site_id` warning holds.** A request without an `Origin` header (which is what a Function
sends) returns editorial rows for **every** site. With `&site_id=3` only ours comes back:

```
include=editorial              → [site 3]   (only site 3 has rows today, by luck)
include=editorial&site_id=3    → [site 3]
include=editorial&site_id=1    → []
```

Site 3 is already in `hugo.toml` as `apiSitemapSiteId = 3`.

Editorial rows have **no timestamp** (`updated_at` or similar). The article has no modified date
either.

## 3. Target output

Example for 329685 (abridged):

```json
{
  "@context": "https://schema.org",
  "@type": "ScholarlyArticle",
  "headline": "Combination of Hydroxychloroquine and Indapamide Attenuates …",
  "url": "https://brain-regeneration.com/articles/329685/",
  "mainEntityOfPage": "https://brain-regeneration.com/articles/329685/",
  "description": "<plain-English summary or abstract, ~300 chars>",
  "abstract": "<plain-text abstract, capped at ~5000 chars>",
  "keywords": ["Multiple Sclerosis", "hydroxychloroquine", "microglia", "Oxidative Stress", …],
  "datePublished": "2021-…",
  "author": [
    { "@type": "Person", "name": "Dennis Brown", "givenName": "Dennis", "familyName": "Brown" },
    { "@type": "Person", "name": "…", "url": "https://brain-regeneration.com/authors/0000-…/",
      "sameAs": "https://orcid.org/0000-…" }
  ],
  "publisher": { "@type": "Organization", "name": "…" },
  "isPartOf": { "@type": "Periodical", "name": "…" },
  "identifier": [
    { "@type": "PropertyValue", "propertyID": "DOI",   "value": "10.…" },
    { "@type": "PropertyValue", "propertyID": "PMID",  "value": "33410109" },
    { "@type": "PropertyValue", "propertyID": "PMCID", "value": "PMC8116375" }
  ],
  "sameAs": ["<publisher link>", "https://doi.org/10.…", "https://pubmed.ncbi.nlm.nih.gov/33410109/"],
  "isAccessibleForFree": true
}
```

Plus a second `BreadcrumbList` object (§5) in the same `AppendJsonLd([...])` call.

## 4. Decisions needed

| # | Question | Recommendation |
|---|---|---|
| D1 | `dateModified`: the API has no modified date. `discovery_date` is when we indexed the article, not when it changed. | **Omit for now.** Ask GregoryAi to expose `editorial[].updated_at` (the history behind `get_history` suggests it's tracked already). When it exists: `dateModified` = latest `updated_at` for site 3. Using `discovery_date` would tell Google the page changed on the indexing date. |
| D2 | `BreadcrumbList` without a visible breadcrumb on the page. Google expects the markup to match a trail the user can see. | **Ship both together:** a visible breadcrumb rendered by `article-single.js` (Home › {subject page} › article), and the matching JSON-LD from the Function. For multi-subject articles, use one trail from a fixed ranking (conditions before research areas), §5 Step 4. If you don't want a visible breadcrumb, drop the BreadcrumbList. |
| D3 | `<meta name="description">` / OG: the Function uses the raw `summary`, but `article-single.js` replaces it with the editorial plain-English summary once JS runs. Crawlers that don't run JS see the raw abstract. | **Align in the same PR.** Once editorial data is fetched, use it for the meta tags as well, so server and client agree. A small extra change. |
| D4 | Which `keywords` to emit. | Subject names + API `keywords` + major-topic MeSH descriptors. Dedupe case-insensitively, cap at ~25. Without a cap, an article like 327524 would emit ~80 terms (53 keywords + 31 MeSH). |

## 5. Implementation steps

### Step 1 — Shared helpers (`functions/_shared/meta.js`)

- Add `SITE_ID = 3`, with a comment saying it must match `apiSitemapSiteId` in `hugo.toml`.
- Add `ownEditorial(data)`: returns the `editorial[]` row where `site.id === SITE_ID`, or `null`.
  Filter on the client side even though `site_id=3` is sent, so a change in the API can't leak
  another site's text.
- Add `normalizeOrcid(value)`: accepts a bare id or an `https://orcid.org/…` URL and returns the
  bare id, or `null` if it doesn't match `ORCID_RE`. Move `ORCID_RE` here from
  `authors/[orcid].js` and import it in both places.
- Add `capText(text, maxLen)`, or reuse `truncate()`, for the abstract cap.

### Step 2 — One API call, with editorial (`functions/articles/[id].js`)

- Change the URL to `${API_BASE}/articles/${id}/?format=json&include=editorial&site_id=${SITE_ID}`.
  This is still a single request (no added latency). The cache key changes, so the first request
  after deploy is uncached. That's fine.
- The fail-open rules stay the same: if `editorial` is missing or empty, the article fields alone
  are used.

### Step 3 — Enrich `buildJsonLd()`

Every value goes through `cleanText()` or `buildDescription()`. `toSafeJsonLd()` already escapes `<`.

- **`description`**: `buildDescription(editorial.summary_plain_english || editorial.takeaways || data.summary, 300)`.
  Skip it if empty.
- **`abstract`**: `cleanText(data.summary)` capped at ~5000 chars on a word boundary. Skip it if
  empty. Don't use the editorial text here: it's our own writing, not the paper's abstract.
- **`keywords`**: per D4. Emit an array (schema.org accepts Text or a list; an array avoids
  escaping commas inside terms).
- **`author[]`**: keep the name-only filter, then add `givenName`/`familyName` when present. When
  `normalizeOrcid(a.ORCID)` returns an id, also add `sameAs: https://orcid.org/{id}` and
  `url: ${SITE_ORIGIN}/authors/{id}/`. The `/authors/{orcid}/` Function already serves those pages.
- **`identifier`**: switch from a single DOI URL string to an array of `PropertyValue`
  (DOI/PMID/PMCID, only those present). Use the array even when only a DOI exists, so the shape
  never varies. Schema validators accept it.
- **`sameAs`**: change to an array containing the publisher `link`, `https://doi.org/{doi}`,
  `https://pubmed.ncbi.nlm.nih.gov/{pmid}/` and `https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/`,
  deduped. Emit a plain string when only one is present, so the output stays tidy.
- **`dateModified`**: per D1. Leave a `// TODO` that points at the GregoryAi follow-up.

### Step 4 — BreadcrumbList (only if D2 = yes)

The Function needs to know which page on our site a subject maps to. That map already exists at
build time (`partials/subject-links.html`), but only inline in the shell as `window.__SUBJECT_LINKS__`.

- **Publish it as a static file.** In `layouts/articles/article-shell.html`, add
  `{{ $_ := (resources.FromString "subject-links.json" (partial "subject-links" . | jsonify)).RelPermalink }}`.
  Calling `.RelPermalink` writes `/subject-links.json` to `public/`. No `hugo.toml` output-format
  change is needed.
- In the Function, fetch it with `env.ASSETS.fetch(new URL('/subject-links.json', request.url))`
  **in parallel** with the API call (`Promise.all`). If it's missing, drop the breadcrumb but keep
  the rest.
- **An article can belong to several subjects.** About 1 in 4 do (7 of 30 sampled, 2026-10-25),
  e.g. MS + Neuroinflammation, or Alzheimer's + Neuroinflammation. The API lists them in no order
  we control, and the relevance signals are too sparse to rank them: `article_subject_relevances`
  is usually empty and `ml_predictions` covers only some subjects. "First in `subjects[]`" would
  therefore be arbitrary, and could change between API responses.

  Only 6 subjects have a page on the site: the 3 conditions (MS 1, Alzheimer's 13, Parkinson's 14)
  and the 3 research areas (Cell Reprogramming 10, Neuroimmunometabolism 11, Neuroinflammation 12).
  Oligodendroglia & Myelin Repair and AI+MS have no page, so they never produce a trail. A real
  choice is only needed when an article has two or more of the six.

- **Rule: one trail, from a fixed ranking set at build time.** `partials/subject-links.html` gains
  a `rank` per entry:
  - conditions first, then research areas;
  - within each group, page `Weight`, then title.
  
  The Function and `article-single.js` both pick, among the article's subjects that have a link,
  the one with the **lowest `rank`**. MS + Neuroinflammation → MS. Alzheimer's + Neuroinflammation
  → Alzheimer's. Because the rule lives in the shared map, the markup and the visible trail can't
  disagree, and changing the order means editing page weights.
- Emit:
  `Home (SITE_ORIGIN/) › {entry.name} (SITE_ORIGIN + entry.url) › {title} (canonicalUrl)`.
  If no subject maps to a page, emit no breadcrumb rather than a 2-item one.
- **Alternative considered: multiple trails.** Google accepts several `BreadcrumbList` objects on
  one page, so each linked subject could get its own trail. Rejected: the page can only show one
  visible breadcrumb sensibly, and the other subjects are already linked as chips in the subject
  section. `keywords` still lists **all** subjects, so nothing is lost there.
- Visible trail: in `article-single.js`, render the same three items, using the existing
  `breadcrumb-nav-dark` markup from `conditions/single.html`. Add a `BR.primarySubject(subjects)`
  helper to `br-utils.js` (lowest `rank` among linked subjects) next to `subjectUrl`. The Function
  applies the same rule to `subject-links.json`.

### Step 5 — Meta tags (only if D3 = yes)

Switch `description` in `onRequest` to the same editorial-first source the client uses
(`editorialSummary()` → `summary`). Keep the meta length at 155. The client's `articleDescription()`
truncates at 180, so pick one value and use it in both places.

### Step 6 — Client fallback parity (small, optional)

`article-single.js` → `updateStructuredData()` only runs when the Function failed open. It
currently sets `publisher` to *our site* and `identifier` to a bare DOI, and uses `discovery_date`
as `dateModified`. Bring it in line with the server output: journal publisher, no `dateModified`,
the same `identifier` shape. That way a fail-open page doesn't send crawlers contradictory data.

## 6. Testing

There's no test harness for `functions/`. To verify:

1. `make dev-proxy` + `make pages-dev` (wrangler with Functions; login dev/dev).
2. `curl -s -u dev:dev http://localhost:8788/articles/{id}/ | grep -o '<script type="application/ld+json">.*</script>'`
   for a set of fixtures:
   - **329685**: authors, keywords, MeSH, PMID, PMCID, editorial takeaways.
   - **1703**: no authors, no keywords, huge summary and editorial (checks the caps).
   - **An author with an ORCID**: checks `url`/`sameAs` on the Person.
   - **330014** (MS + Neuroinflammation): breadcrumb goes through MS.
   - **330037** (Neuroinflammation + Alzheimer's): breadcrumb goes through Alzheimer's.
   - **330027** (MS + Oligodendroglia, which has no page): breadcrumb goes through MS.
   - In all three, the visible trail matches the JSON-LD one.
   - **An unknown id (e.g. 999999999)**: shell is returned unmodified.
   - **A non-numeric id**: shell is returned unmodified.
3. Parse each block with `python3 -m json.tool` and check:
   - no `<` survives unescaped;
   - `keywords` stays at or under the cap.
4. On the preview deploy, run 2–3 URLs through the
   [Rich Results Test](https://search.google.com/test/rich-results) and the
   [Schema Markup Validator](https://validator.schema.org/).
5. With JS on, confirm the page still shows one ScholarlyArticle (the client must still back off).
   Confirm the visible breadcrumb matches the JSON-LD one.

## 7. Out of scope / follow-ups

- **GregoryAi**: expose `editorial[].updated_at` (or an article-level `last_modified`) to unblock
  `dateModified`. This is a backend change in the separate GregoryAi project.
- **Same treatment for `/trials/{id}/`** (`MedicalTrial`) and `/authors/{orcid}/` (`Person`). Both
  are equally thin, but they aren't part of #56.
- **`publication_types` → a more specific `@type`** (e.g. `"Review"` → still ScholarlyArticle, no
  good schema.org mapping). Not worth it.

## 8. As built (2026-10-25)

These are the places where the implementation differs from the steps above, based on what testing showed:

- **Breadcrumb parent is the subject's research-papers page.** For a condition, `url` in the subject
  map is its clinical-trials tab, so the trail uses `papers || url`. For research areas the two are
  the same page.
- **Light breadcrumb style**, not the dark strip. The article page sits on the sand background, so it
  uses `.breadcrumb-nav` (as on curator pages) on one line with an ellipsis. An older dark,
  unlinked breadcrumb ("Observatory › subject › Article #id") was removed in 55c78d4. Its orphaned
  CSS is replaced.
- **Keywords fold spelling variants.** "Alzheimer's Disease", "Alzheimer’s disease" and the MeSH term
  "Alzheimer Disease" count once.
- **`sameAs` dedupes by page.** The source link is often a PubMed URL with tracking parameters, so
  it's dropped when the clean PubMed URL is already listed.
- **Description lead text.** A plain-English summary that opens with headings is described by its
  first real paragraph. The same rule runs in the Function and in `article-single.js`, and both
  cut at 160 chars on a word boundary, so the server and runtime meta descriptions match.
- **`article:modified_time` removed** from the client too, for the same reason as D1.

## Files touched

- `functions/_shared/meta.js`: `SITE_ID`, `ownEditorial`, `normalizeOrcid`, `ORCID_RE`
- `functions/articles/[id].js`: API URL, `buildJsonLd`, breadcrumb, meta description
- `functions/authors/[orcid].js`: import `ORCID_RE` from the shared file
- `themes/brain-regeneration/layouts/articles/article-shell.html`: publish `subject-links.json` (D2)
- `themes/brain-regeneration/layouts/partials/subject-links.html`: add `rank` per entry (D2)
- `themes/brain-regeneration/static/js/br-utils.js`: `BR.primarySubject()` (D2)
- `themes/brain-regeneration/static/js/article-single.js`: visible breadcrumb (D2), fallback parity (Step 6)
