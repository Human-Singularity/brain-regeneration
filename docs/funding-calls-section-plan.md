# Funding Calls section — implementation plan

Handover doc. Implements the `Funding Calls Section.dc.html` design from the Claude Design
project [`c2020405`](https://claude.ai/design/p/c2020405-e146-484e-a26d-4638853b3827), backed by
the ABN/REDONE.br public RSS feed of research funding calls (`editais`).

Source spec: `guia-feed-rss-editais.pdf` (Observatório de Doenças Neurológicas — ABN / REDONE.br,
July 2026). Partnership agreed at the 03/07/2026 meeting; the Observatory built the feed
specifically so Brain Regeneration could consume it.

**Decisions already made — do not re-litigate:**

| Decision | Choice |
|---|---|
| Data path | Cloudflare Pages Function proxy → same-origin JSON → lazy client render |
| Design variant | **1b — compact list** (not the 1a card grid) |
| Placement | **Homepage section only** — no dedicated page |
| Widget content | **The latest entries** (8 rows), newest first |
| Scope | **All of neurology**, not the site's three conditions |
| CTA | **Links out to the ABN / REDONE.br Observatory** — credit, not a local listing |
| Top nav | **No entry** |

---

## 1. The blocking finding: the feed cannot be fetched from the browser in production

The design's `componentDidMount` does a direct `fetch("https://observatorio.abneuro.org.br/editais/rss?q=neuro")`.
**That will not work in production**, and it fails in a way that is easy to miss.

Verified 2026-08-22:

```
Origin: https://brain-regeneration.com   → no access-control-allow-origin header
Origin: http://localhost:1313            → access-control-allow-origin: http://localhost:1313
OPTIONS preflight                        → 204, still no ACAO
```

The origin server sends `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` but
**no `Access-Control-Allow-Origin`** for our production domain. Its allowlist covers `localhost`
only (a leftover dev CORS config).

The trap: `make hugo-dev` serves on `http://localhost:1313`, which **is** whitelisted. A direct
browser fetch therefore works perfectly in local dev and dies silently in production — the
design's `.catch()` swallows the error and falls back to baked sample data, so the section would
render plausible-looking *stale hardcoded content* on the live site forever. Do not rely on local
testing to validate the data path.

This is also the inverse of the usual situation on this project (normally the live GregoryAi API
blocks `localhost`), so muscle memory will mislead here.

**Resolution:** proxy through a Cloudflare Pages Function. Workers-side `fetch` is not subject to
CORS, the response becomes same-origin, and it lets us fix several feed-quality problems in one
place (§4). A parallel ask to ABN's IT (Adalberto García, ATI) to allowlist our origin is worth
sending, but the proxy should ship regardless — it is better on payload size, keyword coverage,
and caching, so it is not merely a CORS workaround.

---

## 2. Architecture

```
browser                     Cloudflare Pages                    observatorio.abneuro.org.br
───────                     ────────────────                    ──────────────────────────
funding-calls.js
  │ IntersectionObserver
  │ + requestIdleCallback
  ▼
GET /api/funding-calls  →   functions/api/funding-calls.js  →   GET /editais/rss?limit=400
  (same-origin, ~2KB JSON)    · ONE request, no q= param          (one call, conditional
  ← latest 8, normalised      · filters to neurology locally       ETag / If-None-Match)
                              · normalises dates, place, links
                              · edge-cached 1–3h
```

Three properties this buys us:

1. **Same-origin** — no CORS dependency on a third party (§1).
2. **One upstream request** — see §3. Filtering locally is both simpler *and* more accurate than
   the feed's own `q=` search, which has no word-boundary handling.
3. **Normalisation happens once, at the edge** — the client script stays small and dumb, and the
   date/encoding bugs in §4 get fixed in one file rather than in every consumer.

---

## 3. Scope and filtering — one request, filtered locally

The widget shows **the latest neurology funding calls**, newest first. Scope is neurology and
neuroscience as a field, not this site's three conditions — which is what the source feed is
curated for and what the design's intro copy already promises (*"Grants, fellowships and awards in
neuroscience and neurodegeneration"*). No copy change needed.

**Fetch the feed once, unfiltered, and filter in the proxy.** Do not use the `q=` parameter.

```
GET https://observatorio.abneuro.org.br/editais/rss?limit=400&lang=en
```

### 3.1 Why local filtering beats the feed's own search

`q=` is a **plain substring match** with no OR syntax and no word-boundary handling. Covering
neurology through it takes ten separate requests (`neuro`, `brain`, `sclerosis`, `esclerose`,
`parkinson`, `alzheimer`, `demen`, `epilep`, `spinal`, `huntington`) and still matches badly.

Measured on the 2026-08-22 corpus, a single unfiltered fetch plus the local filter in §3.2
reproduces that ten-request fan-out **exactly**:

| | ten `q=` requests | one fetch + local filter |
|---|---:|---:|
| upstream requests | 10 | **1** |
| items in the current batch | 21 | **21** |
| distinct funders | 10 | **10** |
| items missed vs the other | — | **0** |
| false positives | 4 (§3.3) | **0** |

Same result, a tenth of the requests, and better precision.

**Truncation is not a risk here.** `limit` caps at 400 and the feed is sorted newest-first, so the
cap only ever drops the *oldest* items — irrelevant to a "latest entries" widget. Today's
collection batch is 315 items across all topics, comfortably inside the cap, and all 21 neurology
items for the day are present.

> A note for anyone revisiting this: an earlier draft of this plan argued the opposite, because it
> assumed a full listing page showing all 45 neurology calls. Reaching the older evergreen grants
> (back to Sep 2024) *does* require `q=`, since the unfiltered feed only reaches 2026-05-05. That
> requirement is gone — the widget shows only the newest few and links out to the Observatory for
> the full list. If a comprehensive local listing ever comes back, revisit this decision.

### 3.2 The neurology filter

Match against **title + categories + the free-text part of the description**, case-insensitively,
with word boundaries:

```js
const NEURO = /\b(
  neuro\w* | brain | cerebr\w* | encephal\w* | encefal\w*
| myelin\w* | mielin\w* | demyelin\w*
| alzheimer\w* | parkinson\w* | huntington\w* | dementia\w* | dem[êe]ncia\w*
| epilep\w* | epilepsia
| sclerosis | esclerose\w* | amyotroph\w* | amiotr[óo]fic\w* | ELA | ALS
| stroke | avc | spinal\s+cord | medula\s+espinh\w* | traumatic\s+brain | concussion
| migraine\w* | enxaqueca | cefaleia | headache
| ataxia\w* | dystonia | distonia | neuropath\w* | neuropat\w*
| glioma | glioblastoma | meningi\w*
)\b/ix;   // written expanded for readability — build it without the x flag
```

**Strip the FAPESP institutional boilerplate before matching.** FAPESP descriptions open with a
fixed `Instituição: … Cidade: … Inscrições até: …` prefix, and matching against the institution
name is a systematic false-positive source — any grant hosted at an *Instituto de Neurociências*
would match `neuro` regardless of its actual topic.

```js
const STRIP = /Institui[çc][ãa]o:.*?(?=Inscri|Source:|$)|Cidade:\s*[^\n]*?(?=Inscri|Source:|$)/gis;
```

This is not hypothetical — it is exactly what produced the false positives in §3.3.

### 3.3 Two false-positive traps, both fixed by the above

| Trap | Example | Cause | Fix |
|---|---|---|---|
| Substring collision | *Fundamental Research to Counter Weapons of Mass Destruction* matched `mental` | `q=` has no word boundaries — also hits `environmental`, `developmental` | word-boundary regex (§3.2) |
| Institution name | *Bolsa de TT-V em Internet das Coisas* matched `cogniti` | hosted at *Centro de Matemática, Computação e **Cognição*** — a department name, not the topic | strip the boilerplate (§3.2) |

Publishing *"Weapons of Mass Destruction"* or an IoT scholarship under "Funding calls &
opportunities" on a brain-regeneration site is exactly the failure mode to avoid. Both are verified
absent with the filter as specified. `cogniti`/`cognição` is deliberately **not** in the
vocabulary — it contributed no unique neurology items and only ever fired on department names.

### 3.4 Ordering

Sort by `pubDate` descending, then take the newest 8.

**`pubDate` is the collection date, not the funder's publication date.** 21 of the current 45
neurology items share a single `pubDate` — the day the crawler saw them. So "newest 8" is really
"8 of today's batch", and a naive slice takes whatever order the feed happened to return, which
skews toward whichever funder posted most that day (today: 6 Michael J. Fox items and 4 FAPESP
graduate stipends out of 21).

**Break ties by funder** — round-robin across distinct funders before taking a second item from any
one of them. Today that turns a slice dominated by two funders into eight different ones: Michael
J. Fox, FAPESP, IBRO, the Alzheimer's Association, the National MS Society, The ALS Association,
CHDI, the ILAE. That is a materially better widget for the same data, and it costs a few lines.

## 4. Feed data quirks that must be handled

These are real defects in the live feed, all verified against the 2026-08-22 payload. The design's
sample-data parser gets several of them wrong — **do not port its `parseFeed` as-is.**

### 4.1 Two different date formats, one of which the design parses backwards ⚠️

FAPESP items:

```
Instituição: … Cidade: Ribeirão Preto Inscrições até: 24/08/2026
```
→ colon after `até`, **DD/MM/YYYY**.

NIH / Grants.gov items:

```
Nº PAR-25-327 — National Institutes of Health. Inscrições até 10/08/2027 (MM/DD/AAAA).
```
→ **no colon**, **MM/DD/YYYY**, with an explicit `(MM/DD/AAAA)` marker.

The design's regex `/Inscri\S*\s*at[ée]:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i` requires the colon, so
it matches FAPESP only and silently drops the deadline for **all 7 NIH items**. Worse, its baked
sample shows `"deadline": "10 Aug 2027"` for the `10/08/2027 (MM/DD/AAAA)` NIH call — read as
DD/MM when the feed explicitly says MM/DD. The correct date is **8 October 2027**.

Parse rule, in the proxy:

1. Match `/Inscri\S*\s*at[ée]:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i` (colon optional).
2. If the description contains `(MM/DD/AAAA)` → interpret as month/day.
3. Otherwise → interpret as day/month.
4. Sanity check: if the first component is > 12 it must be the day regardless of the marker; if
   the resulting date is invalid, emit no deadline rather than a wrong one.
5. Emit ISO `YYYY-MM-DD` in the JSON. The client formats for display (`BR.formatDate`).

Roughly 11 of 18 `q=neuro` items carry a deadline; the rest legitimately have none, so the
"no deadline" path is the common case, not an edge case.

### 4.2 Markup leaking into `<link>` URLs

```xml
<link>https://fapesp.br/oportunidades/…-genoma-em-&lt;i&gt;leishmania&lt;-i&gt;/9567/</link>
```

After entity decoding the URL contains a literal `<i>` and a mangled `<-i>` (a broken `</i>`).
FAPESP italicises species names in opportunity titles and the slug generator does not strip the
tags. Several items are affected.

Strip tag-like fragments from the URL before use — `url.replace(/<\/?-?[a-z]+>/gi, '')` — then run
it through `BR.safeLink` on the client. I could not confirm the resulting status code (FAPESP
returns 403 to non-browser clients), so **verify a stripped link resolves in a real browser before
shipping**; if the stripped form still 404s, suppress the link and render the row as plain text
pointing at the Observatory listing instead.

### 4.3 Entity encoding

Titles contain raw `&nbsp;` and other entities (e.g. *"Addressing Dementia in Tribal and Urban
Indian Communities:&nbsp;CAReS Program"*). There is no CDATA anywhere in the feed (verified), so
plain entity decoding is sufficient.

**Reuse `decodeEntities` from `functions/_shared/meta.js`** — it already handles named, decimal,
hex and double-encoded entities, and is the established pattern in this repo.

### 4.4 Portuguese metadata leaking into an English UI

`<category>` for international items reads `IBRO · Internacional`. The design's place logic passes
`Internacional` straight through because its regex treats it as already-normalised. Map
`Internacional → International`, `Brasil → Brazil` in the proxy. Do **not** translate item titles —
per §3 of the spec these are the official call titles and must stay in their source language, and
the section's intro copy already tells readers this.

### 4.5 Cloudflare bot protection on the origin

The origin 403s unrecognised clients (a bare Python `urllib` request was refused; `curl` was not).
Set an explicit identifying `User-Agent` on the proxy's outbound fetch, e.g.:

```
User-Agent: brain-regeneration.com funding-calls proxy (+https://brain-regeneration.com/)
```

Being identifiable is also just good citizenship toward a partner's server.

---

## 5. Field mapping

Per item, the proxy emits:

| JSON field | Source | Notes |
|---|---|---|
| `id` | `<guid>` | Stable per spec §5; used for dedupe. Not a URL (`isPermaLink="false"`). |
| `title` | `<title>` | Entity-decoded. Original language — do not translate. |
| `link` | `<link>` | Entity-decoded, tag-stripped (§4.2). |
| `funder` | `<category>[0]` before `·` | e.g. `National Institutes of Health` |
| `place` | `<category>[0]` after `·`, else country from `Source:` line | Normalised (§4.4) |
| `type` | first later `<category>` under 40 chars | `Oportunidade`, `R21`, `Prêmio`, … often absent |
| `deadline` | `Inscrições até` in `<description>` | ISO `YYYY-MM-DD`, or omitted (§4.1) |
| `published` | `<pubDate>` | ISO; used for sorting |

Place derivation, matching the design's intent: if the category region and the `Source:` country
differ and the region is not itself a country-level term, join them — `São Paulo, Brazil`.
Otherwise use whichever is present — `USA`, `International`.

The compact-list variant does not render `<description>`, which sidesteps a real problem: many
items have no summary at all (their description is just the `Source: …` metadata line). Another
point in favour of 1b over 1a.

---

## 6. Files to create and change

### 6.1 `functions/api/funding-calls.js` — new

Follows the existing `functions/` conventions (tabs, `export async function onRequest`, fail-open).
No route conflict: `static/_redirects` claims `/articles/*` and `/authors/*` only, and Pages
Functions take precedence over `_redirects` anyway.

```js
export async function onRequest(context) { … }
```

Responsibilities:

- **One** upstream fetch: `?limit=400&lang=en`, no `q=` (§3).
- Set the identifying `User-Agent` (§4.5).
- Use `cf: { cacheTtl: 3600, cacheEverything: true }` on the outbound fetches so the edge handles
  upstream caching. The feed's `Cache-Control` is `max-age=0, must-revalidate, private`, which
  would otherwise defeat caching entirely — the PDF's claim about cache-friendly headers only
  really holds for `ETag`/`Last-Modified` conditional requests, which the edge will do for us
  (a `304` on a conditional request is confirmed working).
- Parse with regex, **not `HTMLRewriter`**. This matters: `HTMLRewriter` parses as HTML, where
  `<link>` is a void element — the item URLs would come back empty. The Workers runtime has no
  `DOMParser`. The feed is machine-generated with no CDATA, so `/<item>([\s\S]*?)<\/item>/g` plus
  per-tag extraction is reliable. Guard against a malformed upstream response by returning
  whatever items did parse.
- Filter to neurology per §3.2, normalise per §4 and §5, dedupe by `guid`, sort by `published`
  desc with the funder round-robin tie-break (§3.4).
- Respond `application/json` with
  `Cache-Control: public, max-age=1800, s-maxage=10800, stale-while-revalidate=86400`.
  The feed is collected once daily at 07:00 BRT (10:00 UTC), so a 3h edge TTL is comfortably
  fresh — the spec explicitly recommends polling every 3–24h and asks partners not to poll harder.
- Support `?limit=N` (clamped 1–24; the widget asks for 8). Return only what the widget needs —
  there is no listing page consuming the long tail.
- **Fail open**, like the other functions here: on upstream error return `200` with
  `{"items": [], "error": "upstream"}` rather than a 5xx, so the section degrades to its empty
  state instead of showing a broken page.

### 6.2 `themes/brain-regeneration/static/js/funding-calls.js` — new

Self-invoking, no-ops unless its mount exists — same shape as `research-spotlight.js`, which is the
closest existing analog and the right file to crib from.

```js
var mount = document.getElementById('funding-calls');
if (!mount) return;
```

Config from `data-*` attributes (`data-endpoint`, `data-limit`), per the repo's mount convention.

**Load-last behaviour** — this is the explicit requirement, so be deliberate about it:

- `<script defer>`, placed in the `page-scripts` block, never in `head`.
- Wrap the fetch in `IntersectionObserver` on the mount with `rootMargin: '200px'` — the request
  only fires when the section is about to enter the viewport. On the homepage the section sits
  well below the fold, so a visitor who never scrolls costs zero requests.
- Wrap the observer callback in `requestIdleCallback(…, { timeout: 3000 })` (with a
  `setTimeout` fallback for Safari) so it yields to anything else still settling.
- Cache in `localStorage` via `BR.makeCache('brFunding:', 3 * 60 * 60 * 1000)` — matches the 3h
  edge TTL and the once-daily update cadence. Render from cache synchronously when warm, which
  makes repeat visits free.
- Reserve height with a skeleton (see §6.3) so there is **no layout shift** when rows arrive.

Rendering: build the 1b row markup and set `innerHTML` once. Escape with `BR.escHtml`, allow the
safe inline tags via `BR.escHtmlAllowSafeTags` for titles, and pass every URL through
`BR.safeLink`. Format `deadline` with `BR.formatDate`.

States to handle explicitly — the design file covers none of them:

- **Loading** — skeleton rows, `aria-busy="true"`.
- **Empty** (`items: []`) — a short line plus the "View all funding calls" CTA, styled like the
  spotlight's empty state.
- **Error** — same treatment as empty; never leave a bare skeleton.

### 6.3 `assets/css/main.css` — add tokens and component styles

⚠️ **`CLAUDE.md` is stale on this point.** It says the CSS lives at
`themes/brain-regeneration/static/css/main.css`. It does not — it moved to **`assets/css/main.css`**
and is now processed through Hugo Pipes (`resources.Get | minify | fingerprint`), with an inlined
`assets/css/critical.css` for above-the-fold. Only `article-single.css`, `author-profile.css` and
`news-single.css` still live under the theme's `static/css/`. Edit `assets/css/main.css`.
Worth fixing that section of `CLAUDE.md` in passing.

**Missing design tokens.** The design system was derived from `main.css`, but the design uses eight
tokens that `:root` does not define. All eight are used by the 1b variant or its hover states, and
all currently resolve to nothing:

| Token | Value | Used for |
|---|---|---|
| `--color-accent-hover` | `#D17E2F` | deadline pill text |
| `--radius-pill` | `100px` | deadline pill, type chips |
| `--shadow-hover` | `0 4px 16px rgba(45,45,45,.1)` | panel/row hover |
| `--fs-h2` | `1.6rem` | section heading |
| `--ease` | `cubic-bezier(.2,.6,.2,1)` | transitions |
| `--dur-fast` | `150ms` | row hover |
| `--dur-base` | `200ms` | card hover |
| `--color-success-bg` / `-fg` | `#E6F4EC` / `#1A6B39` | not used by 1b — skip |

Add the first seven to `:root` in `assets/css/main.css`. They are consistent with what is already
there and fill genuine gaps rather than inventing anything.

One deliberate divergence: the design system sets `--color-muted: #8C8C8C`, but the live site uses
`#6B6B6B`. **The site wins** — do not change it. It is the darker, more accessible value, and
changing it would ripple across every page.

Also note the design's `#EDE8DE` page background and the `1a`/`1b` numbered chips are *canvas
scaffolding*, not part of the section. Drop them.

Then add the component styles. Convert the design's inline `style="…"` attributes into real
classes (`.funding-calls`, `.fc-row`, `.fc-deadline`, `.fc-cta`, `.fc-skeleton`) — the rest of this
codebase uses classes in `main.css`, and inline styles would not survive minification review or
respond to hover/focus. Keep the `--space-*` scale in mind but do not introduce it site-wide just
for this.

Responsive: the 1b row is a flex row that must stack below ~600px — title and meta on top, deadline
pill dropping beneath rather than squeezing the title. The design has no mobile breakpoint at all;
this needs to be authored. `assets/css/feeds-mobile.css` is only loaded for specific feed layouts,
so put these rules in `main.css`.

Accessibility, none of which the design file addresses:

- The whole row is an `<a>` — give it a `:focus-visible` outline, not just `:hover`.
- The deadline pill's `#FBEEDD` background with `--color-accent-hover` text needs a contrast check
  at 12px/600; darken the text if it fails 4.5:1.
- Add `aria-label` to the row link so screen readers get "«title» — «funder», apply by «date»"
  rather than a bare title.
- The `↗` arrow SVGs are decorative — `aria-hidden="true"`.
- External links already carry `target="_blank" rel="noopener"`; keep that.

### 6.4 The section markup — inline in the homepage template

There is only one placement now, so **do not create a partial**. Homepage sections in this repo are
written inline in `layouts/index.html`, and a single-use partial would break that convention for no
benefit. Extract one later if the section ever gets a second home.

The mount:

```html
<div id="funding-calls"
     data-endpoint="/api/funding-calls"
     data-limit="8"
     aria-busy="true"></div>
```

The endpoint is a **site-relative path**, not `params.apiBase` — this is the Pages Function, not
GregoryAi. Do not wire it to `apiBase` or to `window.__API_BASE__`.

#### Crediting REDONE.br

The whole point of the partnership is that the Observatory built this feed for us and asked to be
sent traffic back. The credit is the section's payoff, not its fine print — so give it real weight
rather than the design's 13px muted footer line.

Name them in full, in their own language, and link out:

> **Curated by the Observatório de Doenças Neurológicas**
> Academia Brasileira de Neurologia / REDONE.br — collected daily from CNPq, FAPESP and the state
> FAPs, FINEP, CAPES, NIH, Grants.gov, the European Union, AAN, Instituto Serrapilheira and
> international foundations.
>
> **[Explore the full funding observatory →](https://observatorio.abneuro.org.br/editais)**

Set the credit at body size with the organisation names in `--color-primary`, not in `--color-muted`
at 13px. Keep the design's *"updated daily, newest first"* note — it is useful and true — but
demote it below the credit rather than sharing a line with it.

**Link targets** — verified 2026-08-22:

| URL | Status |
|---|---|
| `https://observatorio.abneuro.org.br/editais` | ✅ the funding calls listing — use this |
| `https://abneuro.org.br/` | ✅ resolves — the parent academy, use for the ABN name if you link it |
| `https://redone.br` | ❌ **NXDOMAIN** — does not exist, do not link it |

⚠️ **The `/editais` link 302-redirects to `/termo`**, a Termo de Uso consent page, for visitors
without the acceptance cookie. So a first-time click lands on terms rather than the calls. Link it
anyway — it is the right destination and the interstitial is one-time — but this is raised with ABN
as §8 item 7. If they will not change it, consider a short "(you may be asked to accept their terms
of use first)" note next to the link rather than silently surprising people.

Worth suggesting separately to Bruno, not part of this task: adding the Observatory to
`content/supporters/` as a partner. That is the more durable form of the recognition he asked for.

### 6.5 `themes/brain-regeneration/layouts/index.html` — the section

Insert near the **"Clinical trials by condition"** section. The homepage alternates `bg-sand` /
`bg-tint`; clinical trials is `bg-tint` and the subscribe section after it is `bg-sand`, so
dropping straight in between them would collide. Cleanest fix: place it **after** the subscribe
section as `bg-tint`, before "Project News" — check the rendered rhythm and pick whichever keeps
the alternation intact.

Add the script in the `page-scripts` block:

```html
<script src="{{ "js/funding-calls.js" | relURL }}" defer></script>
```

## 7. Verification

`make hugo-dev` alone **cannot** validate this — a plain Hugo server has no Functions runtime, so
`/api/funding-calls` will 404. Required:

```bash
hugo --minify && npx wrangler pages dev public
```

1. `curl localhost:8788/api/funding-calls | jq '.items | length'` → expect 8 (the widget's limit).
2. `curl 'localhost:8788/api/funding-calls?limit=24' | jq '[.items[].funder] | unique | length'` →
   expect ~10 distinct funders. If it is 2–3, the funder round-robin tie-break (§3.4) is missing and
   the widget will show a wall of one funder.
3. `jq -r '.items[].title' | grep -iE 'mass destruction|environmental|internet das coisas|redes program'`
   → **must return nothing**. Any hit means the word-boundary regex or the boilerplate strip is
   missing (§3.2, §3.3).
4. `jq '.items[] | select(.deadline) | {title, deadline}'` → NIH items must show ISO dates, and
   `PAR-25-327` must read `2027-10-08`, **not** `2027-08-10`. This is the §4.1 regression test.
5. `jq '.items[] | select(.link | test("<"))'` → must return nothing (§4.2).
6. `jq '.items[] | select(.place == "Internacional")'` → must return nothing (§4.4).
7. Confirm the proxy makes exactly **one** upstream request per cache miss — not ten (§3).
8. Browser: confirm the request fires only on scroll (Network panel, filter `funding-calls`), and
   not at all if you never scroll to the section.
9. Reload with a warm cache → no network request, rows render from `localStorage`.
10. Throttle to Slow 3G and confirm the skeleton holds its height — **no CLS**.
11. Force the error path (block the endpoint in devtools) → empty state renders, no console noise
    beyond one caught error, rest of the page unaffected.
12. Lighthouse on the homepage before/after: performance score must not regress.
13. Mobile at 375px: rows stack, deadline pill does not overflow.
14. Keyboard-tab through the rows: visible focus ring on each.
15. Click the REDONE.br CTA and confirm where it actually lands (§6.4 — expect the `/termo`
    interstitial on a cookie-less browser).

Ship to a **preview branch first** — production is push-to-deploy on Cloudflare Pages, and the
proxy is the one piece that genuinely cannot be verified locally against real production routing.
Note that `functions/_middleware.js` puts preview deployments behind HTTP Basic auth, so you will
need the preview credentials.

---

## 8. Report back to ABN (Adalberto García, ATI)

Worth sending as partner feedback — the spec invites technical questions, and these are their bugs,
not ours:

1. **CORS**: `Access-Control-Allow-Origin` is only emitted for `localhost`. The feed is documented
   as public and intended for partner consumption, but no partner can read it from a browser.
   Please allowlist `https://brain-regeneration.com` (or send `*`, which is appropriate for an
   unauthenticated public feed).
2. **Broken URLs**: FAPESP item links contain literal `<i>` / `<-i>` markup in the path
   (e.g. `…-genoma-em-<i>leishmania<-i>/9567/`) — the slug generator is not stripping the
   italics used for species names.
3. **Inconsistent date formats**: FAPESP uses `Inscrições até: DD/MM/YYYY`, NIH uses
   `Inscrições até MM/DD/YYYY (MM/DD/AAAA)`. Same field, two formats, differing punctuation.
   A machine-readable ISO date (or an RSS extension element) would remove the guesswork.
4. **`lang=pt` leakage**: with `lang=en`, category regions still return `Internacional` / `Brasil`,
   and description labels stay Portuguese (`Instituição:`, `Cidade:`, `Inscrições até`).
5. **Cache headers**: the response sends `Cache-Control: max-age=0, must-revalidate, private`,
   which prevents any shared/edge caching — at odds with §6 of the guide. `ETag` and
   `Last-Modified` do work correctly (a conditional request returns `304`).
6. **Keyword search**: `q` accepts a single term with no OR support and matches on plain
   substrings, so `mental` also returns *fundamental*, *environmental* and *developmental*.
   Multi-term `q` and word-boundary matching would both help. (We work around this by filtering
   locally, so this is low priority for us — but it will bite other partners.)
7. **`/editais` redirects to `/termo`**: partner links to the funding calls listing land on a Termo
   de Uso consent page for visitors without the cookie. Since the partnership is explicitly about
   sending traffic back to the Observatory, a first click that lands on terms rather than content
   costs them most of that traffic. Worth allowing direct access to the listing, or at least
   returning to `/editais` after acceptance.

---

## 9. Out of scope

- A dedicated `/funding-calls/` page. Dropped — the section links out to the Observatory instead,
  which is both less work and the recognition they are owed.
- Filters, search or pagination. The widget shows the latest 8; the full list lives on their site.
- A top-nav entry.
- Ingesting funding calls into GregoryAi. This is a display-only integration against a third-party
  feed — no backend change.
- The 1a card grid variant.
- Localised (`lang=pt`) rendering.
- Adding the Observatory to `content/supporters/` — suggested in §6.4, but Bruno's call.
- Any change to `apiBase` or GregoryAi wiring — unrelated system.

---

## 10. Reference — verified facts

All measured 2026-08-22 against the live feed.

- Endpoint: `https://observatorio.abneuro.org.br/editais/rss` (alias `…/rss.xml`)
- Params: `lang` (`en`|`pt`), `q`, `source`, `limit` (1–400, default 100)
- Full feed: 400 items / 233 KB, reaching back to 2026-05-05. Sorted newest-first, so the `limit`
  cap only ever drops the oldest items — safe for a "latest entries" widget (§3.1).
- Current collection batch: 315 items across all topics, 21 of them neurology.
- Local neurology filter over the unfiltered feed: 31 items total, 21 in the current batch, from 10
  distinct funders — identical to a ten-request `q=` fan-out (§3.1).
- `q=` searches the whole archive (back to 2024-09-25); the unfiltered feed does not. Only matters
  if a comprehensive listing ever returns.
- `<ttl>180</ttl>`; collected once daily at 07:00 BRT (10:00 UTC). Spec asks partners to poll
  every 3–24h.
- Conditional `If-None-Match` returns `304` — confirmed working.
- No CDATA anywhere in the feed.
- Item elements: `title`, `link`, `guid` (`isPermaLink="false"`), `description`, `category` (×N),
  `pubDate`.

**Design file caveat:** `Funding Calls Section.dc.html` is a Claude Design canvas doc. Its
`<sc-for>` / `<sc-if>` / `{{ }}` templating and the `DCLogic` class come from the canvas React
runtime in `support.js` / `_ds_bundle.js` — **none of that exists on the Hugo site**. Port the
markup and CSS; rewrite the logic as plain DOM rendering in the style of `research-spotlight.js`.
Treat the design's `componentDidMount` / `parseFeed` as a sketch of intent, not as code to lift —
it has the CORS assumption (§1), the date bug (§4.1) and no error/empty/loading states.
