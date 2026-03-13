# Handover: Development Agent

## Role

You are the development agent for brain-regeneration.com. Your job is to implement two Hugo templates and update the homepage content, converting the static HTML prototypes produced by the design agent into working Hugo templates. You will also define the React component mount points for the research feed.

---

## Before you start

Read these files before writing any code:

1. `PROTOTYPE-homepage.html` — static HTML prototype for the homepage (produced by design agent)
2. `PROTOTYPE-research-area-page.html` — static HTML prototype for the research area page (produced by design agent)
3. `TASK-homepage-design.md` — full specification including dynamic content requirements
4. `TASK-research-area-pages.md` — full specification including Hugo template logic
5. `.skills/brain-regeneration-brand/SKILL.md` — brand quick reference
6. `.skills/brain-regeneration-brand/references/brand-spec.md` — full brand specification

The prototypes define the visual design. The task files define the dynamic behaviour. Where the two differ, the task files take precedence.

---

## Technical environment

- Hugo v0.153.0 (installed via pip to `.local/bin/hugo`)
- Theme: `Hugo-Now-UI-Pro` at `themes/Hugo-Now-UI-Pro/`
- Theme base template: `themes/Hugo-Now-UI-Pro/layouts/_default/baseof.html`
- Theme single template: `themes/Hugo-Now-UI-Pro/layouts/_default/single.html`
- Deployment: Cloudflare Pages
- The site already builds with `hugo` from the project root. Run `hugo` to verify after each significant change.

### Theme override pattern

Hugo's lookup order means any file in `layouts/` overrides the same path in `themes/Hugo-Now-UI-Pro/layouts/`. To override a template, copy the relevant theme file to `layouts/` and modify it — do not edit files inside `themes/`.

### CSS approach

The Now UI Pro theme uses Bootstrap 4 classes. The brand spec CSS custom properties (colours, fonts) should be added to a custom CSS file at `static/css/brain-regen.css` and linked in a partial or the baseof override. Use the brand spec CSS custom properties as defined in `.skills/brain-regeneration-brand/references/brand-spec.md`.

---

## Deliverables

### 1. `layouts/index.html` — homepage template

Override the theme's `layouts/index.html` (copy from `themes/Hugo-Now-UI-Pro/layouts/index.html` as a starting point). Convert the static HTML prototype sections into Hugo template logic as specified below.

#### Dynamic sections

**Research areas** — generated with Hugo range, not hardcoded HTML:

```go-html-template
{{ range where .Site.Pages "Section" "research-areas" }}
  {{ if .IsPage }}
    {{/* Resolve curator */}}
    {{ $curatorSlug := index .Params.curators 0 }}
    {{ $curator := .Site.GetPage (printf "curators/%s" $curatorSlug) }}
    {{/* Render card */}}
  {{ end }}
{{ end }}
```

**Clinical trials** — generated with Hugo range:

```go-html-template
{{ range where .Site.Pages "Section" "clinical-trials" }}
  {{ if .IsPage }}
    {{/* Render condition card */}}
  {{ end }}
{{ end }}
```

**Scientific curators** — generated with Hugo range:

```go-html-template
{{ range where .Site.Pages "Section" "curators" }}
  {{ if .IsPage }}
    {{/* Render compact curator attribution */}}
  {{ end }}
{{ end }}
```

**Newsletter form** — static HTML (the feed list maps to current research areas and conditions — no dynamic generation required at this stage, but keep the structure easy to extend).

#### Sections to remove

The existing `content/_index.md` has an audiences section (Researchers / Clinicians / Patients cards). Do not include this in the new template. It has been explicitly removed.

#### Homepage content update

After the template is working, update `content/_index.md` frontmatter to match the new design:

- `title`: "Brain Regeneration Observatory"
- `subtitle`: remove the current subtitle — the hero headline is now defined in the template
- Update the `cta` block to match the two CTAs from the task spec
- Remove the inline HTML sections from the content body — all sections are now in the template

---

### 2. `layouts/research-areas/single.html` — research area template

Create this file from scratch (no theme equivalent to copy — use `themes/Hugo-Now-UI-Pro/layouts/_default/single.html` as the structural starting point for the `{{ define "main" }}` block). Convert the static HTML prototype into a Hugo template that works for all three research areas.

#### Template logic for each block

**Block 1 — Page header:**

```go-html-template
<h1>{{ .Title }}</h1>
{{ $curatorSlug := index .Params.curators 0 }}
{{ $curator := .Site.GetPage (printf "curators/%s" $curatorSlug) }}
{{ with $curator }}
  <p class="curator-attribution">
    Curated by <a href="{{ .Permalink }}">{{ .Params.name }}, {{ .Params.institution }}</a> →
  </p>
{{ end }}
```

**Block 2 — Body text:** `{{ .Content }}`

**Block 3 — Condition tags (conditional):**

```go-html-template
{{ if .Params.conditions }}
  <div class="condition-tags">
    <span class="tag-label">Related conditions:</span>
    {{ range .Params.conditions }}
      {{ $condPage := $.Site.GetPage (printf "clinical-trials/%s" .) }}
      {{ with $condPage }}
        <a href="{{ .Permalink }}" class="condition-tag">{{ .Title }}</a>
      {{ end }}
    {{ end }}
  </div>
{{ end }}
```

**Block 4 — Key concepts (conditional):**

```go-html-template
{{ $hasConcepts := false }}
{{ range .Params.concepts }}
  {{ if .definition }}{{ $hasConcepts = true }}{{ end }}
{{ end }}
{{ if $hasConcepts }}
  <section class="key-concepts">
    <h3>Key concepts</h3>
    <dl>
      {{ range .Params.concepts }}
        {{ if .definition }}
          <dt>{{ .term }}</dt>
          <dd>{{ .definition }}</dd>
        {{ end }}
      {{ end }}
    </dl>
  </section>
{{ end }}
```

**Block 5 — Curator card:**

```go-html-template
{{ $curatorSlug := index .Params.curators 0 }}
{{ $curator := .Site.GetPage (printf "curators/%s" $curatorSlug) }}
{{ with $curator }}
  <div class="curator-card">
    {{ with .Params.logo }}<img src="{{ . }}" alt="{{ $.Params.name }} logo">{{ end }}
    <div class="curator-card-body">
      <h4>{{ .Params.name }}</h4>
      <p class="institution">{{ .Params.institution }}</p>
      {{ with .Params.lead_researcher }}<p class="lead-researcher">{{ . }}</p>{{ end }}
      {{ with .Params.bio }}<p class="bio">{{ . }}</p>{{ end }}
      <a href="{{ .Permalink }}">View full profile →</a>
    </div>
  </div>
{{ end }}
```

**Block 6 — Research feed mount point:**

```go-html-template
<section class="research-feed">
  <h2>Latest research</h2>
  {{/* Filter controls — static HTML, styled per prototype */}}
  <div class="feed-filters">
    {{/* sort, date range, keyword search */}}
  </div>
  <div id="research-feed"
       data-endpoint="{{ .Site.Params.clinicalTrials.apiBase }}"
       data-team-id="1"
       data-keywords="{{ delimit .Params.keywords "," }}"
       data-queries="{{ .Params.queries | jsonify }}">
    <p class="feed-loading">Loading research...</p>
  </div>
</section>
```

**Block 7 — Search methodology (conditional):**

```go-html-template
{{ if .Params.show_queries }}
  <section class="search-methodology">
    <h3>Search methodology</h3>
    <p class="methodology-note">This area is populated using the following search queries, defined by the scientific curator.</p>
    {{ range .Params.queries }}
      <div class="query-block">
        <code>{{ .query }}</code>
        {{ with .source }}<span class="source-badge">{{ . }}</span>{{ end }}
      </div>
    {{ end }}
  </section>
{{ end }}
```

#### Contextual newsletter prompt

Between the curator card (Block 5) and the research feed (Block 6), insert a newsletter prompt that pre-selects the current research area's feed. Pass the page title as a data attribute for the form or as a hidden input value.

---

### 3. `static/css/brain-regen.css`

Create this file with the CSS custom properties from the brand spec and any component styles not covered by Bootstrap 4. Import the Google Fonts stack in this file:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@400;600&family=JetBrains+Mono:wght@400&display=swap');
```

Link this stylesheet from a custom partial at `layouts/partials/custom-head.html` that extends the theme's `<head>`.

---

## What not to build

The React components themselves (research feed, clinical trial counts) are a separate workstream. Your job is to output the correct mount point divs with the correct data attributes. The components will be built and bundled separately and injected at a later stage. Leave a `<!-- TODO: inject research-feed bundle here -->` comment in the templates where the script tag will go.

---

## Build verification

After completing each deliverable, run:

```zsh
hugo --minify 2>&1 | tail -20
```

The build must complete with 0 errors. Warnings about missing page resources are acceptable if the content files themselves are complete.

---

## Acceptance criteria

- `layouts/index.html` renders all 9 sections (minus audiences) from the homepage prototype
- Research area cards on the homepage are generated dynamically via Hugo range, not hardcoded
- `layouts/research-areas/single.html` renders all 7 blocks in order
- Condition tags only render when `.Params.conditions` is non-empty
- Key concepts block only renders when at least one definition is non-empty
- `show_queries` correctly gates the search methodology block
- CSS custom properties are applied and match the brand spec hex values
- The word "champion" does not appear anywhere in any template
- All three research area pages build and render correctly: cell-reprogramming, neuroimmune-interactions, neuroinflammation
- Hugo build completes with 0 errors
