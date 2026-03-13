# Task: Design the Brain-Regeneration.com Homepage

## Goal

Design and implement the homepage for brain-regeneration.com using Hugo templates and the project's brand guidelines. The homepage is the single most important page on the site — it must build trust within seconds, clearly explain what the project does, and route three distinct audiences (patients, researchers, clinicians) to the content that matters to them.

## Context

### What the project is

Brain-Regeneration.com is an AI-powered observatory that tracks scientific research and clinical trials related to brain regeneration. It is donor-funded, volunteer-run, and guided by named scientific curators who define the scope of each research area. The site is built with Hugo, uses React components for dynamic data from the GregoryAI API, and is deployed to Cloudflare Pages.

### Who visits

- Patients and caregivers looking for clinical trials they can join and research they can follow
- Researchers who want curated feeds in their field, delivered faster than they can track manually
- Clinicians who need to stay current on emerging therapies and trial activity

### What the homepage must accomplish

1. Answer "What is this?" in one sentence
2. Signal grounded trust — serious, transparent, no hype
3. Show the two primary content types: research areas (curated by scientists) and clinical trials (organised by condition)
4. Make the newsletter subscription model clear — multiple feeds, not one generic list
5. Surface trust signals: numbers, partnerships, curator names
6. Provide a path to donate without making the site feel like a fundraising campaign

---

## Brand Guidelines

Before writing any copy or designing any component, load these files:

- `.skills/brain-regeneration-brand/SKILL.md` — quick reference for colours, type, voice
- `.skills/brain-regeneration-brand/references/brand-spec.md` — full specification including component patterns, voice rules, and layout principles

### Key brand rules for this task

- First impression: grounded trust
- Voice: plain language first, precise but accessible
- Banned words: "breakthrough," "revolutionary," "game-changing," "miracle," "cutting-edge"
- Colours: Warm Sand (`#F5F0E8`) as page background, Deep Teal (`#1A6B6A`) for headers and nav, Signal Amber (`#E8913A`) for CTAs
- Type: Inter for headings, Source Serif 4 for body, JetBrains Mono for data
- Icons: line style, Lucide or Phosphor, Deep Teal default / Amber active
- No pure white backgrounds — use Warm Sand

---

## Homepage Sections (in order)

### 1. Hero

A single clear statement of what the site does. No jargon. Two CTAs that split the audience naturally.

Content direction:

- Headline: one sentence that names the value (tracking research + trials for brain regeneration)
- Subheadline: one sentence that names the method (AI-powered, scientist-curated)
- Primary CTA: toward research areas or the research tracker (for researchers/clinicians)
- Secondary CTA: toward clinical trials (for patients)

Design notes:

- Deep Teal background + White text (per brand spec colour combination)
- Keep it compact — the hero should not push all other content below the fold
- Header image is optional; if used, follow photography direction in brand spec (nature patterns echoing neural networks, microscopy, calm composition)

### 2. The problem we solve

A short paragraph (3-4 sentences) that names the pain this project addresses. Research is scattered. Trials are hard to find. Patients are excluded from the conversation. This paragraph replaces feature-listing with problem-naming — a more trust-building approach.

Content direction:

- Write from the reader's perspective, not the project's
- Name specific frustrations: dozens of databases, no single view, papers behind paywalls, trial registries that require medical training to navigate
- Close with what this project does differently: one place, curated by scientists, updated by AI

Design notes:

- Warm Sand background + Text Dark
- Centre-aligned, narrow column (col-md-8 equivalent)
- Source Serif 4 body text — this is the empathic register

### 3. Research areas

The three curator-led research areas, each as a card. This section signals the human curation layer — real institutions are behind the content.

Content for each card:

- Research area title (from `content/research-areas/*/index.md` title)
- Curator attribution line: "Curated by [Name], [Institution]" (from `content/curators/*/index.md` frontmatter)
- 2-3 sentence description (from research area description field)
- CTA: "Explore this area" linking to the research area page

Current research areas:

| Area | Curator | Institution |
|:-----|:--------|:------------|
| Cell Reprogramming | REGENERAR | University of Coimbra / CNC-UC / CIBB |
| Neuroimmune Interactions | LPJ Lab | University of Cambridge |
| Neuroinflammation | Institute for CNS, Blood and Peripheral Inflammation | iMed.ULisboa |

Design notes:

- 3-column card grid on desktop, stacked on mobile
- Card pattern from brand spec: Warm Sand bg, 1px Border, 8px radius, subtle shadow
- Curator attribution in Muted Grey, Inter 14px
- CTA in Signal Amber

### 4. Clinical trials

A new section introducing the trial browser. Patient-facing framing: "Find trials you may be able to join."

Content for each condition card:

- Condition name (from `content/clinical-trials/*/index.md` title)
- Plain-language description (from description field)
- Default filter shown: "Recruiting" trials
- CTA: "View trials" linking to the condition page

Current conditions:

| Condition | API subject_id |
|:----------|:---------------|
| Multiple Sclerosis | 1 |
| Alzheimer's Disease | 13 |

Design notes:

- 2-column card grid (only two conditions at launch)
- Cards should feel distinct from research area cards — consider using a Light Teal tint background to differentiate
- Lead with patient-relevant info: the description should name the disease in terms a patient understands, not in research terminology
- If feasible at launch: show a live count of recruiting trials per condition (via a lightweight React component that calls the API with `status=Recruiting`)

### 5. How it works

A three-step visual explanation of the pipeline. Rewritten from the current version to foreground the curator role.

Content:

- Step 1: "Curators define what to track" — Scientific curators provide the search queries and categories that scope each research area.
- Step 2: "AI harvests and ranks" — GregoryAI collects papers from PubMed, MedRxiv, and other databases within hours of publication. Machine learning models rank relevance.
- Step 3: "You stay informed" — Receive weekly digests tailored to the areas and conditions you follow.

Design notes:

- Horizontal 3-column layout on desktop, vertical on mobile
- Use line icons (Lucide) for each step
- Deep Teal icon colour
- Inter headings, Source Serif 4 descriptions
- Step 3 naturally leads into the newsletter section below

### 6. Trust signals

Specific numbers that demonstrate the project's track record, each with a one-line explanation of why it matters.

Content:

| Number | Label | Why it matters |
|:-------|:------|:---------------|
| 34,000+ | Articles indexed | Five years of continuous tracking since 2021 |
| 174,000+ | Authors tracked | A comprehensive map of who is working on what |
| 48 | Therapies monitored | Every major therapeutic avenue under active surveillance |
| < 24h | Paper to alert | New research surfaces within hours, not weeks |

Additional trust elements:

- "Built on Gregory-MS, tracking MS research since 2021"
- "In partnership with the Portuguese MS Society"
- "Open source — view the code on GitHub"

Design notes:

- 4-column stat grid on desktop
- Numbers in Deep Teal, large size (H1 or equivalent)
- Labels and explanations in Muted Grey, small
- Partnership mentions below the grid, centre-aligned

### 7. Scientific curators

A compact section that makes the human curation model visible on the homepage. Visitors see real institutions, not just an algorithm claim.

Content:

- Section heading: "Guided by scientific curators"
- Brief explanation (1-2 sentences): what curators do and why it matters
- Curator names and institutions as a compact horizontal list or row of cards
- Link to full curators listing at /curators/

Design notes:

- This section reinforces the "recognition of merit" value — curators are publicly credited
- Keep it compact: name + institution + link, no full bios on the homepage
- Light Teal tint background to distinguish from adjacent sections

### 8. Newsletter subscription

The subscription form with a clear multi-feed model. The visitor selects which digests they want.

Content:

- Section heading: something like "Follow the research that matters to you"
- Brief explanation: "Choose the areas you want to follow. We send one digest per week for each."
- Available feeds (checkboxes, multi-select):
	- Cell Reprogramming — weekly research digest
	- Neuroimmune Interactions — weekly research digest
	- Neuroinflammation — weekly research digest
	- Clinical Trials: Multiple Sclerosis
	- Clinical Trials: Alzheimer's Disease
- Email field
- Optional: audience self-identification (researcher / clinician / patient / other) — useful for internal KPIs but should not gate access
- Submit CTA: "Subscribe"

Design notes:

- Card-based form on Warm Sand background
- Checkboxes should be grouped into two categories: "Research digests" and "Clinical trial alerts" — this makes the model immediately clear
- The audience selector is secondary (smaller, below the feed selection)
- Signal Amber submit button

### 9. Support the project

The donate CTA. Grounded, direct, not guilt-driven.

Content direction:

- Heading: name the reality without being dramatic — something like "This project runs on donations"
- One sentence: "No ads, no paywalls, no gatekeeping. Your support keeps it that way."
- Two CTAs: "Support the project" (primary, links to /donate) and "View source code" (secondary, links to GitHub)

Design notes:

- Warm Sand background, centre-aligned
- Keep this section short — 3-4 lines max plus CTAs
- This is the last section before the footer

---

## What to remove from the current homepage

The current homepage has an "audiences" section with three cards (Researchers, Clinicians, Patients) that tells people what they already know about themselves. The research areas and clinical trials sections already serve as natural entry points for each audience. Remove this section — the routing happens through content, not labels.

---

## Technical notes

### Hugo structure

The homepage is `content/_index.md`. The current version uses inline HTML with Bootstrap classes from the Now UI Pro theme. The new version should follow the same pattern unless the implementer decides to extract sections into Hugo partials.

### React components

Clinical trial counts on the homepage (if included) require a lightweight React component that calls `https://api.gregory-ms.com/trials/?team_id=1&subject_id={id}&status=Recruiting` and renders the count. This is the same pattern used on condition pages.

### Dynamic content from Hugo

Research area cards and curator attributions should be generated dynamically using Hugo's `range` over `content/research-areas/` and `.GetPage` lookups to `content/curators/`, not hardcoded HTML. This means adding a new research area or curator automatically updates the homepage.

### Newsletter form

The form action and backend integration depend on the email service in use (the current site uses a `/subscribe` endpoint). The frontend implementation should use standard form elements with the feed selection as checkbox inputs. The exact backend integration is out of scope for this task but the form markup must support multi-select.

---

## Files to reference

| File | Purpose |
|:-----|:--------|
| `content/_index.md` | Current homepage content (to be replaced) |
| `content/research-areas/*/index.md` | Research area titles, descriptions, curator references |
| `content/curators/*/index.md` | Curator names, institutions, bios |
| `content/clinical-trials/*/index.md` | Condition titles, descriptions, API params |
| `.skills/brain-regeneration-brand/SKILL.md` | Brand quick reference |
| `.skills/brain-regeneration-brand/references/brand-spec.md` | Full brand specification |
| `hugo.toml` | Site config, taxonomies, API base URL |

---

## Acceptance criteria

- All copy follows the voice rules in the brand spec (plain language first, no banned words)
- Colours, typography, and spacing match the brand specification
- Research area cards are generated dynamically from Hugo content, not hardcoded
- Clinical trials section exists with cards for MS and Alzheimer's
- Newsletter form shows grouped feed options (research digests + trial alerts) with multi-select
- The word "champion" does not appear anywhere on the page — the term is "scientific curator"
- The page builds without errors in Hugo
- Mobile responsive (the Now UI Pro theme handles this but verify the new sections work)
