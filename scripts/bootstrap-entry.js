// esbuild entry point for assets/vendor/bootstrap.min.js.
// Run via `make vendor-bootstrap`; see assets/vendor/README.md for context.
//
// Only the components the site actually uses are imported. Each component
// module registers its own data-bs-toggle delegated listeners at import time,
// so importing it is all the wiring needed.
//
// Adding a component here means also widening ALLOWED_TOGGLE / ALLOWED_API in
// scripts/check-bootstrap-usage.sh, or the guard will reject the markup that
// needs it.
import Collapse from 'bootstrap/js/dist/collapse';
import Offcanvas from 'bootstrap/js/dist/offcanvas';
import Tab from 'bootstrap/js/dist/tab';

window.bootstrap = { Collapse, Offcanvas, Tab };
