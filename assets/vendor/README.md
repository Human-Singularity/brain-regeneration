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

There is no build pipeline wired into `make`/Hugo for this — the files here
are static, pre-built output. If Bootstrap usage changes (a new page needs
a dropdown, modal, tooltip, etc.), regenerate both files following the
steps below rather than hand-editing the minified output.

## When to regenerate

- A template starts using a Bootstrap CSS class or JS component that isn't
  currently covered (e.g. `.dropdown`, `.modal`, `.tooltip`, `.carousel`).
- You want to bump the vendored Bootstrap version.
- You add a new page/template and aren't sure it's covered by the current
  purge — rebuilding is cheap and safe to do defensively.

**Symptom if you skip this:** the new markup will render unstyled (missing
CSS) and/or inert (no JS behavior), because the class/component was purged
out or never bundled.

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
   cat > /tmp/purgecss.config.cjs <<'EOF'
   module.exports = {
     content: [
       'public/**/*.html',
       'themes/brain-regeneration/layouts/**/*.html',
       'themes/brain-regeneration/static/js/*.js',
     ],
     css: ['assets/vendor/bootstrap.min.css'],
     safelist: {
       standard: [
         'collapsing',
         'showing',
         'hiding',
         'offcanvas-backdrop',
         'disabled',
       ],
     },
     output: '/tmp/purge-output/',
   };
   EOF
   npx --yes purgecss --config /tmp/purgecss.config.cjs
   ```

   The safelist covers Bootstrap classes that its own JS toggles at
   runtime (transition/backdrop states) and therefore never appear as a
   literal `class="..."` in any static template or built HTML — PurgeCSS
   would otherwise strip them as "unused."

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

1. Set up a scratch project and install the exact Bootstrap version this
   site vendors elsewhere (check the version banner at the top of the
   current `bootstrap.min.css`/`.js` if unsure — currently `5.3.3`):

   ```bash
   rm -rf /tmp/bs-bundle && mkdir -p /tmp/bs-bundle && cd /tmp/bs-bundle
   npm init -y
   npm install bootstrap@5.3.3 esbuild --no-audit --no-fund
   npm approve-scripts --allow-scripts-pending   # allows esbuild's postinstall to fetch its binary
   ```

2. Write an entry file that imports only the components in use:

   ```bash
   cat > entry.js <<'EOF'
   import Collapse from 'bootstrap/js/dist/collapse';
   import Offcanvas from 'bootstrap/js/dist/offcanvas';
   import Tab from 'bootstrap/js/dist/tab';

   window.bootstrap = { Collapse, Offcanvas, Tab };
   EOF
   ```

   To add a component (e.g. a future page needs a modal), add
   `import Modal from 'bootstrap/js/dist/modal';` and include it in the
   `window.bootstrap` object. Each Bootstrap component module registers its
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

## Why not just wire this into the Hugo build?

There's no Node/npm dependency in this repo's normal build (Hugo Pipes
only, per `CLAUDE.md`), and adding one solely to regenerate an
infrequently-changed vendor file didn't seem worth the added tooling
surface. If Bootstrap usage starts changing often enough that manual
regeneration becomes a chore, revisit that tradeoff — e.g. a `make
vendor-bootstrap` target that runs the steps above.
