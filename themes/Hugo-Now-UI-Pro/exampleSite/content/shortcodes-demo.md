+++
title = "Shortcodes Demo"
date = 2025-12-16
description = "Comprehensive demonstration of all available shortcodes in the Now UI Pro Hugo theme"
+++

# Shortcodes Demo

This page demonstrates all the custom shortcodes available in the Now UI Pro theme.

---

## Image Shortcodes

### Standard Image

{{</* image src="https://picsum.photos/800/400" alt="Demo image" */>}}

### Full Width Image

{{</* image-fullwidth src="https://picsum.photos/1200/400" alt="Full width demo" */>}}

### Float Left Image

{{</* image-floatleft src="https://picsum.photos/300/200" alt="Float left" */>}}

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

<div style="clear:both"></div>

### Float Right Image

{{</* image-floatright src="https://picsum.photos/300/200" alt="Float right" */>}}

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

<div style="clear:both"></div>

---

## Video Shortcodes

### YouTube Embed

{{</* youtube id="dQw4w9WgXcQ" */>}}

---

## Code Highlighting

### Now Highlight Shortcode

{{</* now-highlight lang="javascript" */>}}
function greet(name) {
  console.log(`Hello, ${name}!`);
  return `Welcome to Now UI Pro`;
}

const result = greet('World');
console.log(result);
{{</* /now-highlight */>}}

{{</* now-highlight lang="python" */>}}
def fibonacci(n):
    """Generate Fibonacci sequence up to n terms"""
    a, b = 0, 1
    for _ in range(n):
        print(a, end=' ')
        a, b = b, a + b

fibonacci(10)
{{</* /now-highlight */>}}

---

## Content Organization Shortcodes

### Aside / Pullquote

{{</* aside */>}}
This is an important aside or pullquote that stands out from the main content. Perfect for highlighting key information or quotes.
{{</* /aside */>}}

### Table of Contents

{{</* toc */>}}

---

## Text Shortcode

{{</* text */>}}
This is custom text content that can be styled differently from regular markdown content.
{{</* /text */>}}

---

## Copyright

{{</* copyright */>}}

---

## Notes

- The carousel, gallery, and panorama shortcodes require page resources (images in the same directory as the content file)
- To use these, create a page bundle with images
- Example structure:
  ```
  content/
    my-gallery/
      index.md
      image1.jpg
      image2.jpg
      image3.jpg
  ```
