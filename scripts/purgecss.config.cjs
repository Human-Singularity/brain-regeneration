// PurgeCSS config for regenerating assets/vendor/bootstrap.min.css.
// Run via `make vendor-bootstrap`; see assets/vendor/README.md for context.
module.exports = {
	content: [
		// The built site — the primary source of truth for classes in use.
		'public/**/*.html',
		// Go templates, as a backstop for page types absent from this build.
		'themes/brain-regeneration/layouts/**/*.html',
		// Feed/article scripts build markup at runtime, so their class names
		// never appear in any template or in public/. Without this glob the
		// feeds render unstyled.
		'themes/brain-regeneration/static/js/*.js',
	],
	css: ['assets/vendor/bootstrap.min.css'],
	safelist: {
		// Classes Bootstrap's own JS toggles at runtime. They appear in no
		// static markup, so PurgeCSS would otherwise strip them as unused.
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
