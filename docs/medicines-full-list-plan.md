# Medicines tab: every medicine for a condition, filterable by category

Follow-up to the Medicines tab (frontend PR #68). Written 2026-10-26 against GregoryAi `main` after PRs #960–#962 and frontend `8b51896`.

## Backend change

The API now returns every medicine EMA approved for the condition, whether or not an editor filed it under a category. Categories are a curated layer on top: an unfiled medicine has `categories: []`.

Decisions (settled):

- The tab lists every EMA-approved medicine for the condition, with or without a category.
- The category dropdown stays; picking a category shows only medicines filed under it.
- One medicine sold under several names (Exelon, Prometax, Rivastigmine Sandoz) shows once. Copies are hidden by default, behind the generics toggle.
- Diagnostics (Vizamyl, DaTSCAN) are never listed.
- RSS on the tab is the new per-condition feed.
- Readers see no "untracked" label; a medicine with no category simply has no category chips.

## New API fields

`/medicines/` rows: `tracked`, `subjects` (`[{id, subject_name, subject_slug, matched_on}]`), `grouped_under` (lead product id, or `null`).
`/medicines/{id}/`: `grouped_products` (`[{id, name, url}]`) on a lead product.
`include_generics=true` now also returns duplicates. `subject_id` alone matches a category of that condition or EMA's approval for it. New `tracked=true|false` filter (not needed here).

## Frontend changes (done)

1. Wording: hero descriptions drop "we track"; empty state reads "No centrally authorised medicines for {condition} yet."; toggle reads "Show generics, biosimilars and duplicate brands"; sheet group reads "Generics, biosimilars and duplicates".
2. Duplicates: a copy's card shows "Same medicine as {lead}" (looked up in `state.products`); a lead's history panel shows "Also authorised as: …" from `grouped_products`, no extra request.
3. RSS: on `layout: medicines` pages the dropdown offers `{apiBase}/feed/sites/3/medicines/subject/{feed_slug}/`. The category feed from `medicines-feed.js` stays. Don't hide the link when the feed is empty (only new events plus the last 90 days of EMA history).
4. Category dropdown: unchanged. A category arriving via `?category=` stays selected even when disabled and shows the category empty state.

## Done when

- Alzheimer's lists its 8 medicines under "All categories".
- MS lists 27, including Plegridy, Rebif and Avonex with no chips; picking Ocrelizumab shows only Ocrevus and narrows the timeline.
- Toggle off: Exelon shows, Prometax doesn't; Exelon's history lists "Also authorised as: Prometax, …". Toggle on: Prometax shows "Same medicine as Exelon".
- RSS dropdown offers the per-condition feed (plus the category feed when one is selected).
- Parkinson's renders its empty state cleanly until the backend fix below.
- Mobile: the renamed toggle and labels fit the bottom sheet.

## Optional (only if asked): one page for all conditions

Same script with `site_id=3` instead of `subject_id`; category dropdown built from loaded rows' `categories`; condition filter from rows' `subjects`; timeline `/medicines/events/?site_id=3`; RSS links the three per-condition feeds (not `/feed/sites/3/medicines/`, which is curated).

## Backend notes for Bruno (not frontend work)

1. **Parkinson's has no medicines** (`/medicines/?subject_id=14` returns 0). Likely `ema_therapeutic_areas` is unset in prod: set it to `Parkinson Disease`, then run `match_medicines --subject 14` (expect about 20).
2. **Three malaria medicines show under MS** (Artesunate Amivas, Eurartesim, Garsun) via the Dihydroartemisinin category (id 91). Probably hand links; check in the admin and remove if unwanted.
3. **Alzheimer's categories**: every Alzheimer's medicine is unfiled until categories exist. Seeding lecanemab, donanemab, memantine and rivastigmine files Leqembi, Kisunla, Ebixa / Memantine Merz and Exelon and enables those dropdown options.
