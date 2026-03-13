# Handover: Design Agent

## Role

You are the design agent for brain-regeneration.com. Your job is to produce two static HTML prototypes — one for the homepage, one for the research area page — that a development agent will then implement as Hugo templates. You are not writing Hugo code. You are writing clean, self-contained HTML and inline CSS that demonstrates the visual design with realistic content.

---

## Before you start

Read these two files in full before writing any code:

1. `.skills/brain-regeneration-brand/SKILL.md` — brand quick reference (colours, type, voice)
2. `.skills/brain-regeneration-brand/references/brand-spec.md` — full specification (colour palette with hex values, typography stack, component patterns, CSS custom properties, layout principles)

These files define the visual system you must follow exactly. Do not invent colours, fonts, or component styles.

---

## Deliverables

Produce two files, saved to the project root:

- `PROTOTYPE-homepage.html`
- `PROTOTYPE-research-area-page.html`

Each file must be fully self-contained — all CSS inline or in a `<style>` block in the `<head>`, no external dependencies except Google Fonts (Inter, Source Serif 4, JetBrains Mono are available from Google Fonts).

You can also use bootstrap 5 as a css framework.

---

## Deliverable 1: PROTOTYPE-homepage.html

The full specification is in `TASK-homepage-design.md`. Implement all sections in the order listed there. Use realistic placeholder content from the task file — do not use lorem ipsum.

### Sections to build (in order)

1. **Hero** — Deep Teal background, white text, two CTAs (Signal Amber primary, outlined secondary). Compact, not full-viewport height. Headline and subheadline from the task spec.
2. **The problem we solve** — Warm Sand background, narrow centred column (max ~720px), Source Serif 4, empathic register. Write 3-4 sentences per the task spec direction.
3. **Research areas** — 3-column card grid (stacked on mobile). Each card: area title, "Curated by [Name], [Institution]" in Muted Grey, 2-3 sentence description, "Explore this area" CTA in Signal Amber. Use the three real research areas from the task file.
4. **Clinical trials** — 2-column card grid. Light Teal tint background to distinguish from research area cards. Each card: condition name, plain-language description, "View trials" CTA. Include a placeholder for a live trial count badge ("14 recruiting" style).
5. **How it works** — 3-column horizontal layout on desktop. Line icons (SVG inline, Deep Teal). Three steps per the task spec, foregrounding the curator role in Step 1.
6. **Trust signals** — 4-column stat grid. Numbers in Deep Teal H1, labels in Muted Grey. Partnership mentions below. Use the exact numbers and labels from the task file.
7. **Scientific curators** — Light Teal tint background. Compact horizontal row: name + institution per curator. Link to /curators/.
8. **Newsletter subscription** — Card-based form. Two checkbox groups: "Research digests" (3 feeds) and "Clinical trial alerts" (2 feeds). Email field. Audience selector (secondary, below). Signal Amber submit button.
9. **Support the project** — Warm Sand background, centred, 3-4 lines max. Two CTAs.

### What to remove

Do not include an audiences section (Researchers / Clinicians / Patients cards). It exists in the current homepage but has been explicitly removed from the new design.

### Homepage brand rules

- Page background: Warm Sand (`#F5F0E8`) — no pure white sections
- Hero background: Deep Teal (`#1A6B6A`)
- CTAs: Signal Amber (`#E8913A`) background, white text
- Headings: Inter, Deep Teal
- Body: Source Serif 4, Text Dark (`#2D2D2D`)
- Banned words: "breakthrough," "revolutionary," "game-changing," "miracle," "cutting-edge"

---

## Deliverable 2: PROTOTYPE-research-area-page.html

The full specification is in `TASK-research-area-pages.md`. Use the Neuroinflammation research area as the example (it has the most connected conditions — MS and Alzheimer's — so it exercises the most template logic).

### Blocks to build (in order)

1. **Page header** — H1 title "Neuroinflammation". Curator attribution line directly below in Muted Grey, Inter 14px: "Curated by Institute for CNS, Blood and Peripheral Inflammation, iMed.ULisboa →" (the arrow is a link to /curators/institute-cns-inflammation/).

2. **Body text** — 4 paragraphs of prose. Use the actual body content from `content/research-areas/neuroinflammation/index.md`. Source Serif 4, 16-18px, max line length ~70 characters, line height 1.6.

3. **Disease condition tags** — Horizontal row of tag pills. "Related conditions:" label in Muted Grey, then two pills: "Multiple Sclerosis" (links to /clinical-trials/multiple-sclerosis/) and "Alzheimer's Disease" (links to /clinical-trials/alzheimers/). Tag style: Light Teal background, Deep Teal text, 8px radius.

4. **Key concepts glossary** — This block should be shown in the prototype even though in production it only renders when definitions are non-empty. Show 3 placeholder terms with placeholder definitions so the design is visible. Section heading "Key concepts" H3. Definition list style: term in Inter SemiBold, definition in Source Serif 4. Container: Light Teal background, 1px Border, 8px radius.

5. **Curator card** — Compact horizontal card: logo placeholder on left (60×60px grey box), text on right. "Institute for CNS, Blood and Peripheral Inflammation" as name (Deep Teal H4), "iMed.ULisboa" as institution (Muted Grey), "Lead researcher: Adelaide Fernandes" (Text Dark), one-line bio placeholder. "View full profile →" link. Card: Warm Sand background, 1px Border, 8px radius, subtle shadow.

6. **Research feed** — Section heading "Latest research" H2. Filter controls above: sort dropdown (newest / relevance), date range picker, keyword search input. Below filters: 3 placeholder paper cards showing the expected layout (title, authors truncated, journal, date, AI relevance score badge, link). Paper cards: white background, 1px Border, 8px radius. Include the React mount point div as an HTML comment:

```html
<!-- React mount point (populated at runtime):
<div id="research-feed"
     data-endpoint="https://api.gregory-ms.com/trials/"
     data-team-id="1"
     data-keywords="neuroinflammation,microglia,neurodegeneration"
     data-queries="[...]">
</div>
-->
```

7. **Search methodology** — Show this block (for Neuroinflammation, `show_queries` is `false`, but include it in the prototype so the design is visible). Section heading "Search methodology" H3. Explanation line in Source Serif 4, Muted Grey. Two example query strings in JetBrains Mono, Light Teal container, with source badges ("PubMed") and status dots.

### Contextual newsletter prompt

Include a contextual subscription prompt between the curator card and the research feed. Pre-selects "Neuroinflammation — weekly research digest". Copy: "Follow this research area. We send a weekly digest of the latest findings." Compact form: pre-checked checkbox + email field + subscribe button.

### Research area page brand rules

- Page background: Warm Sand (`#F5F0E8`)
- Headings: Inter, Deep Teal
- Body text: Source Serif 4, Text Dark, max ~720px column
- Condition tags: Light Teal bg, Deep Teal text
- Key concepts container: Light Teal bg, 1px Border
- Code/queries: JetBrains Mono, Light Teal container
- Curator card: Warm Sand bg, 1px Border, subtle shadow

---

## Output quality criteria

- No lorem ipsum — all content is from the task files or described above
- Fully responsive (use flexbox/grid with media queries for mobile)
- No banned words anywhere in the copy
- Colours match the hex values in the brand spec exactly — no approximations
- Inter loaded from Google Fonts: weights 400, 500, 600, 700
- Source Serif 4 loaded from Google Fonts: weights 400, 600
- JetBrains Mono loaded from Google Fonts: weight 400
- Both files open correctly in a browser with no console errors
