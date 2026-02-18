# Brain Regeneration Observatory — Brand Specification

## Brand Foundation

### Who we are

A donor-funded, open-source observatory that uses AI to track, curate, and deliver the latest research on brain regeneration. Built by patients and volunteers, guided by scientific curators, and designed for anyone who needs to follow the science.

### What makes us different

- Human curation layer: real scientists define what matters, not just algorithms
- Patient-facing clarity: the same research, presented so anyone can follow it
- Community visibility: you can see who is working on what, and join a network that matters

### Brand tensions we embrace

The identity deliberately holds two qualities in balance:

| Analytical side | Empathic side |
|:----------------|:--------------|
| Data-forward | Human-centred |
| Precise terminology | Plain language |
| Technical confidence | Emotional warmth |
| Innovation signals | Grounded trust |

This duality is what makes the brand distinctive. Neither side dominates. The balance shifts depending on context (research area pages lean analytical, patient pages lean empathic) but both qualities are always present.

---

## Colour Palette

### Primary Colours

| Name | Hex | RGB | Usage |
|:-----|:----|:----|:------|
| Deep Teal | `#1A6B6A` | 26, 107, 106 | Headers, primary buttons, navigation, key brand surfaces |
| Warm Sand | `#F5F0E8` | 245, 240, 232 | Page backgrounds, cards, content areas |
| Signal Amber | `#E8913A` | 232, 145, 58 | CTAs, alerts, new content indicators, hope accent |

### Supporting Colours

| Name | Hex | RGB | Usage |
|:-----|:----|:----|:------|
| Text Dark | `#2D2D2D` | 45, 45, 45 | Primary body text on light backgrounds |
| Text Light | `#FFFFFF` | 255, 255, 255 | Text on teal/dark backgrounds |
| Muted Grey | `#8C8C8C` | 140, 140, 140 | Metadata, timestamps, secondary information |
| Light Teal | `#E6F2F2` | 230, 242, 242 | Hover states, subtle section backgrounds, tags |
| Border | `#D9D4CA` | 217, 212, 202 | Card borders, dividers, table lines |

### Colour Combinations

| Combination | Use case |
|:------------|:---------|
| Deep Teal bg + White text | Navigation, hero sections, footer |
| Warm Sand bg + Dark text | Main content areas, article pages |
| White bg + Teal headings + Amber CTAs | Landing pages, feature sections |
| Light Teal bg + Dark text | Highlighted blocks, curator attribution |

### Avoid

- Amber text on any background (contrast too low for body text)
- Teal text on Warm Sand (insufficient contrast)
- Pure white (`#FFFFFF`) as a page background (too clinical; use Warm Sand)
- Saturated or neon colours anywhere (contradicts grounded trust)

---

## Typography

All typefaces are free and open-source. No licensing required.

### Type Scale

| Role | Family | Weight | Size range | Source |
|:-----|:-------|:-------|:-----------|:------|
| H1 | Inter | 700 (Bold) | 36-48px | Google Fonts |
| H2 | Inter | 600 (SemiBold) | 28-32px | Google Fonts |
| H3 | Inter | 600 (SemiBold) | 22-26px | Google Fonts |
| H4 | Inter | 500 (Medium) | 18-20px | Google Fonts |
| Body | Source Serif 4 | 400 (Regular) | 16-18px | Google Fonts |
| Body emphasis | Source Serif 4 | 600 (SemiBold) | 16-18px | Google Fonts |
| Metadata | Inter | 400 (Regular) | 13-14px | Google Fonts |
| Data/queries | JetBrains Mono | 400 (Regular) | 14-15px | JetBrains |

### Fallback Stack

```css
--font-heading: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-body: 'Source Serif 4', Georgia, 'Times New Roman', serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Typography Rules

- Headings never use bold emphasis markers (no `**` in headings)
- Line height: 1.6 for body text, 1.2 for headings
- Maximum line length: 70-75 characters for body text
- Paragraph spacing: 1.5em between paragraphs
- The pairing of sans-serif headings with serif body text signals the brand tension: modern precision (Inter) meets human warmth (Source Serif)

---

## Voice and Tone

### Core Principle

Plain language first. Technical terms appear but are never the barrier to understanding.

### Voice Attributes

| Attribute | What it sounds like | What it does not sound like |
|:----------|:-------------------|:---------------------------|
| Grounded | "Research shows early signals of..." | "Groundbreaking discovery proves..." |
| Warm | "We track this so you don't have to." | "Users may configure alert preferences." |
| Precise | "34,000 articles indexed since 2021" | "Thousands and thousands of papers" |
| Hopeful | "New avenues are being explored." | "The cure is around the corner." |
| Direct | "This area is curated by LPJ Lab." | "We are proud to announce our partnership..." |

### Writing Rules

- Lead with what matters to the reader, not what matters to the project
- Use active voice
- One idea per sentence when explaining science to patients
- Numbers are specific, never rounded for drama
- Never use "breakthrough," "revolutionary," "game-changing," or "miracle"
- Replace "cutting-edge" with "recent" or "emerging"
- When a term requires explanation, explain it inline in the same sentence
- Attribution is factual: "Curated by [Name], [Institution]" — no superlatives about the curator

### Audience Register

| Context | Register | Example |
|:--------|:---------|:--------|
| Research area page | Informed general | "Cell reprogramming works with existing non-neuronal cells, guiding them to become the neurons needed to restore brain function." |
| Curator profile | Professional | "LPJ Lab investigates how cell metabolism shapes brain-immune interactions." |
| Patient-facing page | Accessible | "We track the latest research so you can stay informed about what scientists are working on." |
| Data/methodology | Technical | "Search query: (cell reprogramming[Title/Abstract]) AND (brain[Title/Abstract])" |
| CTAs | Warm, direct | "Never miss a finding." / "Follow this research area." |

---

## Imagery and Photography

### Photography Direction

- Subject matter: laboratories, microscopy, neural imagery, collaborative research settings, nature patterns that echo neural networks (tree branches, river deltas, root systems)
- Mood: natural light, depth of field, calm composition
- People: when shown, researchers and patients are portrayed with dignity and agency — never as passive subjects
- Colour treatment: desaturated slightly toward warm tones to match the Warm Sand palette

### What to Avoid in Photography

- Stock photos of people pointing at screens or celebrating
- Overly dramatic lighting or heavy colour grading
- Brain scans used as decoration without context
- Images that imply suffering, decline, or helplessness
- Generic "science" imagery (beakers, DNA helixes floating in space)

### Iconography

- Style: line icons, 1.5-2px stroke, rounded caps
- Colour: Deep Teal for default state, Signal Amber for active/highlighted
- Source: use open-source icon sets (Lucide, Phosphor, or Heroicons)
- Avoid filled/solid icons — the line style matches the brand's transparency value

### Illustration (if needed)

- Style: flat, geometric, minimal detail
- Colours: limited to the brand palette
- Use for: explaining processes (how the pipeline works), abstract concepts (brain regions, cell types)
- Avoid: cartoon style, 3D renders, overly literal medical illustrations

---

## Layout Principles

### Spacing

- Use generous white space. Content should breathe.
- Section padding: 80-120px vertical on desktop, 48-64px on mobile
- Card padding: 24-32px internal
- Grid gutters: 24-32px

### Visual Hierarchy

1. Heading (Inter, Deep Teal)
2. Subheading or description (Source Serif 4, Text Dark)
3. Body content (Source Serif 4, Text Dark)
4. Metadata and attribution (Inter, Muted Grey)
5. CTAs (Signal Amber background, White text)

### Cards

- Background: White or Warm Sand
- Border: 1px solid Border colour (`#D9D4CA`)
- Border radius: 8px
- Shadow: subtle, warm-toned — `0 2px 8px rgba(45, 45, 45, 0.06)`
- Hover: light teal background tint (`#E6F2F2`)

### Data Presentation

- Tables use alternating row backgrounds (White / Light Teal)
- Search query strings are displayed in JetBrains Mono inside a lightly shaded code block
- Status indicators: active (Deep Teal dot), low results (Amber dot), zero results (Muted Grey dot)

---

## Component Patterns

### Curator Attribution (on research area pages)

Subtle, inline attribution that links to the curator's standalone page:

```
Curated by [Curator Name], [Institution] →
```

- Text: Muted Grey, Inter, 14px
- Link: Deep Teal on hover
- Position: below the research area title, above the description

### Curator Card (on listing page)

- Curator name: H3, Inter SemiBold, Deep Teal
- Institution: Inter Regular, Muted Grey
- Lead researcher: Inter Regular, Text Dark
- Bio: Source Serif 4, Text Dark, 2-3 lines max
- Research areas: tags in Light Teal background, Deep Teal text
- Website link: Deep Teal, underlined on hover

### Research Area Card (homepage and listings)

- Title: H3, Inter SemiBold, Text Dark
- Curator attribution: Inter, Muted Grey, small
- Description: Source Serif 4, Text Dark, 2-3 lines
- CTA: "Explore →" in Signal Amber

### Search Query Display (when show_queries is true)

- Container: Light Teal background, 1px Border, 8px radius
- Label: "Search methodology" in Inter SemiBold, 14px
- Query strings: JetBrains Mono, 14px, one per line
- Source badge: small pill in Deep Teal with white text
- Status dot: coloured indicator per query

---

## Practical Constraints

This project is donor-funded and volunteer-run. The brand guidelines reflect this reality:

- All typefaces are free and open-source (Google Fonts, JetBrains)
- All icon sets recommended are open-source (MIT/Apache licensed)
- Photography should use royalty-free sources (Unsplash, Pexels) or original project photos
- The site is built with Hugo (static generation) — all design decisions must work without a CMS, JavaScript frameworks, or server-side rendering
- CSS should use custom properties (variables) for all brand values to enable easy theme updates
- The colour palette is small by design — fewer colours to maintain, less room for inconsistency

### CSS Custom Properties

```css
:root {
	--color-primary: #1A6B6A;
	--color-secondary: #F5F0E8;
	--color-accent: #E8913A;
	--color-text: #2D2D2D;
	--color-text-light: #FFFFFF;
	--color-muted: #8C8C8C;
	--color-tint: #E6F2F2;
	--color-border: #D9D4CA;

	--font-heading: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	--font-body: 'Source Serif 4', Georgia, 'Times New Roman', serif;
	--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

	--radius: 8px;
	--shadow: 0 2px 8px rgba(45, 45, 45, 0.06);
}
```

---

## What This Brand Is Not

- Not clinical. We are warmer than a medical journal.
- Not startup-y. We do not use hype language or growth metrics as identity.
- Not charity-coded. We are a serious research tool, not a fundraising campaign.
- Not generic science. We have a specific scope (brain regeneration) and a specific method (AI-assisted curation by scientific experts).

The identity sits in a space that few projects occupy: technically rigorous, emotionally grounded, and radically transparent.
