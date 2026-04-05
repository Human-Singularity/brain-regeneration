# Content Architecture

## Overview

Brain-regeneration.com organises its content across three primary domains — research areas, clinical trials, and the people behind the curation — supported by utility pages for subscription, donation, and project transparency. The content model is designed so that adding a new research area, condition, or curator automatically surfaces that content across the site without editing templates.

---

## Content sections

### Homepage `/`

The entry point for all audiences. It answers "what is this?" in one view and routes visitors toward the two primary content types: research areas (for those following science) and clinical trials (for those looking to enrol). It also makes the newsletter model explicit — multiple targeted feeds, not one generic list.

The homepage does not try to identify or address audience types by name. The routing happens through the content itself.

Files: `content/_index.md`

---

### Research areas `/research-areas/`

The scientific core of the site. Each research area is a curator-led domain that tracks a specific branch of brain regeneration science. The section listing page at `/research-areas/` gives an overview; each individual page goes deep.

**Section listing** (`/research-areas/`) — index of all research areas with curator attributions and descriptions. Entry point for visitors coming from the homepage cards or navigation.

**Individual area pages** — one page per research area, each structured with: intro body text, linked disease conditions, key concept glossary (curator-provided), a compact curator card, a live research feed (React), and optionally the search methodology.

Current research areas:

| Page | URL | Curator |
|:-----|:----|:--------|
| Cell Reprogramming | `/research-areas/cell-reprogramming/` | REGENERAR |
| Neuroimmune Interactions | `/research-areas/neuroimmune-interactions/` | LPJ Lab |
| Neuroinflammation | `/research-areas/neuroinflammation/` | Institute for CNS, Blood and Peripheral Inflammation |

Files: `content/research-areas/*/index.md`

---

### Clinical trials `/clinical-trials/`

Organised by disease condition, not by research discipline. The primary audience is patients and caregivers looking for trials they may be able to join. Data is fetched at runtime from the GregoryAI API — the pages themselves are shells with API parameters in frontmatter.

**Section listing** (`/clinical-trials/`) — intro to the trial browser with condition cards. Default filter: recruiting trials only.

**Condition pages** — one page per disease condition. Each shows a plain-language description of the condition and a React component that fetches and renders matching trials from the API.

Current conditions:

| Page | URL | API subject_id |
|:-----|:----|:--------------|
| Multiple Sclerosis | `/clinical-trials/multiple-sclerosis/` | 1 |
| Alzheimer's Disease | `/clinical-trials/alzheimers/` | 13 |

Files: `content/clinical-trials/*/index.md`

---

### Scientific curators `/curators/`

The people and institutions behind the curation. This section makes the human layer of the site visible and credible. Curator pages are linked from research area pages and referenced on the homepage.

**Section listing** (`/curators/`) — index of all curators with compact cards.

**Individual curator pages** — full profile: name, institution, lead researcher, bio, website, research area links, and commitment scope.

Current curators:

| Page | URL | Research area |
|:-----|:----|:--------------|
| REGENERAR | `/curators/regenerar/` | Cell Reprogramming |
| LPJ Lab | `/curators/lpj-lab/` | Neuroimmune Interactions |
| Institute for CNS, Blood and Peripheral Inflammation | `/curators/institute-cns-inflammation/` | Neuroinflammation |

Files: `content/curators/*/index.md`

---

### Subscribe `/subscribe/`

The newsletter subscription page. Visitors choose which feeds they want — research digests per area, or clinical trial alerts per condition. This page expands the newsletter form on the homepage into a standalone destination for direct links from emails, social posts, and research area pages.

Available feeds at launch:

- Cell Reprogramming — weekly research digest
- Neuroimmune Interactions — weekly research digest
- Neuroinflammation — weekly research digest
- Clinical Trials: Multiple Sclerosis
- Clinical Trials: Alzheimer's Disease

Status: page not yet created. Content needed.

---

### Donate `/donate/`

The support page. Direct, not guilt-driven. Names the reality (donor-funded, volunteer-run, no ads, no paywalls) and offers one clear path to contribute. Secondary CTA links to the GitHub repository for those who prefer to contribute code or visibility.

Status: page not yet created. Content needed.

---

### About `/about/`

Project transparency. Covers: what this project is, how GregoryAI works, the relationship with Gregory-MS and the Portuguese MS Society, the open-source model, and who is involved. This is where the "how it works" detail lives beyond the three-step homepage summary.

Possible sub-pages depending on scope:
- `/about/gregory-ai/` — technical explanation of the AI pipeline
- `/about/partners/` — the Portuguese MS Society and other institutional relationships

Status: page not yet created. Content needed.

---

## Sitemap

```
/
├── research/
│   ├── cell-reprogramming/
│   ├── neuroimmune-interactions/
│   └── neuroinflammation/
├── clinical-trials/
│   ├── multiple-sclerosis/
│   └── alzheimers/
├── curators/
│   ├── regenerar/
│   ├── lpj-lab/
│   └── institute-cns-inflammation/
├── subscribe/
├── donate/
└── about/
    ├── gregory-ai/         (optional)
    └── partners/           (optional)
```



---

## Navigation

### Primary navigation

The primary nav sits in the top bar and covers the two main content domains plus a direct path to subscription. It stays minimal — five items maximum.

| Label | URL | Notes |
|:------|:----|:------|
| Research Areas | `/research/` | Leads to the science |
| Clinical Trials | `/clinical-trials/` | Leads to the patient-facing content |
| Scientific Curators | `/curators/` | Makes the human curation layer discoverable |
| Subscribe | `/subscribe/` | High-value conversion action, earns a top-nav slot |

The "About" section and "Donate" are not primary nav items. They are important but secondary — visitors who need them will find them in the footer or through contextual CTAs on the homepage.

### Utility / secondary navigation

A slim utility bar or right-aligned cluster within the primary nav:

| Label | URL | Notes |
|:------|:----|:------|
| Support the project | `/donate/` | Soft, not aggressive — text link style, not a button |

### Footer navigation

The footer carries everything that matters but does not need prime real estate.

Column 1 — Explore:
- Research Areas `/research/`
- Clinical Trials `/clinical-trials/`
- Scientific Curators `/curators/`

Column 2 — Project:
- About `/about/`
- How it works `/about/gregory-ai/`
- Open source (external GitHub link)

Column 3 — Stay connected:
- Subscribe `/subscribe/`
- Support the project `/donate/`

Below the columns: copyright line, link to privacy policy, link to GitHub.

---

## Hugo menu configuration

To implement the primary navigation above, add this to `hugo.toml`:

```toml
[[menus.main]]
name = "Research Areas"
url = "/research-areas/"
weight = 1

[[menus.main]]
name = "Clinical Trials"
url = "/clinical-trials/"
weight = 2

[[menus.main]]
name = "Scientific Curators"
url = "/curators/"
weight = 3

[[menus.main]]
name = "Subscribe"
url = "/subscribe/"
weight = 4

[[menus.footer]]
name = "About"
url = "/about/"
weight = 1

[[menus.footer]]
name = "Open source"
url = "https://github.com/Human-Singularity/brain-regeneration"
weight = 2

[[menus.footer]]
name = "Subscribe"
url = "/subscribe/"
weight = 3

[[menus.footer]]
name = "Support the project"
url = "/donate/"
weight = 4
```

---

## Pages still needed

These pages are referenced in the task documents and sitemap but have no content files yet:

| Page | Priority | Notes |
|:-----|:---------|:------|
| `/subscribe/` | High — referenced from every research area page and the homepage | Needs multi-feed form |
| `/donate/` | High — referenced from homepage support section | Short, direct copy |
| `/about/` | Medium — trust signal for new visitors | Covers project origins, GregoryAI, partners |
