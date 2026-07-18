#!/bin/sh
# Fail if the theme uses a Bootstrap component that isn't in the trimmed bundle.
#
# assets/vendor/bootstrap.min.js ships only Collapse, Offcanvas, and Tab (see
# assets/vendor/README.md). Using any other component is a *silent* failure:
# Hugo builds fine, Cloudflare Pages deploys fine, and the markup just renders
# inert in the browser. This catches it at build time instead.
#
# Fix a failure by regenerating the bundle (`make vendor-bootstrap`) after
# adding the component to scripts/bootstrap-entry.js — not by deleting the
# markup that tripped this check.

set -eu

THEME=themes/brain-regeneration

# data-bs-toggle values covered by the bundled components.
ALLOWED_TOGGLE='collapse|offcanvas|tab'
# Constructors exposed on window.bootstrap by scripts/bootstrap-entry.js.
ALLOWED_API='Collapse|Offcanvas|Tab'

status=0

# 1. Declarative use: data-bs-toggle="..." in templates and content.
#    `tab` also covers data-bs-toggle="pill", which Bootstrap's Tab handles.
toggles=$(grep -rhoE 'data-bs-toggle="[a-z]+"' "$THEME/layouts" content 2>/dev/null \
	| sed -E 's/.*"(.*)"/\1/' \
	| grep -vxE "$ALLOWED_TOGGLE|pill" \
	| sort -u || true)

if [ -n "$toggles" ]; then
	status=1
	echo "✗ data-bs-toggle values not in the trimmed Bootstrap bundle:"
	for t in $toggles; do
		echo "    $t"
		grep -rnE "data-bs-toggle=\"$t\"" "$THEME/layouts" content 2>/dev/null | sed 's/^/      /'
	done
fi

# 2. Programmatic use: bootstrap.Foo in the theme's JS. Scoped to static/js so
#    Hugo template variables like $bootstrap.RelPermalink don't false-positive.
api=$(grep -rhoE '\bbootstrap\.[A-Z][a-zA-Z]*' "$THEME/static/js" 2>/dev/null \
	| sed 's/^bootstrap\.//' \
	| grep -vxE "$ALLOWED_API" \
	| sort -u || true)

if [ -n "$api" ]; then
	status=1
	echo "✗ bootstrap.* components not in the trimmed Bootstrap bundle:"
	for c in $api; do
		echo "    $c"
		grep -rnE "\bbootstrap\.$c\b" "$THEME/static/js" 2>/dev/null | sed 's/^/      /'
	done
fi

if [ "$status" -ne 0 ]; then
	echo ""
	echo "  The trimmed bundle ships only: Collapse, Offcanvas, Tab."
	echo "  To add a component, see assets/vendor/README.md and run 'make vendor-bootstrap'."
	exit 1
fi

echo "✓ Bootstrap usage is covered by the trimmed bundle (Collapse, Offcanvas, Tab)"
