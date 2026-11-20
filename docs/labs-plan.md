# Labs: a new section for brain-regeneration.com

Handover for the brain-regeneration.com frontend (`Human-Singularity/brain-regeneration`). Copy this file into the frontend repo as `docs/labs-plan.md` before starting.

Written 2026-11-20, against GregoryAi `main` after PRs #993 to #998 (all merged and deployed), and checked against the live API the same day.

## What's new

GregoryAi now groups researchers into **labs**. A lab is a senior author (the **head**) plus the people who repeatedly publish with them (the **members**). Each lab is linked to the subjects and categories it publishes in, with counts of its papers there.

That gives the site three things it couldn't show before:

1. **A Labs directory:** every research group working on the conditions this site covers, searchable and filterable.
2. **A page per lab:** who leads it, where it is, who works there, and what it works on.
3. **Labs on existing pages:** "which labs work on this?" on condition and research-area pages, and "which lab is this person in?" on author pages.

All of it is live on `https://api.brain-regeneration.com` now. **No backend work is needed to start.**

## What the API gives you

Full reference: GregoryAi's `docs/03-api-and-rss-feeds.md`, section "Labs". The OpenAPI schema at `/api/schema/` has every field.

### `GET /labs/`: the directory

Paginated like the other endpoints (`count`, `next`, `previous`, `results`). Pages hold **10 labs**, and there is no page-size parameter.

| Parameter | Use it for |
|:----------|:-----------|
| `subject_id` | Labs working on a condition or subject, such as `1` for MS or `13` for Alzheimer's |
| `category_id` | Labs working on a category, such as a treatment or a research topic |
| `search` | Free text over the lab's name, its head's name and its institution's name |
| `country` | Two-letter country code of the institution, such as `DE` |
| `author_id` | The lab one author heads or belongs to |
| `min_recent_articles` | Hide labs that went quiet on the chosen topic (needs `subject_id` or `category_id`) |
| `ordering` | `name` (default), `articles`, `relevant_articles`, `recent_articles` or `member_count`, with `-` for descending |

**The rule that will trip you up:** `ordering=articles`, `relevant_articles` or `recent_articles` rank by a lab's papers **in one topic**, so they need `subject_id` or `category_id`. Without one, the API returns 400:

```json
{"ordering": "Ordering by relevant_articles requires subject_id or category_id."}
```

An unknown `ordering` value is also a 400 here, unlike the other endpoints, which ignore it.

### `GET /labs/{id}/`: one lab

The same object as in the list. A lab the site can't show returns 404.

```json
{
  "id": 606,
  "name": "Tjalf Ziemssen lab",
  "curated": false,
  "head": {"author_id": 388525, "full_name": "Tjalf Ziemssen", "orcid": "0000-0001-8799-8202"},
  "institution": {"name": "University Hospital Carl Gustav Carus", "country_code": "DE", "openalex_id": "I4210162051", "ror": "04za5zm41"},
  "member_count": 43,
  "members": [{"author_id": 185213, "full_name": "Hernan Inojosa", "orcid": "0000-0002-1377-836X"}],
  "subjects": [{"id": 1, "name": "Multiple Sclerosis", "articles": 184, "relevant_articles": 0, "recent_articles": 139, "latest_article_year": 2026}],
  "categories": [{"id": 6, "name": "Ocrelizumab", "slug": "ocrelizumab", "articles": 23, "relevant_articles": 0, "recent_articles": 18, "latest_article_year": 2026}],
  "topics_last_changed": "2026-11-20T14:30:35Z"
}
```

What each field means for display:

- **`name`** is never blank. Most labs have no curated name yet, so it reads "<head's name> lab".
- **`curated`**: `true` means a person named or corrected the lab; `false` means GregoryAi grouped it automatically from authorship data. Most labs are `false` today. See "Editorial choices" below.
- **`head`** and **`institution`** can be `null`. `orcid` and the institution IDs can be `null`.
- **`members`** lists people with the member role, most shared papers with the head first. The head isn't repeated in it, and collaborators (people with only one paper with the head) are never listed. Lists can be long: lab 606 has 43 members.
- **`member_count`** can be lower than `members.length`, because duplicate author records of one person count once in it. Show `member_count` as the headline number, and the list as it comes.
- **`subjects`** and **`categories`** are already ranked: most relevant papers first, then most papers. Each carries:
  - `articles`: papers in that topic by the head or a member.
  - `relevant_articles`: those marked relevant by an editor or by the AI models.
  - `recent_articles`: papers from the start of 2022 onwards. The window moves each January and includes ahead-of-print papers.
  - `latest_article_year`.
- **`topics_last_changed`**: when the counts last changed. They are refreshed twice a day.

### `?include=lab` on authors: "which lab is this person in?"

Add `include=lab` to the author calls you already make:

```
GET /authors/?orcid=0000-0001-8799-8202&include=lab
```

Each author then carries:

```json
"lab": {"id": 606, "name": "Tjalf Ziemssen lab", "role": "head", "head": {"author_id": 388525, "full_name": "Tjalf Ziemssen"}}
```

- `role` is `head` or `member`.
- `lab` is `null` for collaborators and for authors in no lab.
- Without `include=lab`, the key isn't there at all. Existing calls are unchanged until you add it.
- It works on `/authors/`, `/authors/{id}/` and `/authors/search/`, but never in CSV output.

## Live numbers (2026-11-20)

| Call | Labs |
|:-----|-----:|
| `/labs/` | 2,639 |
| `/labs/?subject_id=1` (Multiple Sclerosis) | 2,617 |
| `/labs/?subject_id=13` (Alzheimer's Disease) | 68 |
| `/labs/?subject_id=14` (Parkinson's Disease) | 0 |

Response sizes are small: about 12 KB for an unfiltered page and 22 KB for a filtered page of 10, in about 0.3 s.

Almost every lab works on MS, because GregoryAi's corpus is MS-heavy. On an MS page, a **category** filter is what makes the list useful.

## Suggested pages

These are suggestions. Shape them as you see fit.

### 1. `/labs/`: directory

- **Search box:** `search`.
- **Filters:** condition (`subject_id`), research topic (`category_id`) and country (`country`).
- **Sort options:** name, size (`-member_count`), and, once a condition or topic is chosen, most papers (`-articles`) and most active recently (`-recent_articles`).
- **Card:** name, head, institution and country, member count, and the first two or three entries of `categories` as chips.
- **Paging:** 10 per page, following `next`.

### 2. `/labs/{id}/`: lab page

- **Header:** name, head (linked to their author page when they have an ORCID iD), institution and country.
- **Research focus:** the subjects and categories with `articles` and `recent_articles`, as bars or a ranked list.
- **Team:** the members, each linked to their author page when they have an ORCID iD. Collapse after about 12.
- **Links out:** the head's papers on the site (the existing author page), and the institution's ROR record (`https://ror.org/{ror}`) when present.
- **SEO:** the author pages get their meta tags from a Cloudflare Pages Function (`functions/authors/[orcid].js`). A `functions/labs/[id].js` built the same way would give lab pages proper titles and descriptions.

### 3. Labs on existing pages

- **Condition and research-area pages:** a "Labs working on this" block calling `/labs/?subject_id={id}&ordering=-articles`, or `category_id` for a category page. Show the top 5 with a link to the filtered directory.
- **Author pages:** add `include=lab` to the existing `/authors/?orcid=` call. Show "Head of …" or "Member of …", linking to the lab page. Show nothing when `lab` is `null`.

## Things to know before building

- **Sort by `-articles`, not `-relevant_articles`, for now.** Relevance marks are sparse: in the Alzheimer's list every lab has `relevant_articles: 0`. The API's ordering is a single field, with ties broken by lab ID, so `-relevant_articles` there gives an essentially arbitrary order. If you need "relevant, then papers" as one ranking, ask the backend; it's a small change.
- **Lab IDs aren't permanent.** A lab can disappear when its head stops qualifying, or when an editor merges two labs. Its old ID then returns 404. Handle 404 on the lab page with a friendly "This lab is no longer listed" and a link to the directory. Don't put lab URLs in the sitemap yet; there is no lab sitemap on the backend.
- **Author pages need an ORCID iD.** The site's author URLs are `/authors/{orcid}/`, and some members have `orcid: null`. Show those as plain names.
- **Visibility is already handled.** The API only returns labs, topics and counts that brain-regeneration.com's scope covers. Never filter by team or site yourself.
- **Caching:** counts change at most twice a day, so the same 2-hour localStorage cache the medicines tab uses (`brMedicines:`) is fine here, under its own prefix.
- **No feed and no CSV** for labs yet.

## Editorial choices for the team

The backend leaves these to you:

1. **Computed labs:** most labs are computed groupings, not curated ones. Should the page say so, for example with a small "Grouped automatically from publication data" note when `curated` is `false`? The backend exposes `curated` so you can.
2. **Wording:** "Lab", "Research group" or "Team"?
3. **Empty conditions:** Parkinson's has no labs yet. Hide the block there, or show an empty state?
4. **Navigation:** does Labs get a top-level menu entry, or does it live under Research?

## Questions for the backend

Send these to Bruno:

- A combined "relevant, then papers" ordering, if you want it.
- A lab sitemap, if lab pages should be indexed.
- A lab RSS feed.
