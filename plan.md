# Mobile Feeds — Option B Implementation Plan

Branch: `mobile-version`

## Scope

All pages that render the research-papers or clinical-trials feed:

| Page | Template | JS |
|---|---|---|
| `/conditions/*/` (trials) | `conditions/single.html` | `trials-feed.js` |
| `/conditions/*/research-papers/` | `conditions/research-papers.html` → partial `research-papers-feed.html` | `ms-research-papers.js` |
| `/research-areas/*/` | `research-areas/single.html` → same partial | `ms-research-papers.js` |

**Breakpoint:** `< 992 px` (Bootstrap `lg`). Desktop layout is unchanged.

---

## What Option B looks like

On mobile, the desktop `.filter-bar` is hidden and replaced by:

1. **Persistent search bar** — sticky strip directly under the section tabs containing a text input and a `×` clear button.
2. **Active-filter token strip** — scrollable horizontal row of removable chips, visible only when at least one non-default filter is set.
3. **Floating Filters FAB** — fixed bottom-right button that opens the bottom sheet. Shows a count badge when filters are active.
4. **Filter bottom sheet** — Bootstrap 5 Offcanvas (`placement="bottom"`) with four single-select chip groups. Edits a *draft* state; commits on "Show results", discards on close/×/backdrop.
5. **Result count bar** — shown between the search bar and the first card. Updates live.
6. **Numbered pagination** — the existing desktop pager is kept; on mobile it is styled to fit small screens (compact).

---

## Files to create

### `themes/brain-regeneration/static/css/feeds-mobile.css`

New stylesheet, loaded only once (via `head.html`). Contains **all** mobile-specific styles under a single `@media (max-width: 991.98px)` block (plus a few layout rules that work at all widths).

Sections to write:

- **Hide desktop filter bar on mobile** — `.filter-bar { display: none; }` inside the breakpoint.
- **Mobile search bar** (`.mobile-feeds-bar`) — sticky, `top: 56px` (below the nav), `z-index: 90`, sand background, full-width input with teal focus ring, `×` clear button.
- **Filter token strip** (`.filter-tokens`) — `display: flex; gap: 8px; overflow-x: auto; padding: 0 16px 8px; -webkit-overflow-scrolling: touch;`. Each token (`.filter-token`) is a pill chip with a `×` remove button (44 × 44 px tap area).  `+ Filters` chip (`.token-add-filters`) opens the offcanvas.
- **Floating FAB** (`.filter-fab`) — `position: fixed; bottom: 24px; right: 20px; z-index: 200`. Amber pill with inline gear SVG. Count badge (`.fab-count`) is a 20 px circle, teal background, white text; `hidden` when count is 0.
- **Bottom sheet** — override Bootstrap's `.offcanvas-bottom` for the filter sheet: max-height 75 vh, `border-radius: 20px 20px 0 0`, grab handle (pseudo-element), scrollable body.
- **Sheet chip groups** (`.sheet-group`, `.sheet-group-label`, `.sheet-chips`, `.sheet-chip`) — chip rows inside the sheet. Active chip: teal bg, white text. Non-active: tint bg, primary text. 44 px min-height.
- **Sheet footer** (`.sheet-footer`) — sticky to bottom of sheet, two buttons: "Reset" (outline-teal) + "Show results" (btn-amber), side by side.
- **Result count bar** (`.mobile-result-count`) — small teal-muted label above card list on mobile.
- **Card adjustments on mobile** — `.paper-card { padding: 16px; }`, card title font-size 16px, authors font-size 12px. `.trial-card { padding: 16px; }`.
- **Pagination on mobile** — hide first/last buttons, reduce button size to 36 px, clamp page number display to current ±1 + last (already handled in JS).
- **Accessibility** — `.visually-hidden` (matches Bootstrap's utility), `prefers-reduced-motion` rule to skip the offcanvas slide.

---

## Files to modify

### 1. `themes/brain-regeneration/layouts/partials/head.html`

**Change:** Add one `<link>` tag after the existing `main.css` line:

```html
<link rel="stylesheet" href="{{ "css/feeds-mobile.css" | relURL }}">
```

---

### 2. `themes/brain-regeneration/layouts/partials/research-papers-feed.html`

**Goals:** wrap the desktop filter bar so it is hidden on mobile; inject the mobile search bar, token strip, offcanvas sheet, and FAB right after it.

**Changes:**

a. Wrap the existing `<div class="filter-bar" id="papers-filters">` block in:
   ```html
   <div class="d-none d-lg-block">
     <!-- existing filter-bar div unchanged -->
   </div>
   ```

b. After that wrapper, and before the category-description panel, insert the mobile block (visible only `d-lg-none`):

```html
<!-- ── MOBILE SEARCH + TOKENS (< lg) ── -->
<div class="mobile-feeds-bar d-lg-none" id="papers-mobile-bar">
  <div class="container">
    <div class="mobile-search-wrap">
      <label for="papers-mobile-search" class="visually-hidden">Search papers</label>
      <input type="text" class="form-control" id="papers-mobile-search" placeholder="Search papers…" autocomplete="off">
      <button type="button" class="mobile-search-clear" id="papers-mobile-clear" hidden aria-label="Clear search">
        <!-- inline × SVG -->
      </button>
    </div>
    <div class="filter-tokens" id="papers-filter-tokens" hidden>
      <!-- populated by JS -->
    </div>
  </div>
</div>

<!-- ── MOBILE FILTER BOTTOM SHEET (Bootstrap Offcanvas) ── -->
<div class="offcanvas offcanvas-bottom filter-sheet d-lg-none"
     tabindex="-1"
     id="papers-filter-sheet"
     role="dialog"
     aria-modal="true"
     aria-label="Filter papers">
  <div class="offcanvas-header">
    <h5 class="offcanvas-title">Filters</h5>
    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
  </div>
  <div class="offcanvas-body">
    <div class="sheet-group">
      <div class="sheet-group-label">Category</div>
      <div class="sheet-chips" id="papers-sheet-category">
        <button type="button" class="sheet-chip active" data-value="">All categories</button>
        <!-- additional chips populated by JS from categories data -->
      </div>
    </div>
    <div class="sheet-group">
      <div class="sheet-group-label">Intersect with</div>
      <div class="sheet-chips" id="papers-sheet-subjects">
        <button type="button" class="sheet-chip active" data-value="">All subjects</button>
        <!-- populated by JS from the same subject list as the desktop select -->
      </div>
    </div>
    <div class="sheet-group">
      <div class="sheet-group-label">Sort by</div>
      <div class="sheet-chips" id="papers-sheet-sort">
        <button type="button" class="sheet-chip active" data-value="date">Newest first</button>
        <button type="button" class="sheet-chip" data-value="relevance">AI relevance</button>
      </div>
    </div>
    <div class="sheet-group">
      <div class="sheet-group-label">Show</div>
      <div class="sheet-chips" id="papers-sheet-show">
        <button type="button" class="sheet-chip active" data-value="true">Relevant papers</button>
        <button type="button" class="sheet-chip" data-value="false">Full feed</button>
        <button type="button" class="sheet-chip" data-value="has_clinical_trials_true">With clinical trials</button>
        <button type="button" class="sheet-chip" data-value="has_clinical_trials_false">Without clinical trials</button>
      </div>
    </div>
  </div>
  <div class="sheet-footer">
    <button type="button" class="btn-outline-teal" id="papers-sheet-reset">Reset</button>
    <button type="button" class="btn-amber" id="papers-sheet-apply">Show results</button>
  </div>
</div>

<!-- ── MOBILE FAB ── -->
<button type="button" class="filter-fab d-lg-none" id="papers-filter-fab"
        data-bs-toggle="offcanvas"
        data-bs-target="#papers-filter-sheet"
        aria-controls="papers-filter-sheet"
        aria-label="Open filters">
  <!-- inline gear/filter SVG (Lucide sliders) -->
  Filters
  <span class="fab-count" id="papers-fab-count" hidden>0</span>
</button>
```

The sheet's Category and Subjects chip lists need data from the Hugo template. Pass the same `$categories` / `$categoryGroups` data that is already available in the partial into JS-readable `data-*` attributes on `#papers-mobile-bar` (e.g., `data-categories` and `data-subjects` mirroring what `#papers-list` already has). The Subjects list is static HTML chips generated with the same Hugo range loops used for the desktop `<select>`.

---

### 3. `themes/brain-regeneration/layouts/conditions/single.html`

**Goals:** same mobile pattern for the clinical-trials feed.

**Changes:**

a. Wrap the existing `<div class="filter-bar" id="trials-filters">` in `<div class="d-none d-lg-block">…</div>`.

b. After that wrapper, add the mobile trials block (visible `d-lg-none`):

```html
<!-- ── MOBILE SEARCH + TOKENS (< lg) ── -->
<div class="mobile-feeds-bar d-lg-none" id="trials-mobile-bar">
  <div class="container">
    <div class="mobile-search-wrap">
      <label for="trials-mobile-search" class="visually-hidden">Search trials</label>
      <input type="text" class="form-control" id="trials-mobile-search" placeholder="Search trials…" autocomplete="off">
      <button type="button" class="mobile-search-clear" id="trials-mobile-clear" hidden aria-label="Clear search">
        <!-- × SVG -->
      </button>
    </div>
    <div class="filter-tokens" id="trials-filter-tokens" hidden>
      <!-- populated by JS -->
    </div>
  </div>
</div>

<!-- ── MOBILE FILTER BOTTOM SHEET ── -->
<div class="offcanvas offcanvas-bottom filter-sheet d-lg-none"
     tabindex="-1"
     id="trials-filter-sheet"
     role="dialog"
     aria-modal="true"
     aria-label="Filter clinical trials">
  <div class="offcanvas-header">
    <h5 class="offcanvas-title">Filters</h5>
    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
  </div>
  <div class="offcanvas-body">
    <div class="sheet-group">
      <div class="sheet-group-label">Phase</div>
      <div class="sheet-chips" id="trials-sheet-phase">
        <button type="button" class="sheet-chip active" data-value="">All phases</button>
        <button type="button" class="sheet-chip" data-value="PHASE1">Phase 1</button>
        <button type="button" class="sheet-chip" data-value="PHASE2">Phase 2</button>
        <button type="button" class="sheet-chip" data-value="PHASE3">Phase 3</button>
        <button type="button" class="sheet-chip" data-value="PHASE4">Phase 4</button>
      </div>
    </div>
    <div class="sheet-group">
      <div class="sheet-group-label">Status</div>
      <div class="sheet-chips" id="trials-sheet-status">
        <button type="button" class="sheet-chip active" data-value="">All statuses</button>
        <button type="button" class="sheet-chip" data-value="RECRUITING">Recruiting</button>
        <button type="button" class="sheet-chip" data-value="ACTIVE_NOT_RECRUITING">Active, not recruiting</button>
        <button type="button" class="sheet-chip" data-value="NOT_YET_RECRUITING">Not yet recruiting</button>
        <button type="button" class="sheet-chip" data-value="COMPLETED">Completed</button>
      </div>
    </div>
    <div class="sheet-group">
      <div class="sheet-group-label">Sort by</div>
      <div class="sheet-chips" id="trials-sheet-sort">
        <button type="button" class="sheet-chip active" data-value="-discovery_date">Date added (newest)</button>
        <button type="button" class="sheet-chip" data-value="discovery_date">Date added (oldest)</button>
        <button type="button" class="sheet-chip" data-value="-published_date">Published (newest)</button>
        <button type="button" class="sheet-chip" data-value="published_date">Published (oldest)</button>
      </div>
    </div>
    <div class="sheet-group">
      <div class="sheet-group-label">Show</div>
      <div class="sheet-chips" id="trials-sheet-show">
        <button type="button" class="sheet-chip active" data-value="">All trials</button>
        <button type="button" class="sheet-chip" data-value="has_results">With results posted</button>
      </div>
    </div>
  </div>
  <div class="sheet-footer">
    <button type="button" class="btn-outline-teal" id="trials-sheet-reset">Reset</button>
    <button type="button" class="btn-amber" id="trials-sheet-apply">Show results</button>
  </div>
</div>

<!-- ── MOBILE FAB ── -->
<button type="button" class="filter-fab d-lg-none" id="trials-filter-fab"
        data-bs-toggle="offcanvas"
        data-bs-target="#trials-filter-sheet"
        aria-controls="trials-filter-sheet"
        aria-label="Open filters">
  Filters
  <span class="fab-count" id="trials-fab-count" hidden>0</span>
</button>
```

---

### 4. `themes/brain-regeneration/static/js/ms-research-papers.js`

**Approach:** Add a self-contained mobile module section at the end of the IIFE, after existing event listeners. It reads the mobile DOM elements, syncs with the same `state` object, and calls the same `fetchPage()` / `renderCards()` functions the desktop code already uses. No core logic is duplicated.

**Functions to add:**

#### `initMobile()`
Called during init (after `populateCategorySelect()`). Wires:

- `#papers-mobile-search` → debounced input handler (200 ms) that sets `state.keyword`, resets `state.page = 1`, calls `fetchPage(1, false)`, updates clear button visibility.
- `#papers-mobile-clear` → clears `state.keyword`, restores full feed.
- `#papers-sheet-category` chips → set `mobileSheetDraft.category` (not state directly).
- `#papers-sheet-subjects` chips → set `mobileSheetDraft.subjects`.
- `#papers-sheet-sort` chips → set `mobileSheetDraft.sort`.
- `#papers-sheet-show` chips → set `mobileSheetDraft.show` string.
- `#papers-sheet-apply` → commit draft to `state`, reset `state.page = 1`, call `fetchPage(1, false)`, close offcanvas via `bootstrap.Offcanvas.getInstance()`, call `renderTokens()`.
- `#papers-sheet-reset` → reset draft to defaults, update chip active states.
- Offcanvas `show.bs.offcanvas` event → sync draft from current state before opening (so chips reflect live filters).

#### `renderTokens()`
Called after every state change. Reads `state.{category, subjects, sort, relevant, hasClinicalTrials}` and builds the token strip HTML. Each token has a `data-filter` attribute (`category`, `subjects`, `sort`, `show`) and an `×` button. Sets `#papers-filter-tokens` `hidden` when strip would be empty. Also calls `updateFabCount()`.

Token labels:
- `category` → category name from `state.categories`
- `subjects` → subject name from the same subject list used by the desktop select
- `sort` → "AI relevance" (only non-default, i.e. not `date`)
- `show` → "Full feed" / "With clinical trials" / "Without clinical trials" (only non-default)

Token removal handler: attached via delegation on `#papers-filter-tokens`, reverts the relevant state field to default, calls `fetchPage(1, false)`, calls `renderTokens()`.

#### `updateFabCount()`
Counts non-default state fields (category, subjects, sort !== 'date', relevant !== requireRelevant or hasClinicalTrials set). Updates `#papers-fab-count` text and `hidden` attribute.

#### `populateMobileSubjectChips()`
Called from `initMobile()`. Reads the same condition/research-area pages that the desktop select uses (passed via a `data-subjects` JSON attribute on `#papers-mobile-bar`), generates `.sheet-chip` buttons inside `#papers-sheet-subjects`.

#### `populateMobileCategoryChips()`
Called from `initMobile()` after `populateCategorySelect()`. Iterates `state.categories` / `state.categoryGroups` and generates `.sheet-chip` buttons inside `#papers-sheet-category`.

**Note on coordination with `syncUIFromState()`:** After popstate or reset, call `renderTokens()` and sync mobile search input to `state.keyword`.

---

### 5. `themes/brain-regeneration/static/js/trials-feed.js`

Same pattern as above, scoped to trials IDs.

**Functions to add:**

#### `initMobileTrials()`
- Wire `#trials-mobile-search` → debounced, sets `state.keyword`, `state.page = 1`, fetch.
- Wire `#trials-mobile-clear`.
- Sheet chips for `#trials-sheet-phase`, `#trials-sheet-status`, `#trials-sheet-sort`, `#trials-sheet-show` → update `trialsMobileDraft`.
- `#trials-sheet-apply` → commit draft, fetch, close offcanvas, render tokens.
- `#trials-sheet-reset` → reset draft.
- Offcanvas `show` event → sync draft from state.

#### `renderTrialsTokens()`
Reads `state.{keyword, phase, status, sort, hasResults}`. Builds token strip in `#trials-filter-tokens`. Calls `updateTrialsFabCount()`.

Token labels:
- `phase` → e.g., "Phase 2"
- `status` → human-readable label from `STATUS_MAP`
- `sort` → only non-default (not `-discovery_date`)
- `hasResults` → "With results"

#### `updateTrialsFabCount()`
Counts non-default fields, updates `#trials-fab-count`.

---

## Implementation order

1. `feeds-mobile.css` — write full CSS first so markup can be tested visually.
2. `head.html` — one-line change to load the stylesheet.
3. `research-papers-feed.html` — wrap desktop bar, add mobile HTML.
4. `conditions/single.html` — wrap desktop bar, add mobile HTML.
5. `ms-research-papers.js` — add mobile module.
6. `trials-feed.js` — add mobile module.
7. Manual test with `make hugo-dev` at `< 992 px` viewport:
   - Search, token strip, FAB count, sheet open/close/commit/discard, reset.
   - Keyboard: tab through search, FAB, sheet controls; Esc closes sheet.
   - Pagination visible and functional.
   - Desktop layout at `≥ 992 px` unchanged.

---

## Not in scope for this branch

- Desktop layout changes.
- Country filter on mobile (the desktop trials filter has a free-text country field; omitted from the mobile sheet as it fits poorly in chip format — carry to backlog).
- Download CSV on mobile (the desktop download dropdown is in the hidden filter bar; can be added to the sheet footer in a follow-up).
- White-on-bright-amber FAB contrast (pre-existing, site-wide a11y debt; recorded in the handover as a separate design-system review).
