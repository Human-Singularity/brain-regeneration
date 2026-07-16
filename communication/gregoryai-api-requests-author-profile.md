# GregoryAI API improvement requests — author profile page

Raised while building the `/authors/{ORCID}/` researcher profile page in the
frontend (`themes/brain-regeneration/static/js/author-profile.js`). None of
these block the page from working — they're listed so the backend team can
prioritise closing the gaps.

## 1. Lookup by ORCID

There's no way to fetch an author record by ORCID directly. The page has to
call `GET /authors/?search={orcid}&format=json` and filter the results
client-side for an exact `ORCID` match. This is fragile (relies on `search`
matching the ORCID string at all, and on the list serializer including the
`ORCID` field per result — unverified).

**Ask:** `GET /authors/?orcid={orcid}` (exact-match filter) or
`GET /authors/by-orcid/{orcid}/`.

## 2. Institutional affiliation

`/authors/{id}/` has `country` (nullable, frequently null in practice) but no
affiliation/institution string. The design calls for a line like "IRCCS San
Raffaele Scientific Institute · Milan, Italy" under the author's name — we
currently only show `country` when present, and omit the line otherwise.

**Ask:** an `affiliation` (or `institution`) field, even if it has to be
curated/curator-entered rather than derived.

## 3. "Tracked since" date

No field indicates when an author started being tracked. The page derives an
approximation (`earliestYear`) from the `published_date` of a sampled window
of the author's articles (see #5), which is not the same thing and is biased
toward the wrong direction when the sample is truncated (older papers may
exist beyond the fetched page).

**Ask:** a `first_tracked_date` (or similar) field on the author record.

## 4. Topics/subjects + matched categories breakdown per author

No endpoint returns "this author's subjects, with per-subject category
(drug/treatment) counts." The page currently derives this by fetching the
author's articles and aggregating `subjects` + `team_categories` client-side.

**Ask:** something like `GET /authors/{id}/subjects/` returning subject name,
paper count, and matched category counts, precomputed server-side.

## 5. Frequent collaborators

No endpoint for "this author's most frequent co-authors." The page derives a
top-8 list by counting co-author appearances across the author's own fetched
articles — capped at 500 papers (5 pages of `page_size=100`) for performance.
For prolific authors this is a sample, not the true top collaborators across
their whole body of work, and the page shows a note to that effect when the
fetch was capped. We also don't have institution data for collaborators (see
#2), so the sidebar only shows a shared-paper count, not an institution line
as in the original design mockup.

**Ask:** `GET /authors/{id}/collaborators/` returning ranked co-authors
(name, shared paper count, affiliation if available) computed server-side
across the author's full article set.

## 6. ORCID on embedded article authors

Whether the `authors` array embedded in `/articles/{id}/` (and
`/articles/?author_id=`) responses includes each author's `ORCID` is
unverified — outbound access to the live API wasn't available in the session
that built this. If it's missing, author names in the article view can't be
linked to their profile page (`article-single.js`'s `formatAuthorsLinked`
already degrades gracefully to plain, unlinked text when `ORCID` isn't
present on an author entry — no visual link, no error, no broken link).

**Ask:** confirm/add `ORCID` to the author objects nested inside article
responses, not just the standalone `/authors/{id}/` endpoint.
