# CLAUDE.md

Guidance for working in this repository.

## What this is

A [Hugo](https://gohugo.io/) **extended** static site — the **Brain Regeneration Observatory**, an expansion of [GregoryMS](https://gregory-ms.com). It tracks research into brain regeneration and myelin repair (multiple sclerosis, Alzheimer's, Parkinson's, and other neuro-degenerative diseases), surfacing articles and clinical trials.

- **Production domain:** `brain-regeneration.com` (`baseURL` in `hugo.toml`)
- **Git remote:** `Human-Singularity/brain-regeneration`
- **Hugo:** extended required (themes/styling). `.env` pins `HUGO_VERSION=0.154` for the build host.

## We work on the frontend; the backend is GregoryAI

This repo is the **frontend** Hugo site. The **backend is GregoryAI**, a *separate project* (not in this repo) that exposes the data API. The site fetches articles/trials **client-side** from that API at runtime — Hugo does not bake the research data into the build.

- `params.apiBase` in `hugo.toml` is `https://api.brain-regeneration.com`, overridable for local work via the `HUGO_PARAMS_APIBASE` env var (see `make hugo-dev-local`).
- **Gotcha:** the JS does **not** read `params.apiBase` directly. Templates must pass the endpoint to each mount element via `data-*` attributes (`data-api-base`, `data-endpoint`, `data-team-id`, `data-subject-id`). When an attribute is missing, the scripts **fall back to a hard-coded `https://api.brain-regeneration.com`** (and read an optional `window.__API_BASE__` global). So if data isn't loading or is coming from the wrong host, check the data attributes the template emits — not just `apiBase`.

So: missing/wrong/duplicated articles, author info, relevance scores, or API response shape → that's a **GregoryAI** concern, not this repo. Layout, rendering, styling, and how the data is displayed → this repo (mostly the theme, below).

## Where the frontend actually lives: the theme

Most of the real frontend — templates, partials, shortcodes, CSS, and JS — is in the **theme** directory:

```
themes/brain-regeneration/
```

> **Default assumption:** "change the homepage", "fix the article card", "edit a color/layout", "tweak the data feed" → you're working in **`themes/brain-regeneration/`**, not the repo root.

Notes on the theme's git state:
- It is **not** a Hugo Module and **not** a git submodule (`.gitmodules` is empty).
- It is **committed directly into this repo** (the theme files are tracked here, not pulled from a separate repo or submodule). So theme edits are committed and shipped through this repo's normal flow, alongside content/config changes.

The repo root `layouts/` is used only for **project-level overrides** of the theme. Currently the only override is `layouts/articles/article-shell.html`. Add files here when a change must be site-specific; otherwise edit the theme.

## Running locally

```bash
make hugo-dev        # hugo server -F -O -N -D  (drafts/future/expired, fast render)
make hugo-dev-local  # same, but HUGO_PARAMS_APIBASE=http://localhost:8000 (local backend)
make hugo-build      # hugo --minify  → ./public
make help            # list all Make targets
```

### Optional local backend (usually not needed)

`docker-compose.yml` + `django/` + `postgres-data/` can run a **local** GregoryAI (Postgres + the `amaralbruno/gregory-ai` Django image) for testing against unreleased API changes. By default the site uses the live API, so you rarely need this.

```bash
make start-gregory / stop-gregory / logs-gregory / status-gregory / clean-gregory
make dev             # start local backend + hugo server together
```

Requires a `.env` (gitignored) with `POSTGRES_*`, `EMAIL_*`, `SECRET_KEY`, `FERNET_SECRET_KEY`.

Build artifacts (`public/`, `resources/_gen/`, `hugo_stats.json`, `.hugo_build.lock`), `node_modules/`, `.env`, and `brain-regeneration-benchmark/` are gitignored.

## Layout of this repo

```
hugo.toml             Single root config (see below)
content/              Page content by section:
  observatory/  research-areas/  conditions/  news/
  supporters/   curators/        articles/
  + standalone pages (about.html, donate.html, contact.html, subscribe.md,
    transparency.html, privacy-policy.md, relevancy-scores.md, thank-you.md, …)
layouts/              Project-level theme overrides (only article-shell.html so far)
archetypes/           New-content templates per section
data/                 social.json
static/               Verbatim assets, incl. _redirects (Cloudflare Pages rules)
themes/brain-regeneration/   The active theme — most frontend lives here
django/, postgres-data/, docker-compose.yml   Optional local GregoryAI backend
workers/              Cloudflare worker (see content/cloudflare-worker.md)
.github/skills/hugo/  In-repo Hugo reference (setup, patterns, errors) worth consulting
```

### Inside the theme (`themes/brain-regeneration/`)

```
layouts/
  _default/   baseof, single, list, sectioned-page, prose-page,
              subscribe, thankyou, communication-tools, error
  partials/   head, nav, footer, research-papers-feed
  shortcodes/ figure
  conditions/ list, single, research-papers
  research-areas/ list, single
  search/ research-papers, single   (advanced search: papers landing + clinical-trials view)
  news/ list, single      supporters/ list, single      curators/ list, single
  observatory/ list       index.html      404.html
static/
  css/  main.css, feeds-mobile.css   (global; article-single.css + news-single.css load per-page via extra-head)
  js/   br-utils.js             (shared helpers on window.BR: escHtml/stripHtml/truncate/debounce/formatDate/slugify/safeLink + makeCache; loaded first, synchronously, in head)
        research-feed.js        (conditions + research-area + advanced-search papers feed: category filter, server-side sort, ML/expert badges, CSV, URL state, mobile sheet)
        trials-feed.js          (conditions clinical-trials feed + stats bar)
        article-single.js       (renders /articles/{id}/ detail from the API)
        research-spotlight.js   (homepage/area "spotlight" of top relevant papers)
        news-single.js          (news article UX: reading progress, TOC, lightbox — no API)
        subscribe-form.js       (full subscribe page form → POST to data-api)
        inline-subscribe.js     (contextual subscribe widgets [data-inline-subscribe])
        donor-transparency.js   (donate page → Stripe transparency Cloudflare Worker)
```

Each script is self-invoking and **no-ops unless its mount element exists** (e.g. `#paper-list`, `#papers-list`, `#trials-list`, `#article-shell`, `#spotlight-papers`), so they're safe to load site-wide. Config comes from `data-*` attributes on those mounts.

## Configuration (`hugo.toml`)

Single root file. Highlights:

- `baseURL`, `title`, `theme = "brain-regeneration"`, `timeZone = "Europe/Lisbon"`, `enableGitInfo`.
- `[params] apiBase` — the API base URL (overridable via `HUGO_PARAMS_APIBASE`); plus `author`, `defaultAuthor`, `og_image`, and site copy.
- `[outputs]` — `home`/`section`/`term` are `HTML` + `RSS`; a custom `Search` output format is defined (`baseName = "index"`, JSON, `path = "search"`).
- `[taxonomies]` — `tags`, `categories`, `authors`.
- `[permalinks]` — `post → /research/:slug/`, `news → /news/:title/`.
- `[markup.goldmark]` — `unsafe = true` (raw HTML in Markdown allowed), `linkify = false`.
- `[params.subscriptions]` — newsletter wiring; global list **"Project News"** is `list_id = 10`, `team_id = 1`.

## Key frontend patterns

- **Client-side data, not built content.** Articles/trials/charts are fetched from the GregoryAI API in the browser. The flow: a Hugo template renders a mount element with `data-*` attributes (endpoint, `team_id`, `subject_id`, etc.) → the matching script reads them → `fetch()` → renders HTML into the mount. Responses are paginated (`results`, `count`, `current_page`, `total_pages`) and queried with params like `team_id`, `subject_id`, `relevant`, `category_id`, `subjects`, `has_clinical_trials`, `ordering`, `page`, `format=json|csv`, `all_results=true`.
- **Article detail is a client-rendered shell.** `static/_redirects` rewrites `/articles/* → /articles/ 200`; `article-single.js` parses the numeric ID from the URL and fetches `/articles/{id}/?format=json`. (`layouts/articles/article-shell.html` is the project override of that shell.) Internal article links use `/articles/{id}/`; external links go straight to the publisher/DOI.
- **Aggressive localStorage caching.** All feeds/widgets cache through `BR.makeCache(prefix, ttl)` (in `br-utils.js`) under keys like `brPapers:`, `brTrialsFeed:`, `brTrialsStats:`, `brTrialStats:`, `brSpotlight:`, `brObsStats*` with TTLs (1–12h). If you're testing fresh API data and not seeing changes, clear localStorage.
- **ML relevance + curator badges** are rendered client-side from `ml_predictions` (threshold 0.8) and `article_subject_relevances`; the explainer lives at `/relevancy-scores/`.
- **Subscribe forms** (`subscribe-form.js`, `inline-subscribe.js`) POST `FormData` to the endpoint in `data-api` with `redirect: 'manual'`, treat an opaque redirect as success, and redirect to the `data-thank-you` / `data-error` URLs (configured via `[params.subscriptions]`). The chosen profile is remembered in `localStorage` under `br_subscriber_profile`.
- **Donations** use a separate Cloudflare Worker (`donor-transparency.js` → `https://stripe-transparency.human-singularity.workers.dev/`), not the GregoryAI API. See `workers/` and `content/cloudflare-worker.md`.
- **Styling** is plain CSS in `themes/.../static/css/` (`main.css` + `feeds-mobile.css` site-wide, plus per-page `article-single.css` / `news-single.css`) — not SCSS/Hugo Pipes. Edit there.

## Conventions

- Frontend changes (templates/CSS/JS) → `themes/brain-regeneration/`. Content/config → repo root. Override the theme via root `layouts/` only when the change must be site-specific.
- Keep API/team/list identifiers consistent (`apiBase`, subscription `list_id`/`team_id`) with what GregoryAI expects.
- Don't commit build output, `node_modules`, or `.env`.
- When unsure about Hugo specifics, check `.github/skills/hugo/references/`.
