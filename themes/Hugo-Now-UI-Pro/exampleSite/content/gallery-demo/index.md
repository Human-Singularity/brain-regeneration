+++
title = "Gallery & Media Demo"
date = 2025-12-16
description = "Demonstration of gallery, carousel, and media shortcodes"
+++

# Gallery & Media Showcase

This page demonstrates the gallery, carousel, and other media shortcodes available in the Now UI Pro theme.

---

## Image Gallery

The gallery shortcode creates a responsive image gallery with lightbox functionality. Images are automatically sourced from page resources.

{{</* gallery */>}}

**Note:** This gallery uses images stored alongside this content file as page resources. To add your own gallery:

1. Create a folder in `content/` (e.g., `my-gallery/`)
2. Add `index.md` to that folder
3. Add images with names starting with `gallery-` (e.g., `gallery-1.jpg`, `gallery-2.jpg`)
4. Use the `{{</* gallery */>}}` shortcode in your content

---

## Image Carousel

The carousel shortcode creates a Bootstrap carousel slider. Images are sourced from page resources starting with "slide".

{{</* carousel title="Sample Carousel" */>}}

**To create your own carousel:**

1. Add images to your page bundle with names starting with `slide-` (e.g., `slide-1.jpg`, `slide-2.jpg`)
2. Use the `{{</* carousel */>}}` shortcode

---

## Panorama Viewer

The panorama shortcode creates a 360° panoramic viewer. Requires a panoramic image as a page resource.

{{</* panorama */>}}

**To add a panorama:**

1. Add a panoramic/360° image to your page bundle named `panorama.jpg`
2. Use the `{{</* panorama */>}}` shortcode

---

## Video Embeds

### YouTube Video

{{</* youtube id="dQw4w9WgXcQ" */>}}

### Bootstrap YouTube Embed

{{</* bootstrap/youtube id="dQw4w9WgXcQ" */>}}

---

## Media Notes

### Page Resources

Most media shortcodes in this theme use Hugo's **page resources** feature. This means:

- Create a folder for your content instead of a single `.md` file
- Add an `index.md` inside that folder
- Place your images in the same folder
- Hugo will automatically associate those images with your page

### Supported Image Formats

- JPEG/JPG
- PNG
- WebP
- GIF (for animations)
- SVG (for vector graphics)

### Image Naming Conventions

Different shortcodes look for images with specific prefixes:

- **Gallery:** `gallery-*.jpg`
- **Carousel:** `slide-*.jpg`
- **Panorama:** `panorama.jpg`
- **Header:** `header.jpg`

---

## Example Page Bundle Structure

```
content/
  my-gallery/
    index.md              # Your content file
    gallery-1.jpg         # Gallery image 1
    gallery-2.jpg         # Gallery image 2
    gallery-3.jpg         # Gallery image 3
    slide-1.jpg           # Carousel slide 1
    slide-2.jpg           # Carousel slide 2
    panorama.jpg          # Panorama image
    header.jpg            # Page header image
```

Then in your `index.md`:

```markdown
+++
title = "My Amazing Gallery"
+++

## My Gallery

{{</* gallery */>}}

## My Carousel

{{</* carousel title="My Photos" */>}}

## 360° View

{{</* panorama */>}}
```
