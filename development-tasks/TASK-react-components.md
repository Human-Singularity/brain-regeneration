# React Components — Dynamic Content Plan

This document maps every location in the Hugo templates that requires dynamic data from the GregoryAI API, and specifies what each React component should do.

---

## API Reference

- **Base URL:** `https://api.gregory-ms.com`
- **Authentication:** None required for read operations
- **Format:** JSON (default), CSV (`?format=csv&all_results=true`)
- **Pagination:** All list endpoints return `{ count, next, previous, current_page, total_pages, page_size, results[] }`

### Key endpoints used

| Purpose | Endpoint | Key params |
|---------|----------|------------|
| Stats | `GET /stats/` | *(none)* — returns global counts |
| Articles | `GET /articles/` | `team_id`, `subject_id`, `search`, `ordering`, `relevant`, `page`, `page_size` |
| Trials | `GET /trials/` | `team_id`, `subject_id`, `status`, `phase`, `search`, `ordering`, `page`, `page_size` |
| Trials search | `GET /trials/search/` | `team_id` *(req)*, `subject_id` *(req)*, `search`, `status`, `format`, `all_results` |
| Articles search | `GET /articles/search/` | `team_id` *(req)*, `subject_id` *(req)*, `search`, `format`, `all_results` |

### Stats endpoint

`GET /stats/` returns global platform numbers in a single call:

```json
{
  "articles": 45217,
  "trials": 18689,
  "subscribers": 1,
  "authors": 232202,
  "sources": {
    "total": 19,
    "by_type": { "science paper": 15, "trials": 4 },
    "by_domain": [ { "domain": "pubmed.ncbi.nlm.nih.gov", "count": 8 }, ... ]
  }
}
```

### Getting counts without fetching all data

For per-condition counts (not covered by `/stats/`), the `count` field in paginated responses gives the total matching records. Request `page_size=1` and read `count`. Example:

```
GET /trials/?team_id=1&subject_id=1&status=Recruiting&page_size=1
→ { "count": 945, ... }
```

---

## Component inventory

### Component 1: `HomepageTrialBadges`

**Layout file:** `themes/brain-regeneration/layouts/index.html` (line 73)

**Mount point:** No single mount div — targets multiple `<span>` elements:
```html
<span class="badge-recruiting" data-trial-slug="multiple-sclerosis" style="display:none;"></span>
<span class="badge-recruiting" data-trial-slug="alzheimers" style="display:none;"></span>
```

**What it does:**
1. Find all `span.badge-recruiting[data-trial-slug]` on the page
2. For each, determine the `team_id` and `subject_id` (these need to be mapped from the slug — see "Slug-to-API mapping" below)
3. Fetch `GET /trials/?team_id={X}&subject_id={Y}&status=Recruiting&page_size=1`
4. Read `count` from response
5. Set the span text to `{count} recruiting` and remove `display:none`

**Slug-to-API mapping:**
The Hugo content files define `api.team_id` and `api.subject_id` in front matter. These are not available in the homepage template where the badges render. Options:
- **Option A:** Add `data-team-id` and `data-subject-id` attributes to the badge spans in the homepage template (recommended — keeps it consistent with other mount points)
- **Option B:** Hardcode a slug→IDs lookup in the JS

**Loading state:** Badge stays hidden until data arrives (no spinner needed).

---

### Component 2: `HomepageStats`

**Layout file:** `themes/brain-regeneration/layouts/index.html` (lines 150–168)

**Mount point:** The trust signals section with these elements:
```html
<div class="stat-number">34,000+</div>  <!-- Articles indexed -->
<div class="stat-number">174,000+</div> <!-- Authors tracked -->
<div class="stat-number">48</div>       <!-- Therapies monitored -->
```

**What it does:**
1. Fetch `GET /stats/` — single call returns all needed values
2. Map response fields to display:
   - `stats.articles` → "Articles indexed"
   - `stats.authors` → "Authors tracked"
   - `stats.sources.total` → "Sources monitored" (or keep as "Therapies monitored" — see note)
3. Replace the hardcoded numbers with live values, formatted with thousands separator and `+` suffix

**Data attributes needed:** Add `id` or `data-stat` attributes to target the specific `.stat-number` divs:
```html
<div class="stat-number" data-stat="articles">34,000+</div>
<div class="stat-number" data-stat="authors">174,000+</div>
<div class="stat-number" data-stat="therapies">48</div>
```

**Loading state:** Keep hardcoded values as fallback. Replace silently when API responds. If API fails, the hardcoded values remain visible (graceful degradation).

**Note:** The "< 24h" stat is not API-driven — keep it hardcoded. The stats endpoint returns `sources.total` (19) rather than a "therapies" count. The label and mapping may need adjusting — the current hardcoded "48 Therapies monitored" may refer to categories rather than sources. Clarify with product before mapping.

---

### Component 3: `ResearchFeed`

**Layout file:** `themes/brain-regeneration/layouts/research-areas/single.html` (lines 134–190)

**Mount point:**
```html
<div id="paper-list"
  data-endpoint="https://api.gregory-ms.com/articles/"
  data-team-id="1"
  data-keywords="cell reprogramming,epigenetic editing,...">
</div>
```

**What it does:**
1. Read `data-endpoint`, `data-team-id` from mount div
2. On load, fetch `GET /articles/?team_id={X}&ordering=-published_date&page_size=20`
3. Render a card for each article with:
   - **Title** (linked to `article.link`)
   - **Authors** (comma-separated `full_name` values)
   - **Journal** (`container_title`)
   - **Date** (formatted `published_date`)
   - **Relevance badge** (from `ml_predictions` array — show highest probability score if available)
   - **Open access indicator** (from `access` field, highlight when `"open"`)
4. Wire up the filter controls above the mount point:
   - **Sort select** (`#sort-select`): toggle `ordering` between `-published_date` and `-ml_prediction` (or relevance equivalent)
   - **Date from/to** (`#date-from`, `#date-to`): add date range filtering
   - **Keyword search** (`#keyword-search`): add `search=` param
5. Re-fetch on any filter change
6. Update pagination controls (`#pagination`)

**CSV download:**
The "Download" button (`.btn-download`) should link to:
```
GET /articles/search/?team_id={X}&subject_id={Y}&format=csv&all_results=true
```
Note: The search endpoint requires both `team_id` and `subject_id`. A `data-subject-id` attribute should be added to the mount div.

**Pagination:**
- Use `page` param
- Show current page / total pages
- Enable/disable prev/next based on `previous`/`next` fields in response

**Loading state:** Show a spinner inside `#paper-list` while fetching. Show "No papers found" if results are empty.

---

### Component 4: `ConditionStats`

**Layout file:** `themes/brain-regeneration/layouts/clinical-trials/list.html` (lines 36–44)

**Mount point:** Multiple `.condition-card` divs, each with:
```html
<div class="condition-card"
  data-endpoint="https://api.gregory-ms.com/trials/"
  data-team-id="1"
  data-subject-id="1">
  ...
  <div class="trial-stat-num recruiting">—</div>
  <div class="trial-stat-num total">—</div>
</div>
```

**What it does:**
1. Find all `.condition-card[data-subject-id]` elements
2. For each card, make two parallel requests:
   - `GET /trials/?team_id={X}&subject_id={Y}&status=Recruiting&page_size=1` → `count` = recruiting
   - `GET /trials/?team_id={X}&subject_id={Y}&page_size=1` → `count` = total
3. Update the `.trial-stat-num.recruiting` and `.trial-stat-num.total` elements within each card

**Loading state:** Show `—` placeholders (already in HTML) until data arrives. Replace with numbers.

---

### Component 5: `TrialStats`

**Layout file:** `themes/brain-regeneration/layouts/clinical-trials/single.html` (lines 23–52)

**Mount point:**
```html
<div class="stats-bar" id="trials-stats"
  data-endpoint="https://api.gregory-ms.com/trials/"
  data-team-id="1"
  data-subject-id="1">
  ...
  <div class="stat-number" id="stat-recruiting">—</div>
  <div class="stat-number" id="stat-active">—</div>
  <div class="stat-number" id="stat-completed">—</div>
  <div class="stat-number" id="stat-total">—</div>
  <div class="stat-number" id="stat-updated">—</div>
</div>
```

**What it does:**
1. Read `data-endpoint`, `data-team-id`, `data-subject-id` from `#trials-stats`
2. Fetch counts in parallel:
   - `GET /trials/?team_id={X}&subject_id={Y}&status=Recruiting&page_size=1` → recruiting count
   - `GET /trials/?team_id={X}&subject_id={Y}&status=Active, not recruiting&page_size=1` → active count
   - `GET /trials/?team_id={X}&subject_id={Y}&status=Completed&page_size=1` → completed count
   - `GET /trials/?team_id={X}&subject_id={Y}&page_size=1` → total count
3. For "Last updated": use the `discovery_date` of the most recent trial from the total query (`results[0].discovery_date`)
4. Update each `#stat-*` element

**Loading state:** `—` placeholders remain until replaced.

---

### Component 6: `TrialListing`

**Layout file:** `themes/brain-regeneration/layouts/clinical-trials/single.html` (lines 55–116)

**Mount point:**
```html
<div id="trials-list"
  data-endpoint="https://api.gregory-ms.com/trials/"
  data-team-id="1"
  data-subject-id="1"
  data-default-status="Recruiting"
  data-default-phase="">
</div>
```

**What it does:**
1. Read data attributes from `#trials-list`
2. On load, fetch `GET /trials/?team_id={X}&subject_id={Y}&status={default_status}&ordering=-discovery_date&page_size=20`
3. Render a card for each trial with:
   - **Title** (`title`, linked to `link`)
   - **NCT number** (from `identifiers.nct` if present, otherwise `internal_number`)
   - **Description** (`summary`, truncated to ~200 chars with "read more")
   - **Phase badge** (`phase`)
   - **Status badge** (`recruitment_status`, colour-coded: green=recruiting, blue=active, grey=completed)
   - **Sponsor** (`primary_sponsor`)
   - **Countries** (`countries`)
   - **Conditions** (`condition`)
   - **Interventions** (`intervention`)
4. Wire up the filter bar (`#trials-filters`):
   - **Search** (`#search-input`): `search=` param
   - **Phase** (`#filter-phase`): `phase=` param
   - **Status** (`#filter-status`): `status=` param (map select values to API values: "recruiting"→"Recruiting", "active"→"Active, not recruiting", "completed"→"Completed")
   - **Reset** (`#reset-filters`): clear all filters, restore defaults
5. Update `#results-count` with `{count} trials found` text
6. Handle pagination (`#pagination`):
   - Show/hide based on `total_pages > 1`
   - Render page number buttons in `#pagination-pages`
   - Wire prev/next buttons
7. Also update `TrialStats` (Component 5) when filters change, OR keep stats always showing unfiltered totals (decide based on UX preference)

**Loading state:** Spinner inside `#trials-list`. "No trials match your current filters" in `#no-results` when empty.

---

## Template changes required before development

These are small Hugo template edits needed to ensure components have the right data attributes:

### 1. Homepage trial badges — add API identifiers

In `layouts/index.html`, change the badge span (line 73) from:
```html
<span class="badge-recruiting" data-trial-slug="{{ .Slug }}" style="display:none;"></span>
```
to:
```html
<span class="badge-recruiting"
  data-trial-slug="{{ .Slug }}"
  data-team-id="{{ with .Params.api }}{{ .team_id }}{{ end }}"
  data-subject-id="{{ with .Params.api }}{{ .subject_id }}{{ end }}"
  style="display:none;"></span>
```

### 2. Homepage stats — add data attributes

In `layouts/index.html`, add `data-stat` attributes to the stat number divs (lines 150–168):
```html
<div class="stat-number" data-stat="articles">34,000+</div>
<div class="stat-number" data-stat="authors">174,000+</div>
<div class="stat-number" data-stat="therapies">48</div>
```

### 3. Research feed — add subject_id

In `layouts/research-areas/single.html`, the `#paper-list` div (line 172) needs a `data-subject-id` for CSV export. This requires adding `subject_id` to the research area front matter, or deriving it from the API.

---

## Bundling strategy

### Recommended approach

1. Use a single JavaScript entry point (e.g., `assets/js/app.jsx` or `static/js/app.js`)
2. Bundle React + components with Vite or esbuild
3. Output a single `static/js/brain-regen.js` file
4. Load it at the bottom of `baseof.html` with `defer`
5. Each component checks for its mount point on `DOMContentLoaded` — if the element exists, initialize; if not, skip

This avoids multiple script tags and keeps things simple. Hugo doesn't need to know about React — the JS bundle is just a static asset.

### File structure suggestion

```
assets/
  js/
    app.jsx                    # Entry point — mounts all components
    components/
      HomepageTrialBadges.jsx
      HomepageStats.jsx
      ResearchFeed.jsx
      ConditionStats.jsx
      TrialStats.jsx
      TrialListing.jsx
    lib/
      api.js                   # Shared fetch wrapper, base URL, error handling
      formatters.js            # Number formatting, date formatting
```

### Build command

```bash
# Example with Vite
npx vite build --config vite.config.js
# Output: static/js/brain-regen.js
```

---

## API response shapes (reference)

### Article object
```json
{
  "article_id": 313535,
  "title": "...",
  "summary": "...",
  "link": "https://...",
  "published_date": "2026-03-14T00:00:00Z",
  "discovery_date": "2026-03-14T06:29:37Z",
  "doi": "10.1007/...",
  "access": "restricted",
  "publisher": "...",
  "container_title": "Journal Name",
  "takeaways": null,
  "sources": ["Springer"],
  "teams": [{ "id": 1, "name": "Team Gregory", "slug": "team-gregory" }],
  "subjects": [{ "id": 1, "subject_name": "Multiple Sclerosis" }],
  "authors": [{ "author_id": 380148, "full_name": "Jacob T. Treanor", "ORCID": null }],
  "ml_predictions": [],
  "team_categories": [],
  "clinical_trials": []
}
```

### Trial object
```json
{
  "trial_id": 12345,
  "title": "...",
  "summary": "...",
  "link": "https://...",
  "published_date": "...",
  "discovery_date": "...",
  "identifiers": { "nct": "NCT12345678", "org_study_id": "..." },
  "recruitment_status": "Recruiting",
  "phase": "Phase III",
  "study_type": "Interventional",
  "primary_sponsor": "...",
  "countries": "United States",
  "condition": "Multiple Sclerosis",
  "intervention": "...",
  "inclusion_criteria": "...",
  "exclusion_criteria": "...",
  "target_size": 200,
  "team_categories": [{ "category_name": "...", "category_slug": "..." }]
}
```

### Paginated response wrapper
```json
{
  "count": 40951,
  "next": "https://api.gregory-ms.com/articles/?page=2&page_size=20",
  "previous": null,
  "current_page": 1,
  "total_pages": 2048,
  "page_size": 20,
  "results": []
}
```

---

## Priority order

1. **TrialListing + TrialStats** (Component 5 + 6) — the clinical trials single page is the most interactive and visible
2. **ResearchFeed** (Component 3) — the research area page is the core content experience
3. **ConditionStats** (Component 4) — completes the clinical trials index page
4. **HomepageTrialBadges** (Component 1) — small enhancement to homepage
5. **HomepageStats** (Component 2) — replaces hardcoded numbers, lowest urgency
