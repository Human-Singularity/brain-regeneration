# Task: Design the Research Area Pages

## Goal

Design and implement the research area page template for brain-regeneration.com. Each research area is a curator-led section of the site that tracks scientific literature in a specific domain of brain regeneration research. The page must serve both patients and researchers with a single unified voice, surface the human curation layer as a trust signal, and provide a live research feed with filtering capabilities.

## Context

### What a research area is

A research area is a scientific domain defined and curated by a named scientific curator — a researcher or institution with expertise in that field. The curator provides the search queries that populate the area with relevant papers, and may also provide key concept definitions and category structures. The research feed is powered by GregoryAI and rendered via a React component.

### Current research areas

| Area | Curator | Institution | Conditions linked |
|:-----|:--------|:------------|:------------------|
| Cell Reprogramming | REGENERAR | University of Coimbra / CNC-UC / CIBB | None yet (stroke, Parkinson's pages pending) |
| Neuroimmune Interactions | LPJ Lab | University of Cambridge | Multiple Sclerosis |
| Neuroinflammation | Institute for CNS, Blood and Peripheral Inflammation | iMed.ULisboa | Multiple Sclerosis, Alzheimer's |

### Content files

| File | Purpose |
|:-----|:--------|
| `content/research-areas/*/index.md` | Research area content (title, description, body, queries, concepts, conditions) |
| `content/curators/*/index.md` | Curator identity (name, institution, lead researcher, bio, website) |
| `content/clinical-trials/*/index.md` | Condition pages linked via `conditions` frontmatter field |
| `archetypes/research-areas.md` | Template for new research areas |

---

## Design Decisions (confirmed)

### Audience approach

One unified text per page, written for the informed general reader. No tabs, toggles, or separate patient/researcher sections. The voice follows the brand spec: plain language first, precise but accessible. Technical terms are always explained inline in the same sentence.

### Content blocks (in page order)

The page has six content blocks, appearing in this order:

1. Header with curator attribution
2. Body text (intro + why it matters)
3. Disease condition tags
4. Key concepts glossary
5. Curator card
6. Live research feed with filters

### Curator presence

A compact card — photo/logo, name, institution, one-line bio, and link to the curator's standalone page at `/curators/`. Not a full bio block. The detailed profile lives on the curator's own page.

### Disease condition links

Implicit connection via tags. Each research area's `conditions` frontmatter lists slugs from `content/clinical-trials/`. The template renders these as linked tag pills (e.g. "Multiple Sclerosis" linking to `/clinical-trials/multiple-sclerosis/`). No prose explaining the disease connection — the research feed content makes the relationship clear.

### Key concepts

A glossary-style block of 3-5 terms with plain-language definitions. These are owned by the scientific curator and provided by them. The terms are listed in frontmatter as structured data (`term` + `definition`). All definitions are currently empty placeholders awaiting curator input. The template should only render this block if at least one concept has a non-empty definition.

### Research feed interaction

The live feed is a React component showing papers ranked by GregoryAI relevance. Visitors can filter by date and relevance score, and search by keyword in title or abstract. The component reads its configuration from data attributes on the mount point div, populated from frontmatter values (queries, keywords) at Hugo build time.

### Search methodology visibility

Controlled by the `show_queries` boolean in frontmatter. When true, the page displays the PubMed search strings used to populate the area. When false, the queries remain in frontmatter (available in the codebase for transparency) but are not rendered on the page. Currently only Cell Reprogramming has `show_queries: true`.

---

## Brand Guidelines

Before writing any copy or designing any component, load these files:

- `.skills/brain-regeneration-brand/SKILL.md` — quick reference
- `.skills/brain-regeneration-brand/references/brand-spec.md` — full specification

### Key brand rules for this task

- Voice: plain language first, one idea per sentence when explaining science
- Banned words: "breakthrough," "revolutionary," "game-changing," "miracle," "cutting-edge"
- Attribution style: "Curated by [Name], [Institution]" — factual, no superlatives
- Page background: Warm Sand (`#F5F0E8`), not pure white
- Headings: Inter, Deep Teal (`#1A6B6A`)
- Body text: Source Serif 4, Text Dark (`#2D2D2D`)
- Data/queries: JetBrains Mono in a Light Teal (`#E6F2F2`) code block
- CTAs: Signal Amber (`#E8913A`) background, white text
- Icons: line style (Lucide or Phosphor), Deep Teal default

---

## Page Layout Specification

### 1. Page header

- Title: H1, Inter Bold, Deep Teal
- Curator attribution line directly below: "Curated by [Curator Name], [Institution] →"
- Attribution text: Inter Regular, 14px, Muted Grey (`#8C8C8C`)
- The arrow links to the curator's standalone page

Source: title from `content/research-areas/*/index.md`, curator data resolved via `.Site.GetPage` on the `curators` frontmatter slug

### 2. Body text

- The main prose content from the markdown body of the research area file
- Each area currently has 4 paragraphs covering: what the area is, how it works, the current state of research, and why it matters for brain regeneration
- Source Serif 4, 16-18px, Text Dark, max line length 70-75 characters
- Line height 1.6, paragraph spacing 1.5em

Source: `.Content` from the research area page

### 3. Disease condition tags

- A horizontal row of tag pills linking to `/clinical-trials/` pages
- Tag style: Light Teal (`#E6F2F2`) background, Deep Teal text, 8px border radius
- Only render this block if `.Params.conditions` is not empty
- Each tag links to the condition's page (e.g. `/clinical-trials/multiple-sclerosis/`)
- Label: "Related conditions:" in Inter, Muted Grey, 13px, preceding the tag row

Source: `conditions` array in frontmatter, resolved to condition page titles via `.Site.GetPage`

### 4. Key concepts glossary

- Section heading: "Key concepts" in H3, Inter SemiBold
- Rendered as a definition list: term in Inter SemiBold (16px, Text Dark), definition in Source Serif 4 (16px, Text Dark)
- Only render this block if at least one concept has a non-empty `definition` field
- Container: Light Teal background, 1px Border (`#D9D4CA`), 8px radius, 24px padding

Source: `concepts` array in frontmatter. Currently all definitions are empty (awaiting curator input), so this block will not render until curators provide content.

### 5. Curator card

- Compact card block, not a full bio
- Layout: horizontal — logo/photo on left, text on right
- Curator name: H4, Inter Medium, Deep Teal
- Institution: Inter Regular, Muted Grey
- Lead researcher (if different from name): Inter Regular, Text Dark
- One-line bio: Source Serif 4, Text Dark
- Link: "View full profile →" in Deep Teal, linking to `/curators/{slug}/`
- Card style: Warm Sand background, 1px Border, 8px radius, subtle shadow

Source: curator data resolved from `curators` frontmatter slug via `.Site.GetPage "curators/{slug}"`

### 6. Research feed

- Section heading: "Latest research" in H2, Inter SemiBold
- Filter controls above the feed:
	- Sort: by date (newest first) or by AI relevance score
	- Date range picker
	- Keyword search field (searches title and abstract)
- Feed items rendered by a React component
- Mount point div with data attributes from frontmatter:

```html
<div id="research-feed"
     data-endpoint="{{ .Site.Params.clinicalTrials.apiBase }}"
     data-team-id="1"
     data-keywords="{{ delimit .Params.keywords "," }}"
     data-queries="{{ .Params.queries | jsonify }}">
</div>
```

- Individual paper card (rendered by React): title, authors (truncated), journal, date, AI relevance score indicator, link to source
- Card style: white background, 1px Border, 8px radius

### 7. Search methodology (conditional)

- Only rendered when `show_queries` is `true` in frontmatter
- Position: below the research feed, above the footer
- Section heading: "Search methodology" in H3, Inter SemiBold
- Explanation line: "This area is populated using the following search queries, defined by the scientific curator." in Source Serif 4, Muted Grey
- Each query displayed in a code block:
	- Query string: JetBrains Mono, 14px
	- Source badge: small pill, Deep Teal background, white text (e.g. "PubMed")
	- Status indicator: Deep Teal dot (active), Signal Amber dot (low results), Muted Grey dot (zero results)
- Container: Light Teal background, 1px Border, 8px radius

Source: `queries` array and `show_queries` boolean from frontmatter

---

## Newsletter integration

Each research area page should include a contextual subscription prompt — either inline or as a sticky element — allowing visitors to subscribe to the weekly digest for that specific research area. The prompt should pre-select the relevant feed based on the current page.

Copy direction: "Follow this research area. We send a weekly digest of the latest findings."

---

## Technical notes

### Hugo template

The research area page uses Hugo's single page template. It should be placed at `layouts/research-areas/single.html` to override the theme's default single template for this section.

### Dynamic content resolution

Research area cards and curator attributions are resolved at build time using Hugo's `.Site.GetPage`. The template loops over `.Params.curators` to fetch curator data and over `.Params.conditions` to fetch condition page titles and URLs.

### React component

The research feed is the only dynamic element on the page. It mounts on a div with data attributes and fetches from the GregoryAI API at runtime. The component is shared across all research area pages — only the data attributes change.

### Responsive behaviour

- Desktop: body text in a centred column (max-width ~720px for readability), curator card horizontal layout, feed items in a list
- Tablet: same as desktop, curator card stacks vertically
- Mobile: full-width, all elements stack, filter controls collapse into a dropdown or accordion

---

## Acceptance criteria

- All copy follows the brand voice rules (plain language, no banned words, active voice)
- Colours, typography, and spacing match the brand specification
- Curator attribution appears below the title in Muted Grey, linking to the curator's page
- Body text renders from the markdown content of each research area
- Condition tags only render when the `conditions` array is non-empty
- Key concepts block only renders when at least one definition is non-empty
- Curator card is compact (not full bio) and links to the standalone curator page
- Research feed React mount point outputs correct data attributes from frontmatter
- Search methodology section only renders when `show_queries` is `true`
- Newsletter prompt is contextual to the current research area
- Page builds without errors in Hugo
- Responsive on mobile, tablet, and desktop
