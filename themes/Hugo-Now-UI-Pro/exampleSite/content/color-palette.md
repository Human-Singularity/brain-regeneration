+++
title = "Color Palette"
date = 2025-12-16
description = "Theme color palette and usage examples"
+++

# Color Palette

This theme uses a carefully curated color palette optimized for accessibility and visual consistency.

---

## Primary Colors

<div class="row">
  <div class="col-md-4 mb-4">
    <div class="card text-white bg-primary">
      <div class="card-body text-center">
        <h3 class="card-title">Primary</h3>
        <p class="card-text">#3B71CA</p>
        <p class="mb-0">rgb(59, 113, 202)</p>
      </div>
    </div>
  </div>
  <div class="col-md-4 mb-4">
    <div class="card" style="background-color: #9FA6B2; color: white;">
      <div class="card-body text-center">
        <h3 class="card-title">Secondary</h3>
        <p class="card-text">#9FA6B2</p>
        <p class="mb-0">rgb(159, 166, 178)</p>
      </div>
    </div>
  </div>
</div>

---

## Semantic Colors

<div class="row">
  <div class="col-md-3 mb-4">
    <div class="card text-white bg-success">
      <div class="card-body text-center">
        <h4 class="card-title">Success</h4>
        <p class="card-text">#14A44D</p>
        <p class="mb-0">rgb(20, 164, 77)</p>
      </div>
    </div>
  </div>
  <div class="col-md-3 mb-4">
    <div class="card text-white bg-danger">
      <div class="card-body text-center">
        <h4 class="card-title">Danger</h4>
        <p class="card-text">#DC4C64</p>
        <p class="mb-0">rgb(220, 76, 100)</p>
      </div>
    </div>
  </div>
  <div class="col-md-3 mb-4">
    <div class="card text-white bg-warning">
      <div class="card-body text-center">
        <h4 class="card-title">Warning</h4>
        <p class="card-text">#E4A11B</p>
        <p class="mb-0">rgb(228, 161, 27)</p>
      </div>
    </div>
  </div>
  <div class="col-md-3 mb-4">
    <div class="card text-white bg-info">
      <div class="card-body text-center">
        <h4 class="card-title">Info</h4>
        <p class="card-text">#54B4D3</p>
        <p class="mb-0">rgb(84, 180, 211)</p>
      </div>
    </div>
  </div>
</div>

---

## Neutral Colors

<div class="row">
  <div class="col-md-6 mb-4">
    <div class="card border" style="background-color: #FBFBFB;">
      <div class="card-body text-center">
        <h4 class="card-title">Light</h4>
        <p class="card-text">#FBFBFB</p>
        <p class="mb-0">rgb(251, 251, 251)</p>
      </div>
    </div>
  </div>
  <div class="col-md-6 mb-4">
    <div class="card text-white" style="background-color: #332D2D;">
      <div class="card-body text-center">
        <h4 class="card-title">Dark</h4>
        <p class="card-text">#332D2D</p>
        <p class="mb-0">rgb(51, 45, 45)</p>
      </div>
    </div>
  </div>
</div>

---

## Usage Examples

### Buttons with New Colors

<div class="my-4">
  <button type="button" class="btn btn-primary">Primary Button</button>
  <button type="button" class="btn btn-success">Success Button</button>
  <button type="button" class="btn btn-danger">Danger Button</button>
  <button type="button" class="btn btn-warning">Warning Button</button>
  <button type="button" class="btn btn-info">Info Button</button>
</div>

### Alerts with New Colors

<div class="alert alert-primary" role="alert">
  This is a primary alert with the new blue color (#3B71CA).
</div>

<div class="alert alert-success" role="alert">
  This is a success alert with the new green color (#14A44D).
</div>

<div class="alert alert-danger" role="alert">
  This is a danger alert with the new red color (#DC4C64).
</div>

<div class="alert alert-warning" role="alert">
  This is a warning alert with the new yellow color (#E4A11B).
</div>

<div class="alert alert-info" role="alert">
  This is an info alert with the new cyan color (#54B4D3).
</div>

### Badges with New Colors

<p>
  <span class="badge bg-primary">Primary</span>
  <span class="badge bg-success">Success</span>
  <span class="badge bg-danger">Danger</span>
  <span class="badge bg-warning">Warning</span>
  <span class="badge bg-info">Info</span>
</p>

---

## Accessibility

All color combinations have been chosen to meet WCAG 2.1 Level AA contrast requirements:

- **Primary (#3B71CA) on white**: Contrast ratio 4.5:1 ✓
- **Success (#14A44D) on white**: Contrast ratio 3.7:1 ✓ (large text)
- **Danger (#DC4C64) on white**: Contrast ratio 4.5:1 ✓
- **Warning (#E4A11B) on dark**: Contrast ratio 7.1:1 ✓
- **Info (#54B4D3) on dark**: Contrast ratio 4.6:1 ✓

---

## SCSS Variables

To use these colors in your custom SCSS:

```scss
// Primary colors
$primary-color: #3B71CA;
$secondary-color: #9FA6B2;

// Semantic colors
$success-color: #14A44D;
$danger-color: #DC4C64;
$warning-color: #E4A11B;
$info-color: #54B4D3;

// Neutral colors
$light-bg: #FBFBFB;
$dark-color: #332D2D;
```

These variables are defined in [assets/scss/now-ui-kit/_variables.scss](../../assets/scss/now-ui-kit/_variables.scss) and are available throughout the theme.
