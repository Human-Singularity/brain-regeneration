---
name: add-condition-research-section
description: Add the "Research Papers" section/tab to a condition page in the Brain Regeneration Observatory (Hugo site). Use when asked to add research papers, a papers feed, or a second tab to a condition (e.g. Alzheimer's, Parkinson's) that currently only has Clinical Trials.
license: MIT
---

# Add a Research Papers section to a condition

## Model

Each entry under `content/conditions/<slug>/` has (at most) two section "tabs",
rendered by two different theme templates that both live under the same URL branch:

1. **Clinical Trials** — the condition's own `_index.md` (`layout: single`,
   `themes/brain-regeneration/layouts/conditions/single.html`). Always exists.
2. **Research Papers** — an optional child leaf bundle
   `content/conditions/<slug>/research-papers/index.md` (`layout: research-papers`,
   `themes/brain-regeneration/layouts/conditions/research-papers.html`).

`single.html` looks for a sibling page with `Params.layout == "research-papers"`
(`{{ where .Pages "Params.layout" "research-papers" }}`) to decide what to render
in the tab bar:

- **Found** → renders a working "Research Papers" tab linking to it.
- **Not found** → renders a disabled tab with a "Coming soon" badge.

So adding the section is purely a **content** change (one new file) — no template
or JS changes are needed. If a condition is missing this leaf bundle, its Clinical
Trials page will show the "Research Papers" tab as "Coming soon".

## Steps

1. **Get the GregoryAi `subject_id`.** This is a backend (GregoryAi) concept, not
   something invented on the frontend. Reuse the **same** `subject_id` and
   `team_id` already set in the condition's `_index.md` under `api:` — the papers
   feed and the trials feed for a condition query the same subject. Don't guess a
   new id; if you don't already have it from `_index.md`, that's a GregoryAi
   question, not a Hugo one.

2. **Create the leaf bundle**, copying the shape of the MS one:

   ```bash
   mkdir -p content/conditions/<slug>/research-papers
   ```

   `content/conditions/<slug>/research-papers/index.md`:

   ```yaml
   ---
   title: "<Condition Title>"
   layout: research-papers
   date: <YYYY-MM-DD>
   draft: false
   subscribe: true
   list_id: <same list_id as the condition's _index.md, or a dedicated one>
   subscribe_description: "Weekly digest of new <condition> research and recruiting clinical trials."

   description: "<one-line patient-facing description, can mirror _index.md>"

   hero_description: "<one- or two-sentence description of what the papers below cover>"

   api:
     endpoint: "https://api.brain-regeneration.com/articles/"
     team_id: 1                # same team_id as _index.md
     subject_id: <same subject_id as _index.md>

   # Optional — defaults to true (ML/curator-relevant papers only). Set to
   # false to show the full unfiltered feed by default for this condition.
   require_relevant: false

   # Optional — only include if you have known GregoryAi category ids to group
   # (e.g. named drugs/treatments). Omit entirely if none apply; the feed still
   # works without it, it just won't have a populated category filter.
   category_groups:
     - label: "<Group label>"
       categories:
         - id: <category id>
           name: "<Category name>"
   ---

   <One short paragraph of body copy shown above the papers listing —
   see content/conditions/multiple-sclerosis/research-papers/index.md for tone.>
   ```

   Note the endpoint is `/articles/`, not `/trials/` (that's the key difference
   from the parent `_index.md`).

3. **Nothing else to touch.** `single.html`'s tab-detection is automatic once the
   sibling page exists; `research-papers.html` renders the hero/tabs/newsletter
   and delegates the actual feed UI to the `research-papers-feed` partial and
   `js/research-feed.js` (both shared, no per-condition code).

4. **Verify.**
   - `make hugo-dev` (or `make hugo-dev-local` if testing without live API
     access) and open `/conditions/<slug>/clinical-trials/` — the "Research
     Papers" tab should now be a working link, not "Coming soon".
   - Open the Research Papers page itself and confirm papers load. If the feed
     stays empty, check the `subject_id`/`team_id` values and clear
     `localStorage` (feeds cache aggressively under `brPapers:` — see
     `br-utils.js` `makeCache`) before assuming the data is wrong.
   - If nothing loads and the network tab shows requests to the wrong host,
     check the rendered `data-*` attributes on `#papers-list` in
     `research-papers-feed.html` — the JS ignores `hugo.toml`'s `apiBase` and
     only reads these attributes (falls back to a hard-coded prod URL).

## Gotchas

- By default the papers feed shows only ML/curator-relevant articles
  (`requireRelevant` defaults to `true` in `research-papers-feed.html`). Set
  `require_relevant: false` in the page's frontmatter to show the full feed by
  default instead — `conditions/research-papers.html` reads this param and
  passes it through to the partial.
- `category_groups` category **ids** must already exist in GregoryAi for that
  `team_id`/`subject_id` — don't invent ids. If unsure what categories exist,
  that's a GregoryAi backend question.
- Keep `list_id` consistent with whatever newsletter list is intended — reusing
  the condition's own `list_id` is normal (see MS: both files use `list_id: 1`).
- This pattern is specific to the **conditions** section. `research-areas/`
  pages currently only have `research-papers` single-view layouts already
  merged into their `single.html` (no separate tab), so don't assume the same
  two-file split applies there — check
  `themes/brain-regeneration/layouts/research-areas/` before extending that
  section the same way.
