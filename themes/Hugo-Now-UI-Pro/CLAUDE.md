# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hugo Now UI Pro is a Hugo theme based on Creative Tim's Now UI Pro design. It's a Bootstrap-based theme with extensive customization options, rich content shortcodes, and multilingual support (currently English and Portuguese).

**Key Information:**
- Hugo theme (min version 0.83)
- Bootstrap-based responsive design
- Uses SCSS for styling, compiled at build time
- Built-in shortcodes for rich media (galleries, carousels, panoramas, YouTube embeds)
- Supports multiple content types: blog posts, stories, episodes, authors, Instagram content
- Includes Disqus comments and multiple analytics integrations

## Development Commands

### Build and Serve

```bash
# Run the example site locally
cd exampleSite
hugo server --themesDir ../..

# Clean build (removes generated resources)
hugo mod clean --all
cd exampleSite && hugo --themesDir ../.. && cd ..

# Production build
cd exampleSite && hugo --themesDir ../.. -e production && cd ..
```

### Testing

The theme uses the example site in `exampleSite/` for testing and demonstration. After making changes:

```bash
# Verify theme builds without errors
cd exampleSite && hugo --themesDir ../.. && cd ..

# Check for broken references and missing files
# Manual verification: inspect the generated HTML output
```

## Architecture

### Directory Structure

- **`layouts/`** - Hugo layout templates
  - `_default/` - Default templates (baseof.html, list.html, single.html, etc.)
  - `partials/` - Reusable template components (header, footer, pagination, comments)
  - `shortcodes/` - Custom shortcodes for rich content
  - Content-specific folders: `authors/`, `episodes/`, `instagram/`, `unlisted/`

- **`assets/`** - Static assets compiled during build
  - `css/` - Bootstrap and utility stylesheets
  - `scss/` - SCSS source files (compiled to CSS)
  - `js/` - JavaScript libraries and utilities
  - `fontawesome-free-*` - Font Awesome icon libraries
  - `webfonts/` - Font files

- **`static/`** - Files copied directly to output
  - `images/` - Theme demo images
  - `fonts/` - Custom font files (nucleo icons)
  - `plugins/` - Third-party plugins
  - `svgs/` - SVG graphics

- **`archetypes/`** - Content scaffolds for `hugo new` command
  - `default.md` - Standard page
  - `post.md` - Blog post
  - `page.md` - Static page
  - `story.md` - Story collection
  - `episodes.md` - Episode/podcast content
  - `authors.md` - Author profiles
  - `instagram.md` - Instagram embed content

- **`i18n/`** - Internationalization strings
  - `en.json` - English translations
  - `pt.json` - Portuguese translations

- **`exampleSite/`** - Demo site using the theme
  - `config.toml` - Theme configuration examples

### Key Layout Files

#### `baseof.html` (`layouts/_default/baseof.html`)
Master template that:
- Manages CSS/SCSS compilation (Bootstrap + Now UI custom styles)
- Conditionally loads YouTube, Vimeo, Spotify embeds based on shortcode usage
- Sets up OpenGraph and Twitter Card metadata
- Loads Google Analytics, Google Tag Manager, and Umami analytics
- Includes language switcher for multilingual support

#### `index.html` (`layouts/_default/index.html`)
Homepage layout that displays blog posts and stories.

#### Partials
- `header-full.html`, `header-small.html`, `header-image.html` - Various header styles
- `footer.html` - Site footer
- `pagination.html` - Post/list pagination
- `comments-js.html` - Disqus comment integration
- `language-icons.html` - Multilingual switcher

### Custom Shortcodes

Located in `layouts/shortcodes/`, these enable rich content:

- **Media:**
  - `gallery.html` - Photo gallery with lightbox
  - `carousel.html` - Image carousel/slider
  - `panorama.html` - 360° panoramic viewer
  - `youtube.html` - YouTube video embed
  - `image.html`, `image-floatleft.html`, `image-floatright.html`, `image-fullwidth.html`, `image-sidebyside.html` - Image display variants
  - `aside.html` - Aside/pullquote boxes

- **Content Organization:**
  - `archives-*.html` - Archive pages by tags/categories/stories
  - `showpage*.html` - Display specific pages/posts
  - `blog-*.html` - Blog post card layouts
  - `story-card.html` - Story card displays

- **Custom:**
  - `bootstrap/` - Bootstrap component wrappers
  - `custom/` - Custom HTML insertion
  - `copyright.html` - Copyright notice
  - `now-highlight.html` - Code highlighting with syntax
  - `recordings-iscsp.html` - Recording player

### Styling System

**SCSS Compilation:**
- Main stylesheet: `assets/scss/now-ui-kit.scss`
- Compiled with Hugo's `toCSS` function (compressed output, source maps disabled)
- All CSS is fingerprinted for cache busting

**CSS Pipeline:**
```
Bootstrap 4.6 + Now UI custom SCSS → Font Awesome 5.x → Montserrat font → Single compiled CSS file
```

**Typography:**
- Primary font: Montserrat (loaded from assets)
- Icons: Font Awesome 5.9 and 5.15.4 (two versions available)
- Nucleo icon font (custom font file in static/fonts/)

### Content Types

Configured via taxonomy in `exampleSite/config.toml`:

- **Posts** - Blog posts (permalink: `/post/:slug/`)
- **Stories** - Multi-section content narratives (permalink: `/:sections/:slug/`)
- **Episodes** - Podcast/video episodes
- **Authors** - Author profiles
- **Categories & Tags** - Taxonomies for organization
- **Instagram** - Instagram embed posts

### Multilingual Support

Configured in `config.toml`:
- Default language: English (`en`)
- Additional supported: Portuguese (`pt`) - currently disabled in example
- Strings localized via `i18n/` JSON files
- Template access: `{{ i18n "translation_key" }}`

### Analytics & Integrations

Configured via `config.toml` parameters:
- **Google Analytics** - `googleAnalytics` parameter
- **Google Tag Manager** - `googleTagManager` parameter
- **Umami Analytics** - `params.umami` configuration
- **Disqus Comments** - `disqusShortname` parameter
- **Algolia Search** - `algoliaapikey`, `algoliaappid`, `algoliaindex` parameters
- **Google Maps API** - `params.apis.googlemaps` parameter
- **Social Integration** - Facebook app ID, social links

## Common Development Tasks

### Adding a New Shortcode

1. Create `layouts/shortcodes/myshortcode.html`
2. Access parameters: `{{ .Get "param_name" }}`
3. Access page resources: `{{ .Page.Resources.Match "pattern" }}`
4. In content: `{{< myshortcode param1="value" >}}` or `{{< myshortcode param1="value" >}}content{{< /myshortcode >}}`

### Adding Translations

1. Edit `i18n/en.json` and `i18n/pt.json`
2. Add new object: `{ "id": "key_name", "translation": "Text here" }`
3. In templates: `{{ i18n "key_name" }}`

### Modifying Styles

1. Edit SCSS files in `assets/scss/`
2. Bootstrap variables can be overridden before import
3. Changes compile automatically on `hugo server`
4. For production, `toCSS` uses compressed output

### Adding New Content Type

1. Create archetype: `archetypes/mytype.md`
2. Add to taxonomies in `config.toml` if needed
3. Create layout: `layouts/mytype/single.html` (for single pages)
4. Update `config.toml` permalinks if custom URL structure needed

## Configuration Notes

- **Theme detection:** Theme name must match: `theme = ["NowUI-Pro"]` (case-sensitive, folder name is `Hugo-Now-UI-Pro` but theme ID is `NowUI-Pro`)
- **Timeout:** Set to 20000ms for large sites with many resources (SCSS compilation can be slow)
- **Image optimization:** Configured with Lanczos resampling at 85% quality, smart crop enabled
- **Markup:** Uses Goldmark markdown with syntax highlighting (Monokai style)
- **Resources:** Hugo generates compiled assets in `exampleSite/resources/_gen/` (git-ignored, regenerated on build)

## Performance Considerations

- CSS is minified and fingerprinted for cache busting
- Images use lazy loading (`loading="lazy"`)
- Resources are preloaded for critical fonts
- SCSS compilation happens at build time, not runtime
- JavaScript is modular and loaded conditionally based on shortcode usage
