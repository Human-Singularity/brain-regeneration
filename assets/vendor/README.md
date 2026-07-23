# Vendored Bootstrap (trimmed build)

`bootstrap.min.css` and `bootstrap.min.js` in this directory are **not** the
stock Bootstrap downloads. They are custom-trimmed builds containing only
what this site actually uses:

- **CSS**: grid/layout, utilities, navbar, offcanvas, forms, and the handful
  of other Bootstrap components referenced across the theme — everything
  else has been purged.
- **JS**: only the `Collapse`, `Offcanvas`, and `Tab` components (used for
  the mobile navbar toggle, the mobile filter sheets on conditions/research
  pages, and the tabs on the communication-tools page). Modal, Dropdown,
  Tooltip, Popover, Carousel, ScrollSpy, Toast, and the Popper dependency
  are intentionally excluded.

This cut the vendored payload from ~293KB to ~72KB raw by removing ~95%
unused CSS and ~45% unused JS that a stock Bootstrap build would ship.

These files are static, pre-built output — nothing regenerates them during a
Hugo or Cloudflare Pages build (see [Why this isn't in the Hugo
build](#why-this-isnt-in-the-hugo-build)). If Bootstrap usage changes (a new
page needs a dropdown, modal, tooltip, etc.), regenerate both files rather
than hand-editing the minified output:

```bash
make vendor-bootstrap
```

That target runs the whole procedure documented below — build, purge, bundle,
leak-check — and reports the size change. Review `git diff assets/vendor/`,
then **verify in a browser** (see [Verification](#verification)) before
committing. The manual steps are kept below so the pipeline stays auditable
and debuggable when something looks wrong.

A companion target guards against the silent-failure mode:

```bash
make check-bootstrap
```

This fails if any template or theme script references a Bootstrap component
that isn't in the bundle. `make vendor-bootstrap` runs it first, and CI runs
it on every PR/push that touches `themes/brain-regeneration/layouts/`,
`themes/brain-regeneration/static/js/`, or `content/`
(`.github/workflows/check-bootstrap-usage.yml`) — so a PR adding an
uncovered component fails before merge, not after someone notices the site
looks broken.

## When to regenerate

- A template starts using a Bootstrap CSS class or JS component that isn't
  currently covered (e.g. `.dropdown`, `.modal`, `.tooltip`, `.carousel`).
- You want to bump the vendored Bootstrap version.
- You add a new page/template and aren't sure it's covered by the current
  purge — rebuilding is cheap and safe to do defensively.

**Symptom if you skip this:** the new markup will render unstyled (missing
CSS) and/or inert (no JS behavior), because the class/component was purged
out or never bundled. Nothing errors — Hugo builds, Pages deploys, and the
breakage only shows up in a browser. `make check-bootstrap` exists to turn
that silent failure into a build-time one, but it only knows about
`data-bs-toggle="…"` attributes and `bootstrap.Foo` API calls; a purged *CSS
class* with no JS counterpart (e.g. `.carousel` styling) will still slip
through, which is why the browser check below isn't optional.

## Prerequisites

- `node` + `npx` (any reasonably recent Node — this was built with Node 22+)
- `hugo` (matching the pinned version in `CLAUDE.md`, currently `0.164.0`)
- A full production build of the site, so the purge step scans real output:

  ```bash
  hugo --minify -D
  ```

  (`-D` includes drafts/future content so the purge sees every page type —
  conditions, research-areas, news, articles, search, subscribe,
  communication-tools, etc. Don't skip this; a partial build risks purging
  classes that only appear on pages you didn't render.)

## Regenerating `bootstrap.min.css`

1. Build the site first (see Prerequisites) so `public/` is fresh.
2. Run PurgeCSS against the built HTML, the theme's Go templates (as a
   backstop for any page type not present in this particular build), and
   the JS files that inject classes dynamically at runtime (feed rendering,
   article rendering, etc.):

   ```bash
   npx --yes purgecss --config scripts/purgecss.config.cjs
   ```

   The config lives at [`scripts/purgecss.config.cjs`](../../scripts/purgecss.config.cjs)
   and writes to `/tmp/purge-output/`. Two things in it are load-bearing:

   - The `themes/.../static/js/*.js` content glob. The feed and article
     scripts build markup at runtime, so their class names appear in no
     template and in no built HTML. Drop that glob and the feeds render
     unstyled.
   - The safelist, which covers classes Bootstrap's own JS toggles at
     runtime (transition/backdrop states). These never appear as a literal
     `class="..."` anywhere, so PurgeCSS would strip them as "unused."

3. Sanity-check the output before replacing anything:

   ```bash
   wc -c /tmp/purge-output/bootstrap.min.css assets/vendor/bootstrap.min.css
   gzip -9 -c /tmp/purge-output/bootstrap.min.css | wc -c
   ```

   If the purged file is *larger* than expected relative to the original,
   or suspiciously tiny, something about the content globs is wrong —
   investigate before proceeding.

4. Replace the vendored file:

   ```bash
   cp /tmp/purge-output/bootstrap.min.css assets/vendor/bootstrap.min.css
   ```

5. Rebuild (`hugo --minify -D`) and **visually verify in a browser** — see
   [Verification](#verification) below. Don't skip this: PurgeCSS purges
   based on class-name matching, not semantic understanding, so a class
   used only inside a rarely-hit conditional partial can be missed if it
   wasn't present in the scanned content.

## Regenerating `bootstrap.min.js`

Only the modules actually used should be bundled. Currently that's
`Collapse`, `Offcanvas`, and `Tab`. If a new component is needed, add its
import to the entry file below.

1. Set up a scratch project and install the pinned Bootstrap version. The
   version lives in the `BS_VERSION` variable in the `Makefile` (currently
   `5.3.3`) — bump it there, not here, so `make vendor-bootstrap` and these
   instructions can't disagree:

   ```bash
   rm -rf /tmp/bs-bundle && mkdir -p /tmp/bs-bundle && cd /tmp/bs-bundle
   npm init -y
   npm install bootstrap@5.3.3 esbuild --no-audit --no-fund
   ```

   On some npm versions esbuild's postinstall is blocked from fetching its
   binary; if the bundle step then fails, run
   `npm approve-scripts --allow-scripts-pending` and reinstall.

2. Copy in the entry file, which imports only the components in use:

   ```bash
   cp /path/to/repo/scripts/bootstrap-entry.js entry.js
   ```

   It lives at [`scripts/bootstrap-entry.js`](../../scripts/bootstrap-entry.js).
   To add a component (e.g. a future page needs a modal), add
   `import Modal from 'bootstrap/js/dist/modal';` there and include it in the
   `window.bootstrap` object — and widen the allow-lists in
   [`scripts/check-bootstrap-usage.sh`](../../scripts/check-bootstrap-usage.sh)
   to match, or the guard will reject the markup that needs it. Each
   Bootstrap component module registers its
   own `data-bs-toggle="..."` delegated event listeners at import time, so
   no extra wiring is needed beyond importing it.

3. Bundle and minify:

   ```bash
   node_modules/.bin/esbuild entry.js --bundle --minify --format=iife --target=es2018 --outfile=bootstrap.min.js
   ```

4. Confirm no unused-component code leaked in (Popper, Modal, Tooltip,
   Dropdown, Carousel, ScrollSpy, Toast should all be absent unless you
   just added one of them on purpose):

   ```bash
   grep -o "Popper\|createPopper\|Modal\|Tooltip\|Dropdown\|Carousel\|ScrollSpy\|Toast" bootstrap.min.js | sort -u
   ```

5. Copy it into the repo and rebuild:

   ```bash
   cp bootstrap.min.js /path/to/repo/assets/vendor/bootstrap.min.js
   ```

## Verification

After regenerating either file, rebuild and check in an actual browser —
don't rely on Hugo/PurgeCSS/esbuild exiting cleanly as proof it works.

```bash
hugo --minify -D
cd public && python3 -m http.server 8811
```

At minimum, click through:

- **Mobile navbar toggle** (resize to a mobile viewport, click the
  hamburger button in `themes/brain-regeneration/layouts/partials/nav.html`)
  — the `#mainNav` collapse should show/hide.
- **Mobile filter offcanvas** on a conditions/research-area/search page
  (the "Filters" button on narrow viewports) — the sheet should slide up
  and the category chips should be interactive.
- **Tabs** on `/communication-tools/` (or wherever `data-bs-toggle="tab"`
  is used) — switching tabs should show/hide the right pane.
- Check the browser console for JS errors and confirm no visibly unstyled
  elements (broken grid, missing button/form styling, etc.) on a few
  representative page types: homepage, a condition page, the subscribe
  form, and the curators/supporters list pages.

If a real click in your test tooling doesn't seem to register on the first
attempt, try again once before assuming something's broken — this has been
observed as flaky in at least one browser-automation harness with the
*stock*, unmodified Bootstrap JS too, i.e. it's not specific to the trimmed
build.

## Why this isn't in the Hugo build

`make vendor-bootstrap` is a local, on-demand convenience. It is deliberately
*not* part of the Cloudflare Pages build, and shouldn't become one:

- The production build is pure Hugo (Hugo Pipes only, per `CLAUDE.md`) with
  no Node/npm dependency. Wiring this in would add one to every deploy —
  including the nightly cron rebuild in
  `.github/workflows/nightly-rebuild.yml` — to regenerate a file that changes
  maybe twice a year.
- Purging is class-name matching, not semantic understanding. A bad purge
  produces a *successful build* that renders a broken site. On an unattended
  cron deploy there is no human to catch it. Keeping regeneration manual
  means the output always arrives as a reviewable diff with a browser check
  behind it.

The tradeoff worth revisiting is the version bump, not the purge: if
Bootstrap upgrades become frequent, a scheduled job that opens a PR with the
regenerated files (rather than deploying them directly) would preserve the
review step while removing the chore.
